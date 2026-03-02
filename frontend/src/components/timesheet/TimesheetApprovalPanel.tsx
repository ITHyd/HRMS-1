import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle } from "lucide-react"

interface TimesheetApprovalPanelProps {
  count: number
  onApprove: () => void
  onReject: (reason: string) => void
}

export function TimesheetApprovalPanel({
  count,
  onApprove,
  onReject,
}: TimesheetApprovalPanelProps) {
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  if (count === 0) return null

  const handleRejectSubmit = () => {
    if (!rejectReason.trim()) return
    onReject(rejectReason.trim())
    setRejectReason("")
    setShowRejectInput(false)
  }

  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {count} {count === 1 ? "entry" : "entries"} pending approval
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onApprove}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
            Approve All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRejectInput(!showRejectInput)}
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      </div>

      {showRejectInput && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRejectSubmit()
            }}
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={handleRejectSubmit}
            disabled={!rejectReason.trim()}
          >
            Confirm Reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowRejectInput(false)
              setRejectReason("")
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
