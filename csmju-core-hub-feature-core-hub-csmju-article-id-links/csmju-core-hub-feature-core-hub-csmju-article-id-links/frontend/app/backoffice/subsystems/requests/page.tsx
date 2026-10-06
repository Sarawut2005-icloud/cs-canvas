import type { Metadata } from "next";
import Link from "next/link";
import { ArrowBackIcon } from "../../../components/icons";
import {
  ApiError,
  getCurrentUser,
  listExceptionRequests,
  listPendingChangeRequests,
  listSubsystems,
  type ChangeRequestWithSubsystem,
  type ExceptionRequest,
  type Subsystem,
} from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import { CORE_ROLES, capabilitiesFor } from "../../../lib/subsystems";
import PageHeader from "../../_components/PageHeader";
import { cardClass, tdClass, thClass } from "../../_components/ui";
import ChangeRequestPanel from "../_components/ChangeRequestPanel";
import ExceptionDecision from "../_components/ExceptionDecision";
import LinkTabs from "../_components/LinkTabs";
import { EmptyState, ErrorState } from "../_components/StateViews";
import ListSearch from "../../_components/ListSearch";
import SubsystemActions from "../_components/SubsystemActions";

export const metadata: Metadata = {
  title: "คำขอที่รอดำเนินการ · BackOffice · CSMJU",
};

type Tab = "subsystems" | "changes" | "exceptions";

/** Only the review buttons — editing and lifecycle live on the detail page. */
const REVIEW_ONLY = {
  create: false,
  readAny: true,
  review: true,
  operate: false,
  remove: false,
  editReviewedFields: false,
};

function roleLabel(role: string) {
  return CORE_ROLES.find((r) => r.role === role)?.label ?? role;
}

export default async function RequestsPage({
  searchParams,
}: PageProps<"/backoffice/subsystems/requests">) {
  const { tab: rawTab, q: rawQ } = await searchParams;
  const tab: Tab =
    rawTab === "exceptions" || rawTab === "changes" ? rawTab : "subsystems";
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 100) : "";
  const has = (...texts: (string | null | undefined)[]) =>
    !q || texts.some((t) => (t ?? "").toLocaleLowerCase("th").includes(q.toLocaleLowerCase("th")));

  const user = await getCurrentUser();
  if (!capabilitiesFor(user?.role ?? "staff").review) {
    return (
      <ErrorState
        error={new ApiError("Forbidden", 403, "FORBIDDEN")}
      />
    );
  }

  let pending: Subsystem[];
  let exceptions: ExceptionRequest[];
  let changes: ChangeRequestWithSubsystem[];
  let pendingTotal: number;
  let exceptionTotal: number;
  let changeTotal: number;

  try {
    const [subsystemPage, exceptionPage, changePage] = await Promise.all([
      listSubsystems({ approvalStatus: "PENDING", limit: 100 }),
      listExceptionRequests(),
      listPendingChangeRequests(),
    ]);
    pendingTotal = subsystemPage.meta.total;
    exceptionTotal = exceptionPage.meta.total;
    changeTotal = changePage.meta.total;
    // The lists are small (at most 100 pending, 50 per review queue);
    // filtered here so one box serves every tab.
    pending = subsystemPage.data.filter((s) =>
      has(s.name, s.displayName, s.owner?.username, s.owner?.email),
    );
    exceptions = exceptionPage.data.filter((e) =>
      has(e.username, e.role, e.reason, e.subsystem.name, e.subsystem.displayName),
    );
    changes = changePage.data.filter((c) =>
      has(
        c.subsystem.name,
        c.subsystem.displayName,
        c.requestedBy.username,
        c.requestedBy.email,
      ),
    );
  } catch (error) {
    return <ErrorState error={error} />;
  }

  return (
    <>
      <Link
        href="/backoffice/subsystems"
        className="fade-slide-up inline-flex items-center gap-2 self-start text-label-md text-on-surface-variant hover:text-on-surface"
      >
        <ArrowBackIcon className="h-4 w-4" />
        ระบบย่อย
      </Link>
      <PageHeader
        title="คำขอที่รอดำเนินการ"
        description="ตรวจ callback URL และการแมปบทบาทให้ถูกต้องก่อนอนุมัติ — สองอย่างนี้กำหนดว่าใครเข้าระบบได้และ Core Hub จะส่ง token ไปที่ไหน"
      />

      <LinkTabs
        label="ประเภทคำขอ"
        active={tab}
        hrefFor={(id) =>
          id === "subsystems"
            ? "/backoffice/subsystems/requests"
            : `/backoffice/subsystems/requests?tab=${id}`
        }
        tabs={[
          { id: "subsystems", label: "คำขอขึ้นระบบ", count: pendingTotal },
          { id: "changes", label: "คำขอแก้ไขทะเบียน", count: changeTotal },
          { id: "exceptions", label: "คำขอสิทธิ์พิเศษ", count: exceptionTotal },
        ]}
      />

      <ListSearch
        q={q}
        placeholder={
          tab === "subsystems"
            ? "ค้นหาชื่อระบบหรือผู้ส่งคำขอ"
            : tab === "changes"
              ? "ค้นหาชื่อระบบหรือผู้ยื่นคำขอ"
              : "ค้นหาชื่อผู้ใช้ ระบบ หรือเหตุผล"
        }
        clearHref={
          tab === "subsystems"
            ? "/backoffice/subsystems/requests"
            : `/backoffice/subsystems/requests?tab=${tab}`
        }
        keep={tab === "subsystems" ? {} : { tab }}
      />

      {tab === "changes" ? (
        changes.length === 0 ? (
          <div className={cardClass}>
            <EmptyState
              title={q ? "ไม่พบคำขอแก้ไขที่ตรงกับคำค้น" : "ไม่มีคำขอแก้ไขที่รออยู่"}
              description="คำขอเปลี่ยน callback URL · base URL · การแมปบทบาท ของระบบที่อนุมัติแล้วจะแสดงที่นี่"
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {changes.map((request) => (
              <li key={request.id} className="flex flex-col gap-2">
                <Link
                  href={`/backoffice/subsystems/${encodeURIComponent(request.subsystem.id)}`}
                  className="font-display text-headline-md text-on-surface hover:text-primary-container"
                >
                  {request.subsystem.displayName}{" "}
                  <span className="text-body-md text-on-surface-variant">
                    {request.subsystem.name}
                  </span>
                </Link>
                <ChangeRequestPanel
                  subsystem={request.subsystem}
                  pending={request}
                  isOwner={false}
                  canReview
                />
              </li>
            ))}
          </ul>
        )
      ) : tab === "subsystems" ? (
        pending.length === 0 ? (
          <div className={cardClass}>
            <EmptyState
              title={q ? `ไม่พบคำขอที่ตรงกับ “${q}”` : "ไม่มีคำขอขึ้นระบบที่รออยู่"}
              description={q ? "ลองคำค้นอื่น หรือกด “ล้าง”" : "คำขอใหม่จากบุคลากรจะแสดงที่นี่"}
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.map((subsystem) => (
              <li key={subsystem.id} className={`fade-slide-up ${cardClass} p-6`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={`/backoffice/subsystems/${encodeURIComponent(subsystem.id)}`}
                      className="font-display text-headline-md text-on-surface hover:text-primary-container"
                    >
                      {subsystem.displayName}
                    </Link>
                    <p className="text-body-md text-on-surface-variant">
                      {subsystem.name} · ส่งโดย{" "}
                      {subsystem.owner?.username ?? subsystem.owner?.email ?? "—"} ·{" "}
                      {formatDateTime(subsystem.createdAt)}
                    </p>
                  </div>
                  <SubsystemActions subsystem={subsystem} caps={REVIEW_ONLY} canEdit={false} />
                </div>
                <dl className="mt-5 grid gap-4 border-t border-outline-variant/40 pt-5 md:grid-cols-3">
                  <div>
                    <dt className="text-label-md text-on-surface-variant">Callback URL</dt>
                    <dd className="mt-1 break-all text-body-md text-on-surface">
                      <code>{subsystem.callbackUrl}</code>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-label-md text-on-surface-variant">การแมปบทบาท</dt>
                    <dd className="mt-1 text-body-md text-on-surface">
                      {Object.entries(subsystem.defaultRoleMapping ?? {}).map(([core, mapped]) => (
                        <span key={core} className="block">
                          {roleLabel(core)} → <code>{mapped}</code>
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-label-md text-on-surface-variant">Repository · มาตรฐาน</dt>
                    <dd className="mt-1 text-body-md text-on-surface">
                      {subsystem.repo} · v{subsystem.standardsVersion}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )
      ) : exceptions.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            title={q ? `ไม่พบคำขอที่ตรงกับ “${q}”` : "ไม่มีคำขอสิทธิ์พิเศษที่รออยู่"}
            description={
              q
                ? "ลองคำค้นอื่น หรือกด “ล้าง”"
                : "คำขอให้ผู้ใช้บางคนมีบทบาทต่างจากปกติจะแสดงที่นี่"
            }
          />
        </div>
      ) : (
        <div className={`fade-slide-up ${cardClass}`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                  <th scope="col" className={thClass}>ระบบย่อย</th>
                  <th scope="col" className={thClass}>ผู้ใช้</th>
                  <th scope="col" className={thClass}>บทบาทที่ขอ</th>
                  <th scope="col" className={thClass}>เหตุผล</th>
                  <th scope="col" className={thClass}>ขอเมื่อ</th>
                  <th scope="col" className={`${thClass} text-right`}>จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-body-md">
                {exceptions.map((exception) => (
                  <tr key={exception.id} className="border-b border-outline-variant/40 last:border-0">
                    <td className={tdClass}>
                      <Link
                        href={`/backoffice/subsystems/${encodeURIComponent(exception.subsystem.id)}`}
                        className="font-medium text-on-surface hover:text-primary-container"
                      >
                        {exception.subsystem.displayName}
                      </Link>
                    </td>
                    <td className={`${tdClass} text-on-surface`}>{exception.username}</td>
                    <td className={`${tdClass} text-on-surface-variant`}>{roleLabel(exception.role)}</td>
                    <td className={`${tdClass} text-on-surface-variant`}>{exception.reason}</td>
                    <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
                      {formatDateTime(exception.createdAt)}
                    </td>
                    <td className={tdClass}>
                      <ExceptionDecision
                        subsystemId={exception.subsystem.id}
                        exceptionId={exception.id}
                        username={exception.username}
                        role={exception.role}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
