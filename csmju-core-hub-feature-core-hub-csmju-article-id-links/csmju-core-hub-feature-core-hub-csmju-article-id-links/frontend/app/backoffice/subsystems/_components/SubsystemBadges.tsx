import StatusBadge from "../../_components/StatusBadge";
import type { Subsystem } from "../../../lib/api";
import {
  APPROVAL_BADGE,
  LIFECYCLE_BADGE,
  showsLifecycle,
} from "../../../lib/subsystems";

/** Approval badge, plus the on/off badge once the subsystem is approved. */
export default function SubsystemBadges({
  subsystem,
}: {
  subsystem: Pick<Subsystem, "approvalStatus" | "status">;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <StatusBadge status={APPROVAL_BADGE[subsystem.approvalStatus]} />
      {showsLifecycle(subsystem) && (
        <StatusBadge status={LIFECYCLE_BADGE[subsystem.status]} />
      )}
    </span>
  );
}
