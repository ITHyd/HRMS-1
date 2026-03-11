import { useEffect, useState, useCallback, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Calendar, Users, TrendingUp, Building2, ExternalLink, X,
  ChevronDown, ChevronRight, AlertTriangle, Loader2, Filter, Briefcase,
} from "lucide-react"
import { listProjects, getProjectDetail } from "@/api/projects"
import { getEmployeeSkills, getSkillCatalog } from "@/api/availability"
import type { ProjectBrief, ProjectDetail } from "@/types/project"
import type { SkillTag, SkillCatalogEntry } from "@/types/availability"

// ─── constants ─────────────────────────────────────────────────────────────
const COL_W = 44
const LEFT_W = 300
const ROW_H = 48
const HEADER_H = 60
const NUM_WEEKS = 30

type WindowFilter = "<30d" | "30-90d" | "90d+" | "all"
const WINDOW_OPTIONS: { value: WindowFilter; label: string }[] = [
  { value: "<30d",   label: "<30d"   },
  { value: "30-90d", label: "30–90d" },
  { value: "90d+",   label: "90d+"   },
  { value: "all",    label: "All"    },
]

type RiskKey = "red" | "orange" | "purple"
const RISK_BANDS: { key: RiskKey; label: string; bg: string; border: string; text: string; chip: string }[] = [
  { key: "red",    label: "< 30 days",  bg: "#fef7f6", border: "#f97316", text: "#c2410c", chip: "<30d"   },
  { key: "orange", label: "30–90 days", bg: "#f0fdf9", border: "#0f766e", text: "#065f46", chip: "30–90d" },
  { key: "purple", label: "> 90 days",  bg: "#eff6ff", border: "#1e40af", text: "#1d4ed8", chip: ">90d"   },
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
function monthLabel(iso: string): string {
  return new Date(iso + "-01").toLocaleString("default", { month: "long", year: "numeric" })
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
interface WeekCell  { date: Date; label: string; isCurrent: boolean }
interface MonthSpan { label: string; weekCount: number }

function buildGrid(ganttStart: Date): { weeks: WeekCell[]; months: MonthSpan[] } {
  const weeks: WeekCell[] = []
  const months: MonthSpan[] = []
  let prevMonth = ""
  for (let i = 0; i < NUM_WEEKS; i++) {
    const d = addWeeks(ganttStart, i)
    const ml = d.toLocaleString("default", { month: "short", year: "2-digit" })
    weeks.push({ date: d, label: `${d.getDate()}/${d.getMonth() + 1}`, isCurrent: weekDiff(d, getMonday(new Date())) === 0 })
    if (ml !== prevMonth) { months.push({ label: ml, weekCount: 1 }); prevMonth = ml }
    else months[months.length - 1].weekCount++
  }
  return { weeks, months }
}

// ─── Avatar helpers ─────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f97316",
  "#10b981", "#3b82f6", "#f59e0b", "#14b8a6",
  "#a855f7", "#ef4444", "#0ea5e9", "#84cc16",
]
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
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
  emp, skills, risk, selected, onSelect, onViewProfile, onMatchProjects,
}: {
  emp: DrawerEmployee
  skills: SkillTag[]
  risk: typeof RISK_BANDS[number]
  selected: boolean
  onSelect: () => void
  onViewProfile: () => void
  onMatchProjects: () => void
}) {
  const color = avatarColor(emp.employee_name)
  const skillList = skills.slice(0, 3).map((s) => s.skill_name).join(", ")
  const hasMoreSkills = skills.length > 3

  return (
    <div
      onClick={onSelect}
      className="relative rounded-xl cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
      style={{
        minHeight: 140,
        backgroundColor: risk.bg,
        border: selected
          ? "2px solid #3b82f6"
          : `1px solid ${risk.border}`,
        boxShadow: selected ? "0 0 0 3px #bfdbfe" : undefined,
        borderLeft: `4px solid ${risk.border}`,
      }}
    >
      {/* Risk pill — top-right */}
      <div className="absolute top-2.5 right-3 z-10">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: risk.border + "22", color: risk.text, border: `1px solid ${risk.border}` }}
        >
          {risk.chip}
        </span>
      </div>

      <div className="p-4 space-y-2">
        {/* Name + designation */}
        <div className="flex items-center gap-2.5 pr-14">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
            style={{ backgroundColor: color }}
          >
            {initials(emp.employee_name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight" style={{ color: risk.text }}>
              {emp.employee_name}
            </p>
            <p className="text-xs truncate" style={{ color: risk.text + "99" }}>
              {emp.designation || "Team member"}
            </p>
          </div>
        </div>

        {/* [Skills] · Project */}
        <p className="text-xs leading-snug" style={{ color: risk.text }}>
          {skillList ? (
            <>
              <span className="font-semibold">[{skillList}{hasMoreSkills ? "…" : ""}]</span>
              <span style={{ color: risk.text + "bb" }}> · {emp.project_name}</span>
            </>
          ) : (
            <span style={{ color: risk.text + "bb" }}>{emp.project_name}</span>
          )}
        </p>

        {/* Client · Ends */}
        <p className="text-xs" style={{ color: risk.text + "bb" }}>
          Client: <span className="font-medium" style={{ color: risk.text }}>{emp.client_name ?? "—"}</span>
          {" · Ends: "}
          <span className="font-medium" style={{ color: risk.text }}>{fmt(emp.end_date)}</span>
        </p>

        {/* Footer buttons */}
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onViewProfile() }}
            className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            style={{ border: `1px solid ${risk.border}`, color: risk.text, backgroundColor: "transparent" }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = risk.border + "18" }}
            onMouseOut={(e)  => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent" }}
          >
            View Profile
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMatchProjects() }}
            className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors text-white"
            style={{ backgroundColor: risk.border }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
            onMouseOut={(e)  => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}
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
      className={`flex items-center justify-between rounded-md px-3 py-2 text-xs gap-2 hover:bg-muted/80 transition-colors group ${
        highlight
          ? "bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
          : "bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: URGENCY_COLOR[urgency] }} />
        <span className="font-medium truncate group-hover:text-primary">{project.name}</span>
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
function EmployeeDrawer({ emp, onClose }: { emp: DrawerEmployee; onClose: () => void }) {
  const urgency = getUrgency(emp.end_date)
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
            <p className="text-sm font-medium">{emp.project_name}</p>
            {emp.client_name && <p className="text-xs text-muted-foreground">Client: {emp.client_name}</p>}
            <p className="text-xs text-muted-foreground">End date: {fmtFull(emp.end_date)}</p>
          </div>
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${URGENCY_BADGE[urgency]}`}>
            {URGENCY_LABEL[urgency]}
          </span>
          {availableMonth && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Available for new project</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">From {availableMonth}</p>
            </div>
          )}
        </div>
        <div className="px-4 pb-4 border-t pt-3">
          <Link
            to="/employees"
            className="block w-full text-center rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
            onClick={onClose}
          >
            View in Employees
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Gantt chart ─────────────────────────────────────────────────────────────
function GanttChart({
  projects, ganttStart, weeks, months,
  details, loadingDetailId, onLoadDetail,
}: {
  projects: ProjectBrief[]
  ganttStart: Date
  weeks: WeekCell[]
  months: MonthSpan[]
  details: Record<string, ProjectDetail>
  loadingDetailId: string | null
  onLoadDetail: (id: string) => void
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const todayWeek = weekDiff(ganttStart, getMonday(new Date()))
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayWeek * COL_W - 120)
  }, [ganttStart])

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    if (!details[id]) onLoadDetail(id)
  }

  function barStyle(p: ProjectBrief) {
    const ganttEnd = addWeeks(ganttStart, NUM_WEEKS)
    const s = p.start_date ? new Date(p.start_date) : ganttStart
    const e = p.end_date ? new Date(p.end_date) : null
    const effStart = s < ganttStart ? ganttStart : s
    const effEnd = e ? (e > ganttEnd ? ganttEnd : e) : null
    if (!effEnd || effStart >= ganttEnd) return null
    const sw = Math.max(0, weekDiff(ganttStart, getMonday(effStart)))
    const ew = Math.min(NUM_WEEKS, Math.max(sw + 1, weekDiff(ganttStart, getMonday(effEnd)) + 1))
    return { left: sw * COL_W + 2, width: Math.max(COL_W - 4, (ew - sw) * COL_W - 4), color: URGENCY_COLOR[getUrgency(p.end_date)] }
  }

  const todayWeek = weekDiff(ganttStart, getMonday(new Date()))
  const todayOffset = todayWeek >= 0 && todayWeek < NUM_WEEKS ? todayWeek * COL_W + COL_W / 2 : null

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex">
        <div className="shrink-0 border-r bg-background z-20" style={{ width: LEFT_W }}>
          <div className="border-b bg-muted/40 flex items-end px-3 pb-2" style={{ height: HEADER_H }}>
            <span className="text-xs font-medium text-muted-foreground">Project</span>
          </div>
          {projects.map((p) => {
            const exp = expandedIds.has(p.id)
            const detail = details[p.id]
            return (
              <div key={p.id}>
                <button
                  onClick={() => toggle(p.id)}
                  className="w-full flex items-center gap-2 px-3 hover:bg-muted/30 transition-colors border-b text-left"
                  style={{ height: ROW_H }}
                >
                  {exp
                    ? <ChevronDown  className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate leading-tight">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.client_name ?? p.department_name}</p>
                  </div>
                  {loadingDetailId === p.id
                    ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                    : <span className="shrink-0 h-2 w-2 rounded-full" style={{ background: URGENCY_COLOR[getUrgency(p.end_date)] }} />
                  }
                </button>
                {exp && (
                  <div className="border-b bg-muted/10 px-3 py-2 space-y-1 min-h-[40px]">
                    {loadingDetailId === p.id ? (
                      <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : detail ? (
                      detail.members.length > 0
                        ? detail.members.map((m) => (
                            <div key={m.employee_id} className="flex items-center gap-1.5">
                              <div
                                className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
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

        <div ref={scrollRef} className="flex-1 overflow-x-auto relative">
          <div style={{ width: NUM_WEEKS * COL_W, position: "relative" }}>
            {todayOffset !== null && (
              <div className="absolute top-0 bottom-0 w-px bg-red-400/70 z-10 pointer-events-none" style={{ left: todayOffset }} />
            )}
            <div className="flex border-b bg-muted/40 sticky top-0 z-10" style={{ height: 32 }}>
              {months.map((m, i) => (
                <div key={i} className="border-r flex items-center px-2 text-xs font-medium text-muted-foreground whitespace-nowrap overflow-hidden shrink-0"
                  style={{ width: m.weekCount * COL_W }}>
                  {m.label}
                </div>
              ))}
            </div>
            <div className="flex border-b bg-muted/20 sticky top-8 z-10" style={{ height: HEADER_H - 32 }}>
              {weeks.map((w, i) => (
                <div key={i}
                  className={`border-r flex items-center justify-center text-[10px] shrink-0 ${w.isCurrent ? "bg-red-50 dark:bg-red-950/20 text-red-500 font-bold" : "text-muted-foreground"}`}
                  style={{ width: COL_W }}>
                  {w.label}
                </div>
              ))}
            </div>
            {projects.map((p) => {
              const bar = barStyle(p)
              const exp = expandedIds.has(p.id)
              const detail = details[p.id]
              const expandedH = exp ? Math.max(40, (detail?.members.length ?? 0) * 24 + 16) : 0
              return (
                <div key={p.id}>
                  <div className="relative border-b cursor-pointer" style={{ height: ROW_H }} onClick={() => toggle(p.id)}>
                    {weeks.map((_, i) => (
                      <div key={i} className="absolute top-0 bottom-0 border-r border-muted/20" style={{ left: i * COL_W, width: COL_W }} />
                    ))}
                    {bar && (
                      <div className="absolute top-3 rounded-md opacity-90 hover:opacity-100 flex items-center px-2 overflow-hidden"
                        style={{ left: bar.left, width: bar.width, height: ROW_H - 24, backgroundColor: bar.color }}>
                        <span className="text-white text-[10px] font-medium truncate">{p.name}</span>
                      </div>
                    )}
                  </div>
                  {exp && <div className="border-b bg-muted/10" style={{ height: expandedH || 40 }} />}
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

  const ganttStart = addWeeks(getMonday(new Date()), -4 + weekOffset)
  const { weeks, months } = buildGrid(ganttStart)

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
      {drawerEmp && <EmployeeDrawer emp={drawerEmp} onClose={() => setDrawerEmp(null)} />}
      {suggestEmp && (
        <SuggestProjectsModal
          emp={suggestEmp}
          empSkills={empSkills[suggestEmp.employee_id] ?? []}
          projects={projects}
          onClose={() => setSuggestEmp(null)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold">Project Timeline</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track project end dates, see who's freeing up, and plan client renewals
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-lg bg-slate-700 p-3">
          <p className="text-xs text-slate-300">Active Projects</p>
          <p className="text-2xl font-bold text-white">{projects.length}</p>
        </div>
        <div className="rounded-lg bg-red-600 p-3">
          <p className="text-xs text-red-100">Overdue</p>
          <p className="text-2xl font-bold text-white">{overdue}</p>
        </div>
        <div className="rounded-lg bg-orange-500 p-3">
          <p className="text-xs text-orange-100">Ending &lt; 30 days</p>
          <p className="text-2xl font-bold text-white">{critical}</p>
        </div>
        <div className="rounded-lg bg-blue-600 p-3">
          <p className="text-xs text-blue-100">Freeing Up (90d)</p>
          <p className="text-2xl font-bold text-white">{freeing90}</p>
          {(freeing_lt30 + freeing_30_90 + freeing_gt90) > 0 && (
            <p className="text-[10px] text-blue-200 mt-1 whitespace-nowrap">
              &lt;30d: {freeing_lt30} · 30–90d: {freeing_30_90} · &gt;90d: {freeing_gt90}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-emerald-600 p-3">
          <p className="text-xs text-emerald-100">Client Opportunities</p>
          <p className="text-2xl font-bold text-white">{clientOpps.length}</p>
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
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Timeline ── */}
      {activeTab === "timeline" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              {(["overdue", "critical", "upcoming", "future"] as Urgency[]).map((u) => (
                <span key={u} className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-5 rounded" style={{ background: URGENCY_COLOR[u] }} />
                  {URGENCY_LABEL[u]}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs">
              <button onClick={() => setWeekOffset((n) => n - 4)} className="rounded px-2 py-1 hover:bg-muted border">← 4 wks</button>
              <button onClick={() => setWeekOffset(0)} className="rounded px-2 py-1 hover:bg-muted border">Today</button>
              <button onClick={() => setWeekOffset((n) => n + 4)} className="rounded px-2 py-1 hover:bg-muted border">4 wks →</button>
            </div>
          </div>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Calendar className="h-10 w-10 opacity-30" />
              <p className="text-sm">No active projects found</p>
            </div>
          ) : (
            <GanttChart
              projects={projects} ganttStart={ganttStart} weeks={weeks} months={months}
              details={details} loadingDetailId={loadingDetailId} onLoadDetail={loadDetailForId}
            />
          )}
          <p className="text-xs text-muted-foreground">Click a row to expand team members · Red line = today</p>
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
                    <span style={{ color: "#c2410c" }}>&lt;30d: {allFreeingEmps.filter(e => urgencyToRisk(getUrgency(e.end_date)) === "red").length}</span>
                    {" | "}
                    <span style={{ color: "#065f46" }}>30–90d: {allFreeingEmps.filter(e => urgencyToRisk(getUrgency(e.end_date)) === "orange").length}</span>
                    {" | "}
                    <span style={{ color: "#1d4ed8" }}>&gt;90d: {allFreeingEmps.filter(e => urgencyToRisk(getUrgency(e.end_date)) === "purple").length}</span>
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
                  className="mt-1 text-xs text-primary hover:underline"
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
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                  {emps.map((emp) => (
                    <FreeingCard
                      key={`${emp.employee_id}-${emp.project_id}`}
                      emp={emp}
                      skills={empSkills[emp.employee_id] ?? []}
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
                  <div key={opp.client_name} className="rounded-lg border bg-card p-4 space-y-3">
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
                          <div key={p.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs gap-2">
                            <Link to={`/projects/${p.id}`} className="font-medium hover:text-primary flex items-center gap-1 truncate">
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
                    <div className="flex items-start gap-2 rounded-md border border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        <strong>Renewal opportunity:</strong> Reach out to {opp.client_name} before{" "}
                        {fmtFull(opp.earliestEnd)} to discuss the next engagement and retain{" "}
                        {opp.totalMembers} freed resource{opp.totalMembers !== 1 ? "s" : ""}.
                      </p>
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
