import { CsvUploader } from "@/components/import/CsvUploader"

export function ImportPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Import Employees</h2>
        <p className="text-sm text-muted-foreground">
          Upload a CSV file to import new employees into your branch
        </p>
      </div>
      <CsvUploader />
    </div>
  )
}
