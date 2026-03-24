import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

interface ClassificationEntry {
  classification: string
  count: number
  percent: number
}

interface ClassificationDonutProps {
  data: ClassificationEntry[]
  onSliceClick?: (classification: string) => void
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  fully_billed: "#22c55e",
  partially_billed: "#f59e0b",
  bench: "#ef4444",
}

const LABEL_MAP: Record<string, string> = {
  fully_billed: "Fully Billed",
  partially_billed: "Partially Billed",
  bench: "Standby Period",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, value } = props
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  if (percent < 0.03) return null

  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={12}
    >
      {`${value} • ${(percent * 100).toFixed(1)}%`}
    </text>
  )
}

export function ClassificationDonut({ data, onSliceClick }: ClassificationDonutProps) {
  const chartData = data
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: LABEL_MAP[item.classification] || item.classification,
      value: item.count,
      fill: CLASSIFICATION_COLORS[item.classification] || "#6b7280",
      classification: item.classification,
    }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Classification Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={renderLabel}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.fill}
                  className={onSliceClick ? "cursor-pointer" : ""}
                  onClick={() => onSliceClick?.(entry.classification)}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} employees`, name]}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              formatter={(value: string, _entry, index) => (
                <span className="text-xs text-muted-foreground">
                  {value} ({chartData[index]?.value ?? 0})
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
