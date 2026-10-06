"use client";

import { useState } from "react";
import { DescriptionIcon } from "../../components/icons";
import { secondaryButtonClass } from "../_components/ui";

/**
 * Downloads the list the page is showing as CSV — same filters, every page
 * (handoff 2.9). Fetched rather than linked so a refusal shows here instead
 * of saving an error as a file. Columns are fixed by the API: no e-mail.
 */
export default function ExportButton({
  filters,
  fileName,
}: {
  filters: Record<string, string | undefined>;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) query.set(key, value);
    }
    try {
      const res = await fetch(`/api/people/export?${query.toString()}`);
      if (!res.ok) {
        setError(
          res.status === 403
            ? "บัญชีของคุณไม่มีสิทธิ์ดาวน์โหลดรายชื่อ"
            : res.status === 429
              ? "มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
              : "ดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง",
        );
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className={`${secondaryButtonClass} inline-flex items-center gap-2 disabled:opacity-60`}
      >
        <DescriptionIcon className="h-4 w-4" />
        {busy ? "กำลังเตรียมไฟล์..." : "ส่งออก CSV"}
      </button>
      {error && (
        <p role="alert" className="text-label-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
