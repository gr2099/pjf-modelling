"""
Valuation engine: DCF, IRR, WACC (CAPM), all 4 terminal value methods,
normalized FCF, football field, comparable company analysis.
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
    except (ValueError, RuntimeError):
        return None


# ── Terminal Value — Four Methods ─────────────────────────────────────────────

def tv_gordon_growth(fcf_last: float, growth_rate: float, discount_rate: float) -> float:
    """Method 1: Gordon Growth Model (Stable Growth)."""
    if discount_rate <= growth_rate:
        return 0.0
    return fcf_last * (1 + growth_rate) / (discount_rate - growth_rate)


def tv_ev_ebitda(ebitda_last: float, ev_ebitda_multiple: float) -> float:
    """Method 2: EV/EBITDA Exit Multiple."""
    return ebitda_last * ev_ebitda_multiple


def tv_value_driver(
    nopat_last: float,
    roic: float,
    wacc: float,
    growth_rate: float,
) -> float:
    """
    Method 3: Value Driver Formula
    TV = NOPAT × (1 - g/ROIC) / (WACC - g)
    Explicitly models the value created by growth given returns above cost of capital.
    """
    if wacc <= growth_rate:
        return 0.0
    if roic <= 0:
        return 0.0
    reinvestment_rate = growth_rate / roic
    payout = max(1.0 - reinvestment_rate, 0.0)
    return nopat_last * payout / (wacc - growth_rate)


def tv_implied_multiple(
    ebitda_last: float,
    growth_rate: float,
    roic: float,
    wacc: float,
    tax_rate: float = 0.25,
    dep_capex_ratio: float = 1.0,
) -> tuple[float, float]:
    """
    Method 4: Implied EV/EBITDA from value driver fundamentals.
    Returns (implied_multiple, terminal_value).
    """
    if wacc <= growth_rate or roic <= 0:
        return 0.0, 0.0
    reinvestment_rate = growth_rate / roic
    nopat_margin = max(1.0 - reinvestment_rate, 0.0)
    # TV = NOPAT × payout / (WACC - g); NOPAT ≈ EBITDA × (1-tax) × adj
    nopat_approx = ebitda_last * (1 - tax_rate) * dep_capex_ratio
    tv = nopat_approx * nopat_margin / (wacc - growth_rate)
    implied_mult = tv / ebitda_last if ebitda_last > 0 else 0.0
    return round(implied_mult, 2), tv


def normalize_terminal_fcf(
    fcf_last: float,
    depreciation_last: float,
    capex_dep_ratio: float,
    wc_pct_revenue: float,
    revenue_last: float,
    revenue_growth_terminal: float,
) -> dict:
    """
    Normalize terminal year FCF to reflect steady-state economics:
    - CapEx converges to depreciation × normalized ratio
    - Working capital investment = WC% × ΔRevenue
    """
    norm_capex = depreciation_last * capex_dep_ratio
    delta_rev = revenue_last * revenue_growth_terminal
    norm_delta_wc = wc_pct_revenue * delta_rev
    norm_fcf = fcf_last - (norm_capex - depreciation_last) - norm_delta_wc
    return {
        "normalized_fcf": norm_fcf,
        "normalized_capex": norm_capex,
        "normalized_delta_wc": norm_delta_wc,
        "capex_dep_ratio_used": capex_dep_ratio,
        "adjustment": norm_fcf - fcf_last,
    }


# ── DCF Valuation ─────────────────────────────────────────────────────────────

def dcf_valuation(
    free_cash_flows: list[float],
    discount_rate: float,
    terminal_growth_rate: float,
    net_debt: float = 0.0,
    shares_outstanding: float | None = None,
    mid_year: bool = True,
    ebitda_last: float = 0.0,
    ev_ebitda_multiple: float = 10.0,
    roic: float = 0.15,
    nopat_last: float = 0.0,
    tv_method: str = "gordon_growth",
    minority_interest: float = 0.0,
    pension_deficit: float = 0.0,
    # Normalization
    normalized_capex_dep_ratio: float = 1.05,
    wc_pct_revenue: float = 0.10,
    depreciation_last: float = 0.0,
    revenue_last: float = 0.0,
    revenue_growth_terminal: float | None = None,
) -> dict:
    n = len(free_cash_flows)
    last_fcf = free_cash_flows[-1]
    rgr = revenue_growth_terminal if revenue_growth_terminal is not None else terminal_growth_rate

    # Normalization adjustment
    norm = None
    if depreciation_last > 0:
        norm = normalize_terminal_fcf(
            last_fcf, depreciation_last, normalized_capex_dep_ratio,
            wc_pct_revenue, revenue_last, rgr
        )
        normalized_last_fcf = norm["normalized_fcf"]
    else:
        normalized_last_fcf = last_fcf

    # ── All 4 terminal values ─────────────────────────────────────────────
    tv_gordon = tv_gordon_growth(normalized_last_fcf, terminal_growth_rate, discount_rate)
    tv_multiple = tv_ev_ebitda(ebitda_last, ev_ebitda_multiple)
    tv_vd = tv_value_driver(
        nopat_last if nopat_last else normalized_last_fcf * 0.8,
        roic, discount_rate, terminal_growth_rate
    )
    implied_mult, tv_impl = tv_implied_multiple(ebitda_last, terminal_growth_rate, roic, discount_rate)

    # Select TV based on method
    tv_map = {
        "gordon_growth": tv_gordon,
        "ev_ebitda": tv_multiple,
        "value_driver": tv_vd,
        "implied_multiple": tv_impl,
    }
    primary_tv = tv_map.get(tv_method, tv_gordon)
    if tv_method == "all":
        primary_tv = tv_gordon  # default to Gordon for primary

    # PV of explicit FCFs
    pv_fcfs = [cf / (1 + discount_rate) ** (i + (0.5 if mid_year else 1.0))
               for i, cf in enumerate(free_cash_flows)]

    # PV of terminal value
    pv_tv_gordon = tv_gordon / (1 + discount_rate) ** (n - (0.5 if mid_year else 0.0))
    pv_tv_multiple = tv_multiple / (1 + discount_rate) ** (n - (0.5 if mid_year else 0.0))
    pv_tv_vd = tv_vd / (1 + discount_rate) ** (n - (0.5 if mid_year else 0.0))
    pv_tv_impl = tv_impl / (1 + discount_rate) ** (n - (0.5 if mid_year else 0.0))
    pv_tv_primary = pv_tv_gordon if tv_method in ("gordon_growth", "all") else tv_map.get(tv_method, tv_gordon) / (1 + discount_rate) ** (n - (0.5 if mid_year else 0.0))

    sum_pv_fcfs = sum(pv_fcfs)

    # Enterprise values under each TV method
    ev_gordon = sum_pv_fcfs + pv_tv_gordon
    ev_multiple = sum_pv_fcfs + pv_tv_multiple
    ev_vd = sum_pv_fcfs + pv_tv_vd
    ev_impl = sum_pv_fcfs + pv_tv_impl

    enterprise_value = sum_pv_fcfs + pv_tv_primary

    # EV → Equity bridge
    equity_value = enterprise_value - net_debt - minority_interest - pension_deficit
    equity_value_gordon = ev_gordon - net_debt
    equity_value_multiple = ev_multiple - net_debt
    equity_value_vd = ev_vd - net_debt

    # Football field — range across methods
    ev_values = [v for v in [ev_gordon, ev_multiple, ev_vd, ev_impl] if v > 0]
    football_field = {
        "min_ev": min(ev_values) if ev_values else 0.0,
        "max_ev": max(ev_values) if ev_values else 0.0,
        "methods": {
            "gordon_growth": {"ev": ev_gordon, "equity_value": equity_value_gordon,
                              "tv": tv_gordon, "pv_tv": pv_tv_gordon,
                              "tv_pct": pv_tv_gordon / ev_gordon * 100 if ev_gordon > 0 else 0},
            "ev_ebitda_exit": {"ev": ev_multiple, "equity_value": equity_value_multiple,
                               "tv": tv_multiple, "pv_tv": pv_tv_multiple,
                               "tv_pct": pv_tv_multiple / ev_multiple * 100 if ev_multiple > 0 else 0,
                               "implied_multiple": ev_ebitda_multiple},
            "value_driver": {"ev": ev_vd, "equity_value": equity_value_vd,
                             "tv": tv_vd, "pv_tv": pv_tv_vd,
                             "tv_pct": pv_tv_vd / ev_vd * 100 if ev_vd > 0 else 0},
            "implied_multiple": {"ev": ev_impl, "equity_value": ev_impl - net_debt,
                                 "tv": tv_impl, "pv_tv": pv_tv_impl,
                                 "implied_ev_ebitda": implied_mult,
                                 "tv_pct": pv_tv_impl / ev_impl * 100 if ev_impl > 0 else 0},
        }
    }

    result = {
        "pv_fcfs": pv_fcfs,
        "sum_pv_fcfs": sum_pv_fcfs,
        "terminal_value": primary_tv,
        "pv_terminal_value": pv_tv_primary,
        "terminal_value_pct": pv_tv_primary / enterprise_value * 100 if enterprise_value > 0 else 0.0,
        "enterprise_value": enterprise_value,
        "net_debt": net_debt,
        "minority_interest": minority_interest,
        "equity_value": equity_value,
        "football_field": football_field,
        "normalization": norm,
        "tv_gordon": tv_gordon,
        "tv_multiple": tv_multiple,
        "tv_value_driver": tv_vd,
        "tv_implied": tv_impl,
        "implied_ev_ebitda": implied_mult,
        "all_terminal_values": {
            "gordon_growth": tv_gordon,
            "ev_ebitda_exit": tv_multiple,
            "value_driver": tv_vd,
            "implied_multiple": tv_impl,
        }
    }

    if shares_outstanding:
        result["price_per_share"] = equity_value / shares_outstanding
        result["ev_per_share"] = enterprise_value / shares_outstanding

    return result


# ── WACC ─────────────────────────────────────────────────────────────────────

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
        "wacc": round(w, 6),
        "equity_weight": round(we, 4),
        "debt_weight": round(wd, 4),
        "after_tax_cost_of_debt": round(cost_of_debt * (1 - tax_rate), 6),
        "cost_of_equity": round(cost_of_equity, 6),
    }


def wacc_capm(
    risk_free_rate: float,
    equity_risk_premium: float,
    beta: float,
    size_premium: float,
    country_risk_premium: float,
    company_specific_premium: float,
    cost_of_debt_pretax: float,
    tax_rate: float,
    debt_value: float,
    equity_value: float,
    target_debt_to_equity: float | None = None,
    beta_unlevered: float | None = None,
) -> dict:
    """Full CAPM-based WACC calculation with re-levering."""
    total = equity_value + debt_value
    if total == 0:
        return {"error": "Zero total capital"}

    # Capital structure weights
    if target_debt_to_equity is not None:
        wd = target_debt_to_equity / (1 + target_debt_to_equity)
        we = 1.0 / (1 + target_debt_to_equity)
    else:
        we = equity_value / total
        wd = debt_value / total

    # Re-lever beta if unlevered beta provided
    if beta_unlevered is not None and wd > 0:
        # Hamada: βL = βU × [1 + (1-t) × D/E]
        de_ratio = wd / we if we > 0 else 0
        beta_levered = beta_unlevered * (1 + (1 - tax_rate) * de_ratio)
    else:
        beta_levered = beta

    # CAPM cost of equity
    cost_of_equity = (
        risk_free_rate
        + beta_levered * equity_risk_premium
        + size_premium
        + country_risk_premium
        + company_specific_premium
    )

    # After-tax cost of debt
    after_tax_cod = cost_of_debt_pretax * (1 - tax_rate)

    # WACC
    wacc_rate = we * cost_of_equity + wd * after_tax_cod

    # Unlever for reference
    de_ratio = wd / we if we > 0 else 0
    beta_unlevered_calc = beta_levered / (1 + (1 - tax_rate) * de_ratio)

    return {
        "wacc": round(wacc_rate, 6),
        "cost_of_equity": round(cost_of_equity, 6),
        "cost_of_debt_pretax": round(cost_of_debt_pretax, 6),
        "after_tax_cost_of_debt": round(after_tax_cod, 6),
        "equity_weight": round(we, 4),
        "debt_weight": round(wd, 4),
        "beta_levered": round(beta_levered, 4),
        "beta_unlevered": round(beta_unlevered_calc, 4),
        "capm_components": {
            "risk_free_rate": round(risk_free_rate, 6),
            "equity_risk_premium": round(equity_risk_premium, 6),
            "beta_contribution": round(beta_levered * equity_risk_premium, 6),
            "size_premium": round(size_premium, 6),
            "country_risk_premium": round(country_risk_premium, 6),
            "company_specific": round(company_specific_premium, 6),
        },
        "cost_of_equity_breakdown": {
            "risk_free_rate": round(risk_free_rate, 6),
            "market_premium": round(beta_levered * equity_risk_premium, 6),
            "size_premium": round(size_premium, 6),
            "country_premium": round(country_risk_premium, 6),
            "total_coe": round(cost_of_equity, 6),
        }
    }


# ── Comparable Company Analysis ────────────────────────────────────────────────

def comparable_analysis(
    comparables: list[dict],
    target_ebitda: float,
    target_revenue: float,
    target_net_income: float,
    net_debt: float = 0.0,
) -> dict:
    if not comparables:
        return {}

    ev_ebitda_multiples = [c["ev"] / c["ebitda"] for c in comparables if c.get("ebitda", 0) > 0]
    ev_revenue_multiples = [c["ev"] / c["revenue"] for c in comparables if c.get("revenue", 0) > 0]
    pe_multiples = [
        c["ev"] / c["net_income"] for c in comparables if c.get("net_income", 0) > 0
    ]

    def _stats(vals: list[float]) -> dict:
        if not vals:
            return {"min": 0, "median": 0, "max": 0, "mean": 0}
        arr = sorted(vals)
        mid = len(arr) // 2
        median = arr[mid] if len(arr) % 2 else (arr[mid - 1] + arr[mid]) / 2
        return {
            "min": round(min(arr), 2),
            "q1": round(arr[len(arr) // 4], 2),
            "median": round(median, 2),
            "q3": round(arr[3 * len(arr) // 4], 2),
            "max": round(max(arr), 2),
            "mean": round(sum(arr) / len(arr), 2),
        }

    ev_ebitda_stats = _stats(ev_ebitda_multiples)
    ev_rev_stats = _stats(ev_revenue_multiples)

    # Implied EVs for target
    implied_ev_from_ebitda = {
        "low": ev_ebitda_stats["q1"] * target_ebitda,
        "median": ev_ebitda_stats["median"] * target_ebitda,
        "high": ev_ebitda_stats["q3"] * target_ebitda,
    }
    implied_ev_from_revenue = {
        "low": ev_rev_stats["q1"] * target_revenue,
        "median": ev_rev_stats["median"] * target_revenue,
        "high": ev_rev_stats["q3"] * target_revenue,
    }

    return {
        "ev_ebitda_stats": ev_ebitda_stats,
        "ev_revenue_stats": ev_rev_stats,
        "pe_stats": _stats(pe_multiples),
        "implied_ev_from_ebitda": implied_ev_from_ebitda,
        "implied_ev_from_revenue": implied_ev_from_revenue,
        "implied_equity_value_from_ebitda": {
            k: v - net_debt for k, v in implied_ev_from_ebitda.items()
        },
        "comparable_count": len(comparables),
    }


def implied_ev_ebitda(growth_rate: float, roic: float, wacc_rate: float) -> float:
    """Implied EV/EBITDA multiple from fundamentals (Modigliani-Miller based)."""
    if wacc_rate <= growth_rate:
        return 0.0
    reinvestment_rate = growth_rate / roic if roic > 0 else 0.0
    nopat_margin = max(1.0 - reinvestment_rate, 0.0)
    return nopat_margin / (wacc_rate - growth_rate)
