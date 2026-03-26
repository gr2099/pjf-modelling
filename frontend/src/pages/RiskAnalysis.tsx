import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runTornado, runBreakEven } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TornadoChart, FinancialChart } from "@/components/charts/FinancialChart";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2 } from "lucide-react";

const DEFAULT_SENSITIVITIES = [
  { variable: "Revenue Growth", base_npv: 250e6, npv_at_low: 180e6, npv_at_high: 330e6 },
  { variable: "EBITDA Margin", base_npv: 250e6, npv_at_low: 190e6, npv_at_high: 310e6 },
  { variable: "Discount Rate", base_npv: 250e6, npv_at_low: 310e6, npv_at_high: 195e6 },
  { variable: "Terminal Growth", base_npv: 250e6, npv_at_low: 210e6, npv_at_high: 295e6 },
  { variable: "CapEx", base_npv: 250e6, npv_at_low: 275e6, npv_at_high: 225e6 },
  { variable: "Working Capital", base_npv: 250e6, npv_at_low: 240e6, npv_at_high: 260e6 },
  { variable: "Tax Rate", base_npv: 250e6, npv_at_low: 265e6, npv_at_high: 238e6 },
];

const DEFAULT_FCF = [12, 15, 18, 22, 26].map((v) => v * 1e6);

export default function RiskAnalysis() {
  const [baseNpv] = useState(250e6);
  const [fcfStr] = useState(DEFAULT_FCF.join(", "));
  const [varLow, setVarLow] = useState(0.08);
  const [varHigh, setVarHigh] = useState(0.15);

  const tornadoMut = useMutation({ mutationFn: runTornado });
  const breakEvenMut = useMutation({ mutationFn: runBreakEven });

  const parsedFcf = fcfStr.split(",").map((s) => parseFloat(s.trim())).filter(isFinite);

  const tornadoRows = tornadoMut.data?.rows ?? [];

  const breakData = breakEvenMut.data
    ? (breakEvenMut.data.values as number[]).map((v: number, i: number) => ({
        value: v,
        NPV: breakEvenMut.data.npvs[i],
      }))
    : [];

  // Waterfall data (static demo)
  const waterfallData = [
    { label: "Base Case", value: baseNpv },
    { label: "+ Revenue", value: 35e6 },
    { label: "− CapEx", value: -18e6 },
    { label: "+ Synergies", value: 12e6 },
    { label: "− Tax", value: -9e6 },
    { label: "± Working Capital", value: -5e6 },
  ].reduce(
    (acc, item, i) => {
      const running = i === 0 ? item.value : acc[i - 1].running + item.value;
      return [...acc, { ...item, running }];
    },
    [] as { label: string; value: number; running: number }[]
  );

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <Tabs defaultValue="tornado">
        <TabsList>
          <TabsTrigger value="tornado">Tornado Diagram</TabsTrigger>
          <TabsTrigger value="breakeven">Break-Even</TabsTrigger>
          <TabsTrigger value="waterfall">Waterfall</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
        </TabsList>

        {/* ── Tornado ─────────────────────────────────────────────────── */}
        <TabsContent value="tornado" className="space-y-4">
          <div className="glass rounded-xl p-5 border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tornado Diagram</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Variables ranked by impact on NPV</p>
              </div>
              <Button
                onClick={() => tornadoMut.mutate({ base_npv: baseNpv, sensitivities: DEFAULT_SENSITIVITIES })}
                disabled={tornadoMut.isPending}
              >
                {tornadoMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                Generate
              </Button>
            </div>
            {tornadoRows.length > 0 ? (
              <TornadoChart rows={tornadoRows} />
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground/40 text-sm">
                Press Generate to build the tornado diagram
              </div>
            )}
          </div>

          {tornadoRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30">
                    {["Variable", "Downside NPV", "Base NPV", "Upside NPV", "Swing"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tornadoRows.map((row: { variable: string; npv_at_low: number; base_npv: number; npv_at_high: number; swing: number }, i: number) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-accent/20">
                      <td className="px-4 py-2 font-medium">{row.variable}</td>
                      <td className="px-4 py-2 number text-red-400">{fmt(row.npv_at_low, { style: "currency" })}</td>
                      <td className="px-4 py-2 number">{fmt(row.base_npv, { style: "currency" })}</td>
                      <td className="px-4 py-2 number text-emerald-400">{fmt(row.npv_at_high, { style: "currency" })}</td>
                      <td className="px-4 py-2 number"><Badge variant="neutral">{fmt(row.swing, { style: "currency" })}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Break-Even ───────────────────────────────────────────────── */}
        <TabsContent value="breakeven" className="space-y-4">
          <div className="glass rounded-xl p-5 border border-border/50 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Break-Even Analysis</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input label="Variable Low" type="number" value={varLow} onChange={(e) => setVarLow(+e.target.value)} step={0.01} />
              <Input label="Variable High" type="number" value={varHigh} onChange={(e) => setVarHigh(+e.target.value)} step={0.01} />
            </div>
            <Button
              onClick={() => breakEvenMut.mutate({ base_fcfs: parsedFcf, discount_rate: 0.10, terminal_growth_rate: 0.025, variable_low: varLow, variable_high: varHigh, variable_name: "Revenue Scalar" })}
              disabled={breakEvenMut.isPending}
            >
              {breakEvenMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Compute
            </Button>

            {breakEvenMut.data && (
              <div className="space-y-4">
                {breakEvenMut.data.break_even != null && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Break-even value:</span>
                    <Badge variant="neutral">{fmt(breakEvenMut.data.break_even, { style: "decimal", decimals: 4 })}</Badge>
                  </div>
                )}
                <Card>
                  <CardHeader><CardTitle>NPV vs Variable</CardTitle></CardHeader>
                  <FinancialChart
                    data={breakData}
                    xKey="value"
                    series={[{ key: "NPV", label: "Enterprise Value", type: "area" }]}
                    height={240}
                  />
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Waterfall ────────────────────────────────────────────────── */}
        <TabsContent value="waterfall">
          <Card>
            <CardHeader>
              <CardTitle>Value Attribution Waterfall</CardTitle>
            </CardHeader>
            <FinancialChart
              data={waterfallData}
              xKey="label"
              series={[{ key: "running", label: "Running NPV", type: "bar" }]}
              height={300}
            />
          </Card>
        </TabsContent>

        {/* ── Scenarios ────────────────────────────────────────────────── */}
        <TabsContent value="scenarios">
          <div className="space-y-4">
            {[
              { name: "Bear Case", color: "negative" as const, ev: 155e6, irr: 0.07, dscr: 1.05, desc: "Revenue −20%, margin compression, higher rates" },
              { name: "Base Case", color: "neutral" as const, ev: 250e6, irr: 0.13, dscr: 1.45, desc: "Management plan with moderate growth" },
              { name: "Bull Case", color: "positive" as const, ev: 370e6, irr: 0.21, dscr: 1.95, desc: "Revenue +25%, full synergy capture, multiple expansion" },
            ].map((s) => (
              <div key={s.name} className="glass rounded-xl p-5 border border-border/50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Badge variant={s.color} className="mb-1.5">{s.name}</Badge>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Enterprise Value</p>
                    <p className="number font-semibold">{fmt(s.ev, { style: "currency" })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Equity IRR</p>
                    <p className="number font-semibold">{fmt(s.irr, { style: "percent" })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Min DSCR</p>
                    <p className="number font-semibold">{fmt(s.dscr, { style: "decimal", decimals: 2 })}×</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
