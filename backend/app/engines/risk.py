"""
Risk analysis engine: sensitivity, scenario, break-even, tornado, spider.
"""
from __future__ import annotations
import numpy as np
from app.engines.valuation import dcf_valuation


def sensitivity_table(
    base_fcfs: list[float],
    discount_rate: float,
    terminal_growth_rate: float,
    variable_name: str,
    base_value: float,
    test_values: list[float],
    fcf_fn,  # callable(value) -> list[float]
) -> dict:
    results = []
    for v in test_values:
        fcfs = fcf_fn(v)
        val = dcf_valuation(fcfs, discount_rate, terminal_growth_rate)
        results.append({"value": v, "npv": val["enterprise_value"]})

    base_npv = dcf_valuation(base_fcfs, discount_rate, terminal_growth_rate)["enterprise_value"]
    return {
        "variable": variable_name,
        "base_value": base_value,
        "base_npv": base_npv,
        "results": results,
    }


def tornado_data(sensitivities: list[dict]) -> list[dict]:
    """
    sensitivities: list of {variable, base_npv, npv_at_low, npv_at_high}
    Returns sorted tornado rows (largest swing first).
    """
    rows = []
    for s in sensitivities:
        swing = abs(s["npv_at_high"] - s["npv_at_low"])
        rows.append({
            "variable": s["variable"],
            "base_npv": s["base_npv"],
            "npv_at_low": s["npv_at_low"],
            "npv_at_high": s["npv_at_high"],
            "swing": swing,
            "low_delta": s["npv_at_low"] - s["base_npv"],
            "high_delta": s["npv_at_high"] - s["base_npv"],
        })
    rows.sort(key=lambda x: x["swing"], reverse=True)
    return rows


def break_even_analysis(
    base_fcfs: list[float],
    discount_rate: float,
    terminal_growth_rate: float,
    variable_range: tuple[float, float],
    fcf_fn,
    target_npv: float = 0.0,
    n_points: int = 50,
) -> dict:
    lo, hi = variable_range
    values = np.linspace(lo, hi, n_points)
    npvs = []
    for v in values:
        fcfs = fcf_fn(v)
        val = dcf_valuation(fcfs, discount_rate, terminal_growth_rate)
        npvs.append(val["enterprise_value"])

    # Find break-even by interpolation
    npv_arr = np.array(npvs) - target_npv
    break_even = None
    for i in range(len(npv_arr) - 1):
        if npv_arr[i] * npv_arr[i + 1] <= 0:
            # Linear interpolation
            t = npv_arr[i] / (npv_arr[i] - npv_arr[i + 1])
            break_even = float(values[i] + t * (values[i + 1] - values[i]))
            break

    return {
        "values": values.tolist(),
        "npvs": npvs,
        "break_even": break_even,
        "target_npv": target_npv,
    }


def waterfall_data(
    base_npv: float,
    impacts: list[dict],  # [{label, delta}]
) -> list[dict]:
    """Build waterfall chart data."""
    rows = [{"label": "Base Case", "value": base_npv, "running": base_npv, "type": "total"}]
    running = base_npv
    for item in impacts:
        running += item["delta"]
        rows.append({
            "label": item["label"],
            "value": item["delta"],
            "running": running,
            "type": "positive" if item["delta"] >= 0 else "negative",
        })
    rows.append({"label": "Final", "value": running, "running": running, "type": "total"})
    return rows
