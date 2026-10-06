import type { Status, StatusTone } from "../../lib/backoffice/types";

export const TONE_STYLES: Record<StatusTone, { badge: string; dot: string; label: string }> = {
  success: { badge: "bg-success/10 text-emerald-700", dot: "bg-success", label: "เขียว" },
  info: { badge: "bg-primary-container/10 text-primary-container", dot: "bg-primary-container", label: "น้ำเงิน" },
  warning: { badge: "bg-amber-100 text-amber-800", dot: "bg-amber-500", label: "ส้ม" },
  error: { badge: "bg-error-container text-on-error-container", dot: "bg-error", label: "แดง" },
  neutral: { badge: "bg-surface-variant text-on-surface-variant", dot: "bg-outline", label: "เทา" },
};

export const TONES = Object.keys(TONE_STYLES) as StatusTone[];

export default function StatusBadge({ status }: { status: Status | undefined }) {
  const tone = TONE_STYLES[status?.tone ?? "neutral"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-label-sm ${tone.badge}`}
    >
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
      {status?.label ?? "ไม่ระบุสถานะ"}
    </span>
  );
}
