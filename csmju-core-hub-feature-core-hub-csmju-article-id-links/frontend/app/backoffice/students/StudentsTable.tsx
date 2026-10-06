"use client";

import { useState } from "react";
import { GroupIcon } from "../../components/icons";
import type { Person } from "../../lib/api";
import { PERSON_STATUS_BADGE, personDisplayName } from "../../lib/people";
import StatusBadge from "../_components/StatusBadge";
import { tdClass, thClass } from "../_components/ui";
import { EmptyState } from "../subsystems/_components/StateViews";
import PersonPanel from "./PersonPanel";

/** Clickable rows; the selected student opens in a detail panel. */
export default function StudentsTable({
  students,
  canManage,
}: {
  students: Person[];
  canManage: boolean;
}) {
  const [selected, setSelected] = useState<Person | null>(null);
  const showEmail = students.some((s) => s.universityEmail !== undefined);

  if (students.length === 0) {
    return (
      <EmptyState
        Icon={GroupIcon}
        title="ไม่พบนักศึกษาที่ตรงกับเงื่อนไข"
        description="ลองเปลี่ยนคำค้นหา ปีเข้า หรือเลือก “ทุกสถานะ” — นักศึกษาที่พ้นสภาพหรือสำเร็จการศึกษาแล้วจะไม่แสดงเป็นค่าเริ่มต้น"
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
              <th className={thClass}>รหัส</th>
              <th className={thClass}>ชื่อ-นามสกุล</th>
              <th className={thClass}>ปีเข้า</th>
              <th className={thClass}>หลักสูตร</th>
              <th className={thClass}>สถานะ</th>
              {showEmail && <th className={thClass}>อีเมลมหาวิทยาลัย</th>}
            </tr>
          </thead>
          <tbody className="text-body-md">
            {students.map((student) => (
              <tr
                key={student.personCode}
                onClick={() => setSelected(student)}
                className="cursor-pointer border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface/50"
              >
                <td className={`${tdClass} whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(student);
                    }}
                    className="font-medium tabular-nums text-primary-container hover:underline"
                  >
                    {student.personCode}
                  </button>
                </td>
                <td className={`${tdClass} whitespace-nowrap text-on-surface`}>
                  {personDisplayName(student)}
                </td>
                <td className={`${tdClass} tabular-nums text-on-surface-variant`}>
                  {student.entryYear ?? "—"}
                </td>
                <td className={`${tdClass} text-on-surface-variant`}>
                  {student.curriculum?.nameTh ?? "—"}
                </td>
                <td className={tdClass}>
                  <StatusBadge status={PERSON_STATUS_BADGE[student.status]} />
                </td>
                {showEmail && (
                  <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
                    {student.universityEmail ?? "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <PersonPanel
          person={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onSaved={(updated) => setSelected(updated)}
        />
      )}
    </>
  );
}
