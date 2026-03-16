import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { ChevronDown, Search, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectProps {
  options: { value: string; label: string }[]
  placeholder?: string
  maxRows?: number
  searchable?: boolean
  colorMap?: Record<string, string>
  value?: string
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
  className?: string
  disabled?: boolean
}

function Select({
  className,
  options,
  placeholder,
  maxRows = 8,
  searchable,
  colorMap,
  value,
  onChange,
  disabled,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)
  const displayLabel =
    selectedOption?.label || placeholder || options[0]?.label || ""

  const filteredOptions =
    searchable && query
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase())
        )
      : options

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  // Focus search on open
  useEffect(() => {
    if (open && searchable && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open, searchable])

  // Scroll selected into view on open
  useEffect(() => {
    if (open && listRef.current && value) {
      const el = listRef.current.querySelector(`[data-value="${value}"]`)
      if (el) el.scrollIntoView({ block: "nearest" })
    }
  }, [open, value])

  const handleSelect = (val: string) => {
    setOpen(false)
    setQuery("")
    if (onChange) {
      const syntheticEvent = {
        target: { value: val },
      } as React.ChangeEvent<HTMLSelectElement>
      onChange(syntheticEvent)
    }
  }

  const maxHeight = maxRows * 36

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-all",
          "hover:bg-accent/30",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "ring-1 ring-ring",
          className
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {colorMap && selectedOption && colorMap[selectedOption.label] && (
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: colorMap[selectedOption.label] }}
            />
          )}
          <span className="truncate">{displayLabel}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full min-w-[180px] rounded-lg border bg-popover shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          {/* Search */}
          {searchable && (
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-md border border-input bg-transparent py-1.5 pl-8 pr-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          )}

          {/* Options */}
          <div
            ref={listRef}
            className="overflow-y-auto p-1"
            style={{ maxHeight }}
          >
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground text-center">
                No results
              </p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value
                const dotColor = colorMap?.[opt.label]

                return (
                  <button
                    key={opt.value}
                    type="button"
                    data-value={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      isSelected
                        ? "bg-accent font-medium text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <span className="w-4 shrink-0 flex items-center justify-center">
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-foreground" />
                      )}
                    </span>

                    {dotColor && (
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                    )}

                    <span className="truncate">{opt.label}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { Select }
export type { SelectProps }
