/**
 * DemoBackend Tests
 *
 * Tests for the in-memory demo backend.
 * Only tests IMPLEMENTED operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DemoBackend } from '../backend/demo';
import { OPS } from '../constants';
import { makeRequest } from '../types';

describe('DemoBackend', () => {
  let backend: DemoBackend;

  beforeEach(() => {
    backend = new DemoBackend();
  });

  describe('connection', () => {
    it('starts disconnected', () => {
      expect(backend.isConnected()).toBe(false);
    });

    it('connects successfully', async () => {
      await backend.connect();
      expect(backend.isConnected()).toBe(true);
    });

    it('disconnects successfully', async () => {
      await backend.connect();
      backend.disconnect();
      expect(backend.isConnected()).toBe(false);
    });
  });

  describe('runtime.info', () => {
    it('returns runtime info even when disconnected', async () => {
      const req = makeRequest(OPS.RUNTIME_INFO, {});
      const res = await backend.request(req);

      expect(res.ok).toBe(true);
      expect(res.result).toMatchObject({
        runtime: 'demo',
        engine_present: false,
        mode: 'demo',
      });
    });
  });

  describe('auth.set', () => {
    beforeEach(async () => {
      await backend.connect();
    });

    it('sets auth context successfully', async () => {
      const req = makeRequest(OPS.AUTH_SET, {
        tenantId: 'tenant-123',
        sub: 'user-456',
        jwt: 'test-jwt',
      });
      const res = await backend.request(req);

      expect(res.ok).toBe(true);
    });

    it('fails without required fields', async () => {
      const req = makeRequest(OPS.AUTH_SET, { tenantId: 'test' });
      const res = await backend.request(req);

      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe('INVALID_PAYLOAD');
    });

    it('requires connection', async () => {
      backend.disconnect();
      const req = makeRequest(OPS.AUTH_SET, {
        tenantId: 'tenant-123',
        sub: 'user-456',
        jwt: 'test-jwt',
      });
      const res = await backend.request(req);

      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe('NOT_CONNECTED');
    });
  });

  describe('home.status', () => {
    beforeEach(async () => {
      await backend.connect();
    });

    it('returns BOOTSTRAP_PRE_LOGIN before auth', async () => {
      const req = makeRequest(OPS.HOME_STATUS, {});
      const res = await backend.request(req);

      expect(res.ok).toBe(true);
      expect((res.result as Record<string, unknown>).state).toBe('BOOTSTRAP_PRE_LOGIN');
      expect((res.result as Record<string, unknown>).grantPresent).toBe(false);
    });

    it('returns AUTHENTICATED_NO_HOME_GRANT after auth', async () => {
      // Set auth first
      await backend.request(
        makeRequest(OPS.AUTH_SET, {
          tenantId: 'tenant-123',
          sub: 'user-456',
          jwt: 'test-jwt',
        })
      );

      const req = makeRequest(OPS.HOME_STATUS, {});
      const res = await backend.request(req);

      expect(res.ok).toBe(true);
      expect((res.result as Record<string, unknown>).state).toBe('AUTHENTICATED_NO_HOME_GRANT');
    });
  });

  describe('home.grant', () => {
    beforeEach(async () => {
      await backend.connect();
    });

    it('fails without auth', async () => {
      const req = makeRequest(OPS.HOME_GRANT, {});
      const res = await backend.request(req);

      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe('NOT_AUTHENTICATED');
    });

    it('succeeds with auth', async () => {
      // Set auth first
      await backend.request(
        makeRequest(OPS.AUTH_SET, {
          tenantId: 'tenant-123',
          sub: 'user-456',
          jwt: 'test-jwt',
        })
      );

      const req = makeRequest(OPS.HOME_GRANT, {});
      const res = await backend.request(req);

      expect(res.ok).toBe(true);
      expect((res.result as Record<string, unknown>).success).toBe(true);
      expect((res.result as Record<string, unknown>).grant_id).toBeDefined();
    });

    it('changes status to HOME_GRANTED', async () => {
      // Set auth
      await backend.request(
        makeRequest(OPS.AUTH_SET, {
          tenantId: 'tenant-123',
          sub: 'user-456',
          jwt: 'test-jwt',
        })
      );

      // Request grant
      await backend.request(makeRequest(OPS.HOME_GRANT, {}));

      // Check status
      const res = await backend.request(makeRequest(OPS.HOME_STATUS, {}));

      expect(res.ok).toBe(true);
      expect((res.result as Record<string, unknown>).state).toBe('HOME_GRANTED');
      expect((res.result as Record<string, unknown>).grantPresent).toBe(true);
    });
  });

  describe('unknown operation', () => {
    beforeEach(async () => {
      await backend.connect();
    });

    it('returns error for unknown op', async () => {
      const req = makeRequest('unknown.op', {});
      const res = await backend.request(req);

      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe('INVALID_OP');
    });
  });
});
