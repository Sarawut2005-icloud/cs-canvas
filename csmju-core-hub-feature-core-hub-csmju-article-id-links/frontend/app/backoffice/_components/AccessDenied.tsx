import Link from "next/link";
import { LockIcon } from "../../components/icons";
import { secondaryButtonClass } from "./ui";

/**
 * Shown when a signed-in user opens a page their role may not use by URL.
 * The menus already hide the link; this is the second line — the API is
 * the third (it answers 403 regardless of what the UI shows).
 */
export default function AccessDenied({
  requirement = "หน้านี้ใช้ได้เฉพาะผู้ดูแลระบบ",
  backHref = "/backoffice",
  backLabel = "กลับหน้าภาพรวม",
}: {
  requirement?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="fade-slide-up flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
        <LockIcon className="h-6 w-6" />
      </span>
      <p className="font-display text-headline-md text-on-surface">
        บัญชีของคุณไม่มีสิทธิ์เข้าถึงส่วนนี้
      </p>
      <p className="max-w-md text-body-md text-on-surface-variant">
        {requirement} หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
      </p>
      <Link href={backHref} className={`${secondaryButtonClass} mt-2`}>
        {backLabel}
      </Link>
    </div>
  );
}
