import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CpanelClient,
  CPHulkLockoutError,
  CPanelAuthError,
  CPanelUapiError,
  CPanelApi2Error,
} from '../src/cpanel-client.js';

// Mock axios so we control the entire HTTP layer.
const getMock = vi.fn();
const postMock = vi.fn();
const createCalls: unknown[] = [];

vi.mock('axios', () => ({
  default: {
    create: (cfg: unknown) => {
      createCalls.push(cfg);
      return {
        get: (...args: unknown[]) => getMock(...args),
        post: (...args: unknown[]) => postMock(...args),
      };
    },
  },
}));

const baseConfig = {
  host: 'test.example.com',
  port: 2083,
  user: 'testuser',
  apiKey: 'TESTAPITOKEN1234',
};

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  createCalls.length = 0;
});

describe('CpanelClient', () => {
  it('parses successful UAPI response', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { status: 1, errors: null, warnings: null, messages: null, data: { hello: 'world' } },
    });
    const client = new CpanelClient(baseConfig);
    const result = await client.call('Test', 'ping');
    expect(result.status).toBe(1);
    expect(result.data).toEqual({ hello: 'world' });
    expect(getMock).toHaveBeenCalledOnce();
  });

  it('detects cPHulk on 403 + cphulkd body and throws CPHulkLockoutError without retry', async () => {
    getMock.mockResolvedValue({
      status: 403,
      data: '<html>cphulkd: brute force protection triggered</html>',
      headers: { 'content-type': 'text/html' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toBeInstanceOf(CPHulkLockoutError);
    expect(getMock).toHaveBeenCalledOnce();
  });

  it('detects cPHulk on 503 with "temporarily" body', async () => {
    getMock.mockResolvedValue({
      status: 503,
      data: 'Service temporarily unavailable',
      headers: { 'content-type': 'text/plain' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toBeInstanceOf(CPHulkLockoutError);
    expect(getMock).toHaveBeenCalledOnce();
  });

  it('does NOT misclassify a JSON 403 auth failure as cPHulk', async () => {
    getMock.mockResolvedValue({
      status: 403,
      data: { status: 0, errors: ['Access denied'], data: null },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toBeInstanceOf(CPanelAuthError);
  });

  it('treats 401 as auth failure', async () => {
    getMock.mockResolvedValue({
      status: 401,
      data: 'unauthorized',
      headers: { 'content-type': 'text/plain' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toBeInstanceOf(CPanelAuthError);
    expect(getMock).toHaveBeenCalledOnce();
  });

  it('treats UAPI status=0 with "access denied" as auth failure', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { status: 0, errors: ['Access denied for resource'], data: null },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toBeInstanceOf(CPanelAuthError);
  });

  it('treats UAPI status=0 with generic error as UapiError', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { status: 0, errors: ['Domain "foo" does not exist'], data: null },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toBeInstanceOf(CPanelUapiError);
  });

  it('tokenSuffix exposes only last 4 of api key', () => {
    const client = new CpanelClient(baseConfig);
    expect(client.tokenSuffix()).toBe('1234');
  });

  // Test #9a: network error branch
  it('wraps axios network errors as CPanelError(NETWORK_ERROR)', async () => {
    const netErr = Object.assign(new Error('ECONNRESET socket hang up'), { code: 'ECONNRESET' });
    getMock.mockRejectedValue(netErr);
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toMatchObject({
      name: 'CPanelError',
      code: 'ECONNRESET',
    });
  });

  // Test #9b: non-JSON 200 body
  it('throws CPanelError(BAD_RESPONSE) when UAPI returns 200 with unparseable body', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: '<html>maintenance page</html>',
      headers: { 'content-type': 'text/html' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });

  // Test #9c: validateStatus regression guard. If a future contributor drops
  // validateStatus, axios throws on 4xx/5xx before we can dispatch to cPHulk
  // detection. Pin the create() config here so that drift is caught.
  it('pins validateStatus: () => true on the axios instance', () => {
    new CpanelClient(baseConfig);
    expect(createCalls).toHaveLength(1);
    const cfg = createCalls[0] as { validateStatus: (s: number) => boolean };
    expect(typeof cfg.validateStatus).toBe('function');
    // Must return true for all status codes so cPHulk dispatch sees them.
    for (const code of [200, 400, 401, 403, 500, 503]) {
      expect(cfg.validateStatus(code)).toBe(true);
    }
  });

  // POST routing for sensitive params (Fix #1).
  it('routes calls with `password` param via POST (form-encoded body)', async () => {
    postMock.mockResolvedValue({
      status: 200,
      data: { status: 1, errors: null, warnings: null, messages: null, data: {} },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await client.call('Email', 'add_pop', {
      email: 'foo',
      domain: 'example.com',
      password: 'sekret',
      quota: 250,
    });
    expect(postMock).toHaveBeenCalledOnce();
    expect(getMock).not.toHaveBeenCalled();
    const [url, body, opts] = postMock.mock.calls[0] as [string, string, { headers: Record<string, string> }];
    expect(url).toBe('/execute/Email/add_pop');
    expect(body).toContain('password=sekret');
    expect(body).toContain('email=foo');
    expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('routes calls with `key` / `cert` / `cabundle` params via POST', async () => {
    postMock.mockResolvedValue({
      status: 200,
      data: { status: 1, errors: null, warnings: null, messages: null, data: {} },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await client.call('SSL', 'install_ssl', {
      domain: 'example.com',
      cert: '-----BEGIN CERT-----',
      key: '-----BEGIN PRIVATE KEY-----',
      cabundle: '-----BEGIN CHAIN-----',
    });
    expect(postMock).toHaveBeenCalledOnce();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('routes non-sensitive calls via GET', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { status: 1, errors: null, warnings: null, messages: null, data: [] },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await client.call('Email', 'list_pops');
    expect(getMock).toHaveBeenCalledOnce();
    expect(postMock).not.toHaveBeenCalled();
  });

  // Auth-error regex tightening (Fix #11): "Invalid domain" must NOT be auth.
  it('does not misclassify "Invalid domain name" as an auth failure', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { status: 0, errors: ['Invalid domain name'], data: null },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('DNS', 'parse_zone', { zone: 'bogus' })).rejects.toBeInstanceOf(CPanelUapiError);
  });
});

describe('CpanelClient.callApi2', () => {
  const ok = (data: unknown) => ({
    status: 200,
    data: { cpanelresult: { event: { result: 1 }, data } },
    headers: { 'content-type': 'application/json' },
  });

  it('hits /json-api/cpanel with the cpanel_jsonapi_* envelope + func params', async () => {
    getMock.mockResolvedValue(ok([{ name: 'a.txt' }]));
    const client = new CpanelClient(baseConfig);
    const res = await client.callApi2('Fileman', 'fileop', { op: 'unlink', sourcefiles: '/home/u/a.txt' });
    const [url, opts] = getMock.mock.calls[0] as [string, { params: Record<string, string> }];
    expect(url).toBe('/json-api/cpanel');
    expect(opts.params).toMatchObject({
      cpanel_jsonapi_user: 'testuser',
      cpanel_jsonapi_apiversion: '2',
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'fileop',
      op: 'unlink',
      sourcefiles: '/home/u/a.txt',
    });
    expect(res.cpanelresult.data).toEqual([{ name: 'a.txt' }]);
  });

  it('accepts string "1" for event.result (cPanel serializes it both ways)', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { cpanelresult: { event: { result: '1' }, data: [{ name: 'a.txt' }] } },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    const res = await client.callApi2('Fileman', 'fileop', { op: 'unlink' });
    expect(res.cpanelresult.data).toEqual([{ name: 'a.txt' }]);
  });

  it('throws CPanelApi2Error when event.result is 0', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { cpanelresult: { event: { result: 0, reason: 'No such file' } } },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.callApi2('Fileman', 'fileop', { op: 'unlink' })).rejects.toBeInstanceOf(
      CPanelApi2Error,
    );
  });

  it('throws CPanelApi2Error when cpanelresult.error is set even if result=1', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { cpanelresult: { event: { result: 1 }, error: 'something broke' } },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.callApi2('Fileman', 'fileop', { op: 'unlink' })).rejects.toBeInstanceOf(
      CPanelApi2Error,
    );
  });

  it('maps an access-denied API 2 error to CPanelAuthError', async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { cpanelresult: { event: { result: 0 }, error: 'Access denied' } },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.callApi2('Fileman', 'fileop', { op: 'unlink' })).rejects.toBeInstanceOf(
      CPanelAuthError,
    );
  });

  it('shares cPHulk dispatch with the UAPI path', async () => {
    getMock.mockResolvedValue({
      status: 403,
      data: '<html>cphulkd: brute force protection</html>',
      headers: { 'content-type': 'text/html' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.callApi2('Fileman', 'fileop', { op: 'unlink' })).rejects.toBeInstanceOf(
      CPHulkLockoutError,
    );
    expect(getMock).toHaveBeenCalledOnce();
  });

  it('POST-routes API 2 calls carrying a sensitive param', async () => {
    postMock.mockResolvedValue(ok({}));
    const client = new CpanelClient(baseConfig);
    await client.callApi2('SomeMod', 'somefunc', { token: 'sekret' });
    expect(postMock).toHaveBeenCalledOnce();
    expect(getMock).not.toHaveBeenCalled();
    const [url, body] = postMock.mock.calls[0] as [string, string];
    expect(url).toBe('/json-api/cpanel');
    expect(body).toContain('token=sekret');
    expect(body).toContain('cpanel_jsonapi_func=somefunc');
  });
});
