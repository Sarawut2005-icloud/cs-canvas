"use client";

import { useRef, useState } from "react";
import {
  CheckIcon,
  DescriptionIcon,
  UploadFileIcon,
} from "../../components/icons";
import type { ImportResult } from "../../lib/api";
import { formatNumber } from "../../lib/format";
import {
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  tdClass,
  thClass,
} from "../_components/ui";
import { callImport, type ApiFailure } from "./import-client";

const MAX_BYTES = 2 * 1024 * 1024;

/** Header row the API expects — same names, any order. `*` = required. */
const COLUMNS = [
  "person_code*",
  "person_type*",
  "staff_type",
  "full_name_th*",
  "full_name_en",
  "academic_title",
  "university_email",
  "entry_year",
  "faculty_code*",
  "department_code",
  "curriculum_code",
  "status",
];

/**
 * Sample file for download. Mock codes only (99…) with the real reference
 * codes from the seed, so it round-trips through dry-run without errors.
 */
const SAMPLE_CSV = [
  "person_code,person_type,staff_type,full_name_th,full_name_en,academic_title,university_email,entry_year,faculty_code,department_code,curriculum_code,status",
  "9901010001,STUDENT,,ทดสอบ หนึ่ง,Test One,,mju9901010001@mju.ac.th,2567,SCI,CS,65304010,ACTIVE",
  "9901010002,STUDENT,,ทดสอบ สอง,Test Two,,mju9901010002@mju.ac.th,2567,SCI,CS,65304010,",
  "9901010003,STUDENT,,\"ทดสอบ, สาม\",Test Three,,mju9901010003@mju.ac.th,2566,SCI,CS,65304010,GRADUATED",
  "9901010004,STUDENT,,ทดสอบ สี่,Test Four,,mju9901010004@mju.ac.th,2568,SCI,CS,65304010,INACTIVE",
  "99staff01,STAFF,LECTURER,ทดสอบ อาจารย์,Test Lecturer,อ.ดร.,99staff01@mju.ac.th,,SCI,CS,,ACTIVE",
  "",
].join("\n");

type Step = "pick" | "checked" | "done";

type FileInfo = { name: string; size: number; lines: number; text: string };

function countLines(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim() !== "").length;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

/** How the accounts made by the import sign in — rule lives in backend UsersService. */
function AccountNote({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p role="note" className="rounded-lg bg-surface px-4 py-3 text-body-md text-on-surface">
      บัญชีผู้ใช้ของนักศึกษาใหม่<strong>ไม่มีรหัสผ่านเริ่มต้น</strong> — นักศึกษาเข้าระบบครั้งแรกด้วย MJU SSO
      แล้วตั้งรหัสผ่านเอง จากนั้นเข้าได้ทั้งด้วย MJU SSO และด้วย<strong>อีเมลมหาวิทยาลัย</strong>กับรหัสผ่านนั้น
    </p>
  );
}

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-label-sm ${
          done
            ? "bg-success text-white"
            : active
              ? "bg-primary-container text-white"
              : "bg-surface-variant text-on-surface-variant"
        }`}
      >
        {done ? <CheckIcon className="h-4 w-4" /> : n}
      </span>
      <span className={`text-label-md ${active ? "text-on-surface" : "text-on-surface-variant"}`}>
        {label}
      </span>
    </li>
  );
}

function SummaryCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-primary-container/40 bg-primary-container/5" : "border-outline-variant/40 bg-surface-container-lowest"
      }`}
    >
      <p className="text-label-md text-on-surface-variant">{label}</p>
      <p className="font-display text-headline-lg text-on-surface">{formatNumber(value)}</p>
    </div>
  );
}

/**
 * CSV import in three steps (pick → dry-run → commit), shown in a popup on
 * the students and staff pages. `onFinished` closes the popup after a commit.
 */
export default function ImportWizard({ onFinished }: { onFinished: () => void }) {
  const [file, setFile] = useState<FileInfo | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [preview, setPreview] = useState<Extract<ImportResult, { mode: "dry-run" }> | null>(null);
  const [outcome, setOutcome] = useState<Extract<ImportResult, { mode: "commit" }> | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState<"dry-run" | "commit" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setFileProblem(null);
    setStep("pick");
    setPreview(null);
    setOutcome(null);
    setFailure(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const pickFile = (picked: File | undefined) => {
    setPreview(null);
    setOutcome(null);
    setFailure(null);
    setStep("pick");
    if (!picked) return setFile(null);
    if (picked.size > MAX_BYTES) {
      setFile(null);
      return setFileProblem(
        `ไฟล์มีขนาด ${formatBytes(picked.size)} เกินขีดจำกัด 2 MB — แบ่งไฟล์แล้วนำเข้าทีละส่วน`,
      );
    }
    setFileProblem(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setFile({ name: picked.name, size: picked.size, lines: countLines(text), text });
    };
    reader.onerror = () => setFileProblem("อ่านไฟล์ไม่สำเร็จ กรุณาลองเลือกไฟล์อีกครั้ง");
    reader.readAsText(picked, "UTF-8");
  };

  const runDryRun = async () => {
    if (!file) return;
    setBusy("dry-run");
    setFailure(null);
    const result = await callImport("dry-run", file.text);
    setBusy(null);
    if (!result.ok) return setFailure(result.error);
    if (result.data.mode !== "dry-run") return;
    setPreview(result.data);
    setStep("checked");
  };

  const runCommit = async () => {
    if (!file || !preview || preview.errors.length > 0) return;
    setBusy("commit");
    setFailure(null);
    const result = await callImport("commit", file.text);
    setBusy(null);
    if (!result.ok) return setFailure(result.error);
    if (result.data.mode !== "commit") return;
    setOutcome(result.data);
    setStep("done");
  };

  const downloadSample = () => {
    const blob = new Blob(["﻿", SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "people-import-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const canConfirm = step === "checked" && preview !== null && preview.errors.length === 0;

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-6">
        <StepBadge n={1} label="เลือกไฟล์" active={step === "pick"} done={step !== "pick"} />
        <StepBadge n={2} label="ตรวจสอบ (dry-run)" active={step === "checked"} done={step === "done"} />
        <StepBadge n={3} label="ยืนยันนำเข้า" active={step === "done"} done={step === "done"} />
      </ol>

      <p role="note" className="rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
        ไฟล์รายชื่อจริงห้ามนำไป commit ลง git หรือแชร์นอกทีมทะเบียน
      </p>

      {/* STEP 1 */}
      <section className={`${cardClass} space-y-4 p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-headline-md text-on-surface">1. เลือกไฟล์ CSV</h3>
            <p className="mt-1 text-body-md text-on-surface-variant">
              เข้ารหัส UTF-8 · แถวแรกเป็นชื่อคอลัมน์ · ค่าที่มีเครื่องหมายจุลภาคให้ครอบด้วยเครื่องหมายคำพูด
            </p>
          </div>
          <button
            type="button"
            onClick={downloadSample}
            className={`${secondaryButtonClass} inline-flex items-center gap-2`}
          >
            <DescriptionIcon className="h-4 w-4" />
            ดาวน์โหลดไฟล์ตัวอย่าง
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {COLUMNS.map((column) => (
            <code
              key={column}
              className="rounded-md bg-surface-variant px-2 py-0.5 text-label-sm text-on-surface-variant"
            >
              {column}
            </code>
          ))}
        </div>
        <p className="text-label-sm text-on-surface-variant">
          * = จำเป็น · <code>person_code</code> เป็นคีย์ของการอัปเดต (แถวที่มีรหัสเดิมจะถูกอัปเดต ไม่สร้างซ้ำ) ·
          <code> staff_type</code> จำเป็นเมื่อ <code>person_type</code> เป็น STAFF · <code>status</code> เว้นว่าง = ACTIVE
        </p>
        <p className="text-label-sm text-on-surface-variant">
          นักศึกษา<strong>ใหม่</strong>ที่สถานะ ACTIVE และมี <code>university_email</code> จะได้บัญชีผู้ใช้สำหรับเข้าสู่ระบบอัตโนมัติ
          (คนที่มีในทะเบียนอยู่แล้ว อาจารย์ และเจ้าหน้าที่ ไม่ได้สร้างให้)
        </p>

        <label className="block space-y-2">
          <span className="text-label-md text-on-surface">ไฟล์</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={busy !== null || step === "done"}
            onChange={(event) => pickFile(event.target.files?.[0])}
            className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-primary-container/10 file:px-3 file:py-1 file:text-label-sm file:text-primary-container`}
          />
        </label>

        {fileProblem && (
          <p role="alert" className="text-label-md text-error">
            {fileProblem}
          </p>
        )}

        {file && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-surface px-4 py-3 text-body-md text-on-surface">
            <span className="flex items-center gap-2">
              <UploadFileIcon className="h-5 w-5 text-primary-container" />
              {file.name}
            </span>
            <span className="text-on-surface-variant">{formatBytes(file.size)}</span>
            <span className="text-on-surface-variant">
              {formatNumber(Math.max(file.lines - 1, 0))} แถวข้อมูล
            </span>
          </div>
        )}

        {step === "pick" && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={runDryRun}
              disabled={!file || busy !== null}
              className={`${primaryButtonClass} disabled:opacity-50`}
            >
              {busy === "dry-run" ? "กำลังตรวจสอบ..." : "ตรวจสอบ (dry-run)"}
            </button>
          </div>
        )}
      </section>

      {/* STEP 2 */}
      {preview && step !== "done" && (
        <section className={`${cardClass} space-y-4 p-6`}>
          <div>
            <h3 className="font-display text-headline-md text-on-surface">2. ผลการตรวจสอบ</h3>
            <p className="mt-1 text-body-md text-on-surface-variant">
              ยังไม่มีการบันทึกข้อมูล — ตรวจตัวเลขและรายการผิดพลาดก่อนยืนยัน
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="ทั้งหมด" value={preview.total} />
            <SummaryCard label="จะสร้างใหม่" value={preview.toCreate} accent />
            <SummaryCard label="จะอัปเดต" value={preview.toUpdate} accent />
            <SummaryCard label="จะสร้างบัญชีผู้ใช้" value={preview.usersToCreate} accent />
          </div>

          <AccountNote count={preview.usersToCreate} />

          {preview.errors.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-error/30">
              <p className="bg-error-container px-4 py-3 text-label-md text-on-error-container">
                พบข้อผิดพลาด {formatNumber(preview.errors.length)} แถว — แก้ไฟล์แล้วเลือกใหม่ จึงจะยืนยันได้
              </p>
              <div className="max-h-80 overflow-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                      <th className={thClass}>แถว</th>
                      <th className={thClass}>สาเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-md">
                    {preview.errors.map((error, index) => (
                      <tr
                        key={`${error.row}-${index}`}
                        className="border-b border-outline-variant/40 last:border-0"
                      >
                        <td className={`${tdClass} whitespace-nowrap tabular-nums text-on-surface`}>
                          {error.row}
                        </td>
                        <td className={`${tdClass} text-on-surface`}>{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-label-md text-emerald-700">
              <CheckIcon className="h-4 w-4" />
              ทุกแถวถูกต้อง พร้อมนำเข้า
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={reset} className={secondaryButtonClass}>
              เลือกไฟล์ใหม่
            </button>
            <button
              type="button"
              onClick={runCommit}
              disabled={!canConfirm || busy !== null}
              className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {busy === "commit" ? "กำลังบันทึก..." : "ยืนยันนำเข้า"}
            </button>
          </div>
        </section>
      )}

      {/* STEP 3 */}
      {outcome && (
        <section className={`${cardClass} space-y-4 p-6`}>
          <div>
            <h3 className="font-display text-headline-md text-on-surface">3. นำเข้าเสร็จสิ้น</h3>
            <p className="mt-1 text-body-md text-on-surface-variant">
              บันทึกลงทะเบียนกลางแล้วในครั้งเดียว
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="ทั้งหมด" value={outcome.total} />
            <SummaryCard label="สร้างใหม่" value={outcome.created} accent />
            <SummaryCard label="อัปเดต" value={outcome.updated} accent />
            <SummaryCard label="สร้างบัญชีผู้ใช้" value={outcome.usersCreated} accent />
          </div>

          <AccountNote count={outcome.usersCreated} />
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={reset} className={secondaryButtonClass}>
              นำเข้าไฟล์อื่น
            </button>
            <button type="button" onClick={onFinished} className={primaryButtonClass}>
              เสร็จสิ้น
            </button>
          </div>
        </section>
      )}

      {failure && (
        <div role="alert" className="space-y-2 rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
          <p>{failure.message}</p>
          {failure.details && failure.details.length > 0 && (
            <ul className="list-inside list-disc space-y-0.5 text-body-md">
              {failure.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
