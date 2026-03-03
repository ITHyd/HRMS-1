import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface SheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function Sheet({ open, onClose, children, className }: SheetProps) {
  if (!open) return null

  return (
    <div
      className={cn(
        "fixed right-0 top-0 z-50 h-full w-[480px] max-w-[90vw] bg-background shadow-xl border-l transition-transform duration-300 overflow-y-auto",
        className
      )}
    >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 cursor-pointer rounded-md p-1 opacity-70 transition-all hover:opacity-100 hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
    </div>
  )
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 p-6 pb-0", className)} {...props} />
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />
}

export function SheetContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />
}
