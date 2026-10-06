import Link from "next/link";
import { LocationIcon } from "../components/icons";
import {
  getCurrentTerm,
  getCurrentUser,
  getMyPerson,
  getMySchedule,
} from "../lib/api";
import { getNewsFeed } from "../lib/news-feed";
import {
  formatCountdown,
  minutesUntil,
  roomLabel,
  todaysSessions,
  type TodaySession,
} from "../lib/schedule";
import { roleLabel, userHandle, type UserRole } from "../lib/session";
import DashboardNews from "./DashboardNews";
import MyOverview from "./MyOverview";
import RetryButton from "../components/RetryButton";

/** How many news items the dashboard loads; the list reveals them as you scroll. */
const NEWS_LIMIT = 30;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 border-l-4 border-primary-container pl-3 font-display text-headline-md text-on-surface">
      {children}
    </h3>
  );
}

/**
 * Students and alumni get their own record (handoff 2.1); everyone else
 * keeps the staff page with today's teaching.
 */
function isLearner(role: UserRole | undefined): boolean {
  return role === "student" || role === "alumni";
}

const DASHBOARD_TITLE: Partial<Record<UserRole, string>> = {
  student: "ภาพรวมแดชบอร์ดนักศึกษา",
  alumni: "ภาพรวมแดชบอร์ดศิษย์เก่า",
};

function ScheduleItem({ item }: { item: TodaySession }) {
  const highlighted = item.state === "now" || item.state === "next";
  const done = item.state === "done";
  const badge =
    item.state === "now" ? (item.involvement === "TEACH" ? "กำลังสอน" : "กำลังเรียน") : null;

  return (
    <div className="relative pl-6 before:absolute before:bottom-[-24px] before:left-[11px] before:top-2 before:w-0.5 before:bg-surface-container last:before:hidden">
      <span
        className={`absolute left-0 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border-4 border-surface-container-lowest ${
          highlighted ? "brand-gradient" : "bg-surface-container"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${highlighted ? "bg-white" : "bg-outline"}`} />
      </span>
      <div
        className={`rounded-lg border p-4 ${
          highlighted
            ? "border-primary-container/40 bg-background"
            : "border-surface-variant/50 bg-surface-container-lowest"
        } ${done ? "opacity-60" : ""}`}
      >
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className={`text-caption font-bold ${highlighted ? "text-primary-container" : "text-outline"}`}>
            {item.startTime} - {item.endTime} น.
          </p>
          {highlighted && (
            <span className="rounded-full bg-primary-container px-2 py-0.5 text-caption font-semibold text-white">
              {badge ?? formatCountdown(minutesUntil(item))}
            </span>
          )}
        </div>
        <h4
          className={`mb-1 text-label-md font-bold ${
            highlighted ? "text-on-surface" : "text-on-surface-variant"
          }`}
        >
          {item.course.code}: {item.course.nameTh}
        </h4>
        <p className="flex items-start gap-1 text-[14px] text-on-surface-variant">
          <LocationIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {roomLabel(item)}
            <span className="whitespace-nowrap text-outline"> · กลุ่ม {item.sectionNo}</span>
          </span>
        </p>
      </div>
    </div>
  );
}

/**
 * The API could not be reached — an error, not "no data"
 * (ui-design-system.md §9.3, no network / timeout).
 */
function LoadError() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant px-4 py-8 text-center">
      <p className="text-body-md text-on-surface-variant">
        เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง
      </p>
      <RetryButton />
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const learner = isLearner(user?.role);
  // Timetables belong to subsystems (PM 2026-10-05): students get none here.
  const [person, schedule, news, term] = await Promise.all([
    getMyPerson(),
    learner ? Promise.resolve([]) : getMySchedule(),
    getNewsFeed(NEWS_LIMIT),
    learner ? getCurrentTerm() : Promise.resolve(null),
  ]);
  const today = todaysSessions(schedule ?? []);
  const showSchedule = !learner;
  const name = person?.fullNameTh ?? (user ? userHandle(user) : null);

  return (
    <>
      <div className="fade-slide-up mb-10 flex items-end justify-between gap-4">
        <div>
          <h2 className="mb-2 font-display text-[24px] font-bold leading-[1.3] text-on-surface md:text-headline-lg">
            {(user && DASHBOARD_TITLE[user.role]) ?? "ภาพรวมแดชบอร์ด"}
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            {user && name
              ? `ยินดีต้อนรับกลับ, ${name} (${roleLabel(user.role)})`
              : "ยินดีต้อนรับกลับ"}
          </p>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-8 ${showSchedule ? "xl:grid-cols-3" : ""}`}>
        {/* MAIN COLUMN */}
        <div className={`flex flex-col gap-8 ${showSchedule ? "xl:col-span-2" : ""}`}>
          {learner && <MyOverview person={person} term={term} />}

          {/* News */}
          <section className="fade-slide-up stagger-2">
            <div className="mb-6 flex items-center justify-between gap-4">
              <SectionHeading>ข่าวสารล่าสุดของสาขา</SectionHeading>
              <Link href="/news" className="shrink-0 text-label-md text-primary-container hover:underline">
                ดูทั้งหมด
              </Link>
            </div>
            <DashboardNews items={news.items} failed={news.failed} />
          </section>
        </div>

        {/* SIDE COLUMN — today's teaching, for staff, lecturers and admins */}
        {showSchedule && (
          <div className="flex flex-col gap-8">
            <section className="fade-slide-up stagger-3 flex flex-col rounded-xl border border-surface-variant bg-surface-container-lowest p-6 shadow-sm xl:sticky xl:top-8">
              <div className="mb-6">
                <SectionHeading>ตารางสอนวันนี้</SectionHeading>
              </div>

              {schedule === null ? (
                <LoadError />
              ) : today.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {today.map((item) => (
                    <ScheduleItem key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-outline-variant px-4 py-8 text-center text-body-md text-on-surface-variant">
                  {schedule.length > 0 ? "วันนี้ไม่มีคาบสอน" : "ยังไม่มีข้อมูลตารางสอนของภาคการศึกษานี้"}
                </p>
              )}

            </section>
          </div>
        )}
      </div>
    </>
  );
}
