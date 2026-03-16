import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import type { LevelCount } from "@/types/analytics"
import { LEVEL_LABELS } from "@/lib/constants"

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
  "#f97316", "#6b7280",
]

export function LevelPyramid({ data }: { data: LevelCount[] }) {
  const chartData = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: LEVEL_LABELS[d.level] || d.level,
      value: d.count,
    }))

  const total = chartData.reduce((sum, d) => sum + d.value, 0)
  const formatLevelCount = (value: number | string | undefined): [string, string] => {
    const count = typeof value === "number" ? value : Number(value ?? 0)
    const percentage = total > 0 ? ((count / total) * 100).toFixed(0) : "0"
    return [`${count} (${percentage}%)`, "Count"]
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Level Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={2}
              stroke="#fff"
            >
              {chartData.map((_entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={formatLevelCount} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11 }}
            />
            <text
              x="50%"
              y="48%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground"
              fontSize={22}
              fontWeight={700}
            >
              {total}
            </text>
            <text
              x="50%"
              y="57%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              fontSize={11}
            >
              employees
            </text>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
