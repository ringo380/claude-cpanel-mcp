import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CpanelClient,
  CPHulkLockoutError,
  CPanelAuthError,
  CPanelUapiError,
} from '../src/cpanel-client.js';

// Mock axios so we control the entire HTTP layer.
const requestMock = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: (...args: unknown[]) => requestMock(...args),
    }),
  },
}));

const baseConfig = {
  host: 'test.example.com',
  port: 2083,
  user: 'testuser',
  apiKey: 'TESTAPITOKEN1234',
};

beforeEach(() => {
  requestMock.mockReset();
});

describe('CpanelClient', () => {
  it('parses successful UAPI response', async () => {
    requestMock.mockResolvedValue({
      status: 200,
      data: { status: 1, errors: null, warnings: null, messages: null, data: { hello: 'world' } },
    });
    const client = new CpanelClient(baseConfig);
    const result = await client.call('Test', 'ping');
    expect(result.status).toBe(1);
    expect(result.data).toEqual({ hello: 'world' });
    expect(requestMock).toHaveBeenCalledOnce();
  });

  it('detects cPHulk on 403 + cphulkd body and throws CPHulkLockoutError without retry', async () => {
    requestMock.mockResolvedValue({
      status: 403,
      data: '<html>cphulkd: brute force protection triggered</html>',
      headers: { 'content-type': 'text/html' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toBeInstanceOf(CPHulkLockoutError);
    expect(requestMock).toHaveBeenCalledOnce();
  });

  it('detects cPHulk on 503 with "temporarily" body', async () => {
    requestMock.mockResolvedValue({
      status: 503,
      data: 'Service temporarily unavailable',
      headers: { 'content-type': 'text/plain' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toBeInstanceOf(CPHulkLockoutError);
    expect(requestMock).toHaveBeenCalledOnce();
  });

  it('does NOT misclassify a JSON 403 auth failure as cPHulk', async () => {
    requestMock.mockResolvedValue({
      status: 403,
      data: { status: 0, errors: ['Access denied'], data: null },
      headers: { 'content-type': 'application/json' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toBeInstanceOf(CPanelAuthError);
  });

  it('treats 401 as auth failure', async () => {
    requestMock.mockResolvedValue({
      status: 401,
      data: 'unauthorized',
      headers: { 'content-type': 'text/plain' },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toBeInstanceOf(CPanelAuthError);
    expect(requestMock).toHaveBeenCalledOnce();
  });

  it('treats UAPI status=0 with "access denied" as auth failure', async () => {
    requestMock.mockResolvedValue({
      status: 200,
      data: { status: 0, errors: ['Access denied for resource'], data: null },
    });
    const client = new CpanelClient(baseConfig);
    await expect(client.call('Email', 'list_pops')).rejects.toBeInstanceOf(CPanelAuthError);
  });

  it('treats UAPI status=0 with generic error as UapiError', async () => {
    requestMock.mockResolvedValue({
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
});
