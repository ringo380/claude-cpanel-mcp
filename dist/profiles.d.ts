export declare const DEFAULT_PROFILE = "default";
export declare function configDir(): string;
export declare function profilesDir(): string;
export declare function activeFile(): string;
export declare function legacyConfigFile(): string;
export declare const CONFIG_DIR: string;
export declare const PROFILES_DIR: string;
export declare const ACTIVE_FILE: string;
export declare const LEGACY_CONFIG_FILE: string;
export interface ProfileValues {
    CPANEL_HOST: string;
    CPANEL_PORT?: string;
    CPANEL_USER: string;
    CPANEL_API_KEY: string;
    CPANEL_INSECURE_TLS?: string;
}
export declare function assertValidProfileName(name: string): void;
export declare function listProfiles(): string[];
export declare function profileExists(name: string): boolean;
export declare function getActiveProfileName(): string;
export declare function readProfile(name: string): Record<string, string>;
/**
 * Atomic profile write: writes to a temp file in the same directory, then
 * renames into place (rename within the same fs is atomic on POSIX). Always
 * chmod 0600 after — Linux umask can mask the `mode:` argument to writeFile.
 */
export declare function writeProfileAtomic(name: string, values: ProfileValues): string;
export declare function setActiveProfile(name: string): void;
export declare function deleteProfile(name: string): void;
export interface ProfileSummary {
    name: string;
    active: boolean;
    host?: string;
    port?: string;
    user?: string;
    tokenSuffix?: string;
    hasToken: boolean;
}
export declare function summarizeProfiles(): ProfileSummary[];
