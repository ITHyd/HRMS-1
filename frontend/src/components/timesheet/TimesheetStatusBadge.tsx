import { cn } from "@/lib/utils"

type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected"

const STATUS_STYLES: Record<TimesheetStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
}

const STATUS_LABELS: Record<TimesheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
}

interface TimesheetStatusBadgeProps {
  status: TimesheetStatus
  className?: string
}

export function TimesheetStatusBadge({ status, className }: TimesheetStatusBadgeProps) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft
  const label = STATUS_LABELS[status] || status

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        style,
        className,
      )}
    >
      {label}
    </span>
  )
}
