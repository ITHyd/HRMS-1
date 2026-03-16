import { create } from "zustand"
import { getNotificationSummary, dismissNotification } from "@/api/notifications"
import type { NotificationSummary } from "@/api/notifications"

const LS_KEY = "bc_dismissed_notifications"

function loadDismissed(): Set<string> {
  try {
    const stored = localStorage.getItem(LS_KEY)
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveDismissed(d: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...d]))
}

interface NotificationState {
  summary: NotificationSummary | null
  dismissed: Set<string>
  loading: boolean
  loadSummary: () => Promise<void>
  dismiss: (type: string, id: string) => void
  clearAll: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  summary: null,
  dismissed: loadDismissed(),
  loading: false,

  loadSummary: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const summary = await getNotificationSummary()
      set({ summary, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  dismiss: (type, id) => {
    const key = `${type}:${id}`
    dismissNotification(type, id).catch(() => {})
    set((state) => {
      const next = new Set(state.dismissed)
      next.add(key)
      saveDismissed(next)
      return { dismissed: next }
    })
  },

  clearAll: () => {
    const summary = get().summary
    if (!summary) return
    const all = new Set<string>()
    for (const e of summary.details.bench_long) all.add(`bench_long:${e.employee_id}`)
    all.add("bench_long:_summary")
    for (const p of summary.details.project_ending) all.add(`project_ending:${p.project_id}`)
    all.add("project_ending:_summary")
    for (const b of summary.details.billable_low) all.add(`billable_low:${b.metric}`)
    for (const s of summary.details.recent_syncs ?? []) all.add(`recent_syncs:${s.sync_id}`)
    saveDismissed(all)
    set({ dismissed: all })
  },
}))
