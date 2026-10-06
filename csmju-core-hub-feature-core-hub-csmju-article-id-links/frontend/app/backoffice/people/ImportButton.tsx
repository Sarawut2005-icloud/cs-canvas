"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UploadFileIcon } from "../../components/icons";
import Modal from "../_components/Modal";
import { secondaryButtonClass } from "../_components/ui";
import ImportWizard from "./ImportWizard";

/**
 * "นำเข้าข้อมูล CSV" on the students and staff pages (handoff 2.2). The file
 * may hold both kinds of people (`person_type`); the page renders this only
 * for admins and the API refuses anyone without `people:manage`.
 */
export default function ImportButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const close = () => {
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${secondaryButtonClass} inline-flex items-center gap-2`}
      >
        <UploadFileIcon className="h-4 w-4" />
        นำเข้าข้อมูล CSV
      </button>
      {open && (
        <Modal title="นำเข้าข้อมูลบุคคล (CSV)" size="xl" onClose={close}>
          <ImportWizard onFinished={close} />
        </Modal>
      )}
    </>
  );
}
