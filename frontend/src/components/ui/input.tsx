import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, type, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-muted-foreground">{label}</label>}
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-input bg-secondary/50 px-3 py-2 text-sm number placeholder:text-muted-foreground/50",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
          "transition-all",
          error && "border-destructive",
          className
        )}
        ref={ref}
        {...props}
      />
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";
