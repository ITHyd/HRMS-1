import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
  placeholder?: string
  maxRows?: number
  searchable?: boolean
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, maxRows, searchable, value, onChange, ...props }, ref) => {
    if (maxRows) {
      return (
        <CustomSelect
          className={className}
          options={options}
          placeholder={placeholder}
          maxRows={maxRows}
          searchable={searchable}
          value={value as string}
          onChange={onChange}
        />
      )
    }

    return (
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={value}
        onChange={onChange}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    )
  }
)
Select.displayName = "Select"

function CustomSelect({
  className,
  options,
  maxRows,
  searchable,
  value,
  onChange,
}: {
  className?: string
  options: { value: string; label: string }[]
  placeholder?: string
  maxRows: number
  searchable?: boolean
  value?: string
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedLabel = options.find((o) => o.value === value)?.label || options[0]?.label

  const filteredOptions = searchable && query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  useEffect(() => {
    if (open && searchable && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open, searchable])

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

  // ~32px per row
  const maxHeight = maxRows * 32

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={cn("ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
          {searchable && (
            <div className="p-1.5 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-sm border border-input bg-transparent py-1 pl-7 pr-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto" style={{ maxHeight }}>
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground text-center">No results</p>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    "block w-full px-3 py-1.5 text-left text-sm transition-colors first:rounded-t-md last:rounded-b-md",
                    opt.value === value
                      ? "bg-accent font-medium"
                      : "hover:bg-accent/50"
                  )}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { Select }
