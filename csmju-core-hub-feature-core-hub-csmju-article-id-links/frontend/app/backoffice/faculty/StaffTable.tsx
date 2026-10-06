"use client";

import { useState } from "react";
import { MailIcon, SchoolIcon } from "../../components/icons";
import type { Person } from "../../lib/api";
import { PERSON_STATUS_BADGE, STAFF_TYPE_LABELS, personDisplayName } from "../../lib/people";
import StatusBadge from "../_components/StatusBadge";
import { tdClass, thClass } from "../_components/ui";
import { EmptyState } from "../subsystems/_components/StateViews";
import PersonPanel from "../students/PersonPanel";

/**
 * Staff rows; clicking one opens the same detail panel as a student, where
 * admins change the status (PATCH /people/:personCode — handoff ข.2).
 */
export default function StaffTable({
  staff,
  canManage,
  filtered,
}: {
  staff: Person[];
  canManage: boolean;
  /** A search or status filter is on — the empty state then says so. */
  filtered: boolean;
}) {
  const [selected, setSelected] = useState<Person | null>(null);
  const showEmail = staff.some((person) => person.universityEmail !== undefined);

  if (staff.length === 0) {
    return filtered ? (
      <EmptyState
        Icon={SchoolIcon}
        title="ไม่พบบุคลากรที่ตรงกับเงื่อนไข"
        description="ลองเปลี่ยนคำค้นหา หรือเลือก “ทุกสถานะ” — บุคลากรที่พ้นสภาพแล้วจะไม่แสดงเป็นค่าเริ่มต้น"
      />
    ) : (
      <EmptyState
        Icon={SchoolIcon}
        title="ยังไม่มีบุคลากรในทะเบียน"
        description="เพิ่มบุคลากรทีละคน หรือนำเข้ารายชื่อด้วยไฟล์ CSV (person_type = STAFF) แล้วรายชื่อจะแสดงที่นี่"
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
              <th className={thClass}>รหัสบุคลากร</th>
              <th className={thClass}>ชื่อ-นามสกุล</th>
              <th className={thClass}>ประเภท</th>
              <th className={thClass}>ตำแหน่ง</th>
              <th className={thClass}>สาขา</th>
              {showEmail && <th className={thClass}>อีเมล</th>}
              <th className={thClass}>สถานะ</th>
            </tr>
          </thead>
          <tbody className="text-body-md">
            {staff.map((person) => (
              <tr
                key={person.personCode}
                onClick={() => setSelected(person)}
                className="cursor-pointer border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface/50"
              >
                <td className={`${tdClass} whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(person);
                    }}
                    aria-label={`ดูรายละเอียด ${personDisplayName(person)}`}
                    className="font-medium tabular-nums text-primary-container hover:underline"
                  >
                    {person.personCode}
                  </button>
                </td>
                <td className={`${tdClass} whitespace-nowrap text-on-surface`}>
                  {personDisplayName(person)}
                </td>
                <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
                  {person.staffType ? STAFF_TYPE_LABELS[person.staffType] : "—"}
                </td>
                <td className={`${tdClass} text-on-surface-variant`}>{person.jobTitle ?? "—"}</td>
                <td className={`${tdClass} text-on-surface-variant`}>
                  {person.department?.nameTh ?? "—"}
                </td>
                {showEmail && (
                  <td className={tdClass}>
                    {person.universityEmail ? (
                      <a
                        href={`mailto:${person.universityEmail}`}
                        onClick={(event) => event.stopPropagation()}
                        className="flex items-center gap-1.5 whitespace-nowrap text-on-surface-variant transition-colors hover:text-primary-container"
                      >
                        <MailIcon className="h-4 w-4 shrink-0" />
                        {person.universityEmail}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className={tdClass}>
                  <StatusBadge status={PERSON_STATUS_BADGE[person.status]} />
                </td>
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
