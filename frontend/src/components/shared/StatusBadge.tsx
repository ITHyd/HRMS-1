import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  processing: "bg-yellow-100 text-yellow-700",
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  running: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  fully_billed: "bg-green-100 text-green-700",
  partially_billed: "bg-amber-100 text-amber-700",
  non_billable: "bg-gray-100 text-gray-700",
  bench: "bg-red-100 text-red-700",
  healthy: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
  active: "bg-blue-100 text-blue-700",
  inactive: "bg-gray-100 text-gray-700",
  on_hold: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status.toLowerCase()] || "bg-gray-100 text-gray-700"
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

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
