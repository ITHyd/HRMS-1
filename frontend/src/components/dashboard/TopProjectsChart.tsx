import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Treemap, ResponsiveContainer, Tooltip } from "recharts"

interface TopProject {
  project_name: string
  total_hours: number
  member_count: number
}

interface TopProjectsChartProps {
  data: TopProject[]
}

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#7c3aed", "#5b21b6"]

function CustomContent(props: any) {
  const { x, y, width, height, name, total_hours, index } = props
  if (width < 30 || height < 30) return null

  const displayName = name || "Unknown Project"
  const maxChars = Math.max(4, Math.floor(width / 8))
  const truncatedName =
    displayName.length > maxChars
      ? displayName.slice(0, maxChars - 1) + "…"
      : displayName

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        fill={COLORS[(index ?? 0) % COLORS.length]}
        stroke="#fff"
        strokeWidth={2}
      />
      {width > 60 && height > 45 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 8}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
            fontWeight={600}
          >
            {truncatedName}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="rgba(255,255,255,0.85)"
            fontSize={11}
          >
            {typeof total_hours === "number" ? total_hours.toFixed(1) : total_hours} hrs
          </text>
        </>
      )}
    </g>
  )
}

export function TopProjectsChart({ data }: TopProjectsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top Consuming Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No project data for this period
          </div>
        </CardContent>
      </Card>
    )
  }

  const treeData = data.map((p, i) => ({
    name: p.project_name || "Unknown Project",
    size: p.total_hours,
    total_hours: p.total_hours,
    member_count: p.member_count,
    index: i,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top Consuming Projects</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <Treemap
            data={treeData}
            dataKey="size"
            aspectRatio={4 / 3}
            content={<CustomContent />}
          >
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)} hrs`, "Total Hours"]}
              labelFormatter={(_label, payload) => {
                if (payload && payload.length > 0) {
                  const item = payload[0].payload
                  return `${item.name} (${item.member_count} members)`
                }
                return _label
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
