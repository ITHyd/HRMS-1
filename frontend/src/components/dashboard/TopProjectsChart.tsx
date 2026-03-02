import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface TopProject {
  project_name: string
  total_hours: number
  member_count: number
}

interface TopProjectsChartProps {
  data: TopProject[]
}

export function TopProjectsChart({ data }: TopProjectsChartProps) {
  const chartData = data.map((p) => ({
    name: p.project_name.length > 20 ? p.project_name.slice(0, 18) + "..." : p.project_name,
    fullName: p.project_name,
    total_hours: p.total_hours,
    member_count: p.member_count,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top Consuming Projects</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              width={140}
            />
            <Tooltip
              formatter={(value: number) => [`${value} hrs`, "Total Hours"]}
              labelFormatter={(_label, payload) => {
                if (payload && payload.length > 0) {
                  const item = payload[0].payload
                  return `${item.fullName} (${item.member_count} members)`
                }
                return _label
              }}
            />
            <Bar
              dataKey="total_hours"
              fill="#6366f1"
              radius={[0, 4, 4, 0]}
              name="Total Hours"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
