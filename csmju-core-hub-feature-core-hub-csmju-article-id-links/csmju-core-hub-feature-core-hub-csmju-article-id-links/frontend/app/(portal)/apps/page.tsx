import type { Metadata } from "next";
import { getLinkedSubsystems } from "../../lib/api";
import AppsBrowser from "./AppsBrowser";

export const metadata: Metadata = {
  title: "ระบบย่อยทั้งหมด · CSMJU",
};

/** Every subsystem the signed-in user may enter, by category, searchable. */
export default async function AppsPage() {
  const subsystems = await getLinkedSubsystems();

  return (
    <>
      <div className="fade-slide-up mb-8">
        <h2 className="mb-2 font-display text-headline-md font-bold text-on-surface md:text-headline-lg">
          ระบบย่อยทั้งหมด
        </h2>
        <p className="text-body-lg text-on-surface-variant">
          ระบบของสาขาที่บัญชีนี้เข้าใช้งานได้ · กดเพื่อเข้าสู่ระบบด้วยบัญชี CSMJU2030
        </p>
      </div>
      <div className="fade-slide-up stagger-1">
        <AppsBrowser subsystems={subsystems} />
      </div>
    </>
  );
}
