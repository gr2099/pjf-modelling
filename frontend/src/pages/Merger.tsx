import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runMergerModel } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FinancialChart } from "@/components/charts/FinancialChart";
import { DataTable } from "@/components/charts/DataTable";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2 } from "lucide-react";

const DEFAULT = {
  name: "Merger Analysis",
  acquirer_revenue: 500_000_000,
  acquirer_ebitda: 100_000_000,
  acquirer_ebit: 80_000_000,
  acquirer_net_income: 55_000_000,
  acquirer_shares: 50_000_000,
  acquirer_share_price: 40.0,
  acquirer_net_debt: 80_000_000,
  acquirer_growth_rate: 0.05,
  target_revenue: 150_000_000,
  target_ebitda: 30_000_000,
  target_ebit: 22_000_000,
  target_net_income: 15_000_000,
  target_net_debt: 20_000_000,
  target_growth_rate: 0.10,
  purchase_price: 300_000_000,
  cash_consideration_pct: 0.50,
  stock_consideration_pct: 0.30,
  debt_consideration_pct: 0.20,
  new_debt_rate: 0.065,
  cost_synergies: 15_000_000,
  revenue_synergies: 5_000_000,
  integration_costs: 20_000_000,
  synergy_phase_in_years: 3,
  amortization_of_intangibles: 5_000_000,
  tax_rate: 0.25,
  holding_period_years: 5,
};

export default function Merger() {
  const [form, setForm] = useState(DEFAULT);
  const mut = useMutation({ mutationFn: runMergerModel });
  const result = mut.data;

  const update = (key: string, value: unknown) =>
    setForm((p) => ({ ...p, [key]: value }));

  const years = result?.years ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const epsData = years.map((y: number, i: number) => ({
    year: y,
    "Standalone EPS": result?.acquirer_standalone.eps[i],
    "Combined EPS": result?.combined.eps[i],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const synergyData = years.map((y: number, i: number) => ({
    year: y,
    "Cost Synergies": result?.synergies.cost_synergies[i],
    "Revenue Synergies": result?.synergies.revenue_synergies[i],
    "Integration Costs": result?.synergies.integration_costs ? -(result.synergies.integration_costs[i]) : 0,
    "Net Synergies": result?.synergies.net_synergies[i],
  }));

  const km = result?.key_metrics ?? {};
  const sud = result?.sources_uses ?? {};

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <div className="glass rounded-xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Merger Assumptions</h2>
          <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Model
          </Button>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Acquirer</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input label="Revenue ($)" type="number" value={form.acquirer_revenue}
              onChange={(e) => update("acquirer_revenue", +e.target.value)} />
            <Input label="EBITDA ($)" type="number" value={form.acquirer_ebitda}
              onChange={(e) => update("acquirer_ebitda", +e.target.value)} />
            <Input label="Net Income ($)" type="number" value={form.acquirer_net_income}
              onChange={(e) => update("acquirer_net_income", +e.target.value)} />
            <Input label="Shares Outstanding" type="number" value={form.acquirer_shares}
              onChange={(e) => update("acquirer_shares", +e.target.value)} />
            <Input label="Share Price ($)" type="number" value={form.acquirer_share_price}
              onChange={(e) => update("acquirer_share_price", +e.target.value)} />
            <Input label="Net Debt ($)" type="number" value={form.acquirer_net_debt}
              onChange={(e) => update("acquirer_net_debt", +e.target.value)} />
            <Input label="Growth Rate" type="number" value={form.acquirer_growth_rate}
              onChange={(e) => update("acquirer_growth_rate", +e.target.value)} step={0.01} />
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input label="Revenue ($)" type="number" value={form.target_revenue}
              onChange={(e) => update("target_revenue", +e.target.value)} />
            <Input label="EBITDA ($)" type="number" value={form.target_ebitda}
              onChange={(e) => update("target_ebitda", +e.target.value)} />
            <Input label="Net Income ($)" type="number" value={form.target_net_income}
              onChange={(e) => update("target_net_income", +e.target.value)} />
            <Input label="Net Debt ($)" type="number" value={form.target_net_debt}
              onChange={(e) => update("target_net_debt", +e.target.value)} />
            <Input label="Growth Rate" type="number" value={form.target_growth_rate}
              onChange={(e) => update("target_growth_rate", +e.target.value)} step={0.01} />
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deal Terms & Synergies</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input label="Purchase Price ($)" type="number" value={form.purchase_price}
              onChange={(e) => update("purchase_price", +e.target.value)} />
            <Input label="Cash Consideration %" type="number" value={form.cash_consideration_pct}
              onChange={(e) => update("cash_consideration_pct", +e.target.value)} step={0.05} />
            <Input label="Stock Consideration %" type="number" value={form.stock_consideration_pct}
              onChange={(e) => update("stock_consideration_pct", +e.target.value)} step={0.05} />
            <Input label="New Debt Rate" type="number" value={form.new_debt_rate}
              onChange={(e) => update("new_debt_rate", +e.target.value)} step={0.005} />
            <Input label="Cost Synergies ($)" type="number" value={form.cost_synergies}
              onChange={(e) => update("cost_synergies", +e.target.value)} />
            <Input label="Revenue Synergies ($)" type="number" value={form.revenue_synergies}
              onChange={(e) => update("revenue_synergies", +e.target.value)} />
            <Input label="Integration Costs ($)" type="number" value={form.integration_costs}
              onChange={(e) => update("integration_costs", +e.target.value)} />
            <Input label="Phase-in Years" type="number" value={form.synergy_phase_in_years}
              onChange={(e) => update("synergy_phase_in_years", +e.target.value)} min={1} />
            <Input label="Amort. Intangibles ($/yr)" type="number" value={form.amortization_of_intangibles}
              onChange={(e) => update("amortization_of_intangibles", +e.target.value)} />
            <Input label="Tax Rate" type="number" value={form.tax_rate}
              onChange={(e) => update("tax_rate", +e.target.value)} step={0.01} />
            <Input label="Holding Period (yrs)" type="number" value={form.holding_period_years}
              onChange={(e) => update("holding_period_years", +e.target.value)} min={1} />
          </div>
        </div>
      </div>

      {result && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Purchase Price / EBITDA", value: `${fmt(km.purchase_price_ebitda, { style: "decimal", decimals: 1 })}×` },
              { label: "Goodwill", value: fmt(km.goodwill, { style: "currency" }) },
              { label: "New Shares Issued", value: fmt(km.new_shares_issued, { style: "decimal", decimals: 0 }) },
              { label: "Dilution", value: fmt(km.dilution_pct, { style: "percent" }) },
              { label: "Year 1 EPS (Combined)", value: fmt(km.year_1_combined_eps, { style: "decimal", decimals: 2 }) },
              { label: "Year 1 EPS (Standalone)", value: fmt(km.year_1_standalone_eps, { style: "decimal", decimals: 2 }) },
              {
                label: "Year 1 Accretion/Dilution",
                value: fmt(km.year_1_eps_accretion, { style: "percent" }),
                variant: (km.year_1_eps_accretion ?? 0) >= 0 ? "positive" as const : "negative" as const,
              },
              {
                label: "Fully Accretive Year",
                value: km.payback_year ? `Year ${km.payback_year}` : "N/A",
                variant: km.payback_year ? "positive" as const : "warning" as const,
              },
            ].map(({ label, value, variant = "default" as const }) => (
              <Card key={label} className="py-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <Badge variant={variant}>{value}</Badge>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="accretion">
            <TabsList>
              <TabsTrigger value="accretion">Accretion / Dilution</TabsTrigger>
              <TabsTrigger value="sources">Sources & Uses</TabsTrigger>
              <TabsTrigger value="combined">Combined P&L</TabsTrigger>
              <TabsTrigger value="synergies">Synergies</TabsTrigger>
              <TabsTrigger value="credit">Credit Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="accretion">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>EPS: Standalone vs Combined</CardTitle></CardHeader>
                  <FinancialChart data={epsData} xKey="year"
                    series={[
                      { key: "Standalone EPS", label: "Acquirer Standalone", type: "line" },
                      { key: "Combined EPS", label: "Combined", type: "line" },
                    ]}
                    currency={false}
                  />
                </Card>
                <Card className="p-4">
                  <p className="text-sm font-semibold mb-3">Accretion / Dilution by Year</p>
                  <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                    rows={[
                      { label: "Standalone EPS ($)", values: result.acquirer_standalone.eps, bold: false },
                      { label: "Combined EPS ($)", values: result.combined.eps, bold: true },
                      { label: "EPS Delta ($)", values: result.accretion_dilution.eps_delta },
                      { label: "Accretion / Dilution %", values: result.accretion_dilution.pct_delta, bold: true },
                    ]}
                    yearLabels={years}
                  />
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="sources">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Transaction Financing</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Purchase Price</span><span className="font-mono">{fmt(sud.uses?.purchase_price, { style: "currency" })}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Transaction Fees</span><span className="font-mono">{fmt(sud.uses?.transaction_fees, { style: "currency" })}</span></div>
                    <div className="flex justify-between font-semibold border-t border-border/30 pt-2"><span>Total Uses</span><span className="font-mono">{fmt(sud.uses?.total_uses, { style: "currency" })}</span></div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Cash</span><span className="font-mono">{fmt(sud.sources?.cash, { style: "currency" })}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Stock Issued</span><span className="font-mono">{fmt(sud.sources?.stock_issued, { style: "currency" })}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">New Debt</span><span className="font-mono">{fmt(sud.sources?.new_debt, { style: "currency" })}</span></div>
                    <div className="flex justify-between font-semibold border-t border-border/30 pt-2"><span>Total Sources</span><span className="font-mono">{fmt(sud.sources?.total_sources, { style: "currency" })}</span></div>
                  </div>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Pro Forma Ownership</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Existing Shares</span><span className="font-mono">{fmt(form.acquirer_shares, { style: "decimal", decimals: 0 })}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">New Shares Issued</span><span className="font-mono">{fmt(sud.new_shares_issued, { style: "decimal", decimals: 0 })}</span></div>
                    <div className="flex justify-between font-semibold"><span>Pro Forma Shares</span><span className="font-mono">{fmt(sud.total_shares_post_merger, { style: "decimal", decimals: 0 })}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Dilution</span><span className="font-mono">{fmt(sud.dilution_pct, { style: "percent" })}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Purchase / EBITDA</span><span className="font-mono">{fmt(sud.purchase_price_to_ebitda, { style: "decimal", decimals: 1 })}×</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Goodwill</span><span className="font-mono">{fmt(sud.goodwill, { style: "currency" })}</span></div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="combined">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Acquirer Revenue", values: result.acquirer_standalone.revenue, bold: false },
                  { label: "Target Revenue", values: result.target_standalone.revenue },
                  { label: "Revenue Synergies", values: result.synergies.revenue_synergies },
                  { label: "Combined Revenue", values: result.combined.revenue, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "Acquirer EBITDA", values: result.acquirer_standalone.ebitda },
                  { label: "Target EBITDA", values: result.target_standalone.ebitda },
                  { label: "Net Synergies", values: result.synergies.net_synergies },
                  { label: "Combined EBITDA", values: result.combined.ebitda, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "Interest on Acquisition Debt", values: result.combined.interest.map((v: number) => -v) },
                  { label: "Combined Net Income", values: result.combined.net_income, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "Standalone EPS ($)", values: result.acquirer_standalone.eps },
                  { label: "Combined EPS ($)", values: result.combined.eps, bold: true },
                  { label: "Accretion / Dilution (%)", values: result.accretion_dilution.pct_delta, bold: true },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            <TabsContent value="synergies">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>Synergy Build-up</CardTitle></CardHeader>
                  <FinancialChart data={synergyData} xKey="year"
                    series={[
                      { key: "Cost Synergies", label: "Cost Synergies", type: "bar" },
                      { key: "Revenue Synergies", label: "Revenue Synergies", type: "bar" },
                      { key: "Integration Costs", label: "Integration Costs", type: "bar" },
                      { key: "Net Synergies", label: "Net Synergies", type: "line" },
                    ]}
                  />
                </Card>
                <Card className="p-4">
                  <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                    rows={[
                      { label: "Cost Synergies", values: result.synergies.cost_synergies },
                      { label: "Revenue Synergies", values: result.synergies.revenue_synergies },
                      { label: "Total Gross Synergies", values: result.synergies.total_synergies, bold: true },
                      { label: "Integration Costs", values: result.synergies.integration_costs.map((v: number) => -v) },
                      { label: "Net Synergies", values: result.synergies.net_synergies, bold: true },
                    ]}
                    yearLabels={years}
                  />
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="credit">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Combined EBITDA", values: result.combined.ebitda, bold: true },
                  { label: "Combined Net Debt", values: result.credit_metrics ? [result.credit_metrics.combined_net_debt, ...Array(years.length - 1).fill(result.credit_metrics.combined_net_debt)] : [] },
                  { label: "Debt / EBITDA", values: result.credit_metrics?.debt_to_ebitda ?? [] },
                  { label: "Interest Coverage (×)", values: result.credit_metrics?.interest_coverage ?? [] },
                ]}
                yearLabels={years}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {!result && !mut.isPending && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50 space-y-2">
          <Play className="h-10 w-10" />
          <p className="text-sm">Enter acquirer and target details, then press Run Model</p>
        </div>
      )}
    </div>
  );
}
