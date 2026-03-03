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
        "fixed right-0 top-14 z-50 flex flex-col h-[calc(100%-3.5rem)] w-96 max-w-[90vw] bg-background shadow-xl border-l transition-transform duration-300",
        className
      )}
    >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 cursor-pointer rounded-md p-1 opacity-70 transition-all hover:opacity-100 hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
    </div>
  )
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 shrink-0 px-5 py-3 border-b", className)} {...props} />
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />
}

export function SheetContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto p-6", className)} {...props} />
}
