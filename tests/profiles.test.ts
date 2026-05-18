import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalHome = process.env.HOME;
const originalEnv = { ...process.env };

let tmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cpanel-mcp-profiles-'));
  process.env.HOME = tmpHome;
  delete process.env.CPANEL_PROFILE;
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

describe('profiles', () => {
  it('round-trips a profile: write, read, list', async () => {
    const { writeProfileAtomic, readProfile, listProfiles } = await import('../src/profiles.js');
    writeProfileAtomic('test1', {
      CPANEL_HOST: 'a.example.com',
      CPANEL_USER: 'alice',
      CPANEL_API_KEY: 'tokenA',
    });
    const v = readProfile('test1');
    expect(v.CPANEL_HOST).toBe('a.example.com');
    expect(v.CPANEL_USER).toBe('alice');
    expect(listProfiles()).toContain('test1');
  });

  it('writes profile files with mode 0600', async () => {
    const { writeProfileAtomic, profilesDir } = await import('../src/profiles.js');
    writeProfileAtomic('modecheck', {
      CPANEL_HOST: 'h',
      CPANEL_USER: 'u',
      CPANEL_API_KEY: 'k',
    });
    const stat = fs.statSync(path.join(profilesDir(), 'modecheck.env'));
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('rejects invalid profile names', async () => {
    const { assertValidProfileName } = await import('../src/profiles.js');
    expect(() => assertValidProfileName('has spaces')).toThrow();
    expect(() => assertValidProfileName('../etc')).toThrow();
    expect(() => assertValidProfileName('')).toThrow();
    expect(() => assertValidProfileName('a'.repeat(65))).toThrow();
    expect(() => assertValidProfileName('ok_name-1.foo')).not.toThrow();
  });

  it('switches active profile and respects CPANEL_PROFILE env override', async () => {
    const { writeProfileAtomic, setActiveProfile, getActiveProfileName } = await import(
      '../src/profiles.js'
    );
    writeProfileAtomic('one', { CPANEL_HOST: '1', CPANEL_USER: '1', CPANEL_API_KEY: '1' });
    writeProfileAtomic('two', { CPANEL_HOST: '2', CPANEL_USER: '2', CPANEL_API_KEY: '2' });
    setActiveProfile('two');
    expect(getActiveProfileName()).toBe('two');
    process.env.CPANEL_PROFILE = 'one';
    expect(getActiveProfileName()).toBe('one');
    delete process.env.CPANEL_PROFILE;
    expect(getActiveProfileName()).toBe('two');
  });

  it('refuses to delete the active profile', async () => {
    const { writeProfileAtomic, setActiveProfile, deleteProfile } = await import('../src/profiles.js');
    writeProfileAtomic('keep', { CPANEL_HOST: 'h', CPANEL_USER: 'u', CPANEL_API_KEY: 'k' });
    setActiveProfile('keep');
    expect(() => deleteProfile('keep')).toThrow(/active profile/);
  });

  it('migrates legacy ~/.config/cpanel-mcp/.env to profiles/default.env on first read', async () => {
    const legacyDir = path.join(tmpHome, '.config', 'cpanel-mcp');
    fs.mkdirSync(legacyDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      path.join(legacyDir, '.env'),
      'CPANEL_HOST=legacy.example.com\nCPANEL_USER=legacyuser\nCPANEL_API_KEY=legacytoken\n',
      { mode: 0o600 },
    );

    const { readProfile, listProfiles } = await import('../src/profiles.js');
    const def = readProfile('default');
    expect(def.CPANEL_HOST).toBe('legacy.example.com');
    expect(def.CPANEL_USER).toBe('legacyuser');
    expect(listProfiles()).toContain('default');

    // Legacy file should be marked deprecated.
    const legacy = fs.readFileSync(path.join(legacyDir, '.env'), 'utf8');
    expect(legacy).toMatch(/^# DEPRECATED:/);
  });

  it('atomic write does not leave the temp file on disk', async () => {
    const { writeProfileAtomic, profilesDir } = await import('../src/profiles.js');
    writeProfileAtomic('atomic', { CPANEL_HOST: 'h', CPANEL_USER: 'u', CPANEL_API_KEY: 'k' });
    const files = fs.readdirSync(profilesDir());
    const tmps = files.filter((f) => f.includes('.tmp.'));
    expect(tmps).toEqual([]);
  });

  it('summarizeProfiles redacts to last-4 of token', async () => {
    const { writeProfileAtomic, summarizeProfiles, setActiveProfile } = await import(
      '../src/profiles.js'
    );
    writeProfileAtomic('redacted', {
      CPANEL_HOST: 'h',
      CPANEL_USER: 'u',
      CPANEL_API_KEY: 'verylongtoken1234',
    });
    setActiveProfile('redacted');
    const s = summarizeProfiles();
    const entry = s.find((p) => p.name === 'redacted')!;
    expect(entry.tokenSuffix).toBe('...1234');
    expect(entry.active).toBe(true);
    expect(JSON.stringify(entry)).not.toContain('verylongtoken1234');
  });
});
