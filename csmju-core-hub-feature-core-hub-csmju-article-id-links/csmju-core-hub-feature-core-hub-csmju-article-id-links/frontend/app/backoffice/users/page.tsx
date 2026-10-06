import type { Metadata } from "next";
import { ManageAccountsIcon } from "../../components/icons";
import {
  ApiError,
  getCurrentUser,
  getUsers,
  type ApiUser,
  type PageMeta,
} from "../../lib/api";
import { formatDate } from "../../lib/format";
import { roleLabel } from "../../lib/session";
import AccessDenied from "../_components/AccessDenied";
import RegisterGrantSwitch from "./RegisterGrantSwitch";
import { DEFAULT_PAGE_SIZE, parseLimit, parsePage } from "../../lib/paging";
import PageHeader from "../_components/PageHeader";
import Pagination from "../_components/Pagination";
import ListSearch from "../_components/ListSearch";
import { cardClass, tdClass, thClass } from "../_components/ui";

export const metadata: Metadata = {
  title: "บัญชีผู้ใช้ · BackOffice · CSMJU",
};

/**
 * บัญชีผู้ใช้ Core Hub — GET /users (admin เท่านั้น)
 * ไม่มี CRUD ในเฟสนี้ · คอลัมน์ "ผูกบุคคล" เป็นเฟสถัดไป (§4.7)
 * สวิตช์ "ลงทะเบียนระบบย่อยได้" ให้/ถอนสิทธิ์ subsystem:create รายบัญชี
 * (staff และ lecturer ไม่ได้สิทธิ์นี้จากบทบาทแล้ว — PM 5 ต.ค. 2569)
 */
export default async function UsersPage({
  searchParams,
}: PageProps<"/backoffice/users">) {
  const params = await searchParams;
  const limit = parseLimit(params.limit);
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const user = await getCurrentUser();

  // เมนูซ่อนไว้แล้ว — นี่คือด่านที่สอง ส่วน API ตอบ 403 เป็นด่านที่สาม
  if (user?.role !== "admin") {
    return (
      <>
        <PageHeader title="บัญชีผู้ใช้" description="บัญชีที่เข้าสู่ระบบ Core Hub ได้" />
        <AccessDenied />
      </>
    );
  }

  let users: ApiUser[] = [];
  let loadError: string | null = null;

  try {
    users = await getUsers(q || undefined);
  } catch (err) {
    loadError =
      err instanceof ApiError
        ? err.status === 403
          ? "บัญชีของคุณไม่มีสิทธิ์ดูบัญชีผู้ใช้"
          : `ไม่สามารถโหลดข้อมูลได้ (${err.message})`
        : "ไม่สามารถเชื่อมต่อ API ได้";
  }

  // GET /users returns every account; page it here so the table matches the
  // other lists (the endpoint gains real paging when it gets CRUD).
  const totalPages = Math.ceil(users.length / limit);
  const page = Math.min(parsePage(params.page), Math.max(totalPages, 1));
  const visible = users.slice((page - 1) * limit, page * limit);
  const meta: PageMeta = { total: users.length, page, limit, totalPages };

  return (
    <>
      <PageHeader
        title="บัญชีผู้ใช้"
        description="บัญชีที่เข้าสู่ระบบ Core Hub ได้ · เปิดสวิตช์ “ลงทะเบียนระบบย่อยได้” ให้บัญชีเจ้าของระบบของแต่ละทีม · การเพิ่ม/แก้ไขบัญชีเป็นเฟสถัดไป"
      />

      <div className="fade-slide-up stagger-1">
        <ListSearch q={q} placeholder="ค้นหาจากอีเมลหรือชื่อผู้ใช้" clearHref="/backoffice/users" />
      </div>

      {loadError ? (
        <div className="fade-slide-up stagger-1 flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
            <ManageAccountsIcon className="h-6 w-6" />
          </span>
          <p className="font-display text-headline-md text-on-surface">
            โหลดข้อมูลไม่สำเร็จ
          </p>
          <p className="max-w-md text-body-md text-on-surface-variant">{loadError}</p>
        </div>
      ) : (
        <div className={`fade-slide-up stagger-1 ${cardClass}`}>
          <div className="flex items-center justify-between gap-4 border-b border-outline-variant/40 px-6 py-5">
            <h3 className="font-display text-headline-md text-on-surface">
              บัญชีทั้งหมด
              <span className="ml-2 rounded-full bg-surface-variant px-2.5 py-1 text-label-sm font-normal text-on-surface-variant">
                {users.length}
              </span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                  <th className={thClass}>อีเมล</th>
                  <th className={thClass}>บทบาท</th>
                  <th
                    className={thClass}
                    title="การแสดงบุคคลที่ผูกกับบัญชีเป็นเฟสถัดไป"
                  >
                    ผูกบุคคล
                    <span className="ml-1 font-normal text-outline">(เฟสถัดไป)</span>
                  </th>
                  <th className={thClass}>ลงทะเบียนระบบย่อยได้</th>
                  <th className={thClass}>สร้างเมื่อ</th>
                </tr>
              </thead>
              <tbody className="text-body-md">
                {visible.map((account) => (
                  <tr
                    key={account.id}
                    className="border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface/50"
                  >
                    <td className={`${tdClass} font-medium text-on-surface`}>
                      {account.email}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <span className="inline-block rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container">
                        {roleLabel(account.role.name)}
                      </span>
                    </td>
                    <td className={`${tdClass} text-on-surface-variant`}>—</td>
                    <td className={tdClass}>
                      <RegisterGrantSwitch
                        userId={account.id}
                        email={account.email}
                        viaRole={account.role.name === "admin"}
                        granted={
                          account.permissionGrants?.some(
                            (grant) => grant.permission === "subsystem:create",
                          ) ?? false
                        }
                      />
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
                      {formatDate(account.createdAt)}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">
                      {q ? `ไม่พบบัญชีที่ตรงกับ “${q}”` : "ยังไม่มีบัญชีผู้ใช้"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={meta}
            basePath="/backoffice/users"
            params={{ limit: limit !== DEFAULT_PAGE_SIZE ? limit : undefined }}
            itemLabel="บัญชี"
          />
        </div>
      )}
    </>
  );
}
