import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runRealEstateModel } from "@/lib/api";
import { fmt, fmtPct } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FinancialChart } from "@/components/charts/FinancialChart";
import { DataTable } from "@/components/charts/DataTable";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, AlertTriangle } from "lucide-react";

const DEFAULT = {
  name: "Office Tower — Class A",
  property_type: "Office",
  rentable_area_sqft: 150_000,
  rent_per_sqft_per_year: 45.0,
  rent_growth_rate: 0.03,
  initial_occupancy: 0.80,
  stabilized_occupancy: 0.92,
  stabilization_years: 2,
  vacancy_credit_loss_pct: 0.02,
  opex_per_sqft_per_year: 14.0,
  opex_growth_rate: 0.025,
  capex_reserve_per_sqft: 0.75,
  tenant_improvement_per_sqft: 25.0,
  leasing_commissions_pct: 0.04,
  purchase_price: 80_000_000,
  equity_pct: 0.35,
  debt_rate: 0.055,
  debt_amort_years: 25,
  entry_cap_rate: 0.055,
  exit_cap_rate: 0.06,
  hold_period_years: 10,
  tax_rate: 0.25,
  depreciation_years: 39,
  additional_properties: [],
};

function Field({
  label,
  value,
  onChange,
  pct = false,
  integer = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  pct?: boolean;
  integer?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        step={pct ? 0.001 : integer ? 1 : undefined}
        value={pct ? +(value * 100).toFixed(3) : value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(pct ? v / 100 : v);
        }}
      />
    </div>
  );
}

export default function RealEstate() {
  const [form, setForm] = useState(DEFAULT);
  const mut = useMutation({ mutationFn: runRealEstateModel });
  const result = mut.data;

  const update = (key: string, value: unknown) =>
    setForm((p) => ({ ...p, [key]: value }));

  const years: number[] = result?.years ?? [];
  const km = result?.key_metrics ?? {};
  const rev = result?.revenue ?? {};
  const exp = result?.expenses ?? {};
  const ds = result?.debt_schedule ?? {};
  const cf = result?.cash_flow ?? {};
  const exit = result?.exit ?? {};
  const su = result?.sources_uses ?? {};

  const minDscr: number | null = km.min_dscr ?? null;
  const dscr_warning = minDscr !== null && minDscr < 1.2;

  // Chart data
  const noiChartData = years.map((y: number, i: number) => ({
    year: y,
    "Gross Potential Rent": rev.gross_potential_rent?.[i],
    "Vacancy Loss": -(rev.vacancy_loss?.[i] ?? 0),
    "OpEx": -(exp.opex?.[i] ?? 0),
    NOI: result?.noi?.[i],
  }));

  const cfChartData = years.map((y: number, i: number) => ({
    year: y,
    CFBT: cf.cfbt?.[i],
    "Income Tax": -(cf.income_tax?.[i] ?? 0),
    CFAT: cf.cfat?.[i],
  }));

  const occupancyChartData = years.map((y: number, i: number) => ({
    year: y,
    "Occupancy %": (rev.occupancy?.[i] ?? 0) * 100,
    "NOI Yield %": (result?.noi_yield?.[i] ?? 0) * 100,
  }));

  const dscrChartData = years.map((y: number, i: number) => ({
    year: y,
    DSCR: ds.dscr?.[i],
    "1.20x Covenant": 1.2,
  }));

  const debtChartData = years.map((y: number, i: number) => ({
    year: y,
    "Opening Balance": ds.opening_balance?.[i],
    Interest: ds.interest?.[i],
    Principal: ds.principal?.[i],
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Real Estate Model</h1>
          <p className="text-sm text-muted-foreground">
            NOI waterfall · Occupancy ramp · Debt schedule · Exit analysis
          </p>
        </div>
        <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
          {mut.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Run Model
        </Button>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Property &amp; Revenue</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Property Name</label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Property Type</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.property_type}
                onChange={(e) => update("property_type", e.target.value)}
              >
                {["Office", "Retail", "Industrial", "Residential", "Mixed"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <Field label="Rentable Area (sqft)" value={form.rentable_area_sqft} onChange={(v) => update("rentable_area_sqft", v)} />
            <Field label="Rent / sqft / year ($)" value={form.rent_per_sqft_per_year} onChange={(v) => update("rent_per_sqft_per_year", v)} />
            <Field label="Rent Growth Rate" value={form.rent_growth_rate} onChange={(v) => update("rent_growth_rate", v)} pct />
            <Field label="Initial Occupancy" value={form.initial_occupancy} onChange={(v) => update("initial_occupancy", v)} pct />
            <Field label="Stabilized Occupancy" value={form.stabilized_occupancy} onChange={(v) => update("stabilized_occupancy", v)} pct />
            <Field label="Stabilization Years" value={form.stabilization_years} onChange={(v) => update("stabilization_years", Math.round(v))} integer />
            <Field label="Credit Loss %" value={form.vacancy_credit_loss_pct} onChange={(v) => update("vacancy_credit_loss_pct", v)} pct />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operating Expenses &amp; CapEx</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <Field label="OpEx / sqft / year ($)" value={form.opex_per_sqft_per_year} onChange={(v) => update("opex_per_sqft_per_year", v)} />
            <Field label="OpEx Growth Rate" value={form.opex_growth_rate} onChange={(v) => update("opex_growth_rate", v)} pct />
            <Field label="CapEx Reserve / sqft ($)" value={form.capex_reserve_per_sqft} onChange={(v) => update("capex_reserve_per_sqft", v)} />
            <Field label="Tenant Improvement / sqft ($)" value={form.tenant_improvement_per_sqft} onChange={(v) => update("tenant_improvement_per_sqft", v)} />
            <Field label="Leasing Commissions %" value={form.leasing_commissions_pct} onChange={(v) => update("leasing_commissions_pct", v)} pct />
            <Field label="Purchase Price ($)" value={form.purchase_price} onChange={(v) => update("purchase_price", v)} />
            <Field label="Equity % (LTV inverse)" value={form.equity_pct} onChange={(v) => update("equity_pct", v)} pct />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financing &amp; Exit</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <Field label="Debt Rate" value={form.debt_rate} onChange={(v) => update("debt_rate", v)} pct />
            <Field label="Amortization Period (yrs)" value={form.debt_amort_years} onChange={(v) => update("debt_amort_years", Math.round(v))} integer />
            <Field label="Entry Cap Rate" value={form.entry_cap_rate} onChange={(v) => update("entry_cap_rate", v)} pct />
            <Field label="Exit Cap Rate" value={form.exit_cap_rate} onChange={(v) => update("exit_cap_rate", v)} pct />
            <Field label="Hold Period (years)" value={form.hold_period_years} onChange={(v) => update("hold_period_years", Math.round(v))} integer />
            <Field label="Tax Rate" value={form.tax_rate} onChange={(v) => update("tax_rate", v)} pct />
            <Field label="Depreciation Life (years)" value={form.depreciation_years} onChange={(v) => update("depreciation_years", Math.round(v))} integer />
          </div>
        </Card>
      </div>

      {/* DSCR Warning */}
      {dscr_warning && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500 bg-amber-50 px-4 py-3 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">
            Minimum DSCR below 1.20x ({minDscr?.toFixed(2)}x) — lender covenant breach risk.
          </span>
        </div>
      )}

      {result && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[
              { label: "Equity IRR", value: fmtPct(km.equity_irr), highlight: true },
              { label: "Unlevered IRR", value: fmtPct(km.unlevered_irr) },
              { label: "Equity Multiple", value: `${km.equity_multiple?.toFixed(2)}x` },
              { label: "Entry Cap Rate", value: fmtPct(km.entry_cap_rate) },
              { label: "Exit Cap Rate", value: fmtPct(km.exit_cap_rate) },
              { label: "Min DSCR", value: km.min_dscr?.toFixed(2) ?? "—" },
              { label: "LTV", value: fmtPct(km.ltv) },
              { label: "Equity Invested", value: fmt(km.equity_invested, { style: "currency" }) },
              { label: "Exit Net Equity", value: fmt(km.exit_equity_net, { style: "currency" }) },
              { label: "Yr 1 NOI", value: fmt(km.noi_year_1, { style: "currency" }) },
              { label: "Stabilized NOI", value: fmt(km.stabilized_noi, { style: "currency" }) },
              { label: "Avg DSCR", value: km.avg_dscr?.toFixed(2) ?? "—" },
            ].map((kpi) => (
              <Card key={kpi.label} className={kpi.highlight ? "border border-primary" : ""}>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-lg font-bold mt-1 ${kpi.highlight ? "text-primary" : ""}`}>
                  {kpi.value}
                </p>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="noi">
            <TabsList>
              <TabsTrigger value="noi">NOI Waterfall</TabsTrigger>
              <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
              <TabsTrigger value="debt">Debt Schedule</TabsTrigger>
              <TabsTrigger value="occupancy">Occupancy &amp; Yield</TabsTrigger>
              <TabsTrigger value="exit">Exit Analysis</TabsTrigger>
            </TabsList>

            {/* NOI Waterfall */}
            <TabsContent value="noi" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>NOI Build — Annual</CardTitle></CardHeader>
                <FinancialChart
                  data={noiChartData}
                  xKey="year"
                  series={[
                    { key: "Gross Potential Rent", label: "Gross Potential Rent", color: "#22c55e", type: "bar" },
                    { key: "Vacancy Loss", label: "Vacancy Loss", color: "#ef4444", type: "bar" },
                    { key: "OpEx", label: "OpEx", color: "#f97316", type: "bar" },
                    { key: "NOI", label: "NOI", color: "#3b82f6", type: "line" },
                  ]}
                  height={300}
                />
              </Card>
              <DataTable
                columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Gross Potential Rent", values: rev.gross_potential_rent ?? [], bold: true },
                  { label: "Vacancy Loss", values: (rev.vacancy_loss ?? []).map((v: number) => -v) },
                  { label: "Eff. Gross Income", values: rev.effective_gross_income ?? [], bold: true },
                  { label: "OpEx", values: (exp.opex ?? []).map((v: number) => -v) },
                  { label: "CapEx Reserve", values: (exp.capex_reserve ?? []).map((v: number) => -v) },
                  { label: "NOI", values: result.noi ?? [], bold: true },
                  { label: "NOI After Reserves", values: result.noi_after_reserves ?? [] },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            {/* Cash Flow */}
            <TabsContent value="cashflow" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Cash Flow to Equity</CardTitle></CardHeader>
                <FinancialChart
                  data={cfChartData}
                  xKey="year"
                  series={[
                    { key: "CFBT", label: "CFBT", color: "#3b82f6", type: "bar" },
                    { key: "Income Tax", label: "Income Tax", color: "#ef4444", type: "bar" },
                    { key: "CFAT", label: "CFAT", color: "#22c55e", type: "line" },
                  ]}
                  height={300}
                />
              </Card>
              <DataTable
                columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "NOI", values: result.noi ?? [], bold: true },
                  { label: "CapEx Reserve", values: (exp.capex_reserve ?? []).map((v: number) => -v) },
                  { label: "Leasing Costs", values: (exp.leasing_costs ?? []).map((v: number) => -v) },
                  { label: "Tenant Improvements", values: (exp.tenant_improvements ?? []).map((v: number) => -v) },
                  { label: "Debt Service", values: (ds.annual_debt_service ?? []).map((v: number) => -v) },
                  { label: "CFBT", values: cf.cfbt ?? [], bold: true },
                  { label: "Income Tax", values: (cf.income_tax ?? []).map((v: number) => -v) },
                  { label: "CFAT", values: cf.cfat ?? [], bold: true },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            {/* Debt Schedule */}
            <TabsContent value="debt" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Debt Balance</CardTitle></CardHeader>
                  <FinancialChart
                    data={debtChartData}
                    xKey="year"
                    series={[
                      { key: "Opening Balance", label: "Opening Balance", color: "#94a3b8", type: "bar" },
                      { key: "Interest", label: "Interest", color: "#f97316", type: "bar" },
                      { key: "Principal", label: "Principal", color: "#ef4444", type: "bar" },
                    ]}
                    height={250}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>DSCR vs 1.20x Covenant</CardTitle></CardHeader>
                  <FinancialChart
                    data={dscrChartData}
                    xKey="year"
                    series={[
                      { key: "DSCR", label: "DSCR", color: "#3b82f6", type: "bar" },
                      { key: "1.20x Covenant", label: "1.20x Covenant", color: "#ef4444", type: "line" },
                    ]}
                    height={250}
                    currency={false}
                  />
                </Card>
              </div>
              <DataTable
                columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Opening Balance", values: ds.opening_balance ?? [] },
                  { label: "Interest", values: (ds.interest ?? []).map((v: number) => -v) },
                  { label: "Principal", values: (ds.principal ?? []).map((v: number) => -v) },
                  { label: "Closing Balance", values: ds.closing_balance ?? [], bold: true },
                  { label: "DSCR", values: ds.dscr ?? [] },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            {/* Occupancy & Yield */}
            <TabsContent value="occupancy" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Occupancy Ramp &amp; NOI Yield</CardTitle></CardHeader>
                <FinancialChart
                  data={occupancyChartData}
                  xKey="year"
                  series={[
                    { key: "Occupancy %", label: "Occupancy %", color: "#3b82f6", type: "line" },
                    { key: "NOI Yield %", label: "NOI Yield %", color: "#22c55e", type: "line" },
                  ]}
                  height={300}
                  currency={false}
                />
              </Card>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {years.map((y: number, i: number) => (
                  <Card key={y}>
                    <p className="text-xs font-medium text-muted-foreground">Year {y}</p>
                    <p className="text-sm mt-1">
                      Occ: <span className="font-semibold">{fmtPct(rev.occupancy?.[i])}</span>
                    </p>
                    <p className="text-sm">
                      NOI Yield: <span className="font-semibold">{fmtPct(result?.noi_yield?.[i])}</span>
                    </p>
                    <p className="text-sm">
                      Rent/sqft: <span className="font-semibold">${rev.rent_per_sqft?.[i]?.toFixed(2)}</span>
                    </p>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Exit Analysis */}
            <TabsContent value="exit" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Acquisition Financing */}
                <Card>
                  <CardHeader><CardTitle>Acquisition Financing</CardTitle></CardHeader>
                  <table className="w-full text-sm">
                    <tbody className="divide-y border-t">
                      {[
                        { label: "Purchase Price", value: fmt(su.purchase_price, { style: "currency" }) },
                        { label: "Equity", value: fmt(su.equity, { style: "currency" }), indent: true },
                        { label: "Debt", value: fmt(su.debt, { style: "currency" }), indent: true },
                        { label: "Loan-to-Value", value: fmtPct(su.loan_to_value) },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className={`py-2 ${row.indent ? "pl-4 text-muted-foreground" : "font-medium"}`}>
                            {row.label}
                          </td>
                          <td className="py-2 text-right font-mono">{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>

                {/* Exit Waterfall */}
                <Card>
                  <CardHeader><CardTitle>Exit Waterfall (Year {form.hold_period_years})</CardTitle></CardHeader>
                  <table className="w-full text-sm">
                    <tbody className="divide-y border-t">
                      {[
                        { label: "Exit NOI", value: fmt(exit.exit_noi, { style: "currency" }) },
                        { label: `÷ Exit Cap Rate (${fmtPct(exit.exit_cap_rate)})`, value: "" },
                        { label: "Exit Enterprise Value", value: fmt(exit.exit_ev, { style: "currency" }), bold: true },
                        { label: "Less: Remaining Debt", value: `(${fmt(exit.exit_debt, { style: "currency" })})`, indent: true },
                        { label: "Pre-Tax Equity Proceeds", value: fmt(exit.exit_equity_pretax, { style: "currency" }) },
                        { label: "Less: Capital Gains Tax", value: `(${fmt(exit.capital_gains_tax, { style: "currency" })})`, indent: true },
                        { label: "Net Exit Equity", value: fmt(exit.exit_equity_net, { style: "currency" }), bold: true },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className={`py-2 ${row.indent ? "pl-4 text-muted-foreground" : row.bold ? "font-semibold" : ""}`}>
                            {row.label}
                          </td>
                          <td className={`py-2 text-right font-mono ${row.bold ? "font-semibold" : ""}`}>
                            {row.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>

              {/* Returns Summary */}
              <Card>
                <CardHeader><CardTitle>Returns Summary</CardTitle></CardHeader>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: "Equity IRR", value: fmtPct(km.equity_irr) },
                    { label: "Unlevered IRR", value: fmtPct(km.unlevered_irr) },
                    { label: "Equity Multiple (MOIC)", value: `${km.equity_multiple?.toFixed(2)}x` },
                    { label: "Equity Invested", value: fmt(km.equity_invested, { style: "currency" }) },
                    { label: "Exit Net Equity", value: fmt(km.exit_equity_net, { style: "currency" }) },
                    { label: "Total Distributions", value: fmt(result?.returns?.total_equity_distributions, { style: "currency" }) },
                    { label: "Levered Spread", value: fmtPct((km.equity_irr ?? 0) - (km.unlevered_irr ?? 0)) },
                    { label: "Entry → Exit Cap Rate", value: `${fmtPct(km.entry_cap_rate)} → ${fmtPct(km.exit_cap_rate)}` },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-lg font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Cap Rate Context */}
              <Card>
                <CardHeader><CardTitle>Cap Rate Context</CardTitle></CardHeader>
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="neutral">
                    Entry Cap: {fmtPct(exit.implied_entry_cap_rate)}
                  </Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant={exit.exit_cap_rate > exit.implied_entry_cap_rate ? "warning" : "positive"}>
                    Exit Cap: {fmtPct(exit.exit_cap_rate)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {exit.exit_cap_rate > exit.implied_entry_cap_rate
                      ? "Cap rate expansion — value erosion on exit"
                      : "Cap rate compression — value enhancement on exit"}
                  </span>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {!result && !mut.isPending && (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">
            Configure inputs and click <strong>Run Model</strong> to see results
          </p>
        </div>
      )}
    </div>
  );
}
