"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Modal from "../backoffice/_components/Modal";
import { EditIcon } from "./icons";
import type { MyPerson } from "../lib/api";
import {
  PROFILE_IMAGE_TYPES,
  profileImageUrl,
  shrinkToLimit,
} from "../lib/profile-image";
import { initials, roleLabel, userHandle, type SessionUser } from "../lib/session";

function Avatar({
  user,
  src,
  size,
  onDark = false,
}: {
  user: SessionUser;
  src: string | null;
  size: "sm" | "lg";
  /** Small avatar on the dark sidebar (`onDark`) or a light header. */
  onDark?: boolean;
}) {
  const box = size === "sm" ? "h-9 w-9 text-label-sm" : "h-24 w-24 text-headline-md";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by our own image proxy, not next/image
      <img src={src} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      className={`${box} flex shrink-0 items-center justify-center rounded-full font-bold ${
        onDark ? "bg-white/20 text-white" : "bg-primary-container text-white"
      }`}
    >
      {initials(user)}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-surface-variant py-2.5 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-caption text-on-surface-variant sm:w-32">{label}</dt>
      <dd className="min-w-0 break-words text-label-md text-on-surface">{value}</dd>
    </div>
  );
}

type UploadErrorBody = {
  requestId?: string;
  error?: { code?: string; message?: string };
};

/** Texts from ui-design-system.md §9.3, by `error.code`. */
const UPLOAD_ERRORS = {
  FORBIDDEN:
    "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ",
  TOO_MANY_REQUESTS: "มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  NETWORK: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
  INVALID_FILE: "ไฟล์รูปภาพไม่ถูกต้อง กรุณาเลือกไฟล์ JPG หรือ PNG อื่น",
} as const;

/** Thai text from the API is shown as is; raw English never is (§9.3). */
const THAI = /[฀-๿]/;

function uploadErrorMessage(status: number, body: UploadErrorBody | null): string {
  const code = body?.error?.code;
  const message = body?.error?.message ?? "";
  if (code === "FORBIDDEN" || status === 403) return UPLOAD_ERRORS.FORBIDDEN;
  if (code === "TOO_MANY_REQUESTS" || status === 429) {
    return UPLOAD_ERRORS.TOO_MANY_REQUESTS;
  }
  if (code === "SERVICE_UNAVAILABLE" || status === 503) return UPLOAD_ERRORS.NETWORK;
  if (code === "VALIDATION_ERROR" || code === "BAD_REQUEST") {
    return THAI.test(message) ? message : UPLOAD_ERRORS.INVALID_FILE;
  }
  const ref = body?.requestId ? body.requestId.slice(0, 8) : "-";
  return `ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง หากยังพบปัญหา กรุณาแจ้งผู้ดูแลระบบพร้อมรหัส: ${ref}`;
}

const PERSON_STATUS: Record<MyPerson["status"], string> = {
  ACTIVE: "กำลังศึกษา / ปฏิบัติงาน",
  INACTIVE: "ไม่ได้ใช้งาน",
  GRADUATED: "สำเร็จการศึกษา",
};

/**
 * The account card — on the portal's dark sidebar or the backoffice's light
 * header; opens the profile with its picture upload.
 */
export default function ProfileCard({
  user,
  person,
  variant = "sidebar",
}: {
  user: SessionUser;
  person: MyPerson | null;
  variant?: "sidebar" | "header";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = profileImageUrl(user.profileImageId);
  const displayName = person?.fullNameTh || userHandle(user);

  const upload = async (picked: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!picked) return;
    setError(null);

    if (!PROFILE_IMAGE_TYPES.includes(picked.type)) {
      setError("รองรับเฉพาะไฟล์ JPG หรือ PNG");
      return;
    }

    setBusy(true);
    try {
      let file: File | null;
      try {
        file = await shrinkToLimit(picked);
      } catch {
        setError("อ่านไฟล์รูปภาพไม่ได้ กรุณาเลือกไฟล์อื่น");
        return;
      }
      if (!file) {
        setError("ย่อรูปให้เหลือไม่เกิน 1 MB ไม่ได้ กรุณาเลือกรูปอื่น");
        return;
      }

      const form = new FormData();
      form.set("file", file);
      let res: Response;
      try {
        res = await fetch("/api/profile-image", { method: "POST", body: form });
      } catch {
        setError(UPLOAD_ERRORS.NETWORK);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as UploadErrorBody | null;
        if (body?.error?.code === "UNAUTHORIZED" || res.status === 401) {
          // §9.3: nothing to show — sign in again and come back here.
          const here = window.location.pathname + window.location.search;
          router.push(`/login?next=${encodeURIComponent(here)}`);
          return;
        }
        setError(uploadErrorMessage(res.status, body));
        return;
      }
      // The layout reads the new picture id from GET /auth/me.
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg bg-white/10 px-3 py-2 text-left backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <Avatar user={user} src={src} size="sm" onDark />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-label-md text-white" title={user.email}>
              {displayName}
            </span>
            <span className="text-caption text-white/70">{roleLabel(user.role)}</span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="ข้อมูลส่วนตัว"
          className="flex items-center gap-2 rounded-full p-1 text-left transition-colors hover:bg-surface-variant/50"
        >
          <Avatar user={user} src={src} size="sm" />
          <span className="hidden max-w-48 flex-col leading-tight md:flex">
            <span className="truncate text-label-md text-on-surface" title={user.email}>
              {displayName}
            </span>
            <span className="text-caption text-on-surface-variant">
              {roleLabel(user.role)}
            </span>
          </span>
        </button>
      )}

      {open && (
        <Modal title="ข้อมูลส่วนตัว" onClose={() => setOpen(false)}>
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar user={user} src={src} size="lg" />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                aria-label="เปลี่ยนรูปโปรไฟล์"
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary-container text-white shadow transition-colors hover:bg-primary disabled:opacity-60"
              >
                <EditIcon className="h-4 w-4" />
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
            <p className="text-center text-caption text-on-surface-variant">
              {busy
                ? "กำลังอัปโหลด..."
                : "ไฟล์ JPG หรือ PNG ไม่เกิน 1 MB — ไฟล์ที่ใหญ่กว่าจะถูกย่อให้อัตโนมัติ"}
            </p>
            {error && (
              <p
                role="alert"
                className="w-full rounded-lg bg-error-container px-4 py-2 text-center text-label-md text-on-error-container"
              >
                {error}
              </p>
            )}
          </div>

          <dl className="mt-5">
            <Detail label="ชื่อ-นามสกุล" value={person?.fullNameTh} />
            <Detail label="ชื่อภาษาอังกฤษ" value={person?.fullNameEn} />
            <Detail
              label="ตำแหน่ง"
              value={[person?.academicTitle, person?.jobTitle].filter(Boolean).join(" · ") || null}
            />
            <Detail
              label={person?.personType === "STAFF" ? "รหัสบุคลากร" : "รหัสนักศึกษา"}
              value={person?.personCode ?? user.username}
            />
            <Detail label="บทบาท" value={roleLabel(user.role)} />
            <Detail label="อีเมล" value={person?.universityEmail ?? user.email} />
            <Detail label="คณะ" value={person?.faculty.nameTh} />
            <Detail label="สาขาวิชา" value={person?.department?.nameTh} />
            <Detail
              label="หลักสูตร"
              value={
                person?.curriculum
                  ? `${person.curriculum.nameTh} (พ.ศ. ${person.curriculum.curriculumYear})`
                  : null
              }
            />
            <Detail
              label="ปีที่เข้าศึกษา"
              value={person?.entryYear ? `พ.ศ. ${person.entryYear}` : null}
            />
            <Detail
              label="อาจารย์ที่ปรึกษา"
              value={person?.advisors.map((a) => a.fullNameTh).join(", ") || null}
            />
            <Detail label="สถานะ" value={person ? PERSON_STATUS[person.status] : null} />
          </dl>
          {!person && (
            <p className="mt-3 text-caption text-on-surface-variant">
              บัญชีนี้ยังไม่ได้ผูกกับทะเบียนบุคคลของสาขา จึงแสดงเฉพาะข้อมูลบัญชี
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
