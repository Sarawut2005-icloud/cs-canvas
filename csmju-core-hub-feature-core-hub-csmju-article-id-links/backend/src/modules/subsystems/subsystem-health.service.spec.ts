import { ForbiddenException } from '@nestjs/common';

import { SubsystemHealthService } from './subsystem-health.service';
import { SubsystemActor, SubsystemsService } from './subsystems.service';

const ADMIN: SubsystemActor = { id: 'user-001', role: 'admin' };

function registered(baseUrl: string | null = 'http://localhost:3001') {
  return { id: 'sub-1', name: 'student-service', baseUrl };
}

/** A `Response` as the probe reads it — status plus a JSON body. */
function reply(status: number, body: unknown = null): Response {
  return {
    status,
    json: () =>
      body === null
        ? Promise.reject(new Error('no body'))
        : Promise.resolve(body),
  } as unknown as Response;
}

function healthy(service = 'student-service') {
  return reply(200, { success: true, data: { status: 'ok', service } });
}

describe('SubsystemHealthService', () => {
  let fetchMock: jest.SpyInstance;
  let findOne: jest.Mock;
  let service: SubsystemHealthService;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    findOne = jest.fn().mockResolvedValue(registered());
    service = new SubsystemHealthService({
      findOne,
    } as unknown as SubsystemsService);
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('reports UP with latency when /api/health answers 200 with the right service', async () => {
    fetchMock.mockResolvedValue(healthy());

    const result = await service.check('sub-1', ADMIN);

    expect(result).toMatchObject({
      status: 'UP',
      httpStatus: 200,
      service: 'student-service',
      serviceMatches: true,
    });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.checkedAt).toMatch(/Z$/);
    expect(result.cached).toBeUndefined();
  });

  it('probes only the registered baseUrl, without following redirects', async () => {
    fetchMock.mockResolvedValue(healthy());

    await service.check('sub-1', ADMIN);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://localhost:3001/api/health');
    expect(init.redirect).toBe('manual');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('accepts a raw (non-enveloped) health body too', async () => {
    fetchMock.mockResolvedValue(
      reply(200, { status: 'ok', service: 'student-service' }),
    );

    await expect(service.check('sub-1', ADMIN)).resolves.toMatchObject({
      status: 'UP',
      serviceMatches: true,
    });
  });

  it('stays UP but flags a service name that differs from the registry', async () => {
    fetchMock.mockResolvedValue(healthy('equipment-service'));

    await expect(service.check('sub-1', ADMIN)).resolves.toMatchObject({
      status: 'UP',
      service: 'equipment-service',
      serviceMatches: false,
    });
  });

  it('reports DOWN with the HTTP status on a 500', async () => {
    fetchMock.mockResolvedValue(reply(500));

    const result = await service.check('sub-1', ADMIN);

    expect(result).toMatchObject({ status: 'DOWN', httpStatus: 500 });
    expect(result.error).toBe('HTTP 500');
    expect(result.service).toBeUndefined();
  });

  it('reports DOWN on a redirect instead of following it', async () => {
    fetchMock.mockResolvedValue(reply(302));

    const result = await service.check('sub-1', ADMIN);

    expect(result).toMatchObject({ status: 'DOWN', httpStatus: 302 });
    expect(result.error).toMatch(/redirects are not followed/);
  });

  it('reports DOWN with a short message on timeout — no stack trace', async () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeout);

    const result = await service.check('sub-1', ADMIN);

    expect(result.status).toBe('DOWN');
    expect(result.httpStatus).toBeUndefined();
    expect(result.error).toBe('No response within 3000 ms');
    expect(JSON.stringify(result)).not.toMatch(/at .*\.ts/);
  });

  it('reports DOWN when the connection is refused', async () => {
    const refused = new Error('fetch failed');
    const ECONNREFUSED = 'ECONNREFUSED';
    (refused as { cause?: unknown }).cause = { code: ECONNREFUSED };
    fetchMock.mockRejectedValue(refused);

    await expect(service.check('sub-1', ADMIN)).resolves.toMatchObject({
      status: 'DOWN',
      error: 'fetch failed (ECONNREFUSED)',
    });
  });

  it('reports DOWN when a 200 body has no service field', async () => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }));

    await expect(service.check('sub-1', ADMIN)).resolves.toMatchObject({
      status: 'DOWN',
      httpStatus: 200,
      error: 'Health response has no `service` field',
    });
  });

  it('answers NO_BASE_URL without probing when no baseUrl is registered', async () => {
    findOne.mockResolvedValue(registered(null));

    const result = await service.check('sub-1', ADMIN);

    expect(result.status).toBe('NO_BASE_URL');
    expect(result.checkedAt).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('replays the last result within 3 s instead of probing again', async () => {
    fetchMock.mockResolvedValue(healthy());

    const first = await service.check('sub-1', ADMIN);
    const second = await service.check('sub-1', ADMIN);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ ...first, cached: true });
  });

  it('probes again once the 3 s window has passed', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-27T10:00:00.000Z') });
    try {
      fetchMock.mockResolvedValue(healthy());

      await service.check('sub-1', ADMIN);
      jest.setSystemTime(new Date('2026-09-27T10:00:03.500Z'));
      const later = await service.check('sub-1', ADMIN);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(later.cached).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the rate limit per subsystem', async () => {
    fetchMock.mockResolvedValue(healthy());
    findOne
      .mockResolvedValueOnce(registered())
      .mockResolvedValueOnce({ ...registered(), id: 'sub-2', name: 'other' });

    await service.check('sub-1', ADMIN);
    await service.check('sub-2', ADMIN);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('applies the registry read rule before probing (staff, not owner → 403)', async () => {
    findOne.mockRejectedValue(
      new ForbiddenException('You do not have access to this subsystem'),
    );

    await expect(
      service.check('sub-1', { id: 'user-003', role: 'staff' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
