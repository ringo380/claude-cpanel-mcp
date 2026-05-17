import { type CpanelConfig } from './cpanel-client.js';
export declare const CONFIG_DIR: string;
export declare const CONFIG_FILE: string;
interface RawConfig {
    CPANEL_HOST?: string;
    CPANEL_PORT?: string;
    CPANEL_USER?: string;
    CPANEL_API_KEY?: string;
    CPANEL_INSECURE_TLS?: string;
}
/** Merge process.env over ~/.config/cpanel-mcp/.env (env wins). */
export declare function loadRawConfig(): RawConfig;
export interface ConfigResult {
    ok: boolean;
    config?: CpanelConfig;
    missing: string[];
    sources: Record<string, 'env' | 'file' | 'missing'>;
}
export declare function readConfig(): ConfigResult;
export declare function writeConfigFile(values: {
    CPANEL_HOST: string;
    CPANEL_PORT?: string;
    CPANEL_USER: string;
    CPANEL_API_KEY: string;
    CPANEL_INSECURE_TLS?: string;
}): string;
export declare function validateConfig(config: CpanelConfig): Promise<{
    ok: true;
    data: unknown;
} | {
    ok: false;
    code: string;
    message: string;
}>;
export declare function tokenManagementUrl(host: string, port?: number): string;
export {};
