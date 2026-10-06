import Link from "next/link";
import {
  AppsIcon,
  ArrowForwardIcon,
  CalendarTodayIcon,
  CampaignIcon,
  GroupIcon,
  SchoolIcon,
} from "../components/icons";
import {
  ApiError,
  getBackofficeSummary,
  getCurrentUser,
  listAnnouncements,
  type Announcement,
  type BackofficeSummary,
} from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import { roleLabel } from "../lib/session";
import { cardClass } from "./_components/ui";
import AnnouncementsTable from "./news/AnnouncementsTable";

function describeLoadError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 403
      ? "บัญชีของคุณไม่มีสิทธิ์ดูข้อมูลสรุป"
      : `ไม่สามารถโหลดข้อมูลได้ (${err.message})`;
  }
  return "ไม่สามารถเชื่อมต่อ API ได้";
}

/**
 * ภาพรวม — ตัวเลขทุกใบมาจาก GET /backoffice/summary ก้อนเดียว (B7)
 * และประกาศล่าสุด 5 ชิ้นจาก GET /announcements — ไม่มีข้อมูล hardcode อีก
 */
export default async function BackofficeOverviewPage() {
  let summary: BackofficeSummary | null = null;
  let announcements: Announcement[] = [];
  let loadError: string | null = null;
  let announcementsError: string | null = null;

  const [user, [summaryResult, announcementsResult]] = await Promise.all([
    getCurrentUser(),
    Promise.allSettled([
      getBackofficeSummary(),
      listAnnouncements({ limit: 5 }),
    ]),
  ]);

  if (summaryResult.status === "fulfilled") summary = summaryResult.value;
  else loadError = describeLoadError(summaryResult.reason);

  if (announcementsResult.status === "fulfilled")
    announcements = announcementsResult.value.data;
  else announcementsError = describeLoadError(announcementsResult.reason);

  const n = (value: number | undefined) =>
    summary && value !== undefined ? formatNumber(value) : "—";

  const byRole = summary?.users.byRole;
  const students = summary?.people.students;
  const term = summary?.currentTerm;

  const stats = [
    {
      label: "ผู้ใช้งานทั้งหมด",
      value: n(
        byRole ? Object.values(byRole).reduce((sum, v) => sum + v, 0) : undefined,
      ),
      Icon: GroupIcon,
      accent: true,
      caption: byRole
        ? (["admin", "staff", "lecturer", "student", "alumni", "guest"] as const)
            .map((role) => `${roleLabel(role)} ${formatNumber(byRole[role] ?? 0)}`)
            .join(" · ")
        : "ทุกบทบาทในระบบ",
    },
    {
      label: "นักศึกษากำลังศึกษา",
      value: n(students?.ACTIVE),
      Icon: SchoolIcon,
      accent: false,
      caption: students
        ? `พ้นสภาพ ${formatNumber(students.INACTIVE)} · สำเร็จการศึกษา ${formatNumber(students.GRADUATED)}`
        : "จากทะเบียนบุคคล",
    },
    {
      label: "บุคลากร",
      value: n(summary?.people.staff),
      Icon: SchoolIcon,
      accent: false,
      caption: "อาจารย์และเจ้าหน้าที่ในทะเบียน",
    },
    {
      label: "ระบบย่อยเปิดใช้งาน",
      value: n(summary?.subsystems.byStatus.ACTIVE),
      Icon: AppsIcon,
      accent: false,
      caption: summary ? (
        <Link
          href="/backoffice/subsystems?tab=pending"
          className="hover:underline"
        >
          รออนุมัติ {formatNumber(summary.subsystems.byApproval.PENDING)} รายการ
        </Link>
      ) : (
        "จากทะเบียนระบบย่อย"
      ),
    },
    {
      label: "ภาคเรียนปัจจุบัน",
      value: summary ? (term?.code ?? "ยังไม่กำหนด") : "—",
      Icon: CalendarTodayIcon,
      accent: false,
      caption: term ? `สิ้นสุด ${formatDate(term.endDate)}` : "ตั้งค่าได้ที่ข้อมูลอ้างอิง",
    },
  ];

  return (
    <>
      <div className="fade-slide-up">
        <h2 className="mb-2 font-display text-headline-lg text-on-surface">
          BackOffice
        </h2>
        <p className="text-body-md text-on-surface-variant">
          ข้อมูลสรุปของ Core Hub และประกาศล่าสุด
        </p>
      </div>

      {loadError && (
        <p className="fade-slide-up rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-body-md text-error">
          {loadError}
        </p>
      )}

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {stats.map(({ label, value, Icon, accent, caption }, index) => (
          <div
            key={label}
            className={`fade-slide-up stagger-${Math.min(index + 1, 3)} flex h-40 flex-col justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm transition-shadow hover:shadow-md`}
          >
            <div className="flex items-start justify-between">
              <span className="text-label-md text-on-surface-variant">
                {label}
              </span>
              <div
                className={`rounded-lg p-2.5 ${
                  accent
                    ? "bg-btn-gradient text-white shadow-sm"
                    : "bg-primary-container/10 text-primary-container"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
            </div>
            <div>
              <h3 className="font-display text-display-lg text-primary-container">
                {value}
              </h3>
              <p className="mt-1 text-label-sm text-secondary">{caption}</p>
            </div>
          </div>
        ))}
      </div>

      {/* RECENT NEWS */}
      <div className={`fade-slide-up stagger-3 ${cardClass}`}>
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant/40 px-6 py-5">
          <h3 className="flex items-center gap-2 font-display text-headline-md text-on-surface">
            <CampaignIcon className="h-5 w-5 text-primary-container" />
            ประกาศล่าสุด
          </h3>
          <Link
            href="/backoffice/news"
            className="flex shrink-0 items-center gap-1 text-label-md text-primary-container hover:underline"
          >
            ดูทั้งหมด
            <ArrowForwardIcon className="h-4 w-4" />
          </Link>
        </div>

        {announcementsError ? (
          <p className="px-6 py-8 text-center text-body-md text-on-surface-variant">
            {announcementsError}
          </p>
        ) : (
          <AnnouncementsTable
            announcements={announcements}
            canDelete={user?.role === "admin"}
          />
        )}
      </div>
    </>
  );
}
