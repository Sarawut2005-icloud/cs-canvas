/**
 * Display formats from ui-design-system.md §11.3 — Buddhist year, fixed to
 * Asia/Bangkok regardless of the viewer's machine. The API always sends ISO.
 */
const TIME_ZONE = "Asia/Bangkok";

const dateFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const timeFormat = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});

/** `11 ส.ค. 2569` */
export function formatDate(value: string | Date): string {
  return dateFormat.format(new Date(value));
}

/** `11 ส.ค. 2569 09:30 น.` */
export function formatDateTime(value: string | Date): string {
  const date = new Date(value);
  return `${dateFormat.format(date)} ${timeFormat.format(date)} น.`;
}

/** `2,450` */
export function formatNumber(value: number): string {
  return value.toLocaleString("th-TH");
}
