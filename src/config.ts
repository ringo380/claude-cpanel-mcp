import { CpanelClient, type CpanelConfig } from './cpanel-client.js';
import {
  ACTIVE_FILE,
  CONFIG_DIR,
  DEFAULT_PROFILE,
  LEGACY_CONFIG_FILE,
  PROFILES_DIR,
  getActiveProfileName,
  readProfile,
  writeProfileAtomic,
  type ProfileValues,
} from './profiles.js';

// Re-export so existing imports `from '../config.js'` keep working.
export { CONFIG_DIR, LEGACY_CONFIG_FILE, PROFILES_DIR, ACTIVE_FILE };
/** Back-compat alias: points to the legacy single-file path. */
export const CONFIG_FILE = LEGACY_CONFIG_FILE;

interface RawConfig {
  CPANEL_HOST?: string;
  CPANEL_PORT?: string;
  CPANEL_USER?: string;
  CPANEL_API_KEY?: string;
  CPANEL_INSECURE_TLS?: string;
}

const FIELDS = ['CPANEL_HOST', 'CPANEL_PORT', 'CPANEL_USER', 'CPANEL_API_KEY', 'CPANEL_INSECURE_TLS'] as const;

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
export function loadRawConfig(): RawConfig {
  const active = getActiveProfileName();
  const fromFile = readProfile(active);

  const merged: RawConfig = { ...(fromFile as RawConfig) };
  for (const k of FIELDS) {
    const fromEnv = process.env[k];
    if (fromEnv && fromEnv.length > 0) {
      merged[k] = fromEnv;
    }
  }
  return merged;
}

export interface ConfigResult {
  ok: boolean;
  config?: CpanelConfig;
  missing: string[];
  sources: Record<string, 'env' | 'file' | 'missing'>;
  profile: string;
}

export function readConfig(): ConfigResult {
  const profile = getActiveProfileName();
  const raw = loadRawConfig();
  const fromFile = readProfile(profile);

  const sources: Record<string, 'env' | 'file' | 'missing'> = {};
  const required = ['CPANEL_HOST', 'CPANEL_USER', 'CPANEL_API_KEY'] as const;
  for (const f of required) {
    if (process.env[f]) sources[f] = 'env';
    else if (fromFile[f]) sources[f] = 'file';
    else sources[f] = 'missing';
  }

  const missing = required.filter((f) => !raw[f]);
  if (missing.length > 0) {
    return { ok: false, missing, sources, profile };
  }

  return {
    ok: true,
    config: {
      host: raw.CPANEL_HOST!,
      port: raw.CPANEL_PORT ? parseInt(raw.CPANEL_PORT, 10) : 2083,
      user: raw.CPANEL_USER!,
      apiKey: raw.CPANEL_API_KEY!,
      insecureTls: raw.CPANEL_INSECURE_TLS === '1' || raw.CPANEL_INSECURE_TLS === 'true',
    },
    missing: [],
    sources,
    profile,
  };
}

/**
 * Write credentials for a profile. Defaults to the active profile (or "default"
 * if none is active yet). Atomic: temp file + rename, mode 0600.
 *
 * Does NOT switch the active profile. Callers wanting that (e.g. first-time
 * setup, account switching) should also call setActiveProfile().
 */
export function writeConfigFile(values: ProfileValues, profile?: string): string {
  const name = profile ?? getActiveProfileName() ?? DEFAULT_PROFILE;
  return writeProfileAtomic(name, values);
}

/**
 * Validate credentials against UAPI without persisting anything to disk.
 * Used by the auth_test tool for "try before save" flows.
 */
export async function validateConfigEphemeral(
  config: CpanelConfig,
): Promise<{ ok: true; data: unknown } | { ok: false; code: string; message: string }> {
  const client = new CpanelClient(config);
  try {
    const result = await client.call('Variables', 'get_user_information');
    return { ok: true, data: result.data };
  } catch (err) {
    const e = err as { name?: string; code?: string; message?: string };
    return {
      ok: false,
      code: e.code ?? 'UNKNOWN',
      message: e.message ?? String(err),
    };
  }
}

/** Back-compat alias used by existing setup tool. */
export const validateConfig = validateConfigEphemeral;

export function tokenManagementUrl(host: string, port = 2083): string {
  return `https://${host}:${port}/frontend/jupiter/security/tokens/index.html`;
}
