import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CpanelClient, type CpanelConfig } from './cpanel-client.js';

export const CONFIG_DIR = path.join(os.homedir(), '.config', 'cpanel-mcp');
export const CONFIG_FILE = path.join(CONFIG_DIR, '.env');

interface RawConfig {
  CPANEL_HOST?: string;
  CPANEL_PORT?: string;
  CPANEL_USER?: string;
  CPANEL_API_KEY?: string;
  CPANEL_INSECURE_TLS?: string;
}

function parseEnvFile(content: string): RawConfig {
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
  return out as RawConfig;
}

/** Merge process.env over ~/.config/cpanel-mcp/.env (env wins). */
export function loadRawConfig(): RawConfig {
  let fromFile: RawConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fromFile = parseEnvFile(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {
    // Ignore — treat as no file.
  }

  const merged: RawConfig = { ...fromFile };
  for (const k of ['CPANEL_HOST', 'CPANEL_PORT', 'CPANEL_USER', 'CPANEL_API_KEY', 'CPANEL_INSECURE_TLS'] as const) {
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
}

export function readConfig(): ConfigResult {
  const raw = loadRawConfig();
  let fromFile: RawConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fromFile = parseEnvFile(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {
    // ignore
  }

  const sources: Record<string, 'env' | 'file' | 'missing'> = {};
  const fields = ['CPANEL_HOST', 'CPANEL_USER', 'CPANEL_API_KEY'] as const;
  for (const f of fields) {
    if (process.env[f]) sources[f] = 'env';
    else if (fromFile[f]) sources[f] = 'file';
    else sources[f] = 'missing';
  }

  const missing = fields.filter((f) => !raw[f]);
  if (missing.length > 0) {
    return { ok: false, missing, sources };
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
  };
}

export function writeConfigFile(values: {
  CPANEL_HOST: string;
  CPANEL_PORT?: string;
  CPANEL_USER: string;
  CPANEL_API_KEY: string;
  CPANEL_INSECURE_TLS?: string;
}): string {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const lines = [
    `CPANEL_HOST=${values.CPANEL_HOST}`,
    `CPANEL_PORT=${values.CPANEL_PORT ?? '2083'}`,
    `CPANEL_USER=${values.CPANEL_USER}`,
    `CPANEL_API_KEY=${values.CPANEL_API_KEY}`,
  ];
  if (values.CPANEL_INSECURE_TLS) {
    lines.push(`CPANEL_INSECURE_TLS=${values.CPANEL_INSECURE_TLS}`);
  }
  fs.writeFileSync(CONFIG_FILE, lines.join('\n') + '\n', { mode: 0o600 });
  fs.chmodSync(CONFIG_FILE, 0o600);
  return CONFIG_FILE;
}

export async function validateConfig(
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

export function tokenManagementUrl(host: string, port = 2083): string {
  return `https://${host}:${port}/frontend/jupiter/security/tokens/index.html`;
}
