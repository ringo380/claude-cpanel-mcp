import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// readConfig reads from a fixed path (~/.config/cpanel-mcp/.env) at runtime,
// so we point HOME at a tmpdir for the duration of each test.
const originalHome = process.env.HOME;
const originalEnv = { ...process.env };

let tmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cpanel-mcp-test-'));
  process.env.HOME = tmpHome;
  delete process.env.CPANEL_HOST;
  delete process.env.CPANEL_USER;
  delete process.env.CPANEL_API_KEY;
  delete process.env.CPANEL_PORT;
  delete process.env.CPANEL_INSECURE_TLS;
});

afterEach(() => {
  process.env = { ...originalEnv };
  process.env.HOME = originalHome;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('config', () => {
  it('reports unconfigured when nothing is set', async () => {
    const { readConfig } = await import('../src/config.js');
    const cfg = readConfig();
    expect(cfg.ok).toBe(false);
    expect(cfg.missing).toContain('CPANEL_HOST');
  });

  it('reads from env when present', async () => {
    process.env.CPANEL_HOST = 'env.example.com';
    process.env.CPANEL_USER = 'envuser';
    process.env.CPANEL_API_KEY = 'envtoken';
    const { readConfig } = await import('../src/config.js');
    const cfg = readConfig();
    expect(cfg.ok).toBe(true);
    expect(cfg.config!.host).toBe('env.example.com');
    expect(cfg.sources.CPANEL_HOST).toBe('env');
  });

  it('writes config file and reads it back', async () => {
    const { writeConfigFile, readConfig, CONFIG_FILE } = await import('../src/config.js');
    writeConfigFile({
      CPANEL_HOST: 'file.example.com',
      CPANEL_USER: 'fileuser',
      CPANEL_API_KEY: 'filetoken',
    });
    // Confirm file mode is 0600
    const stat = fs.statSync(CONFIG_FILE);
    expect(stat.mode & 0o777).toBe(0o600);

    const cfg = readConfig();
    expect(cfg.ok).toBe(true);
    expect(cfg.config!.host).toBe('file.example.com');
    expect(cfg.sources.CPANEL_HOST).toBe('file');
  });

  it('env overrides file', async () => {
    const { writeConfigFile, readConfig } = await import('../src/config.js');
    writeConfigFile({
      CPANEL_HOST: 'file.example.com',
      CPANEL_USER: 'fileuser',
      CPANEL_API_KEY: 'filetoken',
    });
    process.env.CPANEL_HOST = 'env.example.com';
    const cfg = readConfig();
    expect(cfg.config!.host).toBe('env.example.com');
    expect(cfg.sources.CPANEL_HOST).toBe('env');
    expect(cfg.sources.CPANEL_USER).toBe('file');
  });
});
