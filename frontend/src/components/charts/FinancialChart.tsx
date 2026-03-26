import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  BarChart,
  Cell,
} from "recharts";
import { fmt } from "@/lib/utils";

const COLORS = [
  "hsl(210,100%,60%)",
  "hsl(160,84%,50%)",
  "hsl(38,92%,60%)",
  "hsl(280,76%,65%)",
  "hsl(0,63%,55%)",
];

interface Series {
  key: string;
  label: string;
  type?: "bar" | "line" | "area";
  color?: string;
  yAxisId?: string;
}

interface FinancialChartProps {
  data: Record<string, unknown>[];
  series: Series[];
  xKey?: string;
  height?: number;
  currency?: boolean;
  pct?: boolean;
  stacked?: boolean;
}

function customTooltip(currency: boolean, pct: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-popover p-3 shadow-xl text-xs space-y-1.5">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((p: { name: string; value: number; color: string }) => (
          <div key={p.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </span>
            <span className="number font-medium text-foreground">
              {pct ? fmt(p.value, { style: "percent" }) : currency ? fmt(p.value, { style: "currency" }) : fmt(p.value, { style: "compact" })}
            </span>
          </div>
        ))}
      </div>
    );
  };
}

export function FinancialChart({
  data,
  series,
  xKey = "year",
  height = 280,
  currency = true,
  pct = false,
  stacked = false,
}: FinancialChartProps) {
  // Always use ComposedChart — it correctly handles Bar, Line, and Area children.
  // Selecting BarChart/AreaChart for single-type series causes recharts to crash
  // when it receives child elements it doesn't expect (e.g. Area inside BarChart).
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            pct ? fmt(v, { style: "percent" }) : fmt(v, { style: "compact" })
          }
          width={60}
        />
        <Tooltip content={customTooltip(currency, pct)} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "hsl(215,20%,55%)", paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        {series.map((s, i) => {
          const color = s.color ?? COLORS[i % COLORS.length];
          if (s.type === "line") {
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            );
          }
          if (s.type === "area") {
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                fill={color}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
              />
            );
          }
          return (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={color}
              fillOpacity={0.85}
              radius={[3, 3, 0, 0]}
              stackId={stacked ? "stack" : undefined}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Tornado Chart ──────────────────────────────────────────────────────────

interface TornadoRow {
  variable: string;
  low_delta: number;
  high_delta: number;
  swing: number;
}

export function TornadoChart({ rows }: { rows: TornadoRow[] }) {
  const sorted = [...rows].sort((a, b) => b.swing - a.swing).slice(0, 10);
  return (
    <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 36)}>
      <BarChart
        layout="vertical"
        data={sorted}
        margin={{ top: 4, right: 40, left: 120, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => fmt(v, { style: "currency" })}
        />
        <YAxis
          type="category"
          dataKey="variable"
          tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip
          content={customTooltip(true, false)}
          formatter={(v: number, name: string) => [fmt(v, { style: "currency" }), name]}
        />
        <Bar dataKey="low_delta" name="Downside" stackId="a" radius={[3, 0, 0, 3]}>
          {sorted.map((_, i) => (
            <Cell key={i} fill="hsl(0,63%,55%)" fillOpacity={0.8} />
          ))}
        </Bar>
        <Bar dataKey="high_delta" name="Upside" stackId="a" radius={[0, 3, 3, 0]}>
          {sorted.map((_, i) => (
            <Cell key={i} fill="hsl(160,84%,50%)" fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Histogram ──────────────────────────────────────────────────────────────

interface HistogramProps {
  binCenters: number[];
  counts: number[];
  p5?: number;
  p95?: number;
}

export function Histogram({ binCenters, counts, p5, p95 }: HistogramProps) {
  const data = binCenters.map((x, i) => ({ x: Math.round(x), count: counts[i] }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,16%)" vertical={false} />
        <XAxis
          dataKey="x"
          tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => fmt(v, { style: "compact" })}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ fill: "hsl(222,30%,20%)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { x: number; count: number };
            const inRange = (!p5 || d.x >= p5) && (!p95 || d.x <= p95);
            return (
              <div className="rounded-lg border border-border bg-popover p-2 text-xs">
                <p className="number">{fmt(d.x, { style: "currency" })}</p>
                <p className="text-muted-foreground">Count: {d.count}</p>
                {inRange && <p className="text-emerald-400">Within P5–P95</p>}
              </div>
            );
          }}
        />
        <Bar dataKey="count" name="Frequency" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => {
            const inRange = (!p5 || d.x >= p5) && (!p95 || d.x <= p95);
            return <Cell key={i} fill={inRange ? "hsl(210,100%,60%)" : "hsl(210,100%,60%,0.3)"} fillOpacity={inRange ? 0.8 : 0.3} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
