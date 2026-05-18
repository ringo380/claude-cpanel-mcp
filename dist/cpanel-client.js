import axios from 'axios';
import https from 'node:https';
export class CPanelError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'CPanelError';
    }
}
export class CPHulkLockoutError extends CPanelError {
    constructor(host, detail) {
        super(`cPHulk brute-force protection has locked this account or IP at ${host}. ` +
            `File a support ticket with your hosting provider to unblock — do NOT retry, ` +
            `repeated attempts extend the lockout window. Detail: ${detail}`, 'CPHULK_LOCKOUT');
        this.name = 'CPHulkLockoutError';
    }
}
export class CPanelAuthError extends CPanelError {
    constructor(detail) {
        super(`cPanel authentication failed: ${detail}. Verify CPANEL_USER and CPANEL_API_KEY. ` +
            `If credentials are correct, you may have triggered cPHulk — check for a lockout email.`, 'AUTH_FAILED');
        this.name = 'CPanelAuthError';
    }
}
export class CPanelUapiError extends CPanelError {
    errors;
    constructor(message, errors) {
        super(message, 'UAPI_ERROR');
        this.errors = errors;
        this.name = 'CPanelUapiError';
    }
}
/**
 * Param keys whose values must never appear in a request URL — cPanel logs the
 * full request line (including query string) to /usr/local/cpanel/logs/access_log.
 * Any call carrying one of these keys is auto-routed via POST with a
 * form-encoded body.
 */
const SENSITIVE_PARAM_KEYS = new Set([
    'password',
    'pass',
    'passwd',
    'newpass',
    'key',
    'cert',
    'cabundle',
    'api_key',
    'apikey',
    'token',
    'secret',
]);
function hasSensitiveParam(params) {
    for (const k of Object.keys(params)) {
        if (SENSITIVE_PARAM_KEYS.has(k.toLowerCase()))
            return true;
    }
    return false;
}
function looksLikeCphulk(status, body, contentType) {
    const lower = body.toLowerCase();
    // Strong signals: explicit cphulk / brute-force markers anywhere.
    if (lower.includes('cphulk') || lower.includes('brute force') || lower.includes('brute-force')) {
        return true;
    }
    // 503 with "temporarily" is almost always cPHulk soft-lock.
    if (status === 503 && lower.includes('temporarily')) {
        return true;
    }
    // 403 "access denied" / "forbidden" — only count as cPHulk when the response
    // is HTML (cPHulk serves an HTML lockout page). UAPI auth failures return
    // JSON; classifying those as cPHulk would tell the user to file a support
    // ticket when they really just need to fix the token.
    if (status === 403 && contentType.includes('html')) {
        if (lower.includes('access denied') || lower.includes('forbidden')) {
            return true;
        }
    }
    return false;
}
export class CpanelClient {
    http;
    host;
    port;
    user;
    apiKey;
    constructor(cfg) {
        this.host = cfg.host;
        this.port = cfg.port;
        this.user = cfg.user;
        this.apiKey = cfg.apiKey;
        this.http = axios.create({
            baseURL: `https://${cfg.host}:${cfg.port}`,
            timeout: cfg.timeoutMs ?? 15000,
            headers: {
                Authorization: `cpanel ${cfg.user}:${cfg.apiKey}`,
                Accept: 'application/json',
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: !cfg.insecureTls,
            }),
            // No retry. cPHulk-safe: a single attempt per call.
            // validateStatus pinned to () => true so that 4xx/5xx flow through our
            // cPHulk / auth dispatch instead of being thrown as axios errors.
            validateStatus: () => true,
        });
    }
    /**
     * Call any cPanel UAPI endpoint.
     *
     * Calls carrying password / key / cert / etc. params are auto-routed via POST
     * to keep the values out of the request URL (cPanel logs request URLs to its
     * access log). Callers can also force POST by passing `method: 'POST'`.
     *
     * @param module   UAPI module (e.g. "Email", "DNS", "Mysql")
     * @param func     Function on that module (e.g. "list_pops")
     * @param params   UAPI params; values are stringified
     * @param opts     { method?: 'GET' | 'POST' } — defaults to auto (POST iff sensitive)
     */
    async call(module, func, params = {}, opts = {}) {
        const cleanParams = {};
        for (const [k, v] of Object.entries(params)) {
            if (v === undefined || v === null)
                continue;
            cleanParams[k] = String(v);
        }
        const url = `/execute/${encodeURIComponent(module)}/${encodeURIComponent(func)}`;
        const method = opts.method ?? (hasSensitiveParam(cleanParams) ? 'POST' : 'GET');
        let response;
        try {
            if (method === 'POST') {
                const body = new URLSearchParams(cleanParams).toString();
                response = await this.http.post(url, body, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                });
            }
            else {
                response = await this.http.get(url, { params: cleanParams });
            }
        }
        catch (err) {
            const ax = err;
            const code = ax.code ?? 'NETWORK_ERROR';
            throw new CPanelError(`Network error reaching ${this.host}:${this.port} — ${ax.message}`, code);
        }
        const bodyText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? '');
        const contentType = String((response.headers && (response.headers['content-type'] ?? response.headers['Content-Type'])) ?? '').toLowerCase();
        // cPHulk check FIRST — it may return 403/503 with HTML, not JSON.
        if (looksLikeCphulk(response.status, bodyText, contentType)) {
            throw new CPHulkLockoutError(this.host, `HTTP ${response.status}: ${bodyText.slice(0, 200)}`);
        }
        if (response.status === 401) {
            throw new CPanelAuthError(`HTTP 401 from ${this.host}`);
        }
        if (response.status === 403) {
            throw new CPanelAuthError(`HTTP 403 (forbidden) from ${this.host}: ${bodyText.slice(0, 200)}`);
        }
        if (response.status >= 400) {
            throw new CPanelError(`HTTP ${response.status} from ${this.host}: ${bodyText.slice(0, 200)}`, `HTTP_${response.status}`);
        }
        // UAPI returns JSON with status 0/1 even on application errors.
        let parsed;
        if (typeof response.data === 'object' && response.data !== null) {
            parsed = response.data;
        }
        else {
            try {
                parsed = JSON.parse(bodyText);
            }
            catch {
                throw new CPanelError(`Non-JSON response from UAPI (status ${response.status}): ${bodyText.slice(0, 200)}`, 'BAD_RESPONSE');
            }
        }
        if (parsed.status !== 1) {
            const errors = parsed.errors ?? ['Unknown UAPI error'];
            const joined = errors.join('; ');
            // Some auth-related UAPI errors masquerade as status=0. Use word-boundary
            // matches so "Invalid domain name" or "permission set" don't trip this.
            if (/\baccess denied\b|\bunauthorized\b|\bpermission denied\b|\binvalid (?:api )?(?:token|key|credentials?)\b|\bauthentication (?:failed|required)\b/i.test(joined)) {
                throw new CPanelAuthError(joined);
            }
            throw new CPanelUapiError(`UAPI ${module}::${func} failed: ${joined}`, errors);
        }
        return parsed;
    }
    /** Last-4 of the token, safe for logging. */
    tokenSuffix() {
        return this.apiKey.length >= 4 ? this.apiKey.slice(-4) : '****';
    }
}
