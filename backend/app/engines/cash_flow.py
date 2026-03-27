"""
Corporate cash flow, three-statement model, and ROIC engine.
Implements: Revenue → EBITDA → EBIT → NOPAT → FCF → Balance Sheet → ROIC
"""
from __future__ import annotations
import numpy as np
from app.models.schemas import CorporateModelInput


def _depreciation_schedule(capex: np.ndarray, method: str, dep_years: int,
                            db_rate: float, half_year: bool, n: int) -> np.ndarray:
    """Compute depreciation for each capex vintage using chosen method."""
    depreciation = np.zeros(n)
    for i, cap in enumerate(capex):
        if cap == 0:
            continue
        if method == "declining_balance":
            book = cap
            for j in range(i, n):
                period_in_asset = j - i
                if half_year and period_in_asset == 0:
                    dep = book * db_rate * 0.5
                elif half_year and period_in_asset == dep_years:
                    dep = book * 0.5
                elif period_in_asset >= dep_years:
                    break
                else:
                    dep = book * db_rate
                dep = max(dep, 0.0)
                depreciation[j] += dep
                book -= dep
                if book <= 0:
                    break
        else:  # straight_line
            annual = cap / dep_years
            for j in range(i, n):
                period_in_asset = j - i
                if period_in_asset == 0 and half_year:
                    depreciation[j] += annual * 0.5
                elif period_in_asset == dep_years and half_year:
                    depreciation[j] += annual * 0.5
                elif period_in_asset < dep_years:
                    depreciation[j] += annual
                else:
                    break
    return depreciation


def _tax_depreciation_schedule(capex: np.ndarray, dep_years: int,
                                bonus_pct: float, n: int) -> np.ndarray:
    """Tax depreciation: straight-line with optional bonus depreciation year 1."""
    tax_dep = np.zeros(n)
    for i, cap in enumerate(capex):
        if cap == 0:
            continue
        bonus = cap * bonus_pct
        remaining = cap - bonus
        annual_sl = remaining / dep_years if dep_years > 0 else 0.0
        for j in range(i, n):
            period_in_asset = j - i
            if period_in_asset == 0:
                tax_dep[j] += bonus + annual_sl
            elif period_in_asset < dep_years:
                tax_dep[j] += annual_sl
            else:
                break
    return tax_dep


def build_corporate_cash_flows(inp: CorporateModelInput) -> dict:
    n = inp.timeline.forecast_years
    years = list(range(inp.timeline.start_year, inp.timeline.start_year + n))

    # ── Revenue ────────────────────────────────────────────────────────────
    growth = inp.revenue.growth_rates
    if len(growth) < n:
        growth = growth + [growth[-1]] * (n - len(growth))
    growth = growth[:n]

    revenue = np.zeros(n)
    revenue[0] = inp.revenue.base_revenue * (1 + growth[0])
    for i in range(1, n):
        revenue[i] = revenue[i - 1] * (1 + growth[i])

    # ── Cost Structure ──────────────────────────────────────────────────────
    cogs = revenue * inp.costs.cogs_pct
    gross_profit = revenue - cogs
    sga = revenue * inp.costs.sga_pct
    rd = revenue * inp.costs.rd_pct
    fixed_costs = np.full(n, inp.costs.fixed_costs)
    ebitda = gross_profit - sga - rd - fixed_costs
    if inp.costs.ebitda_margin_override is not None:
        ebitda = revenue * inp.costs.ebitda_margin_override

    # ── CapEx & Depreciation ───────────────────────────────────────────────
    maintenance_capex = revenue * inp.capex.maintenance_capex_pct
    growth_capex = np.zeros(n)
    for i, v in enumerate(inp.capex.growth_capex[:n]):
        growth_capex[i] = v
    total_capex = maintenance_capex + growth_capex

    dep_method = inp.capex.depreciation_method
    dep_years = inp.capex.depreciation_years
    db_rate = inp.capex.declining_balance_rate
    half_year = inp.capex.half_year_convention

    # Book depreciation
    depreciation = _depreciation_schedule(total_capex, dep_method, dep_years,
                                          db_rate, half_year, n)

    # Tax depreciation (accelerated, for deferred tax)
    bonus_pct = inp.tax.accelerated_depreciation_pct
    tax_depreciation = _tax_depreciation_schedule(total_capex, dep_years, bonus_pct, n)

    # Net PP&E schedule (opening = 0, grow with capex, shrink with depreciation)
    opening_pp_and_e = np.zeros(n)
    closing_pp_and_e = np.zeros(n)
    for i in range(n):
        opening_pp_and_e[i] = closing_pp_and_e[i - 1] if i > 0 else 0.0
        closing_pp_and_e[i] = max(opening_pp_and_e[i] + total_capex[i] - depreciation[i], 0.0)

    # ── Working Capital ────────────────────────────────────────────────────
    wc = inp.working_capital
    ar = revenue * wc.dso_days / 365.0
    inventory = revenue * inp.costs.cogs_pct * wc.dio_days / 365.0
    ap = revenue * inp.costs.cogs_pct * wc.dpo_days / 365.0
    other_ca = revenue * wc.other_current_assets_pct
    other_cl = revenue * wc.other_current_liabilities_pct
    nwc = ar + inventory + other_ca - ap - other_cl
    delta_nwc = np.diff(nwc, prepend=nwc[0])
    delta_nwc[0] = 0.0

    # ── EBIT → NOPAT → FCF ─────────────────────────────────────────────────
    ebit = ebitda - depreciation
    nopat = np.maximum(ebit, 0) * (1 - inp.tax.tax_rate)
    fcf_pretax = ebitda - total_capex - delta_nwc
    # After-tax FCF (unlevered) — taxes calculated separately by tax engine
    # Approximate for now; router overrides with proper cash taxes
    taxes_approximate = np.maximum(ebit, 0) * inp.tax.tax_rate
    fcf_aftertax = nopat + depreciation - total_capex - delta_nwc

    # ── ROIC & Invested Capital ────────────────────────────────────────────
    # Invested Capital = Net PP&E + Net Working Capital
    invested_capital = closing_pp_and_e + nwc
    opening_ic = np.zeros(n)
    opening_ic[0] = inp.roic.opening_invested_capital
    opening_ic[1:] = invested_capital[:-1]

    avg_ic = (opening_ic + invested_capital) / 2.0
    roic_pct = np.where(avg_ic > 0, nopat / avg_ic, 0.0)
    roe_approx = roic_pct  # placeholder; proper ROE needs net income from router
    wacc = inp.roic.wacc
    roic_spread = roic_pct - wacc
    economic_profit = roic_spread * avg_ic

    # ── Balance Sheet components (partial — debt added by router) ──────────
    cash_min = revenue * 0.02  # assume 2% of revenue held as operating cash

    return {
        "years": years,
        "n": n,
        # Income Statement
        "revenue": revenue.tolist(),
        "cogs": cogs.tolist(),
        "gross_profit": gross_profit.tolist(),
        "sga": sga.tolist(),
        "rd": rd.tolist(),
        "fixed_costs": fixed_costs.tolist(),
        "ebitda": ebitda.tolist(),
        "ebitda_margin": (ebitda / np.maximum(revenue, 1e-9)).tolist(),
        "depreciation": depreciation.tolist(),
        "tax_depreciation": tax_depreciation.tolist(),
        "ebit": ebit.tolist(),
        "ebit_margin": (ebit / np.maximum(revenue, 1e-9)).tolist(),
        # Working Capital
        "ar": ar.tolist(),
        "inventory": inventory.tolist(),
        "ap": ap.tolist(),
        "nwc": nwc.tolist(),
        "delta_nwc": delta_nwc.tolist(),
        # CapEx & PP&E
        "capex": total_capex.tolist(),
        "maintenance_capex": maintenance_capex.tolist(),
        "growth_capex": growth_capex.tolist(),
        "opening_ppe": opening_pp_and_e.tolist(),
        "closing_ppe": closing_pp_and_e.tolist(),
        # Cash Flow
        "fcf_pretax": fcf_pretax.tolist(),
        "fcf_aftertax": fcf_aftertax.tolist(),
        "nopat": nopat.tolist(),
        "taxes_approximate": taxes_approximate.tolist(),
        # ROIC
        "invested_capital": invested_capital.tolist(),
        "opening_invested_capital": opening_ic.tolist(),
        "avg_invested_capital": avg_ic.tolist(),
        "roic": roic_pct.tolist(),
        "roic_spread": roic_spread.tolist(),
        "economic_profit": economic_profit.tolist(),
        # Balance Sheet components
        "cash_min": cash_min.tolist(),
    }


def build_balance_sheet(
    cf: dict,
    tax: dict,
    debt: dict,
    n: int,
    opening_equity: float = 0.0,
) -> dict:
    """Construct the balance sheet given cash flow and debt outputs."""
    revenue = np.array(cf["revenue"])
    ebitda = np.array(cf["ebitda"])
    depreciation = np.array(cf["depreciation"])
    capex = np.array(cf["capex"])
    cash_taxes = np.array(tax["cash_taxes"])
    interest = np.array(debt["interest"])
    principal = np.array(debt["principal"])
    new_debt = np.array(debt["new_debt"])
    closing_debt = np.array(debt["closing_balance"])

    # Net Income for retained earnings
    ebit_arr = np.array(cf["ebit"])
    ebt = ebit_arr - interest
    net_income = ebt - cash_taxes
    net_income = np.where(ebt > 0, ebt - cash_taxes, ebt)  # can't have negative taxes

    # Cash flow from operations
    cfo = net_income + depreciation - np.array(cf["delta_nwc"])

    # Opening equity
    equity = np.zeros(n)
    equity[0] = opening_equity + net_income[0]
    for i in range(1, n):
        equity[i] = equity[i - 1] + net_income[i]

    # Assets
    closing_ppe = np.array(cf["closing_ppe"])
    ar = np.array(cf["ar"])
    inventory = np.array(cf["inventory"])
    # Cash: operating cash + surplus from equity FCF
    equity_fcf = np.array(debt["equity_fcf"])
    cum_surplus = np.cumsum(np.maximum(equity_fcf, 0))
    cash = np.array(cf["cash_min"]) + cum_surplus * 0.5  # retain half, distribute half

    total_current_assets = cash + ar + inventory
    total_assets = total_current_assets + closing_ppe

    # Liabilities
    ap = np.array(cf["ap"])
    total_current_liabilities = ap
    total_liabilities = total_current_liabilities + closing_debt

    # Equity (balancing)
    total_equity = total_assets - total_liabilities

    return {
        # Assets
        "cash": cash.tolist(),
        "accounts_receivable": ar.tolist(),
        "inventory": inventory.tolist(),
        "total_current_assets": total_current_assets.tolist(),
        "net_ppe": closing_ppe.tolist(),
        "total_assets": total_assets.tolist(),
        # Liabilities
        "accounts_payable": ap.tolist(),
        "total_current_liabilities": total_current_liabilities.tolist(),
        "long_term_debt": closing_debt.tolist(),
        "total_liabilities": total_liabilities.tolist(),
        # Equity
        "total_equity": total_equity.tolist(),
        "retained_earnings_annual": net_income.tolist(),
        # Summary
        "net_income": net_income.tolist(),
        "operating_cash_flow": cfo.tolist(),
        "roe": np.where(total_equity > 0, net_income / np.maximum(total_equity, 1e-9), 0.0).tolist(),
        "debt_to_equity": np.where(total_equity > 0, closing_debt / np.maximum(total_equity, 1e-9), 0.0).tolist(),
        "debt_to_ebitda": np.where(ebitda > 0, closing_debt / np.maximum(ebitda, 1e-9), 0.0).tolist(),
        "interest_coverage": np.where(interest > 0, ebitda / np.maximum(interest, 1e-9), 0.0).tolist(),
        "current_ratio": (total_current_assets / np.maximum(total_current_liabilities, 1e-9)).tolist(),
    }
