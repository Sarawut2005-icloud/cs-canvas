"use client";

import Link from "next/link";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { MonitorHeartIcon } from "../../../components/icons";
import type { Subsystem, SubsystemHealth } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import StatusBadge, { TONE_STYLES } from "../../_components/StatusBadge";
import { cardClass, secondaryButtonClass, tdClass, thClass } from "../../_components/ui";
import { EmptyState } from "../_components/StateViews";
import SubsystemBadges from "../_components/SubsystemBadges";
import FilterBox, { matchesQuery } from "../../../components/FilterBox";
import { checkSubsystemHealth } from "./actions";

/** How many probes run at once — the API caps each one at 3 s anyway. */
const CONCURRENCY = 3;

type RowState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; health: SubsystemHealth }
  | { kind: "error"; message: string };

const HEALTH_BADGE = {
  UP: { id: "UP", label: "UP", tone: "success" as const },
  DOWN: { id: "DOWN", label: "DOWN", tone: "error" as const },
  NO_BASE_URL: { id: "NO_BASE_URL", label: "ไม่มี base URL", tone: "neutral" as const },
};

/**
 * Queue with at most CONCURRENCY probes in flight. Lives outside React state
 * (created once per table) so re-renders never restart or duplicate a probe.
 */
function createProbeQueue(setRows: Dispatch<SetStateAction<Record<string, RowState>>>) {
  const queue: string[] = [];
  const running = new Set<string>();

  const pump = () => {
    while (running.size < CONCURRENCY && queue.length > 0) {
      const id = queue.shift()!;
      running.add(id);
      setRows((prev) => ({ ...prev, [id]: { kind: "loading" } }));
      void checkSubsystemHealth(id).then((result) => {
        running.delete(id);
        setRows((prev) => ({
          ...prev,
          [id]: result.ok
            ? { kind: "done", health: result.data }
            : { kind: "error", message: result.error },
        }));
        pump();
      });
    }
  };

  /** Queues ids that are not already queued or running. */
  return (ids: string[]) => {
    for (const id of ids) {
      if (!running.has(id) && !queue.includes(id)) queue.push(id);
    }
    pump();
  };
}

export default function MonitorTable({ subsystems }: { subsystems: Subsystem[] }) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(subsystems.map((s) => [s.id, { kind: "idle" }])),
  );
  const [probe] = useState(() => createProbeQueue(setRows));
  const [query, setQuery] = useState("");
  const visible = subsystems.filter((s) => matchesQuery(query, s.name, s.displayName));

  useEffect(() => {
    probe(subsystems.map((s) => s.id));
  }, [probe, subsystems]);

  const states = Object.values(rows);
  const pendingCount = states.filter((r) => r.kind === "loading").length;
  const doneCount = states.filter((r) => r.kind !== "idle" && r.kind !== "loading").length;
  const count = (status: SubsystemHealth["status"]) =>
    states.filter((r) => r.kind === "done" && r.health.status === status).length;
  const announcement =
    pendingCount > 0
      ? `กำลังตรวจ ${pendingCount} ระบบ`
      : doneCount > 0
        ? `ตรวจเสร็จ ${doneCount} ระบบ`
        : "";

  if (subsystems.length === 0) {
    return (
      <div className={`fade-slide-up stagger-1 ${cardClass}`}>
        <EmptyState
          Icon={MonitorHeartIcon}
          title="ยังไม่มีระบบย่อยให้ตรวจ"
          description="ระบบย่อยที่ลงทะเบียนไว้จะปรากฏที่นี่ พร้อมผลการเรียก /api/health"
        />
      </div>
    );
  }

  const summary = [
    { label: "UP", value: count("UP"), tone: "success" as const },
    { label: "DOWN", value: count("DOWN"), tone: "error" as const },
    { label: "ไม่มี base URL", value: count("NO_BASE_URL"), tone: "neutral" as const },
  ];

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="fade-slide-up stagger-1 grid grid-cols-3 gap-4">
        {summary.map(({ label, value, tone }) => (
          <div
            key={label}
            className="flex flex-col gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm"
          >
            <span className="flex items-center gap-2 text-label-md text-on-surface-variant">
              <span className={`h-2.5 w-2.5 rounded-full ${TONE_STYLES[tone].dot}`} />
              {label}
            </span>
            <span className="font-display text-headline-lg text-on-surface tabular-nums">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className={`fade-slide-up stagger-2 ${cardClass}`}>
        <div className="flex flex-col gap-3 border-b border-outline-variant/40 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <p className="text-body-md text-on-surface-variant">
            {pendingCount > 0
              ? `กำลังตรวจ ${pendingCount} ระบบ…`
              : `ตรวจแล้ว ${doneCount} จาก ${subsystems.length} ระบบ`}
          </p>
          <FilterBox
            value={query}
            onChange={setQuery}
            label="ค้นหาระบบย่อย"
            placeholder="ค้นหาชื่อระบบ"
            className="md:ml-auto md:w-64"
          />
          <button
            type="button"
            onClick={() => probe(subsystems.map((s) => s.id))}
            disabled={pendingCount > 0}
            aria-busy={pendingCount > 0}
            className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            ตรวจใหม่ทั้งหมด
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                <th scope="col" className={thClass}>ระบบ</th>
                <th scope="col" className={thClass}>สถานะทะเบียน</th>
                <th scope="col" className={thClass}>ผล health</th>
                <th scope="col" className={thClass}>Latency</th>
                <th scope="col" className={thClass}>เช็กเมื่อ</th>
                <th scope="col" className={`${thClass} text-right`}>จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-body-md">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-on-surface-variant">
                    ไม่พบระบบที่ตรงกับ &ldquo;{query}&rdquo;
                  </td>
                </tr>
              )}
              {visible.map((subsystem) => (
                <MonitorRow
                  key={subsystem.id}
                  subsystem={subsystem}
                  state={rows[subsystem.id] ?? { kind: "idle" }}
                  onRecheck={() => probe([subsystem.id])}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function MonitorRow({
  subsystem,
  state,
  onRecheck,
}: {
  subsystem: Subsystem;
  state: RowState;
  onRecheck: () => void;
}) {
  const pending = state.kind === "loading";
  const editHref = `/backoffice/subsystems/${encodeURIComponent(subsystem.id)}/edit`;

  return (
    <tr className="border-b border-outline-variant/40 last:border-0" aria-busy={pending}>
      <td className={tdClass}>
        <Link
          href={`/backoffice/subsystems/${encodeURIComponent(subsystem.id)}`}
          className="font-medium text-on-surface hover:text-primary-container hover:underline"
        >
          {subsystem.displayName}
        </Link>
        <p className="text-label-sm text-on-surface-variant">{subsystem.name}</p>
      </td>
      <td className={tdClass}>
        <SubsystemBadges subsystem={subsystem} />
      </td>
      <td className={tdClass}>
        <HealthCell state={state} editHref={editHref} />
      </td>
      <td className={`${tdClass} whitespace-nowrap tabular-nums text-on-surface-variant`}>
        {state.kind === "done" && state.health.latencyMs !== undefined
          ? `${state.health.latencyMs} ms`
          : "—"}
      </td>
      <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
        {state.kind === "done" ? (
          <>
            <time dateTime={state.health.checkedAt}>{formatDateTime(state.health.checkedAt)}</time>
            {state.health.cached && <span className="ml-1 text-label-sm">(cache)</span>}
          </>
        ) : (
          "—"
        )}
      </td>
      <td className={`${tdClass} whitespace-nowrap text-right`}>
        <button
          type="button"
          onClick={onRecheck}
          disabled={pending}
          aria-busy={pending}
          aria-label={`ตรวจ ${subsystem.displayName} ใหม่`}
          className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {pending ? "กำลังตรวจ…" : "ตรวจใหม่"}
        </button>
      </td>
    </tr>
  );
}

function HealthCell({ state, editHref }: { state: RowState; editHref: string }) {
  if (state.kind === "idle") return <span className="text-on-surface-variant">—</span>;
  if (state.kind === "loading") {
    return <span className="text-on-surface-variant">กำลังตรวจ…</span>;
  }
  if (state.kind === "error") {
    return <span className="text-label-md text-error">{state.message}</span>;
  }

  const { health } = state;
  return (
    <div className="flex flex-col items-start gap-1.5">
      <StatusBadge status={HEALTH_BADGE[health.status]} />
      {health.status === "UP" && health.service && (
        <span className="text-label-sm text-on-surface-variant">
          service: <code>{health.service}</code>
        </span>
      )}
      {health.status === "DOWN" && (
        <span className="text-label-sm text-error">
          {health.error ?? "ไม่ตอบ"}
          {health.httpStatus !== undefined && ` (HTTP ${health.httpStatus})`}
        </span>
      )}
      {health.status === "NO_BASE_URL" && (
        <Link href={editHref} className="text-label-sm text-primary-container hover:underline">
          เพิ่ม base URL
        </Link>
      )}
      {health.serviceMatches === false && (
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-label-sm ${TONE_STYLES.warning.badge}`}
        >
          <span className={`h-2 w-2 rounded-full ${TONE_STYLES.warning.dot}`} />
          ชื่อ service ไม่ตรงทะเบียน{health.service ? ` (${health.service})` : ""}
        </span>
      )}
    </div>
  );
}
