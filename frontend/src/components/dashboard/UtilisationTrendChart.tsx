import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface TrendEntry {
  period: string
  utilisation_percent: number
  billable_percent: number
}

interface UtilisationTrendChartProps {
  data: TrendEntry[]
}

export function UtilisationTrendChart({ data }: UtilisationTrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Utilisation Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(value: number | string | undefined) => {
                const percent = typeof value === "number" ? value : Number(value ?? 0)
                return `${percent.toFixed(1)}%`
              }}
              labelFormatter={(label) => `Period: ${label}`}
            />
            <Legend
              verticalAlign="top"
              height={30}
              iconType="line"
              formatter={(value: string) => (
                <span className="text-xs">{value}</span>
              )}
            />
            <Area
              type="monotone"
              dataKey="utilisation_percent"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.1}
              strokeWidth={2}
              name="Utilisation %"
            />
            <Area
              type="monotone"
              dataKey="billable_percent"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.1}
              strokeWidth={2}
              name="Billable %"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
