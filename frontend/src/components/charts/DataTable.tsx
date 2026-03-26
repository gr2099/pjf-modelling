import { cn, fmt } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  format?: "currency" | "percent" | "decimal" | "compact";
  decimals?: number;
  highlight?: boolean;
}

interface DataTableProps {
  columns: Column[];
  rows: { label: string; values: (number | null)[]; bold?: boolean; separator?: boolean }[];
  yearLabels: (string | number)[];
  className?: string;
}

export function DataTable({ columns: _cols, rows, yearLabels, className }: DataTableProps) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border/50", className)}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50 bg-secondary/30">
            <th className="sticky left-0 bg-secondary/30 px-4 py-2.5 text-left font-semibold text-muted-foreground w-48">
              Metric
            </th>
            {yearLabels.map((y) => (
              <th key={y} className="px-3 py-2.5 text-right font-medium text-muted-foreground number min-w-[80px]">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.separator) {
              return (
                <tr key={i}>
                  <td colSpan={yearLabels.length + 1} className="border-t border-border/30 py-0.5" />
                </tr>
              );
            }
            return (
              <tr
                key={i}
                className={cn(
                  "border-b border-border/20 transition-colors hover:bg-accent/30",
                  row.bold && "bg-secondary/20"
                )}
              >
                <td
                  className={cn(
                    "sticky left-0 bg-card/50 px-4 py-2 text-left",
                    row.bold ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {row.label}
                </td>
                {row.values.map((v, j) => (
                  <td
                    key={j}
                    className={cn(
                      "px-3 py-2 text-right number",
                      row.bold ? "font-semibold text-foreground" : "text-foreground/80",
                      v != null && v < 0 && "text-red-400",
                      v != null && v > 0 && row.bold && "text-foreground"
                    )}
                  >
                    {v == null
                      ? "—"
                      : fmt(v, {
                          style: _cols[0]?.format ?? "currency",
                          decimals: _cols[0]?.decimals,
                        })}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
