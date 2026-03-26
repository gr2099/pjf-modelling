import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runAcquisitionModel } from "@/lib/api";
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
  name: "Platform Acquisition",
  purchase_price: 500_000_000,
  entry_ebitda_multiple: 10,
  exit_ebitda_multiple: 12,
  holding_period_years: 5,
  equity_pct: 0.40,
  debt_interest_rate: 0.07,
  ebitda_growth_rate: 0.10,
  revenue_synergies: 5_000_000,
  cost_savings: 8_000_000,
  tax_rate: 0.25,
};

export default function Acquisition() {
  const [form, setForm] = useState(DEFAULT);
  const mut = useMutation({ mutationFn: runAcquisitionModel });
  const result = mut.data;

  const update = (key: keyof typeof DEFAULT, value: unknown) =>
    setForm((p) => ({ ...p, [key]: value }));

  const years = result?.years ?? [];
  const chartData = years.map((y: number, i: number) => ({
    year: y,
    "Adj EBITDA": result?.operations.ebitda_adj[i],
    "Net Income": result?.operations.net_income[i],
    "Debt Balance": result?.operations.debt_balance[i],
    "FCF to Equity": result?.operations.fcf_to_equity[i],
  }));

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <div className="glass rounded-xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Deal Structure</h2>
          <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Model
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <Input label="Purchase Price ($)" type="number" value={form.purchase_price}
            onChange={(e) => update("purchase_price", +e.target.value)} />
          <Input label="Entry EV/EBITDA" type="number" value={form.entry_ebitda_multiple}
            onChange={(e) => update("entry_ebitda_multiple", +e.target.value)} step={0.5} />
          <Input label="Exit EV/EBITDA" type="number" value={form.exit_ebitda_multiple}
            onChange={(e) => update("exit_ebitda_multiple", +e.target.value)} step={0.5} />
          <Input label="Holding Period (yrs)" type="number" value={form.holding_period_years}
            onChange={(e) => update("holding_period_years", +e.target.value)} min={1} max={15} />
          <Input label="Equity %" type="number" value={form.equity_pct}
            onChange={(e) => update("equity_pct", +e.target.value)} step={0.01} />
          <Input label="Debt Interest Rate" type="number" value={form.debt_interest_rate}
            onChange={(e) => update("debt_interest_rate", +e.target.value)} step={0.005} />
          <Input label="EBITDA Growth Rate" type="number" value={form.ebitda_growth_rate}
            onChange={(e) => update("ebitda_growth_rate", +e.target.value)} step={0.01} />
          <Input label="Revenue Synergies ($)" type="number" value={form.revenue_synergies}
            onChange={(e) => update("revenue_synergies", +e.target.value)} />
          <Input label="Cost Savings ($)" type="number" value={form.cost_savings}
            onChange={(e) => update("cost_savings", +e.target.value)} />
          <Input label="Tax Rate" type="number" value={form.tax_rate}
            onChange={(e) => update("tax_rate", +e.target.value)} step={0.01} />
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
              { label: "Total Return ($)", value: fmt(result.key_metrics.total_return, { style: "currency" }), variant: "positive" as const },
              { label: "Entry Debt", value: fmt(result.entry.debt, { style: "currency" }) },
            ].map(({ label, value, variant = "default" as const }) => (
              <Card key={label} className="py-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <Badge variant={variant}>{value}</Badge>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="charts">
            <TabsList>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="table">Operations Detail</TabsTrigger>
            </TabsList>

            <TabsContent value="charts">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>EBITDA & Net Income</CardTitle></CardHeader>
                  <FinancialChart data={chartData} xKey="year"
                    series={[
                      { key: "Adj EBITDA", label: "Adj. EBITDA", type: "bar" },
                      { key: "Net Income", label: "Net Income", type: "bar" },
                      { key: "FCF to Equity", label: "FCF to Equity", type: "line" },
                    ]}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>Debt Paydown</CardTitle></CardHeader>
                  <FinancialChart data={chartData} xKey="year"
                    series={[{ key: "Debt Balance", label: "Debt Balance", type: "area" }]}
                  />
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="table">
              <DataTable
                columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "EBITDA", values: result.operations.ebitda, bold: false },
                  { label: "Synergies", values: result.operations.synergies },
                  { label: "Adj. EBITDA", values: result.operations.ebitda_adj, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "Interest", values: result.operations.interest.map((v: number) => -v) },
                  { label: "EBT", values: result.operations.ebt, bold: true },
                  { label: "Taxes", values: result.operations.taxes.map((v: number) => -v) },
                  { label: "Net Income", values: result.operations.net_income, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "Principal", values: result.operations.principal.map((v: number) => -v) },
                  { label: "FCF to Equity", values: result.operations.fcf_to_equity, bold: true },
                  { label: "Debt Balance", values: result.operations.debt_balance },
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
