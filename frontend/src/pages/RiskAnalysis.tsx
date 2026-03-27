import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runTornado, runBreakEven, runWaterfall } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TornadoChart, FinancialChart } from "@/components/charts/FinancialChart";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2, Plus, Trash2 } from "lucide-react";

type SensRow = { variable: string; base_npv: number; npv_at_low: number; npv_at_high: number };
type ScenarioRow = { name: string; color: "negative" | "neutral" | "positive"; ev: number; irr: number; dscr: number; desc: string };

const DEFAULT_SENSITIVITIES: SensRow[] = [
  { variable: "Revenue Growth",  base_npv: 250e6, npv_at_low: 180e6, npv_at_high: 330e6 },
  { variable: "EBITDA Margin",   base_npv: 250e6, npv_at_low: 190e6, npv_at_high: 310e6 },
  { variable: "Discount Rate",   base_npv: 250e6, npv_at_low: 310e6, npv_at_high: 195e6 },
  { variable: "Terminal Growth", base_npv: 250e6, npv_at_low: 210e6, npv_at_high: 295e6 },
  { variable: "CapEx",           base_npv: 250e6, npv_at_low: 275e6, npv_at_high: 225e6 },
  { variable: "Working Capital", base_npv: 250e6, npv_at_low: 240e6, npv_at_high: 260e6 },
  { variable: "Tax Rate",        base_npv: 250e6, npv_at_low: 265e6, npv_at_high: 238e6 },
];

const DEFAULT_SCENARIOS: ScenarioRow[] = [
  { name: "Bear Case", color: "negative", ev: 155e6, irr: 0.07, dscr: 1.05, desc: "Revenue −20%, margin compression, higher rates" },
  { name: "Base Case", color: "neutral",  ev: 250e6, irr: 0.13, dscr: 1.45, desc: "Management plan with moderate growth" },
  { name: "Bull Case", color: "positive", ev: 370e6, irr: 0.21, dscr: 1.95, desc: "Revenue +25%, full synergy capture, multiple expansion" },
];

const DEFAULT_FCF = [12, 15, 18, 22, 26].map((v) => v * 1e6);

export default function RiskAnalysis() {
  // Tornado state
  const [baseNpv, setBaseNpv] = useState(250e6);
  const [sensitivities, setSensitivities] = useState<SensRow[]>(DEFAULT_SENSITIVITIES);

  // Break-even state
  const [fcfStr, setFcfStr] = useState(DEFAULT_FCF.join(", "));
  const [discountRate, setDiscountRate] = useState(0.10);
  const [terminalGrowth, setTerminalGrowth] = useState(0.025);
  const [varLow, setVarLow] = useState(0.08);
  const [varHigh, setVarHigh] = useState(1.50);
  const [varName, setVarName] = useState("Revenue Scalar");

  // Scenario state
  const [scenarios, setScenarios] = useState<ScenarioRow[]>(DEFAULT_SCENARIOS);

  // Waterfall state
  type ImpactRow = { label: string; delta: number };
  const [wfBaseNpv, setWfBaseNpv] = useState(250e6);
  const [impacts, setImpacts] = useState<ImpactRow[]>([
    { label: "Revenue Growth",  delta:  35_000_000 },
    { label: "Margin Expansion", delta: 22_000_000 },
    { label: "CapEx Reduction",  delta:  8_000_000 },
    { label: "Working Capital",  delta: -12_000_000 },
    { label: "Tax Optimisation", delta:  9_000_000 },
    { label: "Multiple Expansion", delta: 28_000_000 },
  ]);

  const tornadoMut = useMutation({ mutationFn: runTornado });
  const breakEvenMut = useMutation({ mutationFn: runBreakEven });
  const waterfallMut = useMutation({ mutationFn: runWaterfall });

  const parsedFcf = fcfStr.split(",").map((s) => parseFloat(s.trim())).filter(isFinite);

  const tornadoRows = tornadoMut.data?.rows ?? [];

  const breakData = breakEvenMut.data
    ? (breakEvenMut.data.values as number[]).map((v: number, i: number) => ({
        value: v,
        NPV: breakEvenMut.data.npvs[i],
      }))
    : [];

  // Sync all sensitivity rows to the current baseNpv
  const syncedSensitivities = sensitivities.map((r) => ({ ...r, base_npv: baseNpv }));

  // Tornado row helpers
  const updateSens = (i: number, field: keyof SensRow, value: string | number) =>
    setSensitivities((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  const addSensRow = () =>
    setSensitivities((prev) => [...prev, { variable: "New Variable", base_npv: baseNpv, npv_at_low: baseNpv * 0.8, npv_at_high: baseNpv * 1.2 }]);
  const removeSensRow = (i: number) =>
    setSensitivities((prev) => prev.filter((_, idx) => idx !== i));

  // Scenario helpers
  const updateScenario = (i: number, field: keyof ScenarioRow, value: string | number) =>
    setScenarios((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  // Waterfall impact helpers
  const updateImpact = (i: number, field: keyof ImpactRow, value: string | number) =>
    setImpacts((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  const addImpactRow = () =>
    setImpacts((prev) => [...prev, { label: "New Driver", delta: 0 }]);
  const removeImpactRow = (i: number) =>
    setImpacts((prev) => prev.filter((_, idx) => idx !== i));

  // Derive waterfall chart data from API response or local state
  type WfRow = { label: string; value: number; running: number; type: string };
  const wfRows: WfRow[] = waterfallMut.data?.rows ?? [];

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
          <div className="glass rounded-xl p-5 border border-border/50 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tornado Diagram</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Shows which variables have the greatest impact on NPV. Each row tests one variable while keeping others at their base value.
              </p>
            </div>

            {/* Base NPV + Run button */}
            <div className="flex items-end gap-4">
              <div className="w-52">
                <Input
                  label="Base Case NPV ($)"
                  type="number"
                  value={baseNpv}
                  onChange={(e) => setBaseNpv(+e.target.value)}
                  hint="Applied to all rows"
                />
              </div>
              <Button
                onClick={() => tornadoMut.mutate({ base_npv: baseNpv, sensitivities: syncedSensitivities })}
                disabled={tornadoMut.isPending}
              >
                {tornadoMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                Generate
              </Button>
            </div>

            {/* Editable sensitivity table */}
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30">
                    {["Variable Name", "Downside NPV ($)", "Upside NPV ($)", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensitivities.map((row, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="px-2 py-1.5">
                        <input
                          className="w-full bg-transparent border border-border/40 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          value={row.variable}
                          onChange={(e) => updateSens(i, "variable", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="w-full bg-transparent border border-border/40 rounded px-2 py-1 text-xs number focus:outline-none focus:ring-1 focus:ring-ring"
                          type="number"
                          value={row.npv_at_low}
                          onChange={(e) => updateSens(i, "npv_at_low", +e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="w-full bg-transparent border border-border/40 rounded px-2 py-1 text-xs number focus:outline-none focus:ring-1 focus:ring-ring"
                          type="number"
                          value={row.npv_at_high}
                          onChange={(e) => updateSens(i, "npv_at_high", +e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => removeSensRow(i)}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addSensRow}>
              <Plus className="h-3.5 w-3.5" /> Add Variable
            </Button>
          </div>

          {tornadoRows.length > 0 && (
            <>
              <TornadoChart rows={tornadoRows} />
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
            </>
          )}

          {tornadoRows.length === 0 && !tornadoMut.isPending && (
            <div className="flex items-center justify-center py-12 text-muted-foreground/40 text-sm">
              Edit the table above and press Generate to build the tornado diagram
            </div>
          )}
        </TabsContent>

        {/* ── Break-Even ───────────────────────────────────────────────── */}
        <TabsContent value="breakeven" className="space-y-4">
          <div className="glass rounded-xl p-5 border border-border/50 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Break-Even Analysis</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sweeps a multiplier (e.g. revenue scalar) across a range, recomputes NPV at each point, and identifies where NPV crosses zero.
                A scalar of 1.0 = base case; 0.8 = revenues 20% below plan.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              <Input
                label="Variable Name"
                type="text"
                value={varName}
                onChange={(e) => setVarName(e.target.value)}
                hint="Label shown on chart axis"
              />
              <Input
                label="Scalar Low"
                type="number"
                value={varLow}
                onChange={(e) => setVarLow(+e.target.value)}
                step={0.01}
                hint="Min multiplier (e.g. 0.5 = −50%)"
              />
              <Input
                label="Scalar High"
                type="number"
                value={varHigh}
                onChange={(e) => setVarHigh(+e.target.value)}
                step={0.01}
                hint="Max multiplier (e.g. 1.5 = +50%)"
              />
              <Input
                label="Discount Rate"
                type="number"
                value={discountRate}
                onChange={(e) => setDiscountRate(+e.target.value)}
                step={0.005}
                hint="WACC used for NPV"
              />
              <Input
                label="Terminal Growth Rate"
                type="number"
                value={terminalGrowth}
                onChange={(e) => setTerminalGrowth(+e.target.value)}
                step={0.005}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Base FCFs (comma-separated, $)
                <span className="ml-1 font-normal">— scalar multiplies each year's FCF</span>
              </label>
              <input
                className="w-full bg-transparent border border-border/50 rounded-lg px-3 py-2 text-xs number focus:outline-none focus:ring-1 focus:ring-ring"
                value={fcfStr}
                onChange={(e) => setFcfStr(e.target.value)}
                placeholder="e.g. 12000000, 15000000, 18000000"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{parsedFcf.length} year(s) parsed</p>
            </div>

            <Button
              onClick={() => breakEvenMut.mutate({
                base_fcfs: parsedFcf,
                discount_rate: discountRate,
                terminal_growth_rate: terminalGrowth,
                variable_low: varLow,
                variable_high: varHigh,
                variable_name: varName,
              })}
              disabled={breakEvenMut.isPending || parsedFcf.length === 0}
            >
              {breakEvenMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Compute Break-Even
            </Button>

            {breakEvenMut.data && (
              <div className="space-y-4">
                {breakEvenMut.data.break_even != null ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Break-even {varName} scalar:</span>
                    <Badge variant="neutral">{fmt(breakEvenMut.data.break_even, { style: "decimal", decimals: 4 })}</Badge>
                    <span className="text-xs text-muted-foreground">
                      (NPV = 0 when FCFs are {((breakEvenMut.data.break_even as number) * 100).toFixed(1)}% of base)
                    </span>
                  </div>
                ) : (
                  <Badge variant="warning">No break-even found in the specified range</Badge>
                )}
                <Card>
                  <CardHeader><CardTitle>NPV vs {varName}</CardTitle></CardHeader>
                  <FinancialChart
                    data={breakData}
                    xKey="value"
                    series={[{ key: "NPV", label: "Enterprise Value (NPV)", type: "area" }]}
                    height={240}
                  />
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Waterfall ────────────────────────────────────────────────── */}
        <TabsContent value="waterfall" className="space-y-4">
          <div className="glass rounded-xl p-5 border border-border/50 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Value Attribution Waterfall</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bridge from base-case EV to final EV by decomposing each value driver's contribution.
                Enter the base EV and the incremental impact (positive or negative) of each driver.
              </p>
            </div>

            {/* Base NPV */}
            <div className="w-56">
              <Input
                label="Base Case EV ($)"
                type="number"
                value={wfBaseNpv}
                onChange={(e) => setWfBaseNpv(+e.target.value)}
                hint="Starting enterprise value"
              />
            </div>

            {/* Editable driver table */}
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30">
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Value Driver</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Impact on EV ($)</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Direction</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {impacts.map((row, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="px-2 py-1.5">
                        <input
                          className="w-full bg-transparent border border-border/40 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          value={row.label}
                          onChange={(e) => updateImpact(i, "label", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="w-full bg-transparent border border-border/40 rounded px-2 py-1 text-xs number focus:outline-none focus:ring-1 focus:ring-ring"
                          type="number"
                          value={row.delta}
                          onChange={(e) => updateImpact(i, "delta", +e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge variant={row.delta >= 0 ? "positive" : "negative"}>
                          {row.delta >= 0 ? `+${fmt(row.delta, { style: "currency" })}` : fmt(row.delta, { style: "currency" })}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => removeImpactRow(i)}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={addImpactRow}>
                <Plus className="h-3.5 w-3.5" /> Add Driver
              </Button>
              <Button
                onClick={() => waterfallMut.mutate({ base_npv: wfBaseNpv, impacts })}
                disabled={waterfallMut.isPending || impacts.length === 0}
              >
                {waterfallMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                Build Waterfall
              </Button>
            </div>
          </div>

          {wfRows.length > 0 && (
            <>
              {/* Bridge chart — running EV at each step */}
              <Card>
                <CardHeader><CardTitle>EV Bridge — Running Total by Driver</CardTitle></CardHeader>
                <FinancialChart
                  data={wfRows}
                  xKey="label"
                  series={[{ key: "running", label: "Running EV", type: "bar" }]}
                  height={320}
                />
              </Card>

              {/* Driver contribution table */}
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/30">
                      {["Value Driver", "Incremental Impact", "Running EV", "% of Base EV", "Direction"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wfRows.map((row, i) => (
                      <tr key={i} className={`border-b border-border/20 hover:bg-accent/20 ${row.type === "total" ? "bg-secondary/20 font-semibold" : ""}`}>
                        <td className="px-4 py-2 font-medium">{row.label}</td>
                        <td className={`px-4 py-2 number ${row.type === "positive" ? "text-emerald-400" : row.type === "negative" ? "text-red-400" : ""}`}>
                          {row.type === "total" ? "—" : (row.value >= 0 ? "+" : "") + fmt(row.value, { style: "currency" })}
                        </td>
                        <td className="px-4 py-2 number">{fmt(row.running, { style: "currency" })}</td>
                        <td className="px-4 py-2 number text-muted-foreground">
                          {wfBaseNpv > 0 ? `${((row.running / wfBaseNpv) * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-2">
                          {row.type !== "total" && (
                            <Badge variant={row.type === "positive" ? "positive" : "negative"}>
                              {row.type}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Base EV: </span>
                  <span className="font-semibold">{fmt(wfBaseNpv, { style: "currency" })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Final EV: </span>
                  <span className="font-semibold">{fmt(wfRows.at(-1)?.running, { style: "currency" })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Uplift: </span>
                  <span className={`font-semibold ${(wfRows.at(-1)?.running ?? 0) >= wfBaseNpv ? "text-emerald-400" : "text-red-400"}`}>
                    {fmt((wfRows.at(-1)?.running ?? 0) - wfBaseNpv, { style: "currency" })}
                    {" "}({(((wfRows.at(-1)?.running ?? wfBaseNpv) / wfBaseNpv - 1) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </>
          )}

          {wfRows.length === 0 && !waterfallMut.isPending && (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                Edit the driver table above and click <strong>Build Waterfall</strong>
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── Scenarios ────────────────────────────────────────────────── */}
        <TabsContent value="scenarios">
          <div className="space-y-4">
            <div className="glass rounded-xl p-5 border border-border/50">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Scenario Analysis</h2>
              <p className="text-xs text-muted-foreground">
                Three-point scenario framework. Edit the key metrics and description for each scenario.
              </p>
            </div>

            {scenarios.map((s, i) => (
              <div key={s.name} className="glass rounded-xl p-5 border border-border/50">
                <div className="flex items-start gap-4 mb-4">
                  <Badge variant={s.color}>{s.name}</Badge>
                  <input
                    className="flex-1 bg-transparent border border-border/40 rounded px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={s.desc}
                    onChange={(e) => updateScenario(i, "desc", e.target.value)}
                    placeholder="Scenario description…"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Enterprise Value ($)</label>
                    <input
                      className="w-full bg-transparent border border-border/40 rounded px-2 py-1.5 text-sm number font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
                      type="number"
                      value={s.ev}
                      onChange={(e) => updateScenario(i, "ev", +e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Equity IRR</label>
                    <input
                      className="w-full bg-transparent border border-border/40 rounded px-2 py-1.5 text-sm number font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
                      type="number"
                      step={0.01}
                      value={s.irr}
                      onChange={(e) => updateScenario(i, "irr", +e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(s.irr, { style: "percent" })}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Min DSCR</label>
                    <input
                      className="w-full bg-transparent border border-border/40 rounded px-2 py-1.5 text-sm number font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
                      type="number"
                      step={0.05}
                      value={s.dscr}
                      onChange={(e) => updateScenario(i, "dscr", +e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(s.dscr, { style: "decimal", decimals: 2 })}×</p>
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
