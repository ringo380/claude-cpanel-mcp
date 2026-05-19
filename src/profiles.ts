import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Resolve the user's home directory at call time. We prefer process.env.HOME
 * over os.homedir() because some test runners (notably vite-node) appear to
 * cache os.homedir()'s result inside transformed modules; reading the env var
 * directly always reflects current state.
 */
function homeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

// All paths are resolved at call time (not module load) so tests that swap
// $HOME between cases get fresh paths and the package-level cache doesn't pin
// the first-test sandbox.
export const DEFAULT_PROFILE = 'default';

export function configDir(): string {
  return path.join(homeDir(), '.config', 'cpanel-mcp');
}
export function profilesDir(): string {
  return path.join(configDir(), 'profiles');
}
export function activeFile(): string {
  return path.join(configDir(), 'active');
}
export function legacyConfigFile(): string {
  return path.join(configDir(), '.env');
}

// Back-compat: getters disguised as constants. Property access re-evaluates.
// Imports of `CONFIG_DIR` / `PROFILES_DIR` / etc. as named constants from
// other modules become snapshot-on-first-eval; use the functions in code that
// must observe $HOME changes mid-process (i.e. tests).
export const CONFIG_DIR = /* @__PURE__ */ configDir();
export const PROFILES_DIR = /* @__PURE__ */ profilesDir();
export const ACTIVE_FILE = /* @__PURE__ */ activeFile();
export const LEGACY_CONFIG_FILE = /* @__PURE__ */ legacyConfigFile();

export interface ProfileValues {
  CPANEL_HOST: string;
  CPANEL_PORT?: string;
  CPANEL_USER: string;
  CPANEL_API_KEY: string;
  CPANEL_INSECURE_TLS?: string;
}

const VALID_NAME = /^[a-zA-Z0-9_.-]{1,64}$/;

export function assertValidProfileName(name: string): void {
  if (!VALID_NAME.test(name)) {
    throw new Error(
      `Invalid profile name "${name}". Use 1-64 chars of [a-zA-Z0-9_.-] only.`,
    );
  }
}

function profilePath(name: string): string {
  assertValidProfileName(name);
  return path.join(profilesDir(), `${name}.env`);
}

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/**
 * Migrate ~/.config/cpanel-mcp/.env → profiles/default.env on first read.
 * Idempotent: no-op if the legacy file is absent or the default profile already
 * exists. Leaves the legacy file in place (with a deprecation header prepended
 * if not already present) so users on older versions can still inspect it.
 */
function migrateLegacyIfNeeded(): void {
  const legacyFile = legacyConfigFile();
  if (!fs.existsSync(legacyFile)) return;
  const dir = profilesDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const defaultPath = path.join(dir, `${DEFAULT_PROFILE}.env`);
  if (fs.existsSync(defaultPath)) return;
  const legacy = fs.readFileSync(legacyFile, 'utf8');
  // Strip any prior deprecation header before copying forward.
  const stripped = legacy.replace(/^# DEPRECATED:[^\n]*\n/, '');
  fs.writeFileSync(defaultPath, stripped, { mode: 0o600 });
  fs.chmodSync(defaultPath, 0o600);
  if (!legacy.startsWith('# DEPRECATED:')) {
    const header =
      '# DEPRECATED: cpanel-mcp now reads profiles/default.env. ' +
      'This file is kept for reference and ignored.\n';
    fs.writeFileSync(legacyFile, header + stripped, { mode: 0o600 });
    fs.chmodSync(legacyFile, 0o600);
  }
}

export function listProfiles(): string[] {
  migrateLegacyIfNeeded();
  const dir = profilesDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.env'))
    .map((f) => f.slice(0, -4))
    .filter((n) => VALID_NAME.test(n))
    .sort();
}

export function profileExists(name: string): boolean {
  migrateLegacyIfNeeded();
  return fs.existsSync(profilePath(name));
}

export function getActiveProfileName(): string {
  const envOverride = process.env.CPANEL_PROFILE;
  if (envOverride && VALID_NAME.test(envOverride)) return envOverride;
  try {
    const af = activeFile();
    if (fs.existsSync(af)) {
      const val = fs.readFileSync(af, 'utf8').trim();
      if (VALID_NAME.test(val)) return val;
    }
  } catch {
    // fall through
  }
  return DEFAULT_PROFILE;
}

export function readProfile(name: string): Record<string, string> {
  migrateLegacyIfNeeded();
  const p = profilePath(name);
  if (!fs.existsSync(p)) return {};
  try {
    return parseEnvFile(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Atomic profile write: writes to a temp file in the same directory, then
 * renames into place (rename within the same fs is atomic on POSIX). Always
 * chmod 0600 after — Linux umask can mask the `mode:` argument to writeFile.
 */
export function writeProfileAtomic(name: string, values: ProfileValues): string {
  assertValidProfileName(name);
  const dir = profilesDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // best-effort
  }
  const lines = [
    `CPANEL_HOST=${values.CPANEL_HOST}`,
    `CPANEL_PORT=${values.CPANEL_PORT ?? '2083'}`,
    `CPANEL_USER=${values.CPANEL_USER}`,
    `CPANEL_API_KEY=${values.CPANEL_API_KEY}`,
  ];
  if (values.CPANEL_INSECURE_TLS) {
    lines.push(`CPANEL_INSECURE_TLS=${values.CPANEL_INSECURE_TLS}`);
  }
  const body = lines.join('\n') + '\n';
  const finalPath = profilePath(name);
  const tmpPath = `${finalPath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, body, { mode: 0o600 });
  fs.chmodSync(tmpPath, 0o600);
  fs.renameSync(tmpPath, finalPath);
  fs.chmodSync(finalPath, 0o600);
  return finalPath;
}

export function setActiveProfile(name: string): void {
  assertValidProfileName(name);
  if (!profileExists(name)) {
    throw new Error(`Profile "${name}" does not exist. Create it via the setup tool first.`);
  }
  fs.mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  const af = activeFile();
  const tmp = `${af}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, `${name}\n`, { mode: 0o600 });
  fs.renameSync(tmp, af);
  fs.chmodSync(af, 0o600);
}

export function deleteProfile(name: string): void {
  assertValidProfileName(name);
  if (name === getActiveProfileName()) {
    throw new Error(
      `Refusing to delete the active profile "${name}". Switch to a different profile first.`,
    );
  }
  const p = profilePath(name);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
}

export interface ProfileSummary {
  name: string;
  active: boolean;
  host?: string;
  port?: string;
  user?: string;
  tokenSuffix?: string;
  hasToken: boolean;
}

export function summarizeProfiles(): ProfileSummary[] {
  const active = getActiveProfileName();
  return listProfiles().map((name) => {
    const v = readProfile(name);
    const token = v.CPANEL_API_KEY;
    return {
      name,
      active: name === active,
      host: v.CPANEL_HOST,
      port: v.CPANEL_PORT,
      user: v.CPANEL_USER,
      tokenSuffix: token && token.length >= 4 ? `...${token.slice(-4)}` : undefined,
      hasToken: Boolean(token),
    };
  });
}
