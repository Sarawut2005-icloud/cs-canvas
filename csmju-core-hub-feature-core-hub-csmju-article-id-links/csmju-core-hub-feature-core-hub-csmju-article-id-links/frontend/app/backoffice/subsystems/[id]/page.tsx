import type { Metadata } from "next";
import Link from "next/link";
import { ArrowBackIcon } from "../../../components/icons";
import {
  getCurrentUser,
  getSubsystem,
  type AccountRef,
  type SubsystemDetail,
} from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import {
  CORE_ROLES,
  EVENT_LABELS,
  EXCEPTION_BADGE,
  FIELD_LABELS,
  capabilitiesFor,
  categoryLabel,
  formatFieldValue,
} from "../../../lib/subsystems";
import ChangeRequestPanel from "../_components/ChangeRequestPanel";
import StatusBadge from "../../_components/StatusBadge";
import { cardClass, tdClass, thClass } from "../../_components/ui";
import ExceptionDecision from "../_components/ExceptionDecision";
import ExceptionRequestForm from "../_components/ExceptionRequestForm";
import { EmptyState, ErrorState } from "../_components/StateViews";
import SubsystemActions from "../_components/SubsystemActions";
import SubsystemBadges from "../_components/SubsystemBadges";

export const metadata: Metadata = {
  title: "รายละเอียดระบบย่อย · BackOffice · CSMJU",
};

function who(person: AccountRef | null | undefined): string {
  if (!person) return "—";
  return person.username ?? person.email;
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: "error" | "warning" | "info";
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-error/30 bg-error-container text-on-error-container",
    warning: "border-amber-300 bg-amber-100 text-amber-800",
    info: "border-primary-container/30 bg-primary-container/10 text-primary-container",
  }[tone];
  return (
    <div role="note" className={`fade-slide-up rounded-xl border px-5 py-4 ${styles}`}>
      <p className="text-label-md">{title}</p>
      <p className="mt-1 text-body-md">{children}</p>
    </div>
  );
}

function StatusBanner({ subsystem }: { subsystem: SubsystemDetail }) {
  if (subsystem.approvalStatus === "PENDING") {
    return (
      <Banner tone="info" title="รอผู้ดูแลระบบพิจารณา">
        ระบบนี้จะเข้าใช้งานผ่าน SSO ได้หลังได้รับอนุมัติและเปิดใช้งานแล้ว
      </Banner>
    );
  }
  if (subsystem.approvalStatus === "REJECTED") {
    return (
      <Banner tone="error" title="คำขอถูกปฏิเสธ">
        {subsystem.rejectionReason ?? "ไม่ได้ระบุเหตุผล"} · แก้ไขข้อมูลแล้วกด
        &quot;ส่งคำขออีกครั้ง&quot;
      </Banner>
    );
  }
  if (subsystem.status === "SUSPENDED") {
    return (
      <Banner tone="error" title="ระบบถูกระงับ">
        {subsystem.statusReason ?? "ไม่ได้ระบุเหตุผล"}
      </Banner>
    );
  }
  if (subsystem.status === "INACTIVE") {
    return (
      <Banner tone="warning" title="ปิดใช้งานอยู่">
        {subsystem.statusReason ?? "ผู้ใช้ยังเข้าระบบนี้ผ่าน SSO ไม่ได้จนกว่าจะเปิดใช้งาน"}
      </Banner>
    );
  }
  return null;
}

export default async function SubsystemDetailPage({
  params,
}: PageProps<"/backoffice/subsystems/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const caps = capabilitiesFor(user?.role ?? "staff", user?.permissions);

  let subsystem: SubsystemDetail;
  try {
    subsystem = await getSubsystem(id);
  } catch (error) {
    return <ErrorState error={error} />;
  }

  const canEdit = caps.editReviewedFields || subsystem.ownerId === user?.id;
  const mapping = subsystem.defaultRoleMapping ?? {};

  const facts: [string, React.ReactNode][] = [
    ["เจ้าของ", `${who(subsystem.owner)} (${subsystem.owner.email})`],
    ["หมวด", categoryLabel(subsystem.category)],
    [
      "คำอธิบาย",
      subsystem.description ?? (
        <span key="desc" className="text-on-surface-variant">
          ยังไม่มี — เจ้าของระบบเพิ่มได้ที่ &ldquo;แก้ไข&rdquo;
        </span>
      ),
    ],
    ["แสดงในเมนูผู้ใช้", subsystem.listedInMenu ? "แสดง" : "ซ่อน (เข้าผ่าน SSO ได้ตามปกติ)"],
    ["Repository", subsystem.repo],
    ["เวอร์ชันมาตรฐาน", `v${subsystem.standardsVersion}`],
    [
      "Callback URL",
      <code key="cb" className="break-all text-body-md">
        {subsystem.callbackUrl}
      </code>,
    ],
    [
      "Base URL",
      subsystem.baseUrl ? (
        <code key="base" className="break-all text-body-md">
          {subsystem.baseUrl}
        </code>
      ) : (
        <span key="base" className="text-on-surface-variant">
          ยังไม่ตั้งค่า · หน้า Monitor จะแสดงเป็น NO_BASE_URL
        </span>
      ),
    ],
    ["ส่งคำขอเมื่อ", formatDateTime(subsystem.createdAt)],
    [
      "พิจารณาโดย",
      subsystem.reviewedAt
        ? `${who(subsystem.reviewedBy)} · ${formatDateTime(subsystem.reviewedAt)}`
        : "ยังไม่ได้พิจารณา",
    ],
  ];

  return (
    <>
      <Link
        href="/backoffice/subsystems"
        className="fade-slide-up inline-flex items-center gap-2 self-start text-label-md text-on-surface-variant hover:text-on-surface"
      >
        <ArrowBackIcon className="h-4 w-4" />
        ระบบย่อย
      </Link>

      <div className="fade-slide-up flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="mb-2 font-display text-headline-lg text-on-surface">
            {subsystem.displayName}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-body-md text-on-surface-variant">{subsystem.name}</span>
            <SubsystemBadges subsystem={subsystem} />
          </div>
        </div>
        <SubsystemActions subsystem={subsystem} caps={caps} canEdit={canEdit} />
      </div>

      <StatusBanner subsystem={subsystem} />

      {subsystem.approvalStatus === "APPROVED" && (
        <ChangeRequestPanel
          subsystem={subsystem}
          pending={subsystem.pendingChangeRequest}
          isOwner={subsystem.ownerId === user?.id}
          canReview={caps.review}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="facts-title" className={`fade-slide-up stagger-1 ${cardClass}`}>
          <h3 id="facts-title" className="border-b border-outline-variant/40 px-6 py-5 font-display text-headline-md text-on-surface">
            ข้อมูลระบบ
          </h3>
          <dl className="divide-y divide-outline-variant/40">
            {facts.map(([label, value]) => (
              <div key={label} className="grid gap-1 px-6 py-4 md:grid-cols-3">
                <dt className="text-label-md text-on-surface-variant">{label}</dt>
                <dd className="text-body-md text-on-surface md:col-span-2">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="mapping-title" className={`fade-slide-up stagger-2 ${cardClass}`}>
          <div className="border-b border-outline-variant/40 px-6 py-5">
            <h3 id="mapping-title" className="font-display text-headline-md text-on-surface">
              การแมปบทบาท
            </h3>
            <p className="mt-1 text-body-md text-on-surface-variant">
              บทบาทที่ไม่ได้แมปจะถูก Core Hub ปฏิเสธ (403) ก่อนเข้าระบบ
            </p>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                <th scope="col" className={thClass}>บทบาทใน Core Hub</th>
                <th scope="col" className={thClass}>บทบาทในระบบย่อย</th>
              </tr>
            </thead>
            <tbody className="text-body-md">
              {CORE_ROLES.map(({ role, label }) => (
                <tr key={role} className="border-b border-outline-variant/40 last:border-0">
                  <td className={`${tdClass} font-medium text-on-surface`}>{label}</td>
                  <td className={tdClass}>
                    {role in mapping ? (
                      <code className="text-on-surface">{mapping[role]}</code>
                    ) : (
                      <span className="text-on-surface-variant">เข้าไม่ได้</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section aria-labelledby="exceptions-title" className={`fade-slide-up stagger-3 ${cardClass}`}>
        <div className="border-b border-outline-variant/40 px-6 py-5">
          <h3 id="exceptions-title" className="font-display text-headline-md text-on-surface">
            สิทธิ์พิเศษรายบุคคล
          </h3>
          <p className="mt-1 text-body-md text-on-surface-variant">
            ผู้ใช้บางคนที่ต้องได้บทบาทต่างจากปกติ ต้องผ่านการอนุมัติจากผู้ดูแลระบบ
          </p>
        </div>
        {subsystem.exceptions.length === 0 ? (
          <EmptyState
            title="ยังไม่มีคำขอสิทธิ์พิเศษ"
            description={
              canEdit
                ? "ใช้แบบฟอร์มด้านล่างเมื่อต้องการให้ผู้ใช้บางคนมีบทบาทต่างจากปกติ"
                : "ระบบนี้ยังไม่มีผู้ใช้ที่ได้รับสิทธิ์พิเศษ"
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                  <th scope="col" className={thClass}>ผู้ใช้</th>
                  <th scope="col" className={thClass}>บทบาทที่ขอ</th>
                  <th scope="col" className={thClass}>เหตุผล</th>
                  <th scope="col" className={thClass}>สถานะ</th>
                  {caps.review && <th scope="col" className={`${thClass} text-right`}>จัดการ</th>}
                </tr>
              </thead>
              <tbody className="text-body-md">
                {subsystem.exceptions.map((exception) => (
                  <tr key={exception.id} className="border-b border-outline-variant/40 last:border-0">
                    <td className={`${tdClass} font-medium text-on-surface`}>{exception.username}</td>
                    <td className={`${tdClass} text-on-surface-variant`}>{exception.role}</td>
                    <td className={`${tdClass} text-on-surface-variant`}>{exception.reason}</td>
                    <td className={tdClass}>
                      <StatusBadge status={EXCEPTION_BADGE[exception.status]} />
                    </td>
                    {caps.review && (
                      <td className={tdClass}>
                        {exception.status === "REQUESTED" && (
                          <ExceptionDecision
                            subsystemId={subsystem.id}
                            exceptionId={exception.id}
                            username={exception.username}
                            role={exception.role}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canEdit && (
          <ExceptionRequestForm
            subsystemId={subsystem.id}
            mappedRoles={Object.keys(subsystem.defaultRoleMapping ?? {})}
          />
        )}
      </section>

      <section aria-labelledby="history-title" className={`fade-slide-up stagger-3 ${cardClass}`}>
        <h3 id="history-title" className="border-b border-outline-variant/40 px-6 py-5 font-display text-headline-md text-on-surface">
          ประวัติ
        </h3>
        {subsystem.events.length === 0 ? (
          <EmptyState title="ยังไม่มีประวัติ" description="การเปลี่ยนแปลงทุกครั้งจะถูกบันทึกไว้ที่นี่" />
        ) : (
          <ol className="space-y-5 px-6 py-5">
            {subsystem.events.map((event, index) => (
              <li key={event.id} className="relative flex gap-4">
                <span aria-hidden className="relative flex flex-col items-center">
                  <span className="mt-1.5 h-3 w-3 rounded-full bg-primary-container" />
                  {index < subsystem.events.length - 1 && (
                    <span className="mt-1 w-0.5 flex-1 bg-surface-container" />
                  )}
                </span>
                <div className="pb-1">
                  <p className="text-label-md text-on-surface">{EVENT_LABELS[event.action]}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {who(event.actor)} · <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
                  </p>
                  {event.reason && (
                    <p className="mt-1 text-body-md text-on-surface-variant">{event.reason}</p>
                  )}
                  {event.changes && Object.keys(event.changes).length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-body-md text-on-surface-variant">
                      {Object.entries(event.changes).map(([field, change]) => (
                        <li key={field} className="break-all">
                          <span className="text-on-surface">{FIELD_LABELS[field] ?? field}</span>:{" "}
                          {formatFieldValue(change.from, field)} →{" "}
                          <span className="text-on-surface">{formatFieldValue(change.to, field)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
