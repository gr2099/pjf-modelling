import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runDCF, runWACC } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FinancialChart } from "@/components/charts/FinancialChart";
import { Badge } from "@/components/ui/badge";
import { Calculator, Loader2 } from "lucide-react";

const DEFAULT_FCF = [12, 15, 18, 22, 26, 30, 33, 36, 38, 40].map((v) => v * 1e6);

export default function Valuation() {
  const [fcfStr, setFcfStr] = useState(DEFAULT_FCF.join(", "));
  const [dr, setDr] = useState(0.10);
  const [tgr, setTgr] = useState(0.025);
  const [netDebt, setNetDebt] = useState(50_000_000);
  const [shares, setShares] = useState(100_000_000);

  // WACC inputs
  const [ev, setEv] = useState(400_000_000);
  const [dv, setDv] = useState(100_000_000);
  const [coe, setCoe] = useState(0.12);
  const [cod, setCod] = useState(0.06);
  const [tr, setTr] = useState(0.25);

  const dcfMut = useMutation({ mutationFn: runDCF });
  const waccMut = useMutation({ mutationFn: runWACC });

  const parsedFcf = fcfStr.split(",").map((s) => parseFloat(s.trim())).filter(isFinite);

  const runDcf = () =>
    dcfMut.mutate({ free_cash_flows: parsedFcf, discount_rate: dr, terminal_growth_rate: tgr, net_debt: netDebt, shares_outstanding: shares });

  const result = dcfMut.data;
  const wResult = waccMut.data;

  const bridgeData = result
    ? [
        { label: "PV FCFs", value: result.sum_pv_fcfs },
        { label: "PV Terminal", value: result.pv_terminal_value },
        { label: "Enterprise Value", value: result.enterprise_value },
        { label: "Less Net Debt", value: result.enterprise_value - result.equity_value },
        { label: "Equity Value", value: result.equity_value },
      ]
    : [];

  const fcfData = parsedFcf.map((v, i) => ({
    year: `Y${i + 1}`,
    FCF: v,
    "PV FCF": result?.pv_fcfs[i],
  }));

  // Sensitivity: grid of EV at different DR × TGR combinations
  const drRange = [0.07, 0.08, 0.09, 0.10, 0.11, 0.12, 0.13];
  const tgrRange = [0.01, 0.02, 0.025, 0.03, 0.035, 0.04];

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <Tabs defaultValue="dcf">
        <TabsList>
          <TabsTrigger value="dcf">DCF Valuation</TabsTrigger>
          <TabsTrigger value="wacc">WACC Calculator</TabsTrigger>
          <TabsTrigger value="sensitivity">Sensitivity Grid</TabsTrigger>
        </TabsList>

        <TabsContent value="dcf" className="space-y-5">
          <div className="glass rounded-xl p-5 border border-border/50 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">DCF Inputs</h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Free Cash Flows (comma-separated, $)
              </label>
              <textarea
                className="w-full rounded-lg border border-input bg-secondary/50 px-3 py-2 text-sm number focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={2}
                value={fcfStr}
                onChange={(e) => setFcfStr(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">{parsedFcf.length} periods detected</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input label="Discount Rate (WACC)" type="number" value={dr}
                onChange={(e) => setDr(+e.target.value)} step={0.005} />
              <Input label="Terminal Growth Rate" type="number" value={tgr}
                onChange={(e) => setTgr(+e.target.value)} step={0.005} />
              <Input label="Net Debt ($)" type="number" value={netDebt}
                onChange={(e) => setNetDebt(+e.target.value)} />
              <Input label="Shares Outstanding" type="number" value={shares}
                onChange={(e) => setShares(+e.target.value)} />
            </div>
            <Button onClick={runDcf} disabled={dcfMut.isPending || parsedFcf.length === 0}>
              {dcfMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Calculate
            </Button>
          </div>

          {result && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "PV of FCFs", value: fmt(result.sum_pv_fcfs, { style: "currency" }) },
                  { label: "PV Terminal Value", value: fmt(result.pv_terminal_value, { style: "currency" }), variant: "neutral" as const },
                  { label: "Enterprise Value", value: fmt(result.enterprise_value, { style: "currency" }), variant: "positive" as const },
                  { label: "Equity Value", value: fmt(result.equity_value, { style: "currency" }), variant: "positive" as const },
                  { label: "TV % of EV", value: fmt(result.terminal_value_pct / 100, { style: "percent" }) },
                  { label: "Net Debt", value: fmt(result.net_debt, { style: "currency" }) },
                  ...(result.price_per_share ? [{ label: "Implied Share Price", value: fmt(result.price_per_share, { style: "currency" }), variant: "positive" as const }] : []),
                ].map(({ label, value, variant = "default" as const }) => (
                  <Card key={label} className="py-3 px-4">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <Badge variant={variant}>{value}</Badge>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>FCF vs PV of FCF</CardTitle></CardHeader>
                  <FinancialChart data={fcfData} xKey="year"
                    series={[
                      { key: "FCF", label: "Free Cash Flow", type: "bar" },
                      { key: "PV FCF", label: "PV of FCF", type: "bar" },
                    ]}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>Value Bridge</CardTitle></CardHeader>
                  <FinancialChart
                    data={bridgeData}
                    xKey="label"
                    series={[{ key: "value", label: "Value ($)", type: "bar" }]}
                  />
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="wacc" className="space-y-5">
          <div className="glass rounded-xl p-5 border border-border/50 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">WACC Inputs</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <Input label="Equity Value ($)" type="number" value={ev} onChange={(e) => setEv(+e.target.value)} />
              <Input label="Debt Value ($)" type="number" value={dv} onChange={(e) => setDv(+e.target.value)} />
              <Input label="Cost of Equity" type="number" value={coe} onChange={(e) => setCoe(+e.target.value)} step={0.005} />
              <Input label="Cost of Debt" type="number" value={cod} onChange={(e) => setCod(+e.target.value)} step={0.005} />
              <Input label="Tax Rate" type="number" value={tr} onChange={(e) => setTr(+e.target.value)} step={0.01} />
            </div>
            <Button onClick={() => waccMut.mutate({ equity_value: ev, debt_value: dv, cost_of_equity: coe, cost_of_debt: cod, tax_rate: tr })}
              disabled={waccMut.isPending}>
              {waccMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Calculate WACC
            </Button>
          </div>

          {wResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "WACC", value: fmt(wResult.wacc, { style: "percent" }), variant: "neutral" as const },
                { label: "Equity Weight", value: fmt(wResult.equity_weight, { style: "percent" }) },
                { label: "Debt Weight", value: fmt(wResult.debt_weight, { style: "percent" }) },
                { label: "After-Tax Cost of Debt", value: fmt(wResult.after_tax_cost_of_debt, { style: "percent" }) },
              ].map(({ label, value, variant = "default" as const }) => (
                <Card key={label} className="py-3 px-4">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <Badge variant={variant}>{value}</Badge>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sensitivity">
          <div className="glass rounded-xl p-5 border border-border/50 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              EV Sensitivity — Discount Rate × Terminal Growth Rate
            </h2>
            <p className="text-xs text-muted-foreground">
              Run DCF first to compute the base case. The grid below shows approximate EV at each combination
              using current FCFs.
            </p>
            {parsedFcf.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-foreground font-medium">DR \ TGR</th>
                      {tgrRange.map((t) => (
                        <th key={t} className="px-3 py-2 text-right text-muted-foreground font-medium number">
                          {(t * 100).toFixed(1)}%
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drRange.map((d) => (
                      <tr key={d} className="border-t border-border/30 hover:bg-accent/20">
                        <td className="px-3 py-2 font-medium text-muted-foreground number">{(d * 100).toFixed(0)}%</td>
                        {tgrRange.map((t) => {
                          if (d <= t) return <td key={t} className="px-3 py-2 text-right text-muted-foreground/30">—</td>;
                          const lastFcf = parsedFcf.at(-1) ?? 0;
                          const tv = lastFcf * (1 + t) / (d - t);
                          const pvFcf = parsedFcf.reduce((acc, cf, i) => acc + cf / Math.pow(1 + d, i + 1), 0);
                          const pvTv = tv / Math.pow(1 + d, parsedFcf.length);
                          const ev2 = pvFcf + pvTv;
                          const isBase = Math.abs(d - dr) < 0.005 && Math.abs(t - tgr) < 0.003;
                          return (
                            <td key={t} className={`px-3 py-2 text-right number ${isBase ? "text-primary font-semibold bg-primary/10" : "text-foreground/80"}`}>
                              {fmt(ev2, { style: "compact" })}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground/50 text-sm">Enter FCFs in the DCF tab first.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
