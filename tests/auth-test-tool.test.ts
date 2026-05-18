import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalHome = process.env.HOME;
const originalEnv = { ...process.env };
let tmpHome: string;

// Mock axios so validateConfigEphemeral hits our test handler instead of network.
const getMock = vi.fn();
vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: (...args: unknown[]) => getMock(...args),
      post: (...args: unknown[]) => getMock(...args),
    }),
  },
}));

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cpanel-mcp-authtest-'));
  process.env.HOME = tmpHome;
  delete process.env.CPANEL_PROFILE;
  delete process.env.CPANEL_HOST;
  delete process.env.CPANEL_USER;
  delete process.env.CPANEL_API_KEY;
  getMock.mockReset();
});

afterEach(() => {
  process.env = { ...originalEnv };
  process.env.HOME = originalHome;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('validateConfigEphemeral', () => {
  it('does NOT write anything to disk on success', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { status: 1, errors: null, warnings: null, messages: null, data: { user: 'x' } },
      headers: { 'content-type': 'application/json' },
    });
    const writeSpy = vi.spyOn(fs, 'writeFileSync');
    const { validateConfigEphemeral } = await import('../src/config.js');
    const res = await validateConfigEphemeral({
      host: 'h.example.com',
      port: 2083,
      user: 'u',
      apiKey: 't',
    });
    expect(res.ok).toBe(true);
    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it('does NOT write anything to disk on failure', async () => {
    getMock.mockResolvedValue({
      status: 401,
      data: 'unauthorized',
      headers: { 'content-type': 'text/plain' },
    });
    const writeSpy = vi.spyOn(fs, 'writeFileSync');
    const { validateConfigEphemeral } = await import('../src/config.js');
    const res = await validateConfigEphemeral({
      host: 'h.example.com',
      port: 2083,
      user: 'u',
      apiKey: 'bad',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('AUTH_FAILED');
    }
    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });
});
