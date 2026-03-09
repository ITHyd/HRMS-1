import { useEffect, useState, useCallback } from "react"
import { Link2 } from "lucide-react"
import { IntegrationConfigList } from "@/components/integration/IntegrationConfigList"
import { SyncLogTimeline } from "@/components/integration/SyncLogTimeline"
import { DynamicsExportPanel } from "@/components/integration/DynamicsExportPanel"
import { useToastStore } from "@/store/toastStore"
import {
  getIntegrationConfigs,
  updateIntegrationConfig,
  triggerSync,
  retrySync,
  getSyncLogs,
  createDynamicsExport,
  getDynamicsExports,
  downloadDynamicsExport,
} from "@/api/integration"
import type { IntegrationConfig, SyncLogEntry, DynamicsExport } from "@/types/integration"

type TabKey = "hrms" | "finance" | "dynamics" | "skills"

const TABS: { key: TabKey; label: string }[] = [
  { key: "hrms", label: "HRMS" },
  { key: "finance", label: "Finance" },
  { key: "dynamics", label: "Dynamics" },
  { key: "skills", label: "Skills" },
]

export function IntegrationPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("hrms")
  const [configs, setConfigs] = useState<IntegrationConfig[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([])
  const [dynamicsExports, setDynamicsExports] = useState<DynamicsExport[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [loadingExports, setLoadingExports] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [syncingConfigId, setSyncingConfigId] = useState<string | null>(null)
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null)
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

  // Fetch dynamics exports
  const fetchDynamicsExports = useCallback(async () => {
    setLoadingExports(true)
    try {
      const res = await getDynamicsExports({ page_size: 20 })
      setDynamicsExports(res.exports)
    } catch (err) {
      console.error("Failed to load dynamics exports:", err)
      setDynamicsExports([])
    } finally {
      setLoadingExports(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  // Tab-specific data
  useEffect(() => {
    if (activeTab === "dynamics") {
      fetchDynamicsExports()
    } else {
      fetchSyncLogs(activeTab)
    }
  }, [activeTab, fetchSyncLogs, fetchDynamicsExports])

  // Handlers
  const handleSync = async (configId: string) => {
    setSyncingConfigId(configId)
    const startTime = Date.now()
    try {
      const result = await triggerSync(configId)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      await Promise.all([fetchConfigs(), fetchSyncLogs(activeTab)])

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

  const handleExport = async (type: string) => {
    setExporting(true)
    const startTime = Date.now()
    try {
      await createDynamicsExport(type)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      await fetchDynamicsExports()
      addToast({
        type: "success",
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} export ready`,
        message: `Generated in ${elapsed}s`,
      })
    } catch (err) {
      console.error("Failed to create export:", err)
      addToast({
        type: "error",
        title: "Export failed",
        message: "Please try again.",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleDownload = async (exportId: string, format: "json" | "csv") => {
    try {
      const blob = await downloadDynamicsExport(exportId, format)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dynamics-export-${exportId}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      addToast({ type: "success", title: "Download started" })
    } catch (err) {
      console.error("Failed to download export:", err)
      addToast({
        type: "error",
        title: "Download failed",
        message: "Please try again.",
      })
    }
  }

  // Filter for current tab
  const filteredConfigs = configs.filter((c) => c.integration_type === activeTab)
  const filteredLogs = syncLogs.filter((l) => l.integration_type === activeTab)

  const loading = loadingConfigs || loadingLogs || loadingExports

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
            Manage HRMS, Finance, Skills, and Dynamics 365 integrations
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

          {/* Dynamics Tab */}
          {activeTab === "dynamics" && (
            <DynamicsExportPanel
              exports={dynamicsExports}
              onExport={handleExport}
              onDownload={handleDownload}
              exporting={exporting}
            />
          )}

          {/* Skills Tab */}
          {activeTab === "skills" && (
            <div className="space-y-8">
              <IntegrationConfigList
                configs={filteredConfigs}
                onSync={handleSync}
                onToggle={handleToggle}
              />
              <SyncLogTimeline logs={filteredLogs} onRetry={handleRetry} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
