import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { SelectDropdown } from "./SelectDropdown"

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "ellipsis")[] = [1]
  if (current <= 4) {
    for (let i = 2; i <= 5; i++) pages.push(i)
    pages.push("ellipsis", total)
  } else if (current >= total - 3) {
    pages.push("ellipsis")
    for (let i = total - 4; i <= total; i++) pages.push(i)
  } else {
    pages.push("ellipsis", current - 1, current, current + 1, "ellipsis", total)
  }
  return pages
}

interface PaginationProps {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)

  if (total === 0) return null

  return (
    <div className="flex items-center justify-between px-3 py-3 border-t">
      <p className="text-xs text-muted-foreground tabular-nums min-w-[140px]">
        Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of{" "}
        {total}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            className="cursor-pointer rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="cursor-pointer rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {getPageNumbers(page, totalPages).map((item, idx) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1.5 text-xs text-muted-foreground select-none"
              >
                &hellip;
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                className={`cursor-pointer rounded-md min-w-7 px-1.5 py-1 text-xs font-medium transition-colors ${
                  item === page
                    ? "bg-primary text-primary-foreground"
                    : "border hover:bg-accent"
                }`}
              >
                {item}
              </button>
            )
          )}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="cursor-pointer rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            className="cursor-pointer rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {onPageSizeChange ? (
        <div className="flex items-center gap-2 min-w-[140px] justify-end">
          <span className="text-xs text-muted-foreground">Rows</span>
          <SelectDropdown
            value={String(pageSize)}
            onChange={(v) => { onPageSizeChange(Number(v)); onPageChange(1) }}
            options={pageSizeOptions.map((s) => ({ value: String(s), label: String(s) }))}
            maxVisible={5}
          />
        </div>
      ) : (
        <div className="min-w-[140px]" />
      )}
    </div>
  )
}
