import { Lock, Unlock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PeriodLockBannerProps {
  isLocked: boolean
  onToggle: () => void
  period: string
}

export function PeriodLockBanner({ isLocked, onToggle, period }: PeriodLockBannerProps) {
  if (!isLocked) return null

  return (
    <div className="flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-yellow-600" />
        <span className="text-sm font-medium text-yellow-800">
          Period Locked
        </span>
        <span className="text-xs text-yellow-600">
          ({period})
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="border-yellow-400 text-yellow-700 hover:bg-yellow-100"
      >
        <Unlock className="mr-1.5 h-3.5 w-3.5" />
        Unlock Period
      </Button>
    </div>
  )
}
