import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CpanelClient } from '../src/cpanel-client.js';
import { pathLooksDangerous, validateFilename } from '../src/tools/files-write.js';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: (...args: unknown[]) => getMock(...args),
      post: (...args: unknown[]) => postMock(...args),
    }),
  },
}));

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
});

const baseConfig = {
  host: 'test.example.com',
  port: 2083,
  user: 'testuser',
  apiKey: 'TESTAPITOKEN1234',
};

describe('files write tool routing', () => {
  // The files-write tools take user-supplied `content`. That key is not in
  // SENSITIVE_PARAM_KEYS by design (overlapping with text file bodies that
  // legitimately include the word "password" inside config files would be
  // weird). Verify a write goes via GET when no sensitive params are present,
  // and via POST when any are added.
  it('Fileman::save_file_content goes via GET when no sensitive keys', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { status: 1, errors: null, warnings: null, messages: null, data: {} },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await client.call('Fileman', 'save_file_content', {
      dir: '/home/u',
      file: 'a.txt',
      content: 'hello',
    });
    expect(getMock).toHaveBeenCalledOnce();
    expect(postMock).not.toHaveBeenCalled();
  });

  // Ftp::passwd carries `pass` — must POST (we added `pass` indirectly via
  // SENSITIVE_PARAM_KEYS containing common aliases; verify).
  it('Ftp::passwd routes via POST (pass param)', async () => {
    postMock.mockResolvedValue({
      status: 200,
      data: { status: 1, errors: null, warnings: null, messages: null, data: {} },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await client.call('Ftp', 'passwd', { user: 'u', pass: 'secret' });
    expect(postMock).toHaveBeenCalledOnce();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('pathLooksDangerous blocks system roots AND their descendants', () => {
    expect(pathLooksDangerous('/')).toBe(true);
    expect(pathLooksDangerous('/etc')).toBe(true);
    expect(pathLooksDangerous('/etc/')).toBe(true);
    expect(pathLooksDangerous('/etc/cron.d')).toBe(true);
    expect(pathLooksDangerous('/usr/local/bin')).toBe(true);
    expect(pathLooksDangerous('/root/.ssh')).toBe(true);
    expect(pathLooksDangerous('/home/woobyava/public_html')).toBe(false);
    expect(pathLooksDangerous('/home/woobyava')).toBe(false);
  });

  it('validateFilename rejects traversal, slashes, null bytes, dots, empty', () => {
    expect(validateFilename('a.txt')).toBeNull();
    expect(validateFilename('safe-name_2.json')).toBeNull();
    expect(validateFilename('')).toMatch(/empty/);
    expect(validateFilename('../etc/passwd')).toMatch(/"\/" or/);
    expect(validateFilename('foo/bar')).toMatch(/"\/" or/);
    expect(validateFilename('foo\\bar')).toMatch(/"\/" or/);
    expect(validateFilename('foo\0.txt')).toMatch(/null byte/);
    expect(validateFilename('.')).toMatch(/not allowed/);
    expect(validateFilename('..')).toMatch(/not allowed/);
  });

  it('Mysql::set_password routes via POST', async () => {
    postMock.mockResolvedValue({
      status: 200,
      data: { status: 1, errors: null, warnings: null, messages: null, data: {} },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await client.call('Mysql', 'set_password', { user: 'u', password: 'secret' });
    expect(postMock).toHaveBeenCalledOnce();
  });
});
