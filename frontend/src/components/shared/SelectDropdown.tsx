import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronDown } from "lucide-react"

interface SelectDropdownProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  maxVisible?: number
}

export function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = "Select...",
  maxVisible = 5,
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleToggle = useCallback(() => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropdownHeight = Math.min(options.length, maxVisible) * 32 + 8
      setOpenUp(spaceBelow < dropdownHeight && rect.top > dropdownHeight)
    }
    setOpen((v) => !v)
  }, [open, options.length, maxVisible])

  const selected = options.find((o) => o.value === value)
  const itemHeight = 32
  const maxHeight = maxVisible * itemHeight

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="cursor-pointer inline-flex items-center justify-between gap-2 h-8 min-w-[140px] rounded-md border border-input bg-transparent px-2.5 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className={selected?.value ? "" : "text-muted-foreground"}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className={`absolute z-50 w-full min-w-[140px] rounded-md border bg-popover shadow-md ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
          style={{ maxHeight: `${maxHeight}px` }}
        >
          <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: `${maxHeight}px` }}>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`cursor-pointer w-full text-left px-2.5 py-1.5 text-sm transition-colors hover:bg-accent ${
                  value === opt.value ? "bg-accent font-medium" : ""
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
