import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const PROFICIENCY_STYLES: Record<string, string> = {
  beginner: "bg-gray-100 text-gray-700",
  intermediate: "bg-blue-100 text-blue-700",
  advanced: "bg-purple-100 text-purple-700",
  expert: "bg-emerald-100 text-emerald-700",
}

interface SkillBadgeProps {
  name: string
  proficiency: string
  onRemove?: () => void
}

export function SkillBadge({ name, proficiency, onRemove }: SkillBadgeProps) {
  const style =
    PROFICIENCY_STYLES[proficiency.toLowerCase()] || "bg-gray-100 text-gray-700"

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
        style,
      )}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition-colors"
          aria-label={`Remove ${name}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}
