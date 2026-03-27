import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runDCF, runWACC, runWACCCAPM, runComprehensiveValuation } from "@/lib/api";
import { fmt, fmtPct } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FinancialChart } from "@/components/charts/FinancialChart";
import { Badge } from "@/components/ui/badge";
import { Calculator, Loader2, Plus, Trash2 } from "lucide-react";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_FCF = [12, 15, 18, 22, 26, 30, 33, 36, 38, 40].map((v) => v * 1e6);

const DEFAULT_COMPS = [
  { name: "Peer A", ev: 2_800_000_000, ebitda: 280_000_000, revenue: 900_000_000, net_income: 160_000_000, growth_rate: 0.08, roic: 0.18 },
  { name: "Peer B", ev: 1_900_000_000, ebitda: 190_000_000, revenue: 650_000_000, net_income: 105_000_000, growth_rate: 0.06, roic: 0.14 },
  { name: "Peer C", ev: 3_500_000_000, ebitda: 350_000_000, revenue: 1_200_000_000, net_income: 200_000_000, growth_rate: 0.12, roic: 0.22 },
];

function NumInput({ label, value, onChange, step, pct, hint }: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; pct?: boolean; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        step={step}
        value={pct ? +(value * 100).toFixed(3) : value}
        onChange={(e) => onChange(pct ? parseFloat(e.target.value) / 100 : parseFloat(e.target.value))}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Valuation() {
  // ── DCF state ──────────────────────────────────────────────────────────────
  const [fcfStr, setFcfStr] = useState(DEFAULT_FCF.join(", "));
  const [dr, setDr] = useState(0.10);
  const [tgr, setTgr] = useState(0.025);
  const [netDebt, setNetDebt] = useState(50_000_000);
  const [shares, setShares] = useState(100_000_000);
  const [ebitdaLast, setEbitdaLast] = useState(55_000_000);
  const [evMultiple, setEvMultiple] = useState(10.0);
  const [roic, setRoic] = useState(0.15);
  const [nopatLast, setNopatLast] = useState(40_000_000);

  // ── Simple WACC state ──────────────────────────────────────────────────────
  const [wEv, setWEv] = useState(400_000_000);
  const [wDv, setWDv] = useState(100_000_000);
  const [coe, setCoe] = useState(0.12);
  const [cod, setCod] = useState(0.06);
  const [tr, setTr] = useState(0.25);

  // ── CAPM WACC state ────────────────────────────────────────────────────────
  const [rfr, setRfr] = useState(0.04);
  const [erp, setErp] = useState(0.055);
  const [beta, setBeta] = useState(1.05);
  const [betaUnlevered, setBetaUnlevered] = useState(0.85);
  const [sizePremium, setSizePremium] = useState(0.01);
  const [countryPremium, setCountryPremium] = useState(0.0);
  const [companyPremium, setCompanyPremium] = useState(0.0);
  const [capmDebt, setCapmDebt] = useState(100_000_000);
  const [capmEquity, setCapmEquity] = useState(400_000_000);
  const [capmCod, setCapmCod] = useState(0.06);
  const [capmTax, setCapmTax] = useState(0.25);

  // ── Comparable companies state ─────────────────────────────────────────────
  const [comps, setComps] = useState(DEFAULT_COMPS);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const dcfMut = useMutation({ mutationFn: runDCF });
  const waccMut = useMutation({ mutationFn: runWACC });
  const capmMut = useMutation({ mutationFn: runWACCCAPM });
  const compMut = useMutation({ mutationFn: runComprehensiveValuation });

  const parsedFcf = fcfStr.split(",").map((s) => parseFloat(s.trim())).filter(isFinite);

  const dcfResult = dcfMut.data;
  const wResult = waccMut.data;
  const capmResult = capmMut.data;
  const compResult = compMut.data;

  const drRange = [0.07, 0.08, 0.09, 0.10, 0.11, 0.12, 0.13];
  const tgrRange = [0.01, 0.02, 0.025, 0.03, 0.035, 0.04];

  // Football field data
  const ff = compResult?.football_field ?? {};
  type MethodEntry = { ev: number; equity_value: number; tv_pct: number; implied_multiple: number };
  const ffMethods: Record<string, MethodEntry> = ff.methods ?? {};
  const footballChartData = Object.entries(ffMethods).map(([method, v]) => ({
    method: method.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    "Enterprise Value": v.ev,
  }));

  // FCF chart
  const fcfData = parsedFcf.map((v, i) => ({
    year: `Y${i + 1}`,
    "Free Cash Flow": v,
    "PV of FCF": dcfResult?.pv_fcfs?.[i],
  }));

  // TV method comparison from DCF result
  const dcfMethods: Record<string, MethodEntry> = dcfResult?.football_field?.methods ?? {};
  const tvMethodData = Object.entries(dcfMethods).map(([method, v]) => ({
    method: method.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    "EV ($)": v.ev,
  }));

  // Comp EV/EBITDA chart
  const compsChartData = comps
    .filter((c) => c.ebitda > 0)
    .map((c) => ({ name: c.name, "EV/EBITDA": +(c.ev / c.ebitda).toFixed(1) }));

  const compsAnalysis = compResult?.comparable_analysis ?? {};

  const updateComp = (i: number, field: string, value: string | number) =>
    setComps((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  const addComp = () =>
    setComps((prev) => [...prev, { name: "New Peer", ev: 1_000_000_000, ebitda: 100_000_000, revenue: 350_000_000, net_income: 60_000_000, growth_rate: 0.07, roic: 0.15 }]);
  const removeComp = (i: number) =>
    setComps((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">DCF Valuation</h1>
        <p className="text-sm text-muted-foreground">
          4 terminal value methods · CAPM WACC build-up · Football field · Comparable analysis
        </p>
      </div>

      <Tabs defaultValue="dcf">
        <TabsList>
          <TabsTrigger value="dcf">DCF — 4 TV Methods</TabsTrigger>
          <TabsTrigger value="wacc">Simple WACC</TabsTrigger>
          <TabsTrigger value="capm">CAPM WACC</TabsTrigger>
          <TabsTrigger value="football">Football Field</TabsTrigger>
          <TabsTrigger value="sensitivity">Sensitivity Grid</TabsTrigger>
        </TabsList>

        {/* ── DCF ──────────────────────────────────────────────────────────── */}
        <TabsContent value="dcf" className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Free Cash Flows &amp; Discount Rate</CardTitle></CardHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Free Cash Flows (comma-separated, $)</label>
                  <textarea
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    rows={2}
                    value={fcfStr}
                    onChange={(e) => setFcfStr(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{parsedFcf.length} periods</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <NumInput label="Discount Rate (WACC)" value={dr} onChange={setDr} step={0.005} pct />
                  <NumInput label="Terminal Growth Rate" value={tgr} onChange={setTgr} step={0.005} pct />
                  <NumInput label="Net Debt ($)" value={netDebt} onChange={setNetDebt} />
                  <NumInput label="Shares Outstanding" value={shares} onChange={setShares} />
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader><CardTitle>Terminal Value Inputs</CardTitle></CardHeader>
              <div className="space-y-3">
                <NumInput label="Last Year EBITDA ($)" value={ebitdaLast} onChange={setEbitdaLast} />
                <NumInput label="EV/EBITDA Exit Multiple (x)" value={evMultiple} onChange={setEvMultiple} step={0.5} />
                <NumInput label="ROIC (Value Driver)" value={roic} onChange={setRoic} step={0.01} pct />
                <NumInput label="Last Year NOPAT ($)" value={nopatLast} onChange={setNopatLast} />
                <p className="text-xs text-muted-foreground">All 4 TV methods computed simultaneously when tv_method="all"</p>
              </div>
            </Card>
          </div>

          <Button
            onClick={() => dcfMut.mutate({
              free_cash_flows: parsedFcf,
              discount_rate: dr,
              terminal_growth_rate: tgr,
              net_debt: netDebt,
              shares_outstanding: shares,
              ebitda_last: ebitdaLast,
              ev_ebitda_multiple: evMultiple,
              roic,
              nopat_last: nopatLast,
              tv_method: "all",
            })}
            disabled={dcfMut.isPending || parsedFcf.length === 0}
          >
            {dcfMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
            Calculate DCF
          </Button>

          {dcfResult && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "PV of FCFs", value: fmt(dcfResult.sum_pv_fcfs, { style: "currency" }) },
                  { label: "PV Terminal Value", value: fmt(dcfResult.pv_terminal_value, { style: "currency" }) },
                  { label: "Enterprise Value", value: fmt(dcfResult.enterprise_value, { style: "currency" }), highlight: true },
                  { label: "Equity Value", value: fmt(dcfResult.equity_value, { style: "currency" }), highlight: true },
                  { label: "TV % of EV", value: `${dcfResult.terminal_value_pct?.toFixed(1)}%` },
                  { label: "Net Debt", value: fmt(dcfResult.net_debt, { style: "currency" }) },
                  ...(dcfResult.price_per_share ? [{ label: "Implied Share Price", value: fmt(dcfResult.price_per_share, { style: "currency" }), highlight: true }] : []),
                ].map((k) => (
                  <Card key={k.label} className={k.highlight ? "border border-primary" : ""}>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className={`text-xl font-bold mt-1 ${k.highlight ? "text-primary" : ""}`}>{k.value}</p>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>FCF vs PV of FCF</CardTitle></CardHeader>
                  <FinancialChart
                    data={fcfData}
                    xKey="year"
                    series={[
                      { key: "Free Cash Flow", label: "Free Cash Flow", type: "bar", color: "#3b82f6" },
                      { key: "PV of FCF", label: "PV of FCF", type: "bar", color: "#22c55e" },
                    ]}
                    height={250}
                  />
                </Card>

                {tvMethodData.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>EV by Terminal Value Method</CardTitle></CardHeader>
                    <FinancialChart
                      data={tvMethodData}
                      xKey="method"
                      series={[{ key: "EV ($)", label: "Enterprise Value", type: "bar", color: "#8b5cf6" }]}
                      height={250}
                    />
                  </Card>
                )}
              </div>

              {/* TV method breakdown table */}
              {Object.keys(dcfMethods).length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Terminal Value Method Comparison</CardTitle></CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-secondary/30">
                          {["TV Method", "Enterprise Value", "Equity Value", "TV % of EV", "Implied EV/EBITDA"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(dcfMethods).map(([method, v]) => (
                          <tr key={method} className="border-b hover:bg-accent/20">
                            <td className="px-3 py-2 font-medium">
                              {method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </td>
                            <td className="px-3 py-2 font-mono">{fmt(v.ev, { style: "currency" })}</td>
                            <td className="px-3 py-2 font-mono">{fmt(v.equity_value, { style: "currency" })}</td>
                            <td className="px-3 py-2 font-mono">{(v.tv_pct * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 font-mono">{v.implied_multiple?.toFixed(1)}x</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Simple WACC ───────────────────────────────────────────────────── */}
        <TabsContent value="wacc" className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Textbook WACC</CardTitle></CardHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <NumInput label="Equity Value ($)" value={wEv} onChange={setWEv} />
                <NumInput label="Debt Value ($)" value={wDv} onChange={setWDv} />
                <NumInput label="Cost of Equity" value={coe} onChange={setCoe} step={0.005} pct />
                <NumInput label="Cost of Debt" value={cod} onChange={setCod} step={0.005} pct />
                <NumInput label="Tax Rate" value={tr} onChange={setTr} step={0.01} pct />
              </div>
              <Button
                onClick={() => waccMut.mutate({ equity_value: wEv, debt_value: wDv, cost_of_equity: coe, cost_of_debt: cod, tax_rate: tr })}
                disabled={waccMut.isPending}
              >
                {waccMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                Calculate WACC
              </Button>
            </div>
          </Card>

          {wResult && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "WACC", value: fmtPct(wResult.wacc), highlight: true },
                { label: "Cost of Equity", value: fmtPct(wResult.cost_of_equity) },
                { label: "Equity Weight", value: fmtPct(wResult.equity_weight) },
                { label: "Debt Weight", value: fmtPct(wResult.debt_weight) },
                { label: "After-Tax Cost of Debt", value: fmtPct(wResult.after_tax_cost_of_debt) },
              ].map((k) => (
                <Card key={k.label} className={k.highlight ? "border border-primary" : ""}>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={`text-xl font-bold mt-1 ${k.highlight ? "text-primary" : ""}`}>{k.value}</p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── CAPM WACC ─────────────────────────────────────────────────────── */}
        <TabsContent value="capm" className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Cost of Equity — CAPM Build-Up</CardTitle></CardHeader>
              <div className="space-y-3">
                <NumInput label="Risk-Free Rate (10yr Treasury)" value={rfr} onChange={setRfr} step={0.005} pct />
                <NumInput label="Equity Risk Premium (ERP)" value={erp} onChange={setErp} step={0.005} pct />
                <NumInput label="Levered Beta" value={beta} onChange={setBeta} step={0.05} />
                <NumInput label="Unlevered Beta (Hamada re-levering)" value={betaUnlevered} onChange={setBetaUnlevered} step={0.05} />
                <NumInput label="Size Premium (Duff &amp; Phelps)" value={sizePremium} onChange={setSizePremium} step={0.005} pct />
                <NumInput label="Country Risk Premium" value={countryPremium} onChange={setCountryPremium} step={0.005} pct />
                <NumInput label="Company-Specific Premium" value={companyPremium} onChange={setCompanyPremium} step={0.005} pct />
              </div>
            </Card>

            <Card>
              <CardHeader><CardTitle>Capital Structure &amp; Cost of Debt</CardTitle></CardHeader>
              <div className="space-y-3">
                <NumInput label="Market Value of Equity ($)" value={capmEquity} onChange={setCapmEquity} />
                <NumInput label="Market Value of Debt ($)" value={capmDebt} onChange={setCapmDebt} />
                <NumInput label="Pre-Tax Cost of Debt" value={capmCod} onChange={setCapmCod} step={0.005} pct />
                <NumInput label="Tax Rate" value={capmTax} onChange={setCapmTax} step={0.01} pct />
                <p className="text-xs text-muted-foreground">
                  CoE = Rf + β_levered × ERP + Size + Country + Company premiums.
                  If β_unlevered provided, Hamada formula re-levers to target capital structure.
                </p>
              </div>
            </Card>
          </div>

          <Button
            onClick={() => capmMut.mutate({
              risk_free_rate: rfr,
              equity_risk_premium: erp,
              beta,
              beta_unlevered: betaUnlevered,
              size_premium: sizePremium,
              country_risk_premium: countryPremium,
              company_specific_premium: companyPremium,
              debt_value: capmDebt,
              equity_value: capmEquity,
              cost_of_debt_pretax: capmCod,
              tax_rate: capmTax,
            })}
            disabled={capmMut.isPending}
          >
            {capmMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
            Calculate CAPM WACC
          </Button>

          {capmResult && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "WACC", value: fmtPct(capmResult.wacc), highlight: true },
                  { label: "Cost of Equity (CAPM)", value: fmtPct(capmResult.cost_of_equity), highlight: true },
                  { label: "After-Tax Cost of Debt", value: fmtPct(capmResult.after_tax_cost_of_debt) },
                  { label: "Equity Weight", value: fmtPct(capmResult.equity_weight) },
                  { label: "Debt Weight", value: fmtPct(capmResult.debt_weight) },
                  { label: "Levered Beta Used", value: capmResult.capm_components?.beta_levered?.toFixed(3) ?? "—" },
                ].map((k) => (
                  <Card key={k.label} className={k.highlight ? "border border-primary" : ""}>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className={`text-xl font-bold mt-1 ${k.highlight ? "text-primary" : ""}`}>{k.value}</p>
                  </Card>
                ))}
              </div>

              {capmResult.cost_of_equity_breakdown && (
                <Card>
                  <CardHeader><CardTitle>Cost of Equity Build-Up</CardTitle></CardHeader>
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {[
                        { label: "Risk-Free Rate", value: fmtPct(capmResult.cost_of_equity_breakdown.risk_free_rate) },
                        { label: `Beta (${capmResult.capm_components?.beta_levered?.toFixed(2)}) × ERP`, value: fmtPct((capmResult.capm_components?.beta_levered ?? 0) * (capmResult.cost_of_equity_breakdown.equity_risk_premium ?? 0)) },
                        { label: "Size Premium", value: fmtPct(capmResult.cost_of_equity_breakdown.size_premium ?? 0) },
                        { label: "Country Risk Premium", value: fmtPct(capmResult.cost_of_equity_breakdown.country_risk_premium ?? 0) },
                        { label: "Company-Specific Premium", value: fmtPct(capmResult.cost_of_equity_breakdown.company_specific_premium ?? 0) },
                        { label: "Cost of Equity", value: fmtPct(capmResult.cost_of_equity), bold: true },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className={`py-2 ${row.bold ? "font-semibold" : "text-muted-foreground"}`}>{row.label}</td>
                          <td className={`py-2 text-right font-mono ${row.bold ? "font-semibold text-primary" : ""}`}>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Football Field ────────────────────────────────────────────────── */}
        <TabsContent value="football" className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Comparable Companies</CardTitle>
                <Button variant="outline" size="sm" onClick={addComp}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-secondary/30">
                    {["Name", "EV ($)", "EBITDA ($)", "Revenue ($)", "Net Income ($)", "Growth %", "ROIC %", ""].map((h) => (
                      <th key={h} className="px-2 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comps.map((c, i) => (
                    <tr key={i} className="border-b">
                      {(["name", "ev", "ebitda", "revenue", "net_income"] as const).map((f) => (
                        <td key={f} className="px-2 py-1.5">
                          <input
                            className="w-full bg-transparent border border-border/40 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            type={f === "name" ? "text" : "number"}
                            value={c[f] as string | number}
                            onChange={(e) => updateComp(i, f, f === "name" ? e.target.value : +e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5">
                        <input
                          className="w-16 bg-transparent border border-border/40 rounded px-2 py-1 text-xs focus:outline-none"
                          type="number" step={0.1}
                          value={+(c.growth_rate * 100).toFixed(1)}
                          onChange={(e) => updateComp(i, "growth_rate", +e.target.value / 100)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="w-16 bg-transparent border border-border/40 rounded px-2 py-1 text-xs focus:outline-none"
                          type="number" step={0.1}
                          value={+((c.roic ?? 0) * 100).toFixed(1)}
                          onChange={(e) => updateComp(i, "roic", +e.target.value / 100)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => removeComp(i)} className="text-muted-foreground/50 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Button
            onClick={() => compMut.mutate({
              free_cash_flows: parsedFcf,
              discount_rate: dr,
              terminal_growth_rate: tgr,
              net_debt: netDebt,
              shares_outstanding: shares,
              ebitda_last: ebitdaLast,
              ev_ebitda_exit_multiple: evMultiple,
              roic,
              nopat_last: nopatLast,
              comparable_companies: comps,
              revenue_last: 0,
              depreciation_last: 0,
              capex_dep_ratio_terminal: 1.05,
              wc_pct_revenue: 0.10,
            })}
            disabled={compMut.isPending || parsedFcf.length === 0}
          >
            {compMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
            Run Comprehensive Valuation
          </Button>

          {compResult && (
            <>
              {footballChartData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Football Field — Enterprise Value by TV Method</CardTitle></CardHeader>
                  <FinancialChart
                    data={footballChartData}
                    xKey="method"
                    series={[{ key: "Enterprise Value", label: "Enterprise Value", type: "bar", color: "#8b5cf6" }]}
                    height={300}
                  />
                </Card>
              )}

              {Object.keys(ffMethods).length > 0 && (
                <Card>
                  <CardHeader><CardTitle>TV Method Breakdown</CardTitle></CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-secondary/30">
                          {["TV Method", "Enterprise Value", "Equity Value", "TV % of EV", "Implied EV/EBITDA"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(ffMethods).map(([method, v]) => (
                          <tr key={method} className="border-b hover:bg-accent/20">
                            <td className="px-3 py-2 font-medium">
                              {method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </td>
                            <td className="px-3 py-2 font-mono">{fmt(v.ev, { style: "currency" })}</td>
                            <td className="px-3 py-2 font-mono">{fmt(v.equity_value, { style: "currency" })}</td>
                            <td className="px-3 py-2 font-mono">{(v.tv_pct * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 font-mono">{v.implied_multiple?.toFixed(1)}x</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {compsAnalysis.ev_ebitda && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle>Comparable EV/EBITDA</CardTitle></CardHeader>
                    <FinancialChart
                      data={compsChartData}
                      xKey="name"
                      series={[{ key: "EV/EBITDA", label: "EV/EBITDA", type: "bar", color: "#f59e0b" }]}
                      height={220}
                      currency={false}
                    />
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Comp Statistics</CardTitle></CardHeader>
                    <table className="w-full text-sm">
                      <tbody className="divide-y">
                        {[
                          { label: "Min EV/EBITDA", value: `${compsAnalysis.ev_ebitda.min?.toFixed(1)}x` },
                          { label: "25th Percentile", value: `${compsAnalysis.ev_ebitda.q1?.toFixed(1)}x` },
                          { label: "Median", value: `${compsAnalysis.ev_ebitda.median?.toFixed(1)}x`, bold: true },
                          { label: "75th Percentile", value: `${compsAnalysis.ev_ebitda.q3?.toFixed(1)}x` },
                          { label: "Max EV/EBITDA", value: `${compsAnalysis.ev_ebitda.max?.toFixed(1)}x` },
                          { label: "Mean EV/EBITDA", value: `${compsAnalysis.ev_ebitda.mean?.toFixed(1)}x` },
                          { label: "Implied EV (median)", value: fmt(compsAnalysis.implied_ev?.ev_ebitda_median, { style: "currency" }), bold: true },
                        ].map((row) => (
                          <tr key={row.label}>
                            <td className={`py-2 ${row.bold ? "font-semibold" : "text-muted-foreground"}`}>{row.label}</td>
                            <td className={`py-2 text-right font-mono ${row.bold ? "font-semibold text-primary" : ""}`}>{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>
              )}

              {compResult.implied_ev_ebitda_fundamental != null && (
                <Card>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">Value Driver Formula — Implied EV/EBITDA:</span>
                    <Badge variant="neutral">{compResult.implied_ev_ebitda_fundamental?.toFixed(1)}x</Badge>
                    <span className="text-xs text-muted-foreground">
                      ROIC={fmtPct(roic)}, g={fmtPct(tgr)}, WACC={fmtPct(dr)}
                    </span>
                  </div>
                </Card>
              )}
            </>
          )}

          {!compResult && !compMut.isPending && (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">Configure inputs and run to see the football field</p>
            </div>
          )}
        </TabsContent>

        {/* ── Sensitivity Grid ──────────────────────────────────────────────── */}
        <TabsContent value="sensitivity">
          <Card>
            <CardHeader><CardTitle>EV Sensitivity — Discount Rate × Terminal Growth Rate (Gordon Growth)</CardTitle></CardHeader>
            <p className="text-xs text-muted-foreground mb-4">
              Base case highlighted. FCFs from DCF tab ({parsedFcf.length} periods).
            </p>
            {parsedFcf.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-foreground font-medium">DR \ TGR</th>
                      {tgrRange.map((t) => (
                        <th key={t} className="px-3 py-2 text-right text-muted-foreground font-medium">
                          {(t * 100).toFixed(1)}%
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drRange.map((d) => (
                      <tr key={d} className="border-t border-border/30 hover:bg-accent/20">
                        <td className="px-3 py-2 font-medium text-muted-foreground">{(d * 100).toFixed(0)}%</td>
                        {tgrRange.map((t) => {
                          if (d <= t) return <td key={t} className="px-3 py-2 text-right text-muted-foreground/30">—</td>;
                          const lastFcf = parsedFcf.at(-1) ?? 0;
                          const tv = lastFcf * (1 + t) / (d - t);
                          const pvFcf = parsedFcf.reduce((acc, cf, i) => acc + cf / Math.pow(1 + d, i + 1), 0);
                          const pvTv = tv / Math.pow(1 + d, parsedFcf.length);
                          const ev2 = pvFcf + pvTv;
                          const isBase = Math.abs(d - dr) < 0.005 && Math.abs(t - tgr) < 0.003;
                          return (
                            <td key={t} className={`px-3 py-2 text-right font-mono ${isBase ? "text-primary font-semibold bg-primary/10" : "text-foreground/80"}`}>
                              {fmt(ev2, { style: "currency" })}
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
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
