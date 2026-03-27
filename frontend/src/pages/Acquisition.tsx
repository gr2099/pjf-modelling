import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runAcquisitionModel, exportAcquisitionXlsx } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FinancialChart } from "@/components/charts/FinancialChart";
import { DataTable } from "@/components/charts/DataTable";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, Download } from "lucide-react";

const DEFAULT = {
  name: "Platform Acquisition",
  purchase_price: 500_000_000,
  entry_ebitda_multiple: 10,
  exit_ebitda_multiple: 12,
  holding_period_years: 5,
  equity_pct: 0.40,
  debt_tranches: [],
  debt_interest_rate: 0.07,
  transaction_fees_pct: 0.015,
  ebitda_growth_rate: 0.10,
  capex_pct_revenue: 0.03,
  revenue_pct_purchase_price: 0.50,
  revenue_synergies: 5_000_000,
  cost_savings: 8_000_000,
  synergy_phase_in_years: 2,
  integration_costs: 10_000_000,
  working_capital_pct_revenue: 0.10,
  amortization_of_intangibles: 0.0,
  preferred_equity_pct: 0.0,
  preferred_return_rate: 0.08,
  carry_pct: 0.0,
  carry_hurdle: 0.08,
  tax_rate: 0.25,
};

export default function Acquisition() {
  const [form, setForm] = useState(DEFAULT);
  const mut = useMutation({ mutationFn: runAcquisitionModel });
  const result = mut.data;

  const update = (key: string, value: unknown) => {
    setForm((p) => ({ ...p, [key]: value }));
  };

  const years = result?.years ?? [];
  const km = result?.key_metrics ?? {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData = years.map((y: number, i: number) => ({
    year: y,
    "Adj EBITDA": result?.operations.ebitda_adj[i],
    "Net Income": result?.operations.net_income[i],
    "FCF to Equity": result?.operations.fcf_to_equity[i],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debtData = years.map((y: number, i: number) => ({
    year: y,
    "Debt Balance": result?.operations.debt_balance[i],
    "Debt/EBITDA": result?.credit_metrics?.debt_to_ebitda?.[i],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const synergyData = years.map((y: number, i: number) => ({
    year: y,
    "EBITDA (Base)": result?.operations.ebitda[i],
    Synergies: result?.operations.synergies[i],
    "Adj EBITDA": result?.operations.ebitda_adj[i],
  }));

  const entryEbitda = form.purchase_price / form.entry_ebitda_multiple;
  const entryDebt = form.purchase_price * (1 - form.equity_pct);
  const entryEquity = form.purchase_price * form.equity_pct;
  const txnFees = form.purchase_price * form.transaction_fees_pct;

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <div className="glass rounded-xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Deal Structure</h2>
          <div className="flex gap-2">
            {result && (
              <Button variant="outline" onClick={() => exportAcquisitionXlsx(form)}>
                <Download className="h-4 w-4" />Export Excel
              </Button>
            )}
            <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Model
            </Button>
          </div>
        </div>

        {/* Live Sources & Uses Preview */}
        <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-2 rounded-lg bg-muted/30 p-3 text-xs">
          <div><span className="text-muted-foreground">Entry EBITDA: </span><span className="font-mono font-semibold">{fmt(entryEbitda, { style: "compact" })}</span></div>
          <div><span className="text-muted-foreground">Senior Debt: </span><span className="font-mono font-semibold">{fmt(entryDebt, { style: "compact" })}</span></div>
          <div><span className="text-muted-foreground">Equity: </span><span className="font-mono font-semibold">{fmt(entryEquity, { style: "compact" })}</span></div>
          <div><span className="text-muted-foreground">Txn Fees: </span><span className="font-mono">{fmt(txnFees, { style: "compact" })}</span></div>
          <div><span className="text-muted-foreground">Debt/EBITDA: </span><span className="font-mono">{(entryDebt / entryEbitda).toFixed(1)}×</span></div>
          <div><span className="text-muted-foreground">Entry Multiple: </span><span className="font-mono">{form.entry_ebitda_multiple}×</span></div>
          <div><span className="text-muted-foreground">Exit Multiple: </span><span className="font-mono">{form.exit_ebitda_multiple}×</span></div>
          <div><span className="text-muted-foreground">Hold Period: </span><span className="font-mono">{form.holding_period_years}y</span></div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Transaction</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="Purchase Price ($)" type="number" value={form.purchase_price}
              onChange={(e) => update("purchase_price", +e.target.value)} />
            <Input label="Entry EV/EBITDA" type="number" value={form.entry_ebitda_multiple}
              onChange={(e) => update("entry_ebitda_multiple", +e.target.value)} step={0.5} />
            <Input label="Exit EV/EBITDA" type="number" value={form.exit_ebitda_multiple}
              onChange={(e) => update("exit_ebitda_multiple", +e.target.value)} step={0.5} />
            <Input label="Holding Period (yrs)" type="number" value={form.holding_period_years}
              onChange={(e) => update("holding_period_years", +e.target.value)} min={1} max={15} />
            <Input label="Transaction Fees %" type="number" value={form.transaction_fees_pct}
              onChange={(e) => update("transaction_fees_pct", +e.target.value)} step={0.005} />
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Financing</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="Equity %" type="number" value={form.equity_pct}
              onChange={(e) => update("equity_pct", +e.target.value)} step={0.01} />
            <Input label="Debt Interest Rate" type="number" value={form.debt_interest_rate}
              onChange={(e) => update("debt_interest_rate", +e.target.value)} step={0.005} />
            <Input label="Preferred Equity %" type="number" value={form.preferred_equity_pct}
              onChange={(e) => update("preferred_equity_pct", +e.target.value)} step={0.01} />
            <Input label="Preferred Return %" type="number" value={form.preferred_return_rate}
              onChange={(e) => update("preferred_return_rate", +e.target.value)} step={0.01} />
            <Input label="Carry % (above hurdle)" type="number" value={form.carry_pct}
              onChange={(e) => update("carry_pct", +e.target.value)} step={0.01} />
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operations & Synergies</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="EBITDA Growth Rate" type="number" value={form.ebitda_growth_rate}
              onChange={(e) => update("ebitda_growth_rate", +e.target.value)} step={0.01} />
            <Input label="Revenue Synergies ($)" type="number" value={form.revenue_synergies}
              onChange={(e) => update("revenue_synergies", +e.target.value)} />
            <Input label="Cost Savings ($)" type="number" value={form.cost_savings}
              onChange={(e) => update("cost_savings", +e.target.value)} />
            <Input label="Synergy Phase-in (yrs)" type="number" value={form.synergy_phase_in_years}
              onChange={(e) => update("synergy_phase_in_years", +e.target.value)} min={1} />
            <Input label="Integration Costs ($)" type="number" value={form.integration_costs}
              onChange={(e) => update("integration_costs", +e.target.value)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="Tax Rate" type="number" value={form.tax_rate}
              onChange={(e) => update("tax_rate", +e.target.value)} step={0.01} />
            <Input label="CapEx % Revenue" type="number" value={form.capex_pct_revenue}
              onChange={(e) => update("capex_pct_revenue", +e.target.value)} step={0.005} />
            <Input label="Working Capital % Rev." type="number" value={form.working_capital_pct_revenue}
              onChange={(e) => update("working_capital_pct_revenue", +e.target.value)} step={0.01} />
            <Input label="Intangibles Amort. ($/yr)" type="number" value={form.amortization_of_intangibles}
              onChange={(e) => update("amortization_of_intangibles", +e.target.value)} />
          </div>
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Entry EBITDA", value: fmt(result.entry.entry_ebitda, { style: "currency" }) },
              { label: "Equity Invested", value: fmt(result.entry.equity_invested, { style: "currency" }) },
              { label: "Exit EV", value: fmt(result.exit.exit_ev, { style: "currency" }), variant: "neutral" as const },
              { label: "Exit Equity Proceeds", value: fmt(result.exit.exit_equity_proceeds, { style: "currency" }), variant: "positive" as const },
              { label: "Equity IRR", value: fmt(result.returns.equity_irr, { style: "percent" }), variant: (result.returns.equity_irr ?? 0) > 0.2 ? "positive" as const : "warning" as const },
              { label: "MOIC", value: `${fmt(result.returns.moic, { style: "decimal", decimals: 2 })}×`, variant: (result.returns.moic ?? 0) > 2 ? "positive" as const : "warning" as const },
              { label: "Entry Leverage", value: `${fmt(km.entry_leverage, { style: "decimal", decimals: 1 })}× D/EBITDA` },
              { label: "Exit Leverage", value: `${fmt(km.exit_leverage, { style: "decimal", decimals: 1 })}× D/EBITDA` },
            ].map(({ label, value, variant = "default" as const }) => (
              <Card key={label} className="py-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <Badge variant={variant}>{value}</Badge>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="sources">
            <TabsList>
              <TabsTrigger value="sources">Sources & Uses</TabsTrigger>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="table">Operations</TabsTrigger>
              <TabsTrigger value="waterfall">Returns Waterfall</TabsTrigger>
              <TabsTrigger value="credit">Credit Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="sources">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Uses of Funds</p>
                  <div className="space-y-2 text-sm">
                    {Object.entries(result.sources_uses?.uses ?? {}).map(([k, v]: [string, any]) => (
                      <div key={k} className="flex justify-between">
                        <span className={k === "total_uses" ? "font-semibold" : "text-muted-foreground"}>
                          {k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        <span className="font-mono">{fmt(v, { style: "currency" })}</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Sources of Funds</p>
                  <div className="space-y-2 text-sm">
                    {Object.entries(result.sources_uses?.sources ?? {}).map(([k, v]: [string, any]) => (
                      <div key={k} className="flex justify-between">
                        <span className={k === "total_sources" ? "font-semibold" : "text-muted-foreground"}>
                          {k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        <span className="font-mono">{fmt(v, { style: "currency" })}</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-4 md:col-span-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Entry Leverage Metrics</p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {Object.entries(result.sources_uses?.leverage_metrics ?? {}).map(([k, v]: [string, any]) => (
                      <div key={k}>
                        <p className="text-muted-foreground text-xs">{k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
                        <p className="font-mono font-semibold">{typeof v === "number" && v < 100 ? v.toFixed(2) + (k.includes("pct") ? "%" : "×") : fmt(v, { style: "decimal", decimals: 2 })}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="charts">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>EBITDA Build (Synergies)</CardTitle></CardHeader>
                  <FinancialChart data={synergyData} xKey="year"
                    series={[
                      { key: "EBITDA (Base)", label: "EBITDA Base", type: "bar" },
                      { key: "Synergies", label: "Synergies", type: "bar" },
                      { key: "Adj EBITDA", label: "Adj EBITDA", type: "line" },
                    ]}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>FCF & Debt Paydown</CardTitle></CardHeader>
                  <FinancialChart data={[...chartData, ...debtData.map((d: any, i: number) => ({...chartData[i], ...d}))].slice(0, chartData.length)} xKey="year"
                    series={[
                      { key: "FCF to Equity", label: "FCF to Equity", type: "bar" },
                      { key: "Debt Balance", label: "Debt Balance", type: "line" },
                    ]}
                  />
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="table">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "EBITDA (Standalone)", values: result.operations.ebitda },
                  { label: "Synergies", values: result.operations.synergies },
                  { label: "Integration Costs", values: result.operations.integration_costs.map((v: number) => -v) },
                  { label: "Adj. EBITDA", values: result.operations.ebitda_adj, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "Amortization", values: result.operations.amortization_intangibles?.map((v: number) => -v) ?? [] },
                  { label: "CapEx", values: result.operations.capex.map((v: number) => -v) },
                  { label: "ΔNWC", values: result.operations.delta_nwc.map((v: number) => -v) },
                  { label: "Interest", values: result.operations.interest.map((v: number) => -v) },
                  { label: "EBT", values: result.operations.ebt, bold: true },
                  { label: "Taxes", values: result.operations.taxes.map((v: number) => -v) },
                  { label: "Net Income", values: result.operations.net_income, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "Principal", values: result.operations.principal.map((v: number) => -v) },
                  { label: "FCF to Equity", values: result.operations.fcf_to_equity, bold: true },
                  { label: "Debt Balance", values: result.operations.debt_balance },
                  { label: "DSCR", values: result.operations.dscr },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            <TabsContent value="waterfall">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Exit Proceeds Waterfall</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Exit EV</span><span className="font-mono">{fmt(result.exit.exit_ev, { style: "currency" })}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Less: Debt Repayment</span><span className="font-mono text-destructive">({fmt(result.exit.exit_debt, { style: "currency" })})</span></div>
                    <div className="flex justify-between font-semibold"><span>Total Equity Proceeds</span><span className="font-mono">{fmt(result.exit.exit_equity_proceeds, { style: "currency" })}</span></div>
                    {result.returns_waterfall?.preferred_equity?.invested > 0 && (
                      <>
                        <div className="border-t border-border/30 pt-2 flex justify-between"><span className="text-muted-foreground">Preferred Return</span><span className="font-mono text-destructive">({fmt(result.returns_waterfall.preferred_equity.total_return, { style: "currency" })})</span></div>
                        <div className="flex justify-between font-semibold"><span>Available for Common</span><span className="font-mono">{fmt(result.returns_waterfall.common_equity.exit_proceeds, { style: "currency" })}</span></div>
                      </>
                    )}
                    {result.returns_waterfall?.carry > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Carry</span><span className="font-mono text-destructive">({fmt(result.returns_waterfall.carry, { style: "currency" })})</span></div>
                    )}
                  </div>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Returns Summary</p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span>Equity IRR</span>
                      <Badge variant={(result.returns.equity_irr ?? 0) > 0.2 ? "positive" : "warning"}>
                        {fmt(result.returns.equity_irr, { style: "percent" })}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>MOIC</span>
                      <Badge variant={(result.returns.moic ?? 0) > 2 ? "positive" : "warning"}>
                        {fmt(result.returns.moic, { style: "decimal", decimals: 2 })}×
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Equity Invested</span>
                      <span className="font-mono">{fmt(result.entry.equity_invested, { style: "currency" })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Exit Equity</span>
                      <span className="font-mono">{fmt(result.exit.exit_equity_proceeds, { style: "currency" })}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total Return</span>
                      <span className="font-mono">{fmt(km.total_return, { style: "currency" })}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="credit">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Adj. EBITDA", values: result.operations.ebitda_adj, bold: true },
                  { label: "Total Interest", values: result.operations.interest.map((v: number) => -v) },
                  { label: "Debt Balance", values: result.operations.debt_balance },
                  { label: "Debt / EBITDA", values: result.credit_metrics?.debt_to_ebitda ?? [] },
                  { label: "Interest Coverage (EBITDA/Int.)", values: result.credit_metrics?.interest_coverage ?? [] },
                  { label: "DSCR", values: result.operations.dscr, bold: true },
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
          <p className="text-sm">Enter deal parameters and press Run Model</p>
        </div>
      )}
    </div>
  );
}
