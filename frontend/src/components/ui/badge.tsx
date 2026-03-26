import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "positive" | "negative" | "warning" | "neutral";

const variants: Record<BadgeVariant, string> = {
  default: "bg-secondary text-foreground",
  positive: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  negative: "bg-red-500/15 text-red-400 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  neutral: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

export function Badge({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium number",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
