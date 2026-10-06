import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowForwardIcon, MenuBookIcon } from "../components/icons";
import RetryButton from "../components/RetryButton";
import { listPublicCurricula } from "../lib/public-curricula";
import { SiteFooter, SiteHeader } from "../welcome/SiteChrome";

export const metadata: Metadata = {
  title: "หลักสูตร · CSMJU",
};

/** Public list of the department's active curricula — no sign-in needed. */
export default async function CurriculaPage() {
  // Rendered per request, never at `next build`: the build has no backend,
  // so a prerendered page baked in the "cannot reach the server" state and
  // served it after every deploy. The fetch keeps its own 5-minute cache.
  await connection();
  const result = await listPublicCurricula();
  const curricula = result.ok ? (result.data ?? []) : [];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
        <div>
          <h1 className="font-display text-headline-md text-on-surface md:text-headline-lg">
            หลักสูตร
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            โครงสร้างหลักสูตรและแผนการศึกษาของสาขาวิชาวิทยาการคอมพิวเตอร์
          </p>
        </div>

        {!result.ok ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
            <p className="text-body-md text-on-surface-variant">
              เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง
            </p>
            <RetryButton />
          </div>
        ) : curricula.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
            <MenuBookIcon className="h-8 w-8 text-outline" />
            <p className="text-body-md text-on-surface-variant">ยังไม่มีหลักสูตรที่เปิดสอนในขณะนี้</p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {curricula.map((c) => (
              <li key={c.code}>
                <Link
                  href={`/curricula/${encodeURIComponent(c.code)}`}
                  className="group flex h-full flex-col gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="w-fit rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container">
                    หลักสูตรปี พ.ศ. {c.curriculumYear}
                  </span>
                  <h2 className="font-display text-label-md font-bold text-on-surface group-hover:text-primary-container">
                    {c.nameTh}
                  </h2>
                  {c.nameEn && <p className="text-body-md text-on-surface-variant">{c.nameEn}</p>}
                  <span className="mt-auto inline-flex items-center gap-1 pt-2 text-label-md text-primary-container">
                    โครงสร้างและแผนการศึกษา
                    <ArrowForwardIcon className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
