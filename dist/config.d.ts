import { type CpanelConfig } from './cpanel-client.js';
import { ACTIVE_FILE, CONFIG_DIR, LEGACY_CONFIG_FILE, PROFILES_DIR, type ProfileValues } from './profiles.js';
export { CONFIG_DIR, LEGACY_CONFIG_FILE, PROFILES_DIR, ACTIVE_FILE };
/** Back-compat alias: points to the legacy single-file path. */
export declare const CONFIG_FILE: string;
interface RawConfig {
    CPANEL_HOST?: string;
    CPANEL_PORT?: string;
    CPANEL_USER?: string;
    CPANEL_API_KEY?: string;
    CPANEL_INSECURE_TLS?: string;
}
/**
 * Merge process.env over the active profile (env wins).
 *
 * Active profile is resolved via:
 *   1. CPANEL_PROFILE env var (if set and valid)
 *   2. ~/.config/cpanel-mcp/active file
 *   3. "default"
 *
 * If the active profile is "default" and the legacy ~/.config/cpanel-mcp/.env
 * file exists, it's migrated to profiles/default.env on first read.
 */
export declare function loadRawConfig(): RawConfig;
export interface ConfigResult {
    ok: boolean;
    config?: CpanelConfig;
    missing: string[];
    sources: Record<string, 'env' | 'file' | 'missing'>;
    profile: string;
}
export declare function readConfig(): ConfigResult;
/**
 * Write credentials for a profile. Defaults to the active profile (or "default"
 * if none is active yet). Atomic: temp file + rename, mode 0600.
 *
 * Does NOT switch the active profile. Callers wanting that (e.g. first-time
 * setup, account switching) should also call setActiveProfile().
 */
export declare function writeConfigFile(values: ProfileValues, profile?: string): string;
/**
 * Validate credentials against UAPI without persisting anything to disk.
 * Used by the auth_test tool for "try before save" flows.
 */
export declare function validateConfigEphemeral(config: CpanelConfig): Promise<{
    ok: true;
    data: unknown;
} | {
    ok: false;
    code: string;
    message: string;
}>;
/** Back-compat alias used by existing setup tool. */
export declare const validateConfig: typeof validateConfigEphemeral;
export declare function tokenManagementUrl(host: string, port?: number): string;
