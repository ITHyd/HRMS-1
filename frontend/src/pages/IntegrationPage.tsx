import { useEffect, useState, useCallback } from "react"
import { Link2, AlertTriangle, RefreshCw } from "lucide-react"
import { IntegrationConfigList } from "@/components/integration/IntegrationConfigList"
import { SyncLogTimeline } from "@/components/integration/SyncLogTimeline"
import { useToastStore } from "@/store/toastStore"
import { useAuthStore } from "@/store/authStore" // used via .getState() after sync
import {
  getIntegrationConfigs,
  updateIntegrationConfig,
  triggerSync,
  retrySync,
  getSyncLogs,
} from "@/api/integration"
import { getMe } from "@/api/auth"
import { getHrmsStatus } from "@/api/employees"
import type { IntegrationConfig, SyncLogEntry } from "@/types/integration"

type TabKey = "hrms" | "finance" | "skills"

const TABS: { key: TabKey; label: string }[] = [
  { key: "hrms", label: "HRMS" },
  { key: "finance", label: "Finance" },
  { key: "skills", label: "Skills" },
]

export function IntegrationPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("hrms")
  const [configs, setConfigs] = useState<IntegrationConfig[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [syncingConfigId, setSyncingConfigId] = useState<string | null>(null)
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null)
  const [hrmsDataSynced, setHrmsDataSynced] = useState<boolean | null>(null)
  const addToast = useToastStore((s) => s.addToast)

  // Fetch integration configs
  const fetchConfigs = useCallback(async () => {
    setLoadingConfigs(true)
    try {
      const data = await getIntegrationConfigs()
      setConfigs(data)
    } catch (err) {
      console.error("Failed to load integration configs:", err)
      setConfigs([])
    } finally {
      setLoadingConfigs(false)
    }
  }, [])

  // Fetch sync logs
  const fetchSyncLogs = useCallback(async (integrationType?: string) => {
    setLoadingLogs(true)
    try {
      const data = await getSyncLogs({
        integration_type: integrationType,
        page_size: 50,
      })
      setSyncLogs(data.logs)
    } catch (err) {
      console.error("Failed to load sync logs:", err)
      setSyncLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  // Check if HRMS data has ever been synced
  const checkHrmsStatus = useCallback(async () => {
    try {
      const status = await getHrmsStatus()
      setHrmsDataSynced(status.synced)
    } catch {
      setHrmsDataSynced(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchConfigs()
    checkHrmsStatus()
  }, [fetchConfigs, checkHrmsStatus])

  // Tab-specific data
  useEffect(() => {
    fetchSyncLogs(activeTab)
  }, [activeTab, fetchSyncLogs])

  // Handlers
  const handleSync = async (configId: string) => {
    setSyncingConfigId(configId)
    const startTime = Date.now()
    try {
      const result = await triggerSync(configId)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      await Promise.all([fetchConfigs(), fetchSyncLogs(activeTab)])

      await checkHrmsStatus()

      // Refresh user profile (branch_code, employee_id) after sync updates the User doc
      try {
        const fresh = await getMe()
        useAuthStore.getState().setAuth(fresh.access_token, {
          employee_id: fresh.employee_id,
          branch_location_id: fresh.branch_location_id,
          branch_code: fresh.branch_code,
          name: fresh.name,
          role: fresh.role || "branch_head",
        })
      } catch { /* non-critical */ }

      if (result.status === "completed") {
        addToast({
          type: "success",
          title: "Sync completed",
          message: `Finished in ${elapsed}s`,
        })
      } else if (result.status === "failed") {
        addToast({
          type: "error",
          title: "Sync failed",
          message: `Failed after ${elapsed}s. Check sync history for details.`,
          duration: 6000,
        })
      } else {
        addToast({
          type: "info",
          title: "Sync triggered",
          message: `Status: ${result.status} (${elapsed}s)`,
        })
      }
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.error("Failed to trigger sync:", err)
      addToast({
        type: "error",
        title: "Sync failed",
        message: `Error after ${elapsed}s. Please try again.`,
        duration: 6000,
      })
    } finally {
      setSyncingConfigId(null)
    }
  }

  const handleToggle = async (configId: string, status: string) => {
    try {
      await updateIntegrationConfig(configId, { status })
      await fetchConfigs()
      addToast({
        type: "success",
        title: status === "active" ? "Integration activated" : "Integration deactivated",
      })
    } catch (err) {
      console.error("Failed to update config status:", err)
      addToast({
        type: "error",
        title: "Failed to update status",
        message: "Please try again.",
      })
    }
  }

  const handleRetry = async (syncLogId: string) => {
    setRetryingLogId(syncLogId)
    const startTime = Date.now()
    try {
      await retrySync(syncLogId)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      await fetchSyncLogs(activeTab)
      addToast({
        type: "success",
        title: "Retry completed",
        message: `Finished in ${elapsed}s`,
      })
    } catch (err) {
      console.error("Failed to retry sync:", err)
      addToast({
        type: "error",
        title: "Retry failed",
        message: "Please try again.",
      })
    } finally {
      setRetryingLogId(null)
    }
  }

  // Filter for current tab
  const filteredConfigs = configs.filter((c) => c.integration_type === activeTab)
  const filteredLogs = syncLogs.filter((l) => l.integration_type === activeTab)

  const loading = loadingConfigs || loadingLogs

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Integration Hub
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage HRMS, Finance, and Skills integrations
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`cursor-pointer px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* HRMS Tab */}
          {activeTab === "hrms" && (
            <div className="space-y-8">
              {/* Initial sync required banner */}
              {hrmsDataSynced === false && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      No HRMS data synced yet
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Activate your HRMS integration and click <strong>Sync Now</strong> to import employees, projects, attendance, and timesheets from HRMS.
                    </p>
                  </div>
                  {filteredConfigs.some((c) => c.status === "active") && (
                    <button
                      onClick={() => {
                        const active = filteredConfigs.find((c) => c.status === "active")
                        if (active) handleSync(active.id)
                      }}
                      disabled={!!syncingConfigId}
                      className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60 shrink-0"
                    >
                      <RefreshCw className={`h-3 w-3 ${syncingConfigId ? "animate-spin" : ""}`} />
                      {syncingConfigId ? "Syncing..." : "Sync Now"}
                    </button>
                  )}
                </div>
              )}
              <IntegrationConfigList
                configs={filteredConfigs}
                onSync={handleSync}
                onToggle={handleToggle}
                syncingConfigId={syncingConfigId}
              />
              <SyncLogTimeline
                logs={filteredLogs}
                onRetry={handleRetry}
                retryingLogId={retryingLogId}
              />
            </div>
          )}

          {/* Finance Tab */}
          {activeTab === "finance" && (
            <div className="space-y-8">
              <IntegrationConfigList
                configs={filteredConfigs}
                onSync={handleSync}
                onToggle={handleToggle}
                syncingConfigId={syncingConfigId}
              />
              <SyncLogTimeline
                logs={filteredLogs}
                onRetry={handleRetry}
                retryingLogId={retryingLogId}
              />
            </div>
          )}

          {/* Skills Tab */}
          {activeTab === "skills" && (
            <div className="space-y-8">
              <IntegrationConfigList
                configs={filteredConfigs}
                onSync={handleSync}
                onToggle={handleToggle}
                syncingConfigId={syncingConfigId}
              />
              <SyncLogTimeline
                logs={filteredLogs}
                onRetry={handleRetry}
                retryingLogId={retryingLogId}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
