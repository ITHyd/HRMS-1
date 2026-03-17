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
    // Bench: counts as 1 summary notification (not per employee)
    const benchVisible = (summary.details.bench_long ?? []).filter((e) => !dismissed.has(`bench_long:${e.employee_id}`))
    if (benchVisible.length > 0 && !dismissed.has("bench_long:_summary")) c++
    // Project ending: counts as 1 summary notification
    const projVisible = (summary.details.project_ending ?? []).filter((p) => !dismissed.has(`project_ending:${p.project_id}`))
    if (projVisible.length > 0 && !dismissed.has("project_ending:_summary")) c++
    // Billable low: already 1 item
    for (const b of summary.details.billable_low) {
      if (!dismissed.has(`billable_low:${b.metric}`)) c++
    }
    for (const s of summary.details.recent_syncs ?? []) {
      if (!dismissed.has(`recent_syncs:${s.sync_id}`)) c++
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
                {/* Build a unified sorted list — latest first */}
                {(() => {
                  type NItem = { type: string; key: string; dismissKey: string; ts: number; node: React.ReactNode }
                  const items: NItem[] = []

                  for (const s of summary?.details.recent_syncs ?? []) {
                    const dk = `recent_syncs:${s.sync_id}`
                    if (dismissed.has(dk)) continue
                    items.push({
                      type: "recent_syncs", key: s.sync_id, dismissKey: dk,
                      ts: s.completed_at ? new Date(s.completed_at).getTime() : Date.now(),
                      node: (
                        <div
                          key={s.sync_id}
                          onClick={() => nav("/integrations")}
                          onContextMenu={(ev) => rightClick(ev, "recent_syncs", s.sync_id)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          title="Right-click to dismiss"
                        >
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.status === "completed" ? "bg-green-500" : s.status === "failed" ? "bg-destructive" : "bg-blue-500"}`} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {s.type_label} sync {s.status}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {s.records_processed} records processed, {s.records_succeeded} succeeded
                              {s.records_failed > 0 ? `, ${s.records_failed} failed` : ""}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {s.completed_at ? new Date(s.completed_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "In progress"} · Integrations →
                            </p>
                          </div>
                        </div>
                      ),
                    })
                  }

                  // Bench: single grouped notification
                  const benchVisible = (summary?.details.bench_long ?? []).filter((e) => !dismissed.has(`bench_long:${e.employee_id}`))
                  if (benchVisible.length > 0 && !dismissed.has("bench_long:_summary")) {
                    const topNames = benchVisible.slice(0, 3).map((e) => e.employee_name)
                    const remaining = benchVisible.length - topNames.length
                    items.push({
                      type: "bench_long", key: "_summary", dismissKey: "bench_long:_summary",
                      ts: 0,
                      node: (
                        <div
                          key="bench_summary"
                          onClick={() => nav("/")}
                          onContextMenu={(ev) => rightClick(ev, "bench_long", "_summary")}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          title="Right-click to dismiss"
                        >
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium">{benchVisible.length} employee{benchVisible.length !== 1 ? "s" : ""} on long bench</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {topNames.join(", ")}{remaining > 0 ? ` and ${remaining} more` : ""} — benched for 2+ months. Consider reassignment or upskilling.
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Resources page →</p>
                          </div>
                        </div>
                      ),
                    })
                  }

                  // Project ending: single grouped notification
                  const projVisible = (summary?.details.project_ending ?? []).filter((p) => !dismissed.has(`project_ending:${p.project_id}`))
                  if (projVisible.length > 0 && !dismissed.has("project_ending:_summary")) {
                    const topProjs = projVisible.slice(0, 3).map((p) => p.project_name)
                    const remaining = projVisible.length - topProjs.length
                    const totalPeople = projVisible.reduce((sum, p) => sum + p.team_size, 0)
                    items.push({
                      type: "project_ending", key: "_summary", dismissKey: "project_ending:_summary",
                      ts: 0,
                      node: (
                        <div
                          key="proj_summary"
                          onClick={() => nav("/project-timeline")}
                          onContextMenu={(ev) => rightClick(ev, "project_ending", "_summary")}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          title="Right-click to dismiss"
                        >
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium">{projVisible.length} project{projVisible.length !== 1 ? "s" : ""} ending within 7 days</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {topProjs.join(", ")}{remaining > 0 ? ` and ${remaining} more` : ""} — {totalPeople} people will be freed. Plan reassignment.
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Timeline →</p>
                          </div>
                        </div>
                      ),
                    })
                  }

                  for (const b of summary?.details.billable_low ?? []) {
                    const dk = `billable_low:${b.metric}`
                    if (dismissed.has(dk)) continue
                    items.push({
                      type: "billable_low", key: b.metric, dismissKey: dk,
                      ts: 0,
                      node: (
                        <div
                          key={`bill_${b.metric}`}
                          onClick={() => nav("/")}
                          onContextMenu={(ev) => rightClick(ev, "billable_low", b.metric)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          title="Right-click to dismiss"
                        >
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium">Billable {b.current_pct}% — below target</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Branch billable rate is {(b.target_pct - b.current_pct).toFixed(1)}% below the {b.target_pct}% target. Review bench and partial allocations.
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Dashboard →</p>
                          </div>
                        </div>
                      ),
                    })
                  }

                  // Sort: items with a real timestamp (syncs) first (newest on top), then alerts (ts=0) in original order
                  items.sort((a, b) => b.ts - a.ts)

                  return items.map((item) => item.node)
                })()}
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
