import { SearchBar } from "./SearchBar"
import { Button } from "@/components/ui/button"
import { Download, Compass } from "lucide-react"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useAuthStore } from "@/store/authStore"
import { exportTeamReport } from "@/api/importExport"
import { useLocation } from "react-router-dom"

export function Header() {
  const { user } = useAuthStore()
  const location = useLocation()
  const clearHighlight = useOrgChartStore((s) => s.clearHighlight)
  const clearTrace = useOrgChartStore((s) => s.clearTrace)

  const isOrgChart = location.pathname === "/"

  const handleExport = async () => {
    try {
      const blob = await exportTeamReport()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "team_report.xlsx"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // handle error
    }
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
      <SearchBar />

      <div className="ml-auto flex items-center gap-2">
        {isOrgChart && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearHighlight()
              clearTrace()
              // Dispatch custom event for OrgChartCanvas to handle
              window.dispatchEvent(new CustomEvent("focus-my-branch"))
            }}
          >
            <Compass className="mr-1.5 h-3.5 w-3.5" />
            My Branch
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </Button>
      </div>
    </header>
  )
}
