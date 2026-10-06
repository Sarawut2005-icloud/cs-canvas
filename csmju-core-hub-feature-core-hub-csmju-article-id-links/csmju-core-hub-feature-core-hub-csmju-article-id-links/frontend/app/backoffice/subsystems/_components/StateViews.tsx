import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { AppsIcon, ShieldIcon } from "../../../components/icons";
import { ApiError } from "../../../lib/api-error";
import { describeError } from "../../../lib/subsystems";
import { secondaryButtonClass } from "../../_components/ui";

/** Empty state — icon, why it is empty, and a way forward (§9.2). */
export function EmptyState({
  title,
  description,
  action,
  Icon = AppsIcon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
        <Icon className="h-6 w-6" />
      </span>
      <p className="font-display text-headline-md text-on-surface">{title}</p>
      <p className="max-w-md text-body-md text-on-surface-variant">
        {description}
      </p>
      {action}
    </div>
  );
}

/** Whole-page failure, mapped from `error.code` (§9.3). */
export function ErrorState({ error }: { error: unknown }) {
  const apiError = error instanceof ApiError ? error : null;
  const forbidden = apiError?.code === "FORBIDDEN";
  const notFound = apiError?.code === "NOT_FOUND";

  const message = apiError
    ? describeError(apiError)
    : "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง";

  return (
    <div className="fade-slide-up rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest">
      <EmptyState
        Icon={forbidden ? ShieldIcon : AppsIcon}
        title={
          forbidden
            ? "ไม่มีสิทธิ์เข้าถึง"
            : notFound
              ? "ไม่พบข้อมูล"
              : "โหลดข้อมูลไม่สำเร็จ"
        }
        description={message}
        action={
          <Link href="/backoffice/subsystems" className={secondaryButtonClass}>
            กลับไปหน้าระบบย่อย
          </Link>
        }
      />
    </div>
  );
}
