import { useEffect, useMemo, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useNotificationStore } from "@/store/notificationStore"

function DismissMenu({
  x, y, onDismiss, onClose,
}: { x: number; y: number; onDismiss: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])
  return (
    <div
      ref={ref}
      className="fixed z-[300] rounded-md border bg-popover shadow-md py-1 min-w-[90px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onDismiss(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors cursor-pointer"
      >
        Dismiss
      </button>
    </div>
  )
}

export function NotificationBell() {
  const navigate = useNavigate()
  const summary = useNotificationStore((s) => s.summary)
  const dismissed = useNotificationStore((s) => s.dismissed)
  const loadSummary = useNotificationStore((s) => s.loadSummary)
  const dismiss = useNotificationStore((s) => s.dismiss)
  const clearAll = useNotificationStore((s) => s.clearAll)

  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; type: string; id: string } | null>(null)
  const bellRef = useRef<HTMLDivElement>(null)

  const count = useMemo(() => {
    if (!summary) return 0
    let c = 0
    for (const e of summary.details.bench_long) {
      if (!dismissed.has(`bench_long:${e.employee_id}`)) c++
    }
    for (const p of summary.details.project_ending) {
      if (!dismissed.has(`project_ending:${p.project_id}`)) c++
    }
    for (const b of summary.details.billable_low) {
      if (!dismissed.has(`billable_low:${b.metric}`)) c++
    }
    return c
  }, [summary, dismissed])

  useEffect(() => {
    loadSummary()
    const id = setInterval(loadSummary, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [loadSummary])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!bellRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  function nav(path: string) {
    navigate(path)
    setOpen(false)
  }

  function rightClick(e: React.MouseEvent, type: string, id: string) {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, type, id })
  }

  return (
    <div ref={bellRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative cursor-pointer rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-popover shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold">Notifications</span>
            {count > 0 && (
              <button
                onClick={() => { clearAll(); setOpen(false) }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y">
            {count === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                All clear — no active alerts
              </div>
            ) : (
              <>
                {summary?.details.bench_long
                  .filter((e) => !dismissed.has(`bench_long:${e.employee_id}`))
                  .map((e) => (
                    <div
                      key={e.employee_id}
                      onClick={() => nav("/")}
                      onContextMenu={(ev) => rightClick(ev, "bench_long", e.employee_id)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      title="Right-click to dismiss"
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{e.employee_name} benched {e.bench_days}+ days</p>
                        <p className="text-[11px] text-muted-foreground">Resources page →</p>
                      </div>
                    </div>
                  ))}

                {summary?.details.project_ending
                  .filter((p) => !dismissed.has(`project_ending:${p.project_id}`))
                  .map((p) => (
                    <div
                      key={p.project_id}
                      onClick={() => nav("/project-timeline")}
                      onContextMenu={(ev) => rightClick(ev, "project_ending", p.project_id)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      title="Right-click to dismiss"
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{p.project_name} ends in {p.days_remaining}d</p>
                        <p className="text-[11px] text-muted-foreground">{p.team_size} people freeing {p.end_date} · Timeline →</p>
                      </div>
                    </div>
                  ))}

                {summary?.details.billable_low
                  .filter((b) => !dismissed.has(`billable_low:${b.metric}`))
                  .map((b) => (
                    <div
                      key={b.metric}
                      onClick={() => nav("/")}
                      onContextMenu={(ev) => rightClick(ev, "billable_low", b.metric)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      title="Right-click to dismiss"
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium">Billable {b.current_pct}% — below target</p>
                        <p className="text-[11px] text-muted-foreground">Target {b.target_pct}% · Dashboard →</p>
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>
      )}

      {menu && (
        <DismissMenu
          x={menu.x}
          y={menu.y}
          onDismiss={() => dismiss(menu.type, menu.id)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
