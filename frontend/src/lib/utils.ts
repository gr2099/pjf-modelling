import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(value: number | null | undefined, opts?: {
  style?: "currency" | "percent" | "decimal" | "compact";
  decimals?: number;
  prefix?: string;
}): string {
  if (value == null || !isFinite(value)) return "—";
  const { style = "decimal", decimals, prefix = "" } = opts ?? {};

  if (style === "currency") {
    const d = decimals ?? (Math.abs(value) >= 1e6 ? 1 : 0);
    if (Math.abs(value) >= 1e9) return `${prefix}$${(value / 1e9).toFixed(d)}B`;
    if (Math.abs(value) >= 1e6) return `${prefix}$${(value / 1e6).toFixed(d)}M`;
    if (Math.abs(value) >= 1e3) return `${prefix}$${(value / 1e3).toFixed(d)}K`;
    return `${prefix}$${value.toFixed(decimals ?? 0)}`;
  }
  if (style === "percent") {
    return `${(value * 100).toFixed(decimals ?? 1)}%`;
  }
  if (style === "compact") {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toFixed(decimals ?? 0);
  }
  return value.toFixed(decimals ?? 2);
}

export function fmtPct(value: number | null | undefined, decimals = 1): string {
  return fmt(value, { style: "percent", decimals });
}

export function pctChange(a: number, b: number): number {
  return b === 0 ? 0 : (a - b) / Math.abs(b);
}

export const API = "/api";
