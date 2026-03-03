import { NavLink } from "react-router-dom"
import {
  Network,
  BarChart3,
  Upload,
  ClipboardList,
  LogOut,
  Building2,
  Clock,
  DollarSign,
  LayoutDashboard,
  Users,
  Users2,
  FolderKanban,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/org-chart", icon: Network, label: "Org Chart" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/timesheets", icon: Clock, label: "Timesheets" },
  { to: "/finance", icon: DollarSign, label: "Finance" },
  { to: "/availability", icon: Users, label: "Bench Pool" },
  { to: "/employees", icon: Users2, label: "Employees" },
  { to: "/projects", icon: FolderKanban, label: "Projects" },
  { to: "/integrations", icon: Link2, label: "Integrations" },
  { to: "/import", icon: Upload, label: "Import" },
  { to: "/audit", icon: ClipboardList, label: "Audit Log" },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore()

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-sidebar-background transition-all duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Header */}
      <div className="flex items-center border-b px-3 py-4 min-h-16">
        <div className={cn(
          "flex items-center gap-2 overflow-hidden transition-all duration-300 ease-in-out",
          collapsed ? "w-0 opacity-0" : "w-40 opacity-100"
        )}>
          <Building2 className="h-6 w-6 shrink-0 text-sidebar-primary" />
          <div className="whitespace-nowrap">
            <h1 className="text-sm font-bold text-sidebar-primary">Branch Command</h1>
            <p className="text-xs text-muted-foreground">Center</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={cn(
            "cursor-pointer shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent/50 transition-all duration-200",
            collapsed ? "mx-auto" : "ml-auto"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-lg py-2 text-sm font-medium transition-all duration-200",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                isActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span
              className={cn(
                "whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden",
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              )}
            >
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out min-w-0",
              collapsed ? "w-0 opacity-0" : "flex-1 opacity-100"
            )}
          >
            <p className="text-sm font-medium truncate whitespace-nowrap">{user?.name}</p>
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              Branch: {user?.branch_code}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className={cn(
              "cursor-pointer shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-200",
              collapsed && "mx-auto"
            )}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
