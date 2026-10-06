import {
  AddIcon,
  DescriptionIcon,
  PageHeader,
  SearchIcon,
  cardClass,
  inputClass,
  primaryButtonClass,
  thClass,
} from "@/csmju";

// หน้าแรกใช้ title.default จาก layout · หน้าลูกให้ export `metadata = { title: "<ชื่อหน้า>" }`
// แล้วจะได้ "<ชื่อหน้า> · <ชื่อระบบ> · CSMJU" อัตโนมัติ (ui-design-system.md §11.4)

// ตัวอย่างหน้ารายการ — ลบ/แก้ได้ตามระบบของคุณ แต่ให้คงโครง PageHeader + การ์ด + ตาราง + empty state ไว้
export default function OverviewPage() {
  return (
    <>
      <PageHeader title="ภาพรวม" description="คำอธิบายหน้านี้ 1 บรรทัด" />

      <div className={`fade-slide-up stagger-1 ${cardClass}`}>
        <div className="flex flex-col gap-3 border-b border-outline-variant/40 px-6 py-5 md:flex-row md:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
            <input
              type="search"
              placeholder="ค้นหา..."
              aria-label="ค้นหารายการ"
              className={`${inputClass} pl-10`}
            />
          </div>
          <button type="button" className={primaryButtonClass}>
            <AddIcon className="h-4 w-4" />
            เพิ่มรายการ
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                <th className={thClass}>ชื่อรายการ</th>
                <th className={thClass}>สถานะ</th>
                <th className={`${thClass} text-right`}>จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-body-md">
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-on-surface-variant">
                  <DescriptionIcon className="mx-auto mb-3 h-10 w-10 text-outline" />
                  <p className="text-on-surface">ยังไม่มีรายการ</p>
                  <p className="mt-1">เริ่มต้นด้วยการเพิ่มรายการแรกของระบบ</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
