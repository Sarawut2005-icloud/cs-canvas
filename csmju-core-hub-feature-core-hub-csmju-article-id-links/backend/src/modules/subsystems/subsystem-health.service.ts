import { Injectable, Logger } from '@nestjs/common';

import { SubsystemActor, SubsystemsService } from './subsystems.service';

export type SubsystemHealthStatus = 'UP' | 'DOWN' | 'NO_BASE_URL';

/** What `GET /subsystems/:id/health` answers with. */
export interface SubsystemHealth {
  status: SubsystemHealthStatus;
  httpStatus?: number;
  latencyMs?: number;
  /** `service` field the subsystem reported from `/api/health`. */
  service?: string;
  /** Whether that name matches the registry entry — a warning, not DOWN. */
  serviceMatches?: boolean;
  checkedAt: string;
  /** Short reason for DOWN — never a stack trace. */
  error?: string;
  /** True when a recent result was replayed instead of probing again. */
  cached?: boolean;
}

/** How long a probe may take before the subsystem counts as DOWN. */
const PROBE_TIMEOUT_MS = 3_000;

/** A subsystem is probed at most once per this window (guards against click spam). */
const MIN_INTERVAL_MS = 3_000;

/** Body shapes a health endpoint may answer with: the Core Hub envelope, or raw. */
type HealthBody = { data?: { service?: unknown }; service?: unknown };

function serviceNameOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { data, service } = body as HealthBody;
  const candidate =
    typeof data === 'object' && data !== null ? data.service : service;
  return typeof candidate === 'string' ? candidate : undefined;
}

/** One line for the response — `fetch` errors carry hostnames, not secrets. */
function shortError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return `No response within ${PROBE_TIMEOUT_MS} ms`;
    }
    const cause = (error as { cause?: { code?: string } }).cause?.code;
    return cause ? `${error.message} (${cause})` : error.message;
  }
  return 'Request failed';
}

/**
 * On-demand health probe of a registered subsystem (Monitor v1).
 *
 * Only the `baseUrl` stored in the registry is ever fetched — the request
 * carries no URL — and redirects are not followed, so the Core API cannot be
 * turned into a proxy for arbitrary hosts. Access follows the registry's
 * read rule: staff see their own subsystems, admins every one.
 */
@Injectable()
export class SubsystemHealthService {
  private readonly logger = new Logger(SubsystemHealthService.name);

  /** Last real probe per subsystem id, for the rate limit. */
  private readonly recent = new Map<
    string,
    { at: number; result: SubsystemHealth }
  >();

  constructor(private readonly subsystems: SubsystemsService) {}

  async check(id: string, actor: SubsystemActor): Promise<SubsystemHealth> {
    const subsystem = await this.subsystems.findOne(id, actor);

    if (!subsystem.baseUrl) {
      return { status: 'NO_BASE_URL', checkedAt: new Date().toISOString() };
    }

    const last = this.recent.get(subsystem.id);
    if (last && Date.now() - last.at < MIN_INTERVAL_MS) {
      return { ...last.result, cached: true };
    }

    const result = await this.probe(subsystem.baseUrl, subsystem.name);
    this.recent.set(subsystem.id, { at: Date.now(), result });

    this.logger.log(
      JSON.stringify({
        event: 'subsystem.health_checked',
        subsystem: subsystem.name,
        status: result.status,
        httpStatus: result.httpStatus,
        latencyMs: result.latencyMs,
      }),
    );

    return result;
  }

  private async probe(
    baseUrl: string,
    expectedService: string,
  ): Promise<SubsystemHealth> {
    const startedAt = Date.now();
    const checkedAt = new Date(startedAt).toISOString();
    const latency = () => Date.now() - startedAt;

    let response: Response;
    try {
      response = await fetch(new URL('/api/health', baseUrl), {
        redirect: 'manual',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });
    } catch (error) {
      return {
        status: 'DOWN',
        latencyMs: latency(),
        checkedAt,
        error: shortError(error),
      };
    }

    if (response.status !== 200) {
      return {
        status: 'DOWN',
        httpStatus: response.status,
        latencyMs: latency(),
        checkedAt,
        error:
          response.status >= 300 && response.status < 400
            ? `Redirected (HTTP ${response.status}) — redirects are not followed`
            : `HTTP ${response.status}`,
      };
    }

    const service = serviceNameOf(await response.json().catch(() => null));

    if (!service) {
      return {
        status: 'DOWN',
        httpStatus: 200,
        latencyMs: latency(),
        checkedAt,
        error: 'Health response has no `service` field',
      };
    }

    return {
      status: 'UP',
      httpStatus: 200,
      latencyMs: latency(),
      service,
      serviceMatches: service === expectedService,
      checkedAt,
    };
  }
}
