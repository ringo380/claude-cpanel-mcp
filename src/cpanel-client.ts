import axios, { AxiosError, AxiosInstance } from 'axios';
import https from 'node:https';

export interface CpanelConfig {
  host: string;
  port: number;
  user: string;
  apiKey: string;
  insecureTls?: boolean;
  timeoutMs?: number;
}

export interface UapiResponse<T = unknown> {
  status: 0 | 1;
  errors: string[] | null;
  warnings: string[] | null;
  messages: string[] | null;
  metadata?: Record<string, unknown>;
  data: T;
}

export class CPanelError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CPanelError';
  }
}

export class CPHulkLockoutError extends CPanelError {
  constructor(host: string, detail: string) {
    super(
      `cPHulk brute-force protection has locked this account or IP at ${host}. ` +
        `File a support ticket with your hosting provider to unblock — do NOT retry, ` +
        `repeated attempts extend the lockout window. Detail: ${detail}`,
      'CPHULK_LOCKOUT',
    );
    this.name = 'CPHulkLockoutError';
  }
}

export class CPanelAuthError extends CPanelError {
  constructor(detail: string) {
    super(
      `cPanel authentication failed: ${detail}. Verify CPANEL_USER and CPANEL_API_KEY. ` +
        `If credentials are correct, you may have triggered cPHulk — check for a lockout email.`,
      'AUTH_FAILED',
    );
    this.name = 'CPanelAuthError';
  }
}

export class CPanelUapiError extends CPanelError {
  constructor(message: string, public readonly errors: string[]) {
    super(message, 'UAPI_ERROR');
    this.name = 'CPanelUapiError';
  }
}

export class CPanelApi2Error extends CPanelError {
  constructor(message: string, public readonly errors: string[]) {
    super(message, 'API2_ERROR');
    this.name = 'CPanelApi2Error';
  }
}

/**
 * cPanel API 2 response envelope. Unlike UAPI's flat {status, errors, data},
 * API 2 nests everything under `cpanelresult` and signals success via
 * `event.result` (1 = ok, 0 = failure). Application errors surface in `error`.
 */
export interface Api2Response<T = unknown> {
  cpanelresult: {
    data?: T;
    // result is 1 on success — serialized as number or string depending on
    // cPanel version. Coerce with Number() before comparing.
    event?: { result: 0 | 1 | string; reason?: string };
    error?: string;
    func?: string;
    module?: string;
    [key: string]: unknown;
  };
}

/** Auth-related error strings that should map to CPanelAuthError regardless of
 * which API surfaced them. Shared by UAPI and API 2 dispatch. */
const AUTH_ERROR_RE =
  /\baccess denied\b|\bunauthorized\b|\bpermission denied\b|\binvalid (?:api )?(?:token|key|credentials?)\b|\bauthentication (?:failed|required)\b/i;

/**
 * Param keys whose values must never appear in a request URL — cPanel logs the
 * full request line (including query string) to /usr/local/cpanel/logs/access_log.
 * Any call carrying one of these keys is auto-routed via POST with a
 * form-encoded body.
 */
const SENSITIVE_PARAM_KEYS = new Set<string>([
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

function hasSensitiveParam(params: Record<string, unknown>): boolean {
  for (const k of Object.keys(params)) {
    if (SENSITIVE_PARAM_KEYS.has(k.toLowerCase())) return true;
  }
  return false;
}

function looksLikeCphulk(status: number | undefined, body: string, contentType: string): boolean {
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
  private http: AxiosInstance;
  public readonly host: string;
  public readonly port: number;
  public readonly user: string;
  private readonly apiKey: string;

  constructor(cfg: CpanelConfig) {
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
  async call<T = unknown>(
    module: string,
    func: string,
    params: Record<string, string | number | boolean | undefined> = {},
    opts: { method?: 'GET' | 'POST' } = {},
  ): Promise<UapiResponse<T>> {
    const url = `/execute/${encodeURIComponent(module)}/${encodeURIComponent(func)}`;
    const { parsed } = await this.dispatch(url, params, opts);

    // UAPI returns JSON with status 0/1 even on application errors.
    const body = parsed as UapiResponse<T>;
    if (body.status !== 1) {
      const errors = body.errors ?? ['Unknown UAPI error'];
      const joined = errors.join('; ');
      // Some auth-related UAPI errors masquerade as status=0. Use word-boundary
      // matches so "Invalid domain name" or "permission set" don't trip this.
      if (AUTH_ERROR_RE.test(joined)) {
        throw new CPanelAuthError(joined);
      }
      throw new CPanelUapiError(`UAPI ${module}::${func} failed: ${joined}`, errors);
    }

    return body;
  }

  /**
   * Call a cPanel **API 2** endpoint. cPanel's file-mutation operations
   * (Fileman::fileop op=unlink/move/copy/chmod/compress/extract) live in API 2,
   * not UAPI — UAPI's Fileman module is read/utility only.
   *
   * Hits /json-api/cpanel with the cpanel_jsonapi_* envelope params plus the
   * function params. Shares the cPHulk-safe single-attempt dispatch and the
   * POST-for-sensitive-params routing with `call`.
   *
   * @param module   API 2 module (e.g. "Fileman")
   * @param func     Function on that module (e.g. "fileop")
   * @param params   Function params; values are stringified
   * @param opts     { method?: 'GET' | 'POST' } — defaults to auto (POST iff sensitive)
   */
  async callApi2<T = unknown>(
    module: string,
    func: string,
    params: Record<string, string | number | boolean | undefined> = {},
    opts: { method?: 'GET' | 'POST' } = {},
  ): Promise<Api2Response<T>> {
    const envelope: Record<string, string | number | boolean | undefined> = {
      cpanel_jsonapi_user: this.user,
      cpanel_jsonapi_apiversion: 2,
      cpanel_jsonapi_module: module,
      cpanel_jsonapi_func: func,
      ...params,
    };
    const { parsed } = await this.dispatch('/json-api/cpanel', envelope, opts);

    const body = parsed as Api2Response<T>;
    const result = body.cpanelresult;
    if (!result || typeof result !== 'object') {
      throw new CPanelApi2Error(`API 2 ${module}::${func}: unexpected response shape`, [
        JSON.stringify(parsed).slice(0, 200),
      ]);
    }
    // cPanel serializes event.result as either the number 1 or the string "1"
    // depending on version (legacy XML layer is text). Coerce so a successful
    // call isn't misread as a failure.
    const succeeded = Number(result.event?.result) === 1;
    const failed = !succeeded || Boolean(result.error);
    if (failed) {
      const detail = result.error ?? result.event?.reason ?? 'Unknown API 2 error';
      if (AUTH_ERROR_RE.test(detail)) {
        throw new CPanelAuthError(detail);
      }
      throw new CPanelApi2Error(`API 2 ${module}::${func} failed: ${detail}`, [detail]);
    }

    return body;
  }

  /**
   * Shared HTTP dispatch for both API surfaces. Performs a single request (no
   * retry — cPHulk-safe), POST-routes any payload carrying a sensitive param,
   * and runs the cPHulk / auth / HTTP-status checks. Returns the parsed JSON
   * body; per-API status interpretation is the caller's job.
   */
  private async dispatch(
    url: string,
    params: Record<string, string | number | boolean | undefined>,
    opts: { method?: 'GET' | 'POST' },
  ): Promise<{ parsed: unknown; status: number }> {
    const cleanParams: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      cleanParams[k] = String(v);
    }

    const method: 'GET' | 'POST' =
      opts.method ?? (hasSensitiveParam(cleanParams) ? 'POST' : 'GET');

    let response;
    try {
      if (method === 'POST') {
        const body = new URLSearchParams(cleanParams).toString();
        response = await this.http.post(url, body, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } else {
        response = await this.http.get(url, { params: cleanParams });
      }
    } catch (err) {
      const ax = err as AxiosError;
      const code = ax.code ?? 'NETWORK_ERROR';
      throw new CPanelError(
        `Network error reaching ${this.host}:${this.port} — ${ax.message}`,
        code,
      );
    }

    const bodyText =
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? '');
    const contentType = String(
      (response.headers && (response.headers['content-type'] ?? response.headers['Content-Type'])) ?? '',
    ).toLowerCase();

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
      throw new CPanelError(
        `HTTP ${response.status} from ${this.host}: ${bodyText.slice(0, 200)}`,
        `HTTP_${response.status}`,
      );
    }

    let parsed: unknown;
    if (typeof response.data === 'object' && response.data !== null) {
      parsed = response.data;
    } else {
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        throw new CPanelError(
          `Non-JSON response (status ${response.status}): ${bodyText.slice(0, 200)}`,
          'BAD_RESPONSE',
        );
      }
    }

    return { parsed, status: response.status };
  }

  /** Last-4 of the token, safe for logging. */
  tokenSuffix(): string {
    return this.apiKey.length >= 4 ? this.apiKey.slice(-4) : '****';
  }
}
