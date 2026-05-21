import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CpanelClient } from '../src/cpanel-client.js';
import {
  pathLooksDangerous,
  validateFilename,
  registerFileWriteTools,
} from '../src/tools/files-write.js';

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

// Mutation tools must hit API 2 Fileman::fileop, not the (nonexistent) UAPI
// Fileman functions. Register the tools against a stub server + stub client and
// assert the callApi2 arguments per op.
describe('file-mutation tools route through API 2 fileop', () => {
  type Handler = (args: Record<string, unknown>) => Promise<unknown>;
  const handlers = new Map<string, Handler>();
  const callApi2 = vi.fn().mockResolvedValue({ cpanelresult: { event: { result: 1 }, data: [] } });
  const call = vi.fn();

  beforeEach(() => {
    handlers.clear();
    callApi2.mockClear();
    call.mockClear();
    const server = {
      registerTool: (name: string, _cfg: unknown, handler: Handler) => handlers.set(name, handler),
    };
    const client = { call, callApi2 } as unknown as CpanelClient;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerFileWriteTools(server as any, () => client);
  });

  it('files_delete → op=unlink with joined full paths', async () => {
    await handlers.get('files_delete')!({
      dir: '/home/u/public_html',
      files: ['a.txt', 'b.txt'],
      confirm: true,
    });
    expect(callApi2).toHaveBeenCalledWith('Fileman', 'fileop', {
      op: 'unlink',
      sourcefiles: '/home/u/public_html/a.txt,/home/u/public_html/b.txt',
      doubledecode: 1,
    });
  });

  it('files_delete refuses without confirm and never calls the API', async () => {
    const res = (await handlers.get('files_delete')!({
      dir: '/home/u',
      files: 'a.txt',
      confirm: false,
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
    expect(callApi2).not.toHaveBeenCalled();
  });

  it('files_delete blocks system paths before any API call', async () => {
    const res = (await handlers.get('files_delete')!({
      dir: '/etc',
      files: 'passwd',
      confirm: true,
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
    expect(callApi2).not.toHaveBeenCalled();
  });

  it('files_move → op=move with sourcefiles + destfiles', async () => {
    await handlers.get('files_move')!({
      source_dir: '/home/u/a',
      dest_dir: '/home/u/b',
      files: 'x.txt',
    });
    expect(callApi2).toHaveBeenCalledWith('Fileman', 'fileop', {
      op: 'move',
      sourcefiles: '/home/u/a/x.txt',
      destfiles: '/home/u/b',
      doubledecode: 1,
    });
  });

  it('files_copy → op=copy with sourcefiles + destfiles', async () => {
    await handlers.get('files_copy')!({
      source_dir: '/home/u/a',
      dest_dir: '/home/u/b',
      files: ['x.txt', 'y.txt'],
    });
    expect(callApi2).toHaveBeenCalledWith('Fileman', 'fileop', {
      op: 'copy',
      sourcefiles: '/home/u/a/x.txt,/home/u/a/y.txt',
      destfiles: '/home/u/b',
      doubledecode: 1,
    });
  });

  it('files_chmod → op=chmod with permissions in metadata', async () => {
    await handlers.get('files_chmod')!({
      dir: '/home/u',
      files: 'x.sh',
      permissions: '0755',
    });
    expect(callApi2).toHaveBeenCalledWith('Fileman', 'fileop', {
      op: 'chmod',
      sourcefiles: '/home/u/x.sh',
      metadata: '0755',
      doubledecode: 1,
    });
  });

  it('files_compress → op=compress with type in metadata', async () => {
    await handlers.get('files_compress')!({
      sources: ['/home/u/a', '/home/u/b'],
      destination: '/home/u/out.zip',
      type: 'zip',
    });
    expect(callApi2).toHaveBeenCalledWith('Fileman', 'fileop', {
      op: 'compress',
      sourcefiles: '/home/u/a,/home/u/b',
      destfiles: '/home/u/out.zip',
      metadata: 'zip',
      doubledecode: 1,
    });
  });

  it('files_extract → op=extract with destfiles', async () => {
    await handlers.get('files_extract')!({
      sources: ['/home/u/out.zip'],
      destination: '/home/u/dest',
    });
    expect(callApi2).toHaveBeenCalledWith('Fileman', 'fileop', {
      op: 'extract',
      sourcefiles: '/home/u/out.zip',
      destfiles: '/home/u/dest',
      doubledecode: 1,
    });
  });

  it('never falls back to the UAPI call() path for mutations', async () => {
    await handlers.get('files_delete')!({ dir: '/home/u', files: 'a.txt', confirm: true });
    await handlers.get('files_move')!({ source_dir: '/home/u', dest_dir: '/home/u/b', files: 'a.txt' });
    expect(call).not.toHaveBeenCalled();
  });
});
