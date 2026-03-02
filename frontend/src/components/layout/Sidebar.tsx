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
  Link2,
} from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", icon: Network, label: "Org Chart" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/timesheets", icon: Clock, label: "Timesheets" },
  { to: "/finance", icon: DollarSign, label: "Finance" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/availability", icon: Users, label: "Bench Pool" },
  { to: "/integrations", icon: Link2, label: "Integrations" },
  { to: "/import", icon: Upload, label: "Import" },
  { to: "/audit", icon: ClipboardList, label: "Audit Log" },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-sidebar-background">
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <Building2 className="h-6 w-6 text-sidebar-primary" />
        <div>
          <h1 className="text-sm font-bold text-sidebar-primary">Branch Command</h1>
          <p className="text-xs text-muted-foreground">Center</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-4">
        <div className="mb-3">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-muted-foreground">
            Branch: {user?.branch_code}
          </p>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
