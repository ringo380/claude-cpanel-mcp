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
export declare class CPanelError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class CPHulkLockoutError extends CPanelError {
    constructor(host: string, detail: string);
}
export declare class CPanelAuthError extends CPanelError {
    constructor(detail: string);
}
export declare class CPanelUapiError extends CPanelError {
    readonly errors: string[];
    constructor(message: string, errors: string[]);
}
export declare class CPanelApi2Error extends CPanelError {
    readonly errors: string[];
    constructor(message: string, errors: string[]);
}
/**
 * cPanel API 2 response envelope. Unlike UAPI's flat {status, errors, data},
 * API 2 nests everything under `cpanelresult` and signals success via
 * `event.result` (1 = ok, 0 = failure). Application errors surface in `error`.
 */
export interface Api2Response<T = unknown> {
    cpanelresult: {
        data?: T;
        event?: {
            result: 0 | 1 | string;
            reason?: string;
        };
        error?: string;
        func?: string;
        module?: string;
        [key: string]: unknown;
    };
}
export declare class CpanelClient {
    private http;
    readonly host: string;
    readonly port: number;
    readonly user: string;
    private readonly apiKey;
    constructor(cfg: CpanelConfig);
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
    call<T = unknown>(module: string, func: string, params?: Record<string, string | number | boolean | undefined>, opts?: {
        method?: 'GET' | 'POST';
    }): Promise<UapiResponse<T>>;
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
    callApi2<T = unknown>(module: string, func: string, params?: Record<string, string | number | boolean | undefined>, opts?: {
        method?: 'GET' | 'POST';
    }): Promise<Api2Response<T>>;
    /**
     * Shared HTTP dispatch for both API surfaces. Performs a single request (no
     * retry — cPHulk-safe), POST-routes any payload carrying a sensitive param,
     * and runs the cPHulk / auth / HTTP-status checks. Returns the parsed JSON
     * body; per-API status interpretation is the caller's job.
     */
    private dispatch;
    /** Last-4 of the token, safe for logging. */
    tokenSuffix(): string;
}
