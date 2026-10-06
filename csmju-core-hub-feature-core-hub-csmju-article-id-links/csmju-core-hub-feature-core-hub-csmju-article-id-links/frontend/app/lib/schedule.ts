import type { ClassSession } from "./api";

/** Where a class stands against the current time. */
export type SessionState = "done" | "now" | "next" | "later";

export type TodaySession = ClassSession & { state: SessionState };

/** Minutes since midnight of "HH:mm". */
function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * The weekday (1 = Monday … 7 = Sunday) and minute of the day in Thailand,
 * whatever time zone the server runs in — class times are stored in Thai time.
 */
export function bangkokNow(now = new Date()): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/**
 * Today's classes in order, each marked done / now / next / later. Only the
 * first class that has not started yet is `next` — the one to remind about.
 */
export function todaysSessions(sessions: ClassSession[], now = new Date()): TodaySession[] {
  const { day, minutes } = bangkokNow(now);
  let nextTaken = false;

  return sessions
    .filter((s) => s.dayOfWeek === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((s) => {
      const start = minutesOf(s.startTime);
      const end = minutesOf(s.endTime);
      let state: SessionState;
      if (minutes >= end) state = "done";
      else if (minutes >= start) state = "now";
      else if (!nextTaken) {
        state = "next";
        nextTaken = true;
      } else state = "later";
      return { ...s, state };
    });
}

/** Minutes until a class starts, from the same clock as `todaysSessions`. */
export function minutesUntil(session: ClassSession, now = new Date()): number {
  return minutesOf(session.startTime) - bangkokNow(now).minutes;
}

export function roomLabel(session: ClassSession): string {
  if (!session.room) return "ยังไม่ระบุห้องเรียน";
  return `${session.room.nameTh} ${session.room.buildingNameTh}`.trim();
}

/** "ใน 1 ชม. 20 นาที" style countdown. */
export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return "เริ่มแล้ว";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `อีก ${m} นาที`;
  return m === 0 ? `อีก ${h} ชม.` : `อีก ${h} ชม. ${m} นาที`;
}

/** The bell's reminder for the class that is on now or starts next today. */
export function classReminder(
  sessions: ClassSession[],
  now = new Date(),
): { title: string; detail: string } | null {
  const today = todaysSessions(sessions, now);
  const current = today.find((s) => s.state === "now");
  const upcoming = today.find((s) => s.state === "next");
  const session = current ?? upcoming;
  if (!session) return null;

  const when = current
    ? `${session.involvement === "TEACH" ? "กำลังสอน" : "กำลังเรียน"}อยู่ ถึง ${session.endTime} น.`
    : `${formatCountdown(minutesUntil(session, now))} (${session.startTime} น.)`;
  const teaching = session.involvement === "TEACH";
  const label = current
    ? teaching
      ? "วิชาที่กำลังสอน"
      : "วิชาที่กำลังเรียน"
    : teaching
      ? "คาบสอนถัดไป"
      : "วิชาถัดไป";
  return {
    title: `${label}: ${session.course.code} ${session.course.nameTh}`,
    detail: `${when} · ${roomLabel(session)}`,
  };
}
