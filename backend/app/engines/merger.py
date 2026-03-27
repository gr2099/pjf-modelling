"""
Merger / M&A model engine.
Implements: Sources & Uses, EPS accretion/dilution, combined P&L, synergy ramp.
"""
from __future__ import annotations
import numpy as np
from app.models.schemas import MergerInput
from app.engines.valuation import irr as calc_irr


def build_merger_model(inp: MergerInput) -> dict:
    n = inp.holding_period_years
    tax = inp.tax_rate

    # ── Deal Structure ────────────────────────────────────────────────────────
    purchase_premium = inp.purchase_price / (inp.target_ebitda * 10)  # implied premium vs 10x
    goodwill = max(inp.purchase_price - inp.target_net_income * 15, 0)

    # Sources & Uses
    cash_used = inp.purchase_price * inp.cash_consideration_pct
    stock_issued_value = inp.purchase_price * inp.stock_consideration_pct
    debt_raised = inp.purchase_price * inp.debt_consideration_pct

    # New shares issued (at current acquirer price)
    new_shares = stock_issued_value / inp.acquirer_share_price if inp.acquirer_share_price > 0 else 0.0
    total_shares_combined = inp.acquirer_shares + new_shares

    sources_uses = {
        "uses": {
            "purchase_price": inp.purchase_price,
            "transaction_fees": inp.purchase_price * 0.015,
            "total_uses": inp.purchase_price * 1.015,
        },
        "sources": {
            "cash": cash_used,
            "stock_issued": stock_issued_value,
            "new_debt": debt_raised,
            "total_sources": cash_used + stock_issued_value + debt_raised,
        },
        "new_shares_issued": new_shares,
        "total_shares_post_merger": total_shares_combined,
        "dilution_pct": new_shares / inp.acquirer_shares if inp.acquirer_shares > 0 else 0,
        "goodwill": goodwill,
        "purchase_price_to_ebitda": inp.purchase_price / inp.target_ebitda,
        "purchase_price_to_revenue": inp.purchase_price / inp.target_revenue,
    }

    # ── Interest on New Debt ──────────────────────────────────────────────────
    annual_interest = debt_raised * inp.new_debt_rate
    debt_balance = debt_raised  # simplified: no amortization for merger model

    # ── Synergy Ramp ──────────────────────────────────────────────────────────
    # Phase in over synergy_phase_in_years
    phase_in = inp.synergy_phase_in_years
    synergy_factors = np.array([
        min((i + 1) / phase_in, 1.0) for i in range(n)
    ])
    cost_synergies_pa = np.ones(n) * inp.cost_synergies * synergy_factors
    revenue_synergies_pa = np.ones(n) * inp.revenue_synergies * synergy_factors
    total_synergies = cost_synergies_pa + revenue_synergies_pa
    integration_costs_arr = np.zeros(n)
    integration_costs_arr[0] = inp.integration_costs  # one-time in year 1

    # ── Standalone Projections ────────────────────────────────────────────────
    acquirer_revenue_arr = np.array([
        inp.acquirer_revenue * (1 + inp.acquirer_growth_rate) ** i for i in range(1, n + 1)
    ])
    acquirer_ebitda_arr = acquirer_revenue_arr * (inp.acquirer_ebitda / inp.acquirer_revenue)
    acquirer_ebit_arr = acquirer_ebitda_arr * (inp.acquirer_ebit / inp.acquirer_ebitda)
    acquirer_ni_arr = acquirer_ebit_arr * (1 - tax)

    target_revenue_arr = np.array([
        inp.target_revenue * (1 + inp.target_growth_rate) ** i for i in range(1, n + 1)
    ])
    target_ebitda_arr = target_revenue_arr * (inp.target_ebitda / inp.target_revenue)
    target_ebit_arr = target_ebitda_arr * (inp.target_ebit / inp.target_ebitda)
    target_ni_arr = target_ebit_arr * (1 - tax)

    # Standalone EPS (acquirer)
    standalone_eps = acquirer_ni_arr / inp.acquirer_shares

    # ── Combined P&L ──────────────────────────────────────────────────────────
    combined_revenue = acquirer_revenue_arr + target_revenue_arr + revenue_synergies_pa
    combined_ebitda = acquirer_ebitda_arr + target_ebitda_arr + total_synergies - integration_costs_arr
    combined_ebit = combined_ebitda - np.ones(n) * inp.amortization_of_intangibles
    combined_ebt = combined_ebit - annual_interest
    combined_net_income = np.maximum(combined_ebt, 0) * (1 - tax)

    # Combined EPS
    combined_eps = combined_net_income / total_shares_combined

    # ── Accretion / Dilution ──────────────────────────────────────────────────
    accretion_dilution_eps = combined_eps - standalone_eps
    accretion_dilution_pct = (combined_eps / np.maximum(standalone_eps, 1e-9) - 1)

    # ── Credit Metrics ────────────────────────────────────────────────────────
    combined_net_debt = inp.acquirer_net_debt + inp.target_net_debt + debt_raised
    debt_to_ebitda = combined_net_debt / np.maximum(combined_ebitda, 1e-9)
    interest_coverage = combined_ebitda / max(annual_interest, 1e-9)

    # ── Returns Analysis ─────────────────────────────────────────────────────
    combined_eps_growth = np.diff(combined_eps, prepend=combined_eps[0]) / np.maximum(combined_eps, 1e-9)
    pe_at_current_price = inp.acquirer_share_price / np.maximum(standalone_eps, 1e-9)

    # Payback year for dilution (year when combined EPS exceeds standalone)
    payback_year = None
    for i in range(n):
        if accretion_dilution_eps[i] >= 0:
            payback_year = i + 1
            break

    # ── Standalone vs Combined comparison ─────────────────────────────────────
    years = list(range(1, n + 1))

    return {
        "name": inp.name,
        "years": years,
        "sources_uses": sources_uses,

        # Acquirer standalone
        "acquirer_standalone": {
            "revenue": acquirer_revenue_arr.tolist(),
            "ebitda": acquirer_ebitda_arr.tolist(),
            "ebit": acquirer_ebit_arr.tolist(),
            "net_income": acquirer_ni_arr.tolist(),
            "eps": standalone_eps.tolist(),
            "shares": [inp.acquirer_shares] * n,
        },

        # Target standalone
        "target_standalone": {
            "revenue": target_revenue_arr.tolist(),
            "ebitda": target_ebitda_arr.tolist(),
            "ebit": target_ebit_arr.tolist(),
            "net_income": target_ni_arr.tolist(),
        },

        # Synergies
        "synergies": {
            "cost_synergies": cost_synergies_pa.tolist(),
            "revenue_synergies": revenue_synergies_pa.tolist(),
            "total_synergies": total_synergies.tolist(),
            "integration_costs": integration_costs_arr.tolist(),
            "net_synergies": (total_synergies - integration_costs_arr).tolist(),
            "phase_in_years": phase_in,
        },

        # Combined
        "combined": {
            "revenue": combined_revenue.tolist(),
            "ebitda": combined_ebitda.tolist(),
            "ebit": combined_ebit.tolist(),
            "interest": [annual_interest] * n,
            "net_income": combined_net_income.tolist(),
            "eps": combined_eps.tolist(),
            "shares": [total_shares_combined] * n,
        },

        # Accretion/Dilution
        "accretion_dilution": {
            "eps_delta": accretion_dilution_eps.tolist(),
            "pct_delta": accretion_dilution_pct.tolist(),
            "payback_year": payback_year,
            "year_1_accretive": bool(accretion_dilution_eps[0] >= 0) if n > 0 else False,
            "fully_accretive_year": payback_year,
        },

        # Credit metrics
        "credit_metrics": {
            "combined_net_debt": combined_net_debt,
            "debt_to_ebitda": debt_to_ebitda.tolist(),
            "interest_coverage": (combined_ebitda / max(annual_interest, 1e-9)).tolist(),
        },

        # Key metrics
        "key_metrics": {
            "purchase_price_ebitda": sources_uses["purchase_price_to_ebitda"],
            "goodwill": goodwill,
            "new_shares_issued": new_shares,
            "dilution_pct": sources_uses["dilution_pct"],
            "year_1_eps_accretion": float(accretion_dilution_pct[0]) if n > 0 else 0.0,
            "year_1_combined_eps": float(combined_eps[0]) if n > 0 else 0.0,
            "year_1_standalone_eps": float(standalone_eps[0]) if n > 0 else 0.0,
            "payback_year": payback_year,
            "combined_net_debt": combined_net_debt,
            "pro_forma_leverage": float(debt_to_ebitda[0]) if n > 0 else 0.0,
        }
    }
