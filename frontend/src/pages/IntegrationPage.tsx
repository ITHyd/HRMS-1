import { useEffect, useState, useCallback } from "react"
import { Link2 } from "lucide-react"
import { IntegrationConfigList } from "@/components/integration/IntegrationConfigList"
import { SyncLogTimeline } from "@/components/integration/SyncLogTimeline"
import { DynamicsExportPanel } from "@/components/integration/DynamicsExportPanel"
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

type TabKey = "hrms" | "finance" | "dynamics"

const TABS: { key: TabKey; label: string }[] = [
  { key: "hrms", label: "HRMS" },
  { key: "finance", label: "Finance" },
  { key: "dynamics", label: "Dynamics" },
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
      const data = await getDynamicsExports({ page_size: 20 })
      setDynamicsExports(data)
    } catch (err) {
      console.error("Failed to load dynamics exports:", err)
      setDynamicsExports([])
    } finally {
      setLoadingExports(false)
    }
  }, [])

  // Initial fetch: configs + sync logs
  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  // Fetch tab-specific data when tab changes
  useEffect(() => {
    if (activeTab === "dynamics") {
      fetchDynamicsExports()
    } else {
      fetchSyncLogs(activeTab)
    }
  }, [activeTab, fetchSyncLogs, fetchDynamicsExports])

  // Handlers
  const handleSync = async (configId: string) => {
    try {
      await triggerSync(configId)
      // Refresh configs and logs after triggering sync
      await Promise.all([fetchConfigs(), fetchSyncLogs(activeTab)])
    } catch (err) {
      console.error("Failed to trigger sync:", err)
    }
  }

  const handleToggle = async (configId: string, status: string) => {
    try {
      await updateIntegrationConfig(configId, { status })
      await fetchConfigs()
    } catch (err) {
      console.error("Failed to update config status:", err)
    }
  }

  const handleRetry = async (syncLogId: string) => {
    try {
      await retrySync(syncLogId)
      await fetchSyncLogs(activeTab)
    } catch (err) {
      console.error("Failed to retry sync:", err)
    }
  }

  const handleExport = async (type: string) => {
    setExporting(true)
    try {
      await createDynamicsExport(type)
      await fetchDynamicsExports()
    } catch (err) {
      console.error("Failed to create export:", err)
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
    } catch (err) {
      console.error("Failed to download export:", err)
    }
  }

  // Filter configs for current tab
  const filteredConfigs = configs.filter(
    (c) => c.integration_type === activeTab
  )

  // Filter sync logs for current tab
  const filteredLogs = syncLogs.filter(
    (l) => l.integration_type === activeTab
  )

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
            Manage HRMS, Finance, and Dynamics 365 integrations
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
              />
              <SyncLogTimeline logs={filteredLogs} onRetry={handleRetry} />
            </div>
          )}

          {/* Finance Tab */}
          {activeTab === "finance" && (
            <div className="space-y-8">
              <IntegrationConfigList
                configs={filteredConfigs}
                onSync={handleSync}
                onToggle={handleToggle}
              />
              <SyncLogTimeline logs={filteredLogs} onRetry={handleRetry} />
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
        </>
      )}
    </div>
  )
}
