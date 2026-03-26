"""
Valuation engine: DCF, IRR, WACC, terminal value.
"""
from __future__ import annotations
import numpy as np
from scipy.optimize import brentq


def npv(rate: float, cash_flows: list[float], mid_year: bool = False) -> float:
    offset = 0.5 if mid_year else 1.0
    return sum(cf / (1 + rate) ** (i + offset) for i, cf in enumerate(cash_flows))


def irr(cash_flows: list[float]) -> float | None:
    """Calculate IRR using Brent's method."""
    try:
        return brentq(lambda r: npv(r, cash_flows, mid_year=False), -0.9999, 100.0, xtol=1e-8)
    except ValueError:
        return None


def terminal_value_gordon(fcf_last: float, growth_rate: float, discount_rate: float) -> float:
    if discount_rate <= growth_rate:
        return float("inf")
    return fcf_last * (1 + growth_rate) / (discount_rate - growth_rate)


def terminal_value_multiple(ebitda_last: float, ev_ebitda_multiple: float) -> float:
    return ebitda_last * ev_ebitda_multiple


def dcf_valuation(
    free_cash_flows: list[float],
    discount_rate: float,
    terminal_growth_rate: float,
    net_debt: float = 0.0,
    shares_outstanding: float | None = None,
    mid_year: bool = True,
) -> dict:
    n = len(free_cash_flows)
    tv = terminal_value_gordon(free_cash_flows[-1], terminal_growth_rate, discount_rate)

    # PV of explicit FCFs
    pv_fcfs = [cf / (1 + discount_rate) ** (i + (0.5 if mid_year else 1.0)) for i, cf in enumerate(free_cash_flows)]
    pv_terminal = tv / (1 + discount_rate) ** (n - (0.5 if mid_year else 0.0))

    enterprise_value = sum(pv_fcfs) + pv_terminal
    equity_value = enterprise_value - net_debt

    result = {
        "pv_fcfs": pv_fcfs,
        "sum_pv_fcfs": sum(pv_fcfs),
        "terminal_value": tv,
        "pv_terminal_value": pv_terminal,
        "terminal_value_pct": pv_terminal / enterprise_value * 100 if enterprise_value != 0 else 0.0,
        "enterprise_value": enterprise_value,
        "net_debt": net_debt,
        "equity_value": equity_value,
    }

    if shares_outstanding:
        result["price_per_share"] = equity_value / shares_outstanding

    return result


def wacc(
    equity_value: float,
    debt_value: float,
    cost_of_equity: float,
    cost_of_debt: float,
    tax_rate: float,
) -> dict:
    total = equity_value + debt_value
    if total == 0:
        return {"wacc": 0.0, "equity_weight": 0.0, "debt_weight": 0.0}
    we = equity_value / total
    wd = debt_value / total
    w = we * cost_of_equity + wd * cost_of_debt * (1 - tax_rate)
    return {
        "wacc": w,
        "equity_weight": we,
        "debt_weight": wd,
        "after_tax_cost_of_debt": cost_of_debt * (1 - tax_rate),
    }


def implied_ev_ebitda(
    growth_rate: float,
    roic: float,
    wacc_rate: float,
) -> float:
    """Implied EV/EBITDA multiple from fundamentals (Modigliani-Miller based)."""
    if wacc_rate <= growth_rate:
        return float("inf")
    reinvestment_rate = growth_rate / roic if roic > 0 else 0.0
    nopat_margin = 1.0 - reinvestment_rate
    return nopat_margin / (wacc_rate - growth_rate)
