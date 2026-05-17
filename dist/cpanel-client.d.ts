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
     * @param module   UAPI module (e.g. "Email", "DNS", "Mysql")
     * @param func     Function on that module (e.g. "list_pops")
     * @param params   Query-string params; values are stringified
     */
    call<T = unknown>(module: string, func: string, params?: Record<string, string | number | boolean | undefined>): Promise<UapiResponse<T>>;
    /** Last-4 of the token, safe for logging. */
    tokenSuffix(): string;
}
