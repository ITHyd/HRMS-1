import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Calendar, Users, TrendingUp, Building2, ExternalLink, X,
  ChevronDown, ChevronRight, AlertTriangle, Loader2, Filter, Briefcase,
} from "lucide-react"
import { listProjects, getProjectDetail } from "@/api/projects"
import { getEmployeeSkills, getSkillCatalog } from "@/api/availability"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ProjectBrief, ProjectDetail } from "@/types/project"
import type { SkillTag, SkillCatalogEntry } from "@/types/availability"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useNotificationStore } from "@/store/notificationStore"

// ─── constants ─────────────────────────────────────────────────────────────
const COL_W = 44
const LEFT_W = 300
const ROW_H = 52
const HEADER_H = 64
const NUM_WEEKS = 30 // fallback only — overridden dynamically

type WindowFilter = "<30d" | "30-90d" | "90d+" | "all"
const WINDOW_OPTIONS: { value: WindowFilter; label: string }[] = [
  { value: "<30d",   label: "<30d"   },
  { value: "30-90d", label: "30–90d" },
  { value: "90d+",   label: "90d+"   },
  { value: "all",    label: "All"    },
]

type RiskKey = "red" | "orange" | "purple"
const RISK_BANDS: { key: RiskKey; label: string; bg: string; border: string; text: string; chip: string }[] = [
  { key: "red",    label: "< 30 days",  bg: "#ffffff", border: "#f97316", text: "#c2410c", chip: "<30d"   },
  { key: "orange", label: "30–90 days", bg: "#ffffff", border: "#0f766e", text: "#065f46", chip: "30–90d" },
  { key: "purple", label: "> 90 days",  bg: "#ffffff", border: "#1e40af", text: "#1d4ed8", chip: ">90d"   },
]

// ─── date helpers ──────────────────────────────────────────────────────────
function getMonday(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  r.setHours(0, 0, 0, 0)
  return r
}
function addWeeks(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n * 7); return r
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d); r.setMonth(r.getMonth() + n); return r
}
function weekDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 86400 * 1000))
}
function fmt(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}
function fmtFull(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}
function daysUntilEnd(endDate: string | null | undefined): number | null {
  if (!endDate) return null
  return (new Date(endDate).getTime() - Date.now()) / 86400000
}
function inWindow(endDate: string | null | undefined, filter: WindowFilter): boolean {
  const days = daysUntilEnd(endDate)
  if (days === null) return filter === "all"
  if (filter === "all")    return true
  if (filter === "<30d")   return days < 30
  if (filter === "30-90d") return days >= 30 && days < 90
  if (filter === "90d+")   return days >= 90
  return true
}

// ─── urgency ───────────────────────────────────────────────────────────────
type Urgency = "overdue" | "critical" | "upcoming" | "future" | "no_date"

function getUrgency(endDate: string | null | undefined): Urgency {
  if (!endDate) return "no_date"
  const days = (new Date(endDate).getTime() - Date.now()) / 86400000
  if (days < 0)   return "overdue"
  if (days <= 30) return "critical"
  if (days <= 90) return "upcoming"
  return "future"
}
function urgencyToRisk(u: Urgency): RiskKey {
  if (u === "overdue" || u === "critical") return "red"
  if (u === "upcoming") return "orange"
  return "purple"
}

const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: "#ef4444", critical: "#f97316", upcoming: "#3b82f6", future: "#8b5cf6", no_date: "#94a3b8",
}
const URGENCY_BADGE: Record<Urgency, string> = {
  overdue: "bg-red-600 text-white", critical: "bg-orange-500 text-white",
  upcoming: "bg-blue-600 text-white", future: "bg-violet-600 text-white", no_date: "bg-slate-400 text-white",
}
const URGENCY_LABEL: Record<Urgency, string> = {
  overdue: "Overdue", critical: "< 30 days", upcoming: "30–90 days", future: "> 90 days", no_date: "No end date",
}

// ─── week/month grid ───────────────────────────────────────────────────────
const TIMELINE_BAR_TONE: Record<Urgency, { fill: string; border: string }> = {
  overdue:  { fill: "linear-gradient(90deg, #dc2626 0%, #ef4444 100%)", border: "rgba(254, 202, 202, 0.9)" },
  critical: { fill: "linear-gradient(90deg, #ea580c 0%, #f97316 100%)", border: "rgba(254, 215, 170, 0.9)" },
  upcoming: { fill: "linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)", border: "rgba(191, 219, 254, 0.9)" },
  future:   { fill: "linear-gradient(90deg, #475569 0%, #64748b 100%)", border: "rgba(203, 213, 225, 0.9)" },
  no_date:  { fill: "linear-gradient(90deg, #64748b 0%, #94a3b8 100%)", border: "rgba(226, 232, 240, 0.9)" },
}

interface WeekCell  { date: Date; label: string; isCurrent: boolean }
interface MonthSpan { label: string; weekCount: number }

function buildGrid(ganttStart: Date, numWeeks: number = NUM_WEEKS): { weeks: WeekCell[]; months: MonthSpan[] } {
  const weeks: WeekCell[] = []
  const months: MonthSpan[] = []
  let prevMonth = ""
  for (let i = 0; i < numWeeks; i++) {
    const d = addWeeks(ganttStart, i)
    const ml = d.toLocaleString("default", { month: "short", year: "2-digit" })
    weeks.push({ date: d, label: `${d.getDate()}/${d.getMonth() + 1}`, isCurrent: weekDiff(d, getMonday(new Date())) === 0 })
    if (ml !== prevMonth) { months.push({ label: ml, weekCount: 1 }); prevMonth = ml }
    else months[months.length - 1].weekCount++
  }
  return { weeks, months }
}

// ─── Avatar helpers ─────────────────────────────────────────────────────────
function avatarColor(name: string): string {
  const palette = ["#6366f1", "#0ea5e9", "#10b981", "#f97316", "#ef4444", "#8b5cf6"]
  const hash = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return palette[hash % palette.length]
}
function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface DrawerEmployee {
  employee_id: string
  employee_name: string
  designation: string
  project_name: string
  project_id: string
  client_name: string | null
  end_date: string | null
}

// ─── Freeing Card ────────────────────────────────────────────────────────────
function FreeingCard({
  emp, risk, selected, onSelect, onViewProfile, onMatchProjects,
}: {
  emp: DrawerEmployee
  risk: typeof RISK_BANDS[number]
  selected: boolean
  onSelect: () => void
  onViewProfile: () => void
  onMatchProjects: () => void
}) {
  const color = avatarColor(emp.employee_name)

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative cursor-pointer overflow-hidden border transition-all duration-200",
        selected
          ? "border-primary shadow-md ring-2 ring-primary/20"
          : "border-border shadow-sm bc-hover-surface hover:border-primary/40"
      )}
      style={{
        minHeight: 100,
        borderRadius: 10,
        backgroundColor: risk.bg,
        borderLeft: `4px solid ${risk.border}`,
      }}
    >
      {/* Risk pill — top-right */}
      <div className="absolute top-2 right-2.5 z-10">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: risk.border + "22", color: risk.text, border: `1px solid ${risk.border}` }}
        >
          {risk.chip}
        </span>
      </div>

      <div className="p-3 space-y-1.5">
        {/* Name + designation */}
        <div className="flex items-center gap-2 pr-12">
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm"
            style={{ backgroundColor: color }}
          >
            {initials(emp.employee_name)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate leading-tight" style={{ color: risk.text }}>
              {emp.employee_name}
            </p>
            <p className="text-[11px] truncate" style={{ color: risk.text + "99" }}>
              {emp.designation || "Team member"}
            </p>
          </div>
        </div>

        {/* Project */}
        <p className="text-[11px] leading-snug truncate" style={{ color: risk.text + "bb" }}>
          {emp.project_name}
        </p>

        {/* Client · Ends */}
        <p className="text-[11px]" style={{ color: risk.text + "bb" }}>
          Client: <span className="font-medium" style={{ color: risk.text }}>{emp.client_name ?? "—"}</span>
          {" · Ends: "}
          <span className="font-medium" style={{ color: risk.text }}>{fmt(emp.end_date)}</span>
        </p>

        {/* Footer buttons */}
        <div className="flex gap-1.5 justify-end pt-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onViewProfile() }}
            className="rounded border border-slate-400/70 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            View Profile
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMatchProjects() }}
            className="rounded bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-blue-700"
          >
            Match Projects
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Suggest Projects Modal ─────────────────────────────────────────────────
function ProjectSuggestionRow({ project, highlight }: { project: ProjectBrief; highlight?: boolean }) {
  const urgency = getUrgency(project.end_date)
  return (
    <Link
      to={`/projects/${project.id}`}
      className={`group flex items-center justify-between gap-2 rounded-md px-3 py-2 text-xs transition-all duration-200 hover:bg-muted/80 ${
        highlight
          ? "bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
          : "bg-muted/40 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: URGENCY_COLOR[urgency] }} />
        <span className="font-medium truncate group-hover:text-foreground">{project.name}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
        <span>{project.member_count} ppl</span>
        <span className="whitespace-nowrap">{fmtFull(project.end_date)}</span>
        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}

function SuggestProjectsModal({
  emp, empSkills, projects, onClose,
}: {
  emp: DrawerEmployee
  empSkills: SkillTag[]
  projects: ProjectBrief[]
  onClose: () => void
}) {
  const otherProjects = projects.filter((p) => p.id !== emp.project_id)
  const sameClient   = emp.client_name ? otherProjects.filter((p) => p.client_name === emp.client_name) : []
  const otherActive  = emp.client_name ? otherProjects.filter((p) => p.client_name !== emp.client_name) : otherProjects
  const skillNames   = empSkills.map((s) => s.skill_name)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-background rounded-xl border shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 py-3 border-b gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">Suggest Projects — {emp.employee_name}</h2>
            {skillNames.length > 0 ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Skills: {skillNames.slice(0, 5).join(", ")}{skillNames.length > 5 ? ` +${skillNames.length - 5}` : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">{emp.designation || "Team member"}</p>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {sameClient.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                  Same Client — {emp.client_name}
                </p>
              </div>
              <div className="space-y-1.5">
                {sameClient.map((p) => <ProjectSuggestionRow key={p.id} project={p} highlight />)}
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {sameClient.length > 0 ? "Other Active Projects" : "Active Projects"}
              </p>
            </div>
            {otherActive.length === 0
              ? <p className="text-xs text-muted-foreground py-6 text-center">No other active projects found</p>
              : (
                <div className="space-y-1.5">
                  {otherActive.slice(0, 10).map((p) => <ProjectSuggestionRow key={p.id} project={p} />)}
                  {otherActive.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">+{otherActive.length - 10} more projects</p>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Employee Drawer ─────────────────────────────────────────────────────────
function EmployeeDrawer({ emp, skills, onClose }: { emp: DrawerEmployee; skills: SkillTag[]; onClose: () => void }) {
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const availableMonth = emp.end_date
    ? new Date(emp.end_date).toLocaleString("default", { month: "long", year: "numeric" })
    : null
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div className="w-80 bg-background border-l shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-4 border-b">
          <h2 className="font-semibold text-sm">Employee Details</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
              style={{ backgroundColor: avatarColor(emp.employee_name) }}
            >
              {initials(emp.employee_name)}
            </div>
            <div>
              <p className="font-semibold">{emp.employee_name}</p>
              <p className="text-sm text-muted-foreground">{emp.designation || "Team member"}</p>
            </div>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Completing</p>
            <Link
              to={`/projects/${emp.project_id}`}
              onClick={onClose}
              className="text-sm font-medium text-foreground hover:underline flex items-center gap-1"
            >
              {emp.project_name}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </Link>
            {emp.client_name && <p className="text-xs text-muted-foreground">Client: {emp.client_name}</p>}
            <p className="text-xs text-muted-foreground">End date: {fmtFull(emp.end_date)}</p>
          </div>
          {skills.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2" style={{ background: "#f9fafb", borderColor: "#e5e7eb" }}>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span key={s.skill_name} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "#ede9fe", color: "#5b21b6" }}>
                    {s.skill_name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {availableMonth && (
            <div className="rounded-lg border p-3 flex items-center gap-3" style={{ background: "#f9fafb", borderColor: "#e5e7eb" }}>
              <div className="rounded-md p-1.5 shrink-0" style={{ background: "#d1fae5" }}>
                <Users className="h-4 w-4" style={{ color: "#059669" }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "#111827" }}>Available for new project</p>
                <p className="text-xs text-muted-foreground mt-0.5">From {availableMonth}</p>
              </div>
            </div>
          )}
        </div>
        <div className="px-4 pb-4 border-t pt-3">
          <button
            className="block w-full text-center rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
            onClick={() => { onClose(); selectEmployee(emp.employee_id) }}
          >
            View More Details
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Gantt chart ─────────────────────────────────────────────────────────────
function GanttChart({
  projects, ganttStart, weeks, months, numWeeks,
  details, loadingDetailId, onLoadDetail,
}: {
  projects: ProjectBrief[]
  ganttStart: Date
  weeks: WeekCell[]
  months: MonthSpan[]
  numWeeks: number
  details: Record<string, ProjectDetail>
  loadingDetailId: string | null
  onLoadDetail: (id: string) => void
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [hoveredBarId, setHoveredBarId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const todayWeek = weekDiff(ganttStart, getMonday(new Date()))
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayWeek * COL_W - 120)
  }, [ganttStart])

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    if (!details[id]) onLoadDetail(id)
  }

  function barStyle(p: ProjectBrief) {
    const ganttEnd = addWeeks(ganttStart, numWeeks)
    const s = p.start_date ? new Date(p.start_date) : ganttStart
    const e = p.end_date ? new Date(p.end_date) : null
    const effStart = s < ganttStart ? ganttStart : s
    const effEnd = e ? (e > ganttEnd ? ganttEnd : e) : null
    if (!effEnd || effStart >= ganttEnd) return null
    const sw = Math.max(0, weekDiff(ganttStart, getMonday(effStart)))
    const ew = Math.min(numWeeks, Math.max(sw + 1, weekDiff(ganttStart, getMonday(effEnd)) + 1))
    const urgency = getUrgency(p.end_date)
    const tone = TIMELINE_BAR_TONE[urgency]
    return {
      left: sw * COL_W + 3,
      width: Math.max(COL_W - 6, (ew - sw) * COL_W - 6),
      fill: tone.fill,
      border: tone.border,
    }
  }

  const todayWeek = weekDiff(ganttStart, getMonday(new Date()))
  const todayOffset = todayWeek >= 0 && todayWeek < numWeeks ? todayWeek * COL_W + COL_W / 2 : null

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex">
        <div className="z-20 shrink-0 border-r border-border/80 bg-card" style={{ width: LEFT_W }}>
          <div className="flex items-center border-b border-border/80 bg-muted/40 px-3.5" style={{ height: HEADER_H }}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Project</p>
              <p className="text-xs text-muted-foreground">Client and timeline</p>
            </div>
          </div>
          {projects.map((p, rowIndex) => {
            const exp = expandedIds.has(p.id)
            const detail = details[p.id]
            const urgency = getUrgency(p.end_date)
            return (
              <div key={p.id}>
                <button
                  onClick={() => toggle(p.id)}
                  className={`w-full border-b border-border/70 px-3.5 text-left transition-colors ${
                    rowIndex % 2 === 0 ? "bg-background" : "bg-muted/20"
                  } hover:bg-primary/5`}
                >
                  <div className="flex items-center gap-2.5" style={{ height: ROW_H }}>
                    {exp
                      ? <ChevronDown  className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="truncate text-sm font-medium leading-tight">{p.name}</p>
                        {(() => {
                          const days = daysUntilEnd(p.end_date)
                          if (days === null || days < 0 || days > 7) return null
                          if (notifDismissed.has(`project_ending:${p.id}`)) return null
                          const info = notifSummary?.details.project_ending.find((ep) => ep.project_id === p.id)
                          return (
                            <span
                              title={`${info?.team_size ?? p.member_count} people freeing ${fmt(p.end_date)} · Right-click to dismiss`}
                              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); notifDismiss("project_ending", p.id) }}
                              className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 cursor-context-menu select-none whitespace-nowrap"
                            >
                              🔔 Ends soon
                            </span>
                          )
                        })()}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.client_name} | Ends {fmt(p.end_date)}
                      </p>
                    </div>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: URGENCY_COLOR[urgency] }} />
                    {loadingDetailId === p.id && (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </button>
                {exp && (
                  <div className="space-y-1.5 border-b border-border/70 bg-muted/20 px-3.5 py-2.5 min-h-[44px]">
                    {loadingDetailId === p.id ? (
                      <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : detail ? (
                      detail.members.length > 0
                        ? detail.members.map((m) => (
                            <div key={m.employee_id} className="flex items-center gap-1.5">
                              <div
                                className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ring-1 ring-white/70"
                                style={{ backgroundColor: avatarColor(m.employee_name) }}
                              >
                                {initials(m.employee_name)}
                              </div>
                              <p className="text-xs truncate flex-1">{m.employee_name}</p>
                              <span className="text-[10px] text-muted-foreground">{m.role_in_project}</span>
                            </div>
                          ))
                        : <p className="text-xs text-muted-foreground">No members</p>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div ref={scrollRef} className="relative flex-1 overflow-x-auto scrollbar-thin">
          <div style={{ width: numWeeks * COL_W, position: "relative" }}>
            {todayOffset !== null && (
              <>
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-500/70"
                  style={{ left: todayOffset }}
                />
                <div
                  className="pointer-events-none absolute top-1 z-30 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                  style={{ left: todayOffset }}
                >
                  Today
                </div>
              </>
            )}
            <div className="sticky top-0 z-20 flex border-b border-border/80 bg-muted/60 backdrop-blur" style={{ height: 32 }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  className="shrink-0 border-r border-border/70 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center whitespace-nowrap overflow-hidden"
                  style={{ width: m.weekCount * COL_W }}
                >
                  {m.label}
                </div>
              ))}
            </div>
            <div
              className="sticky z-20 flex border-b border-border/80 bg-card backdrop-blur"
              style={{ top: 32, height: HEADER_H - 32 }}
            >
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className={`shrink-0 border-r border-border/60 flex items-center justify-center text-[10px] ${
                    w.isCurrent ? "bg-red-50 text-red-600 font-semibold" : "text-muted-foreground"
                  }`}
                  style={{ width: COL_W }}
                >
                  {w.label}
                </div>
              ))}
            </div>
            {projects.map((p, rowIndex) => {
              const bar = barStyle(p)
              const exp = expandedIds.has(p.id)
              const detail = details[p.id]
              const expandedH = exp ? Math.max(40, (detail?.members.length ?? 0) * 24 + 16) : 0
              const barHeight = ROW_H - 18
              const tooltipLeft = bar ? Math.min(numWeeks * COL_W - 12, Math.max(12, bar.left + bar.width / 2)) : 0
              return (
                <div key={p.id}>
                  <div
                    className={`relative cursor-pointer border-b border-border/70 transition-colors ${
                      rowIndex % 2 === 0 ? "bg-background" : "bg-muted/20"
                    } hover:bg-primary/5`}
                    style={{ height: ROW_H }}
                    onClick={() => toggle(p.id)}
                  >
                    {weeks.map((_, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 border-r ${i % 4 === 0 ? "border-border/60" : "border-border/30"}`}
                        style={{ left: i * COL_W, width: COL_W }}
                      />
                    ))}
                    {bar && (
                      <div
                        className="absolute flex items-center overflow-hidden rounded-full border px-2.5 text-[10px] font-semibold text-white shadow-[0_3px_10px_rgba(15,23,42,0.16)] transition-transform duration-200 hover:-translate-y-0.5"
                        style={{
                          left: bar.left,
                          width: bar.width,
                          height: barHeight,
                          top: (ROW_H - barHeight) / 2,
                          background: bar.fill,
                          borderColor: bar.border,
                        }}
                        onMouseEnter={() => setHoveredBarId(p.id)}
                        onMouseLeave={() => setHoveredBarId((curr) => (curr === p.id ? null : curr))}
                      >
                        <span className="truncate">{p.name}</span>
                      </div>
                    )}
                    {bar && hoveredBarId === p.id && (
                      <div
                        className="bc-tooltip absolute z-40 -translate-x-1/2 -translate-y-full whitespace-nowrap"
                        style={{ left: tooltipLeft, top: (ROW_H - barHeight) / 2 - 6 }}
                      >
                        {p.name}: {fmt(p.start_date)} - {fmt(p.end_date)}
                      </div>
                    )}
                  </div>
                  {exp && <div className="border-b border-border/70 bg-muted/20" style={{ height: expandedH || 40 }} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ProjectTimelinePage() {
  const navigate = useNavigate()
  const notifSummary = useNotificationStore((s) => s.summary)
  const notifDismissed = useNotificationStore((s) => s.dismissed)
  const notifDismiss = useNotificationStore((s) => s.dismiss)
  const [activeTab, setActiveTab] = useState<"timeline" | "freeing" | "opportunities">("timeline")
  const [projects, setProjects] = useState<ProjectBrief[]>([])
  const [details, setDetails] = useState<Record<string, ProjectDetail>>({})
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [drawerEmp, setDrawerEmp] = useState<DrawerEmployee | null>(null)
  const [suggestEmp, setSuggestEmp] = useState<DrawerEmployee | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)

  // Freeing Up filters
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("all")
  const [empSkills, setEmpSkills] = useState<Record<string, SkillTag[]>>({})
  const [skillCatalog, setSkillCatalog] = useState<SkillCatalogEntry[]>([])
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [skillDropdownOpen, setSkillDropdownOpen] = useState(false)

  const ganttStart = useMemo(() => {
    if (projects.length === 0) return addWeeks(getMonday(new Date()), -4 + weekOffset)
    const dates = projects
      .filter((p) => p.start_date)
      .map((p) => new Date(p.start_date!))
    const earliest = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date()
    return addWeeks(getMonday(earliest), -1 + weekOffset)
  }, [projects, weekOffset])

  const numWeeks = useMemo(() => {
    if (projects.length === 0) return 30
    const endDates = projects
      .filter((p) => p.end_date)
      .map((p) => new Date(p.end_date!))
    const latest = endDates.length > 0 ? new Date(Math.max(...endDates.map((d) => d.getTime()))) : addWeeks(ganttStart, 30)
    const weeks = weekDiff(ganttStart, addWeeks(getMonday(latest), 2))
    return Math.max(30, weeks)
  }, [projects, ganttStart])

  const { weeks, months } = buildGrid(ganttStart, numWeeks)

  useEffect(() => {
    getSkillCatalog().then(setSkillCatalog).catch(() => {})
  }, [])

  const loadDetailForId = useCallback(async (id: string) => {
    if (details[id]) return
    setLoadingDetailId(id)
    try {
      const d = await getProjectDetail(id)
      setDetails((prev) => ({ ...prev, [id]: d }))
    } finally {
      setLoadingDetailId(null)
    }
  }, [details])

  const loadData = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res = await listProjects({ status: "ACTIVE", page_size: 100 })
      setProjects(res.projects)
    } catch {
      setError("Failed to load projects. Make sure the backend is running.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Pre-fetch project details when Freeing Up tab opens (12-month horizon)
  useEffect(() => {
    if (activeTab !== "freeing" || projects.length === 0) return
    const cutoff = addMonths(new Date(), 12)
    const toFetch = projects.filter((p) => p.end_date && new Date(p.end_date) <= cutoff)
    const fetchSequentially = async () => {
      for (const p of toFetch) {
        if (!details[p.id]) await loadDetailForId(p.id)
      }
    }
    fetchSequentially()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, projects.length])

  // Fetch employee skills after project details load
  const detailsCount = Object.keys(details).length
  useEffect(() => {
    if (activeTab !== "freeing") return
    const allEmpIds = new Set<string>()
    Object.values(details).forEach((d) => d.members.forEach((m) => allEmpIds.add(m.employee_id)))
    const toFetch = [...allEmpIds].filter((id) => !(id in empSkills))
    if (toFetch.length === 0) return
    const fetchSkills = async () => {
      for (const empId of toFetch) {
        try {
          const skills = await getEmployeeSkills(empId)
          setEmpSkills((prev) => ({ ...prev, [empId]: skills }))
        } catch {
          setEmpSkills((prev) => ({ ...prev, [empId]: [] }))
        }
      }
    }
    fetchSkills()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsCount, activeTab])

  // ── build flat list of all freeing employees (from loaded details) ──────────
  const allFreeingEmps: DrawerEmployee[] = []
  for (const p of projects) {
    if (!p.end_date) continue
    const detail = details[p.id]
    if (!detail) continue
    for (const m of detail.members) {
      allFreeingEmps.push({
        employee_id: m.employee_id,
        employee_name: m.employee_name,
        designation: m.designation,
        project_name: p.name,
        project_id: p.id,
        client_name: p.client_name,
        end_date: p.end_date,
      })
    }
  }

  // Apply window + skill filters
  const filteredEmps = allFreeingEmps.filter((emp) => {
    if (!inWindow(emp.end_date, windowFilter)) return false
    if (selectedSkills.length > 0) {
      const skills = empSkills[emp.employee_id] ?? []
      if (!skills.some((s) => selectedSkills.includes(s.skill_name))) return false
    }
    return true
  })

  // Group by risk band (sorted: red → orange → purple)
  const empsByBand: Record<RiskKey, DrawerEmployee[]> = { red: [], orange: [], purple: [] }
  for (const emp of filteredEmps) {
    const risk = urgencyToRisk(getUrgency(emp.end_date))
    empsByBand[risk].push(emp)
  }
  // Sort within each band by end_date ascending
  for (const band of RISK_BANDS) {
    empsByBand[band.key].sort((a, b) => (a.end_date ?? "9999") < (b.end_date ?? "9999") ? -1 : 1)
  }

  const freeingTotal = filteredEmps.length

  // Loading indicator: projects in 12-month window that don't have details yet
  const cutoff12 = addMonths(new Date(), 12)
  const pendingDetails = projects.filter((p) => p.end_date && new Date(p.end_date) <= cutoff12 && !details[p.id])
  const loadingFreeingData = pendingDetails.length > 0

  // ── stat card values (project-level counts, no detail needed) ──────────────
  const overdue  = projects.filter((p) => getUrgency(p.end_date) === "overdue").length
  const critical = projects.filter((p) => getUrgency(p.end_date) === "critical").length
  const freeing90 = projects
    .filter((p) => { const u = getUrgency(p.end_date); return u === "overdue" || u === "critical" || u === "upcoming" })
    .reduce((sum, p) => sum + p.member_count, 0)
  function bandCount(minD: number, maxD: number) {
    return projects
      .filter((p) => { const d = daysUntilEnd(p.end_date); return d !== null && d >= minD && d < maxD })
      .reduce((sum, p) => sum + p.member_count, 0)
  }
  const freeing_lt30  = bandCount(-Infinity, 30)
  const freeing_30_90 = bandCount(30, 90)
  const freeing_gt90  = bandCount(90, Infinity)

  // ── client opportunities ────────────────────────────────────────────────────
  type ClientOpp = { client_name: string; projects: ProjectBrief[]; earliestEnd: string | null; totalMembers: number }
  const clientMap: Record<string, ClientOpp> = {}
  for (const p of projects) {
    if (!p.client_name) continue
    const u = getUrgency(p.end_date)
    if (u === "future" || u === "no_date") continue
    const opp = (clientMap[p.client_name] ??= { client_name: p.client_name, projects: [], earliestEnd: null, totalMembers: 0 })
    opp.projects.push(p)
    opp.totalMembers += p.member_count
    if (!opp.earliestEnd || (p.end_date && p.end_date < opp.earliestEnd)) opp.earliestEnd = p.end_date
  }
  const clientOpps = Object.values(clientMap).sort((a, b) => (a.earliestEnd ?? "9999") < (b.earliestEnd ?? "9999") ? -1 : 1)

  // ── handlers ────────────────────────────────────────────────────────────────
  const handleMatchProjects = (emp: DrawerEmployee) => {
    const params = new URLSearchParams()
    if (emp.client_name) params.set("client_name", emp.client_name)
    navigate(`/projects?${params.toString()}`)
  }

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill])
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }
  if (error) {
    return <div className="flex h-64 items-center justify-center text-destructive text-sm">{error}</div>
  }

  const tabs = [
    { key: "timeline"      as const, label: "Timeline" },
    { key: "freeing"       as const, label: `Freeing Up${freeingTotal ? ` (${freeingTotal})` : ""}` },
    { key: "opportunities" as const, label: `Client Opportunities${clientOpps.length ? ` (${clientOpps.length})` : ""}` },
  ]

  return (
    <div className="space-y-5 p-6">
      {drawerEmp && <EmployeeDrawer emp={drawerEmp} skills={empSkills[drawerEmp.employee_id] ?? []} onClose={() => setDrawerEmp(null)} />}
      {suggestEmp && (
        <SuggestProjectsModal
          emp={suggestEmp}
          empSkills={empSkills[suggestEmp.employee_id] ?? []}
          projects={projects}
          onClose={() => setSuggestEmp(null)}
        />
      )}

      <div>
        <h2 className="text-xl font-semibold tracking-tight">Project Timeline</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track project end dates, see who's freeing up, and plan client renewals
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Active Projects */}
        <div
          className="rounded-xl border p-4 shadow-sm transition-all duration-200 bc-hover-surface hover:border-primary/30"
          style={{ background: "#f9fafb" }}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-slate-100">
              <Calendar className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Projects</p>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: "#111827" }}>{projects.length}</p>
            </div>
          </div>
        </div>
        {/* Overdue */}
        <div
          className="rounded-xl border p-4 shadow-sm transition-all duration-200 bc-hover-surface hover:border-primary/30"
          style={{ background: "#f9fafb" }}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: "#111827" }}>{overdue}</p>
            </div>
          </div>
        </div>
        {/* Ending <30d */}
        <div
          className="rounded-xl border p-4 shadow-sm transition-all duration-200 bc-hover-surface hover:border-primary/30"
          style={{ background: "#f9fafb" }}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-orange-50">
              <TrendingUp className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ending &lt; 30 days</p>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: "#111827" }}>{critical}</p>
            </div>
          </div>
        </div>
        {/* Freeing Up */}
        <div
          className="rounded-xl border p-4 shadow-sm transition-all duration-200 bc-hover-surface hover:border-primary/30"
          style={{ background: "#f9fafb" }}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-blue-50">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Freeing Up (90d)</p>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: "#111827" }}>{freeing90}</p>
              {(freeing_lt30 + freeing_30_90 + freeing_gt90) > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap tabular-nums">
                  &lt;30d: {freeing_lt30} · 30–90d: {freeing_30_90} · &gt;90d: {freeing_gt90}
                </p>
              )}
            </div>
          </div>
        </div>
        {/* Client Opportunities */}
        <div
          className="rounded-xl border p-4 shadow-sm transition-all duration-200 bc-hover-surface hover:border-primary/30"
          style={{ background: "#f9fafb" }}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-emerald-50">
              <Building2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Client Opportunities</p>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: "#111827" }}>{clientOpps.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Timeline ── */}
      {activeTab === "timeline" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Window starts {weeks[0]?.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </p>
            <div className="flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm">
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setWeekOffset((n) => n - 4)}>
                {"< 4 wks"}
              </Button>
              <Button
                variant={weekOffset === 0 ? "default" : "outline"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setWeekOffset(0)}
              >
                Today
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setWeekOffset((n) => n + 4)}>
                {"4 wks >"}
              </Button>
            </div>
          </div>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Calendar className="h-10 w-10 opacity-30" />
              <p className="text-sm">No active projects found</p>
            </div>
          ) : (
            <GanttChart
              projects={projects} ganttStart={ganttStart} weeks={weeks} months={months} numWeeks={numWeeks}
              details={details} loadingDetailId={loadingDetailId} onLoadDetail={loadDetailForId}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Click a row to expand team members. Timeline bars are color-coded by urgency.
          </p>
        </div>
      )}

      {/* ── TAB 2: Freeing Up ── */}
      {activeTab === "freeing" && (
        <div className="space-y-6">

          {/* ── Freeing Up header: summary + segmented control + skill filter ── */}
          <div className="flex items-center justify-between gap-4 flex-wrap rounded-xl border bg-card px-5 py-4">
            {/* Summary text */}
            <div>
              {loadingFreeingData ? (
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </p>
              ) : (
                <>
                  <p className="text-base font-bold text-foreground leading-tight">
                    Freeing Up: {allFreeingEmps.length}
                    {" · "}
                    <span>&lt;30d: {allFreeingEmps.filter(e => urgencyToRisk(getUrgency(e.end_date)) === "red").length}</span>
                    {" | "}
                    <span>30–90d: {allFreeingEmps.filter(e => urgencyToRisk(getUrgency(e.end_date)) === "orange").length}</span>
                    {" | "}
                    <span>&gt;90d: {allFreeingEmps.filter(e => urgencyToRisk(getUrgency(e.end_date)) === "purple").length}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {freeingTotal === allFreeingEmps.length ? "All windows" : `${freeingTotal} shown`}
                    {selectedSkills.length > 0 ? ` · ${selectedSkills.length} skill filter${selectedSkills.length > 1 ? "s" : ""}` : ""}
                  </p>
                </>
              )}
            </div>

            {/* Right: segmented control + skill filter */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Segmented control */}
              <div className="flex rounded-lg overflow-hidden border text-xs font-medium">
                {WINDOW_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.value}
                    onClick={() => setWindowFilter(opt.value)}
                    className={`px-3 py-1.5 transition-colors ${i > 0 ? "border-l" : ""} ${
                      windowFilter === opt.value
                        ? "bg-foreground text-background font-bold"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Skill filter */}
              <div className="relative">
                <button
                  onClick={() => setSkillDropdownOpen((o) => !o)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedSkills.length > 0
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Skills
                  {selectedSkills.length > 0 && (
                    <span className="ml-1 rounded-full bg-background text-foreground px-1.5 py-0.5 text-[10px] font-bold leading-none">
                      {selectedSkills.length}
                    </span>
                  )}
                </button>

                {skillDropdownOpen && (
                  <div
                    className="absolute top-full right-0 mt-1 z-30 w-56 rounded-lg border bg-background shadow-xl"
                    onMouseLeave={() => setSkillDropdownOpen(false)}
                  >
                    <div className="p-2 border-b flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Filter by skill</span>
                      {selectedSkills.length > 0 && (
                        <button onClick={() => setSelectedSkills([])} className="text-[10px] text-muted-foreground hover:text-foreground">
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                      {skillCatalog.length === 0
                        ? <p className="text-xs text-muted-foreground px-2 py-3 text-center">No skills in catalog</p>
                        : skillCatalog.map((skill) => (
                            <label key={skill.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedSkills.includes(skill.name)}
                                onChange={() => toggleSkill(skill.name)}
                                className="accent-primary"
                              />
                              <span className="text-xs">{skill.display_name || skill.name}</span>
                            </label>
                          ))
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Loading progress (below header) */}
          {loadingFreeingData && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Fetching member data for {pendingDetails.length} project{pendingDetails.length !== 1 ? "s" : ""}…
            </div>
          )}

          {/* Empty state */}
          {!loadingFreeingData && freeingTotal === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <span className="text-5xl select-none">🎉</span>
              <p className="text-base font-semibold text-foreground">No employees freeing up in the next 90 days</p>
              <p className="text-sm text-muted-foreground">Everyone's fully allocated — great news for utilisation!</p>
              {windowFilter !== "all" && (
                <button
                  onClick={() => setWindowFilter("all")}
                  className="mt-1 text-xs text-foreground hover:underline"
                >
                  Show all time ranges
                </button>
              )}
            </div>
          )}

          {/* Risk band groups — sorted Red → Orange → Purple */}
          {freeingTotal > 0 && RISK_BANDS.map((band) => {
            const emps = empsByBand[band.key]
            if (emps.length === 0) return null
            return (
              <div key={band.key} className="space-y-3">
                {/* Section header with left border stripe */}
                <div
                  className="flex items-center gap-3 pl-3 py-1"
                  style={{ borderLeft: `4px solid ${band.border}` }}
                >
                  <h3 className="text-sm font-semibold" style={{ color: band.text }}>
                    {band.label}
                  </h3>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: band.border + "18", color: band.text }}
                  >
                    {emps.length} {emps.length === 1 ? "person" : "people"}
                  </span>
                </div>

                {/* 2-column card grid, min 300px per card */}
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                  {emps.map((emp) => (
                    <FreeingCard
                      key={`${emp.employee_id}-${emp.project_id}`}
                      emp={emp}
                      risk={band}
                      selected={selectedEmpId === `${emp.employee_id}-${emp.project_id}`}
                      onSelect={() => setSelectedEmpId(
                        selectedEmpId === `${emp.employee_id}-${emp.project_id}` ? null : `${emp.employee_id}-${emp.project_id}`
                      )}
                      onViewProfile={() => setDrawerEmp(emp)}
                      onMatchProjects={() => handleMatchProjects(emp)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB 3: Client Opportunities ── */}
      {activeTab === "opportunities" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clients with active projects ending within 90 days — the best time to plan renewal or new work.
          </p>
          {clientOpps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <TrendingUp className="h-10 w-10 opacity-30" />
              <p className="text-sm">No client opportunities in the next 90 days</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {clientOpps.map((opp) => {
                const mostUrgent = opp.projects.reduce<Urgency>((acc, p) => {
                  const order: Urgency[] = ["overdue", "critical", "upcoming", "future", "no_date"]
                  const pu = getUrgency(p.end_date)
                  return order.indexOf(pu) < order.indexOf(acc) ? pu : acc
                }, "no_date")
                return (
                  <div
                    key={opp.client_name}
                    className="bc-hover-surface rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-muted p-1.5 shrink-0">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{opp.client_name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {opp.projects.length} project{opp.projects.length !== 1 ? "s" : ""} · {opp.totalMembers} people freeing up
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_BADGE[mostUrgent]}`}>
                        {URGENCY_LABEL[mostUrgent]}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {opp.projects.map((p) => {
                        const pu = getUrgency(p.end_date)
                        return (
                          <div key={p.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs gap-2 transition-colors hover:bg-muted/70">
                            <Link to={`/projects/${p.id}`} className="font-medium hover:text-foreground transition-colors flex items-center gap-1 truncate">
                              {p.name} <ExternalLink className="h-3 w-3 shrink-0" />
                            </Link>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted-foreground">{p.member_count} ppl</span>
                              <span className="h-2 w-2 rounded-full" style={{ background: URGENCY_COLOR[pu] }} />
                              <span className="text-muted-foreground whitespace-nowrap">{fmtFull(p.end_date)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-start gap-2 rounded-md px-3 py-2.5" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
                      <p className="text-xs leading-relaxed" style={{ color: "#15803d" }}>
                        <span className="font-semibold">Renewal opportunity: </span>
                        Reach out to <span className="font-medium">{opp.client_name}</span> before{" "}
                        <span className="font-medium">{fmtFull(opp.earliestEnd)}</span> to discuss the next engagement and retain{" "}
                        <span className="font-medium">{opp.totalMembers} freed resource{opp.totalMembers !== 1 ? "s" : ""}</span>.
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => navigate(`/projects?client_name=${encodeURIComponent(opp.client_name)}`)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Create Renewal →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
