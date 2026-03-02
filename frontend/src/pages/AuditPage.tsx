import { AuditLogTable } from "@/components/audit/AuditLogTable"

export function AuditPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Audit Log</h2>
        <p className="text-sm text-muted-foreground">
          Track all changes made to your branch
        </p>
      </div>
      <AuditLogTable />
    </div>
  )
}
