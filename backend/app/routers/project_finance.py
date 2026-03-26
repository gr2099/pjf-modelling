from fastapi import APIRouter
import numpy as np
from app.models.schemas import ProjectFinanceInput
from app.engines.debt_schedule import build_project_debt_schedule
from app.engines.tax import build_tax_schedule
from app.engines.valuation import dcf_valuation, irr as calc_irr

router = APIRouter()


@router.post("/run")
def run_project_model(inp: ProjectFinanceInput):
    phases = inp.phases
    n_op = phases.operating_years
    construction_cost = inp.costs.construction_cost
    equity_pct = inp.costs.equity_pct
    debt_pct = 1.0 - equity_pct
    equity_investment = construction_cost * equity_pct

    # ── Operating Revenue ──────────────────────────────────────────────────
    years_op = list(range(
        inp.timeline.start_year + phases.construction_years,
        inp.timeline.start_year + phases.construction_years + n_op,
    ))
    rev = inp.revenue

    if rev.capacity_mw:
        base_gen = rev.capacity_mw * rev.capacity_factor * 8760
    else:
        base_gen = 1.0

    revenue = np.array([
        base_gen * rev.price_per_unit * (1 + rev.price_escalation) ** i
        for i in range(n_op)
    ])
    opex = np.array([
        inp.costs.opex_per_year * (1 + inp.costs.opex_escalation) ** i
        for i in range(n_op)
    ])
    ebitda = revenue - opex

    # ── Debt Schedule ──────────────────────────────────────────────────────
    debt_sched = build_project_debt_schedule(
        construction_cost=construction_cost,
        debt_pct=debt_pct,
        operating_fcf=ebitda.tolist(),
        debt=inp.debt,
    )

    # ── Tax ────────────────────────────────────────────────────────────────
    # Simplified: depreciation straight-line over operating life
    annual_dep = construction_cost / n_op
    depreciation = [annual_dep] * n_op
    ebit = (ebitda - np.array(depreciation)).tolist()
    tax = build_tax_schedule(
        ebit=ebit,
        tax_rate=inp.tax.tax_rate,
        nol_opening=inp.tax.nol_carryforward,
        nol_expiry_years=inp.tax.nol_expiry_years,
    )

    fcf = [ebitda[i] - tax["cash_taxes"][i] for i in range(n_op)]

    # ── Equity Cash Flows ──────────────────────────────────────────────────
    # Construction period: equity outflows spread evenly
    construction_equity = [-equity_investment / max(phases.construction_years, 1)] * phases.construction_years
    equity_ops = debt_sched["equity_distributions"]
    all_equity_cf = construction_equity + equity_ops

    equity_irr = calc_irr(all_equity_cf)
    project_irr = calc_irr(
        [-construction_cost] * 1 + fcf  # simplified: all cost upfront
    )

    val = dcf_valuation(
        free_cash_flows=fcf,
        discount_rate=inp.timeline.discount_rate,
        terminal_growth_rate=0.0,  # finite life — no terminal value
        net_debt=debt_sched["closing_balance"][-1],
    )

    return {
        "name": inp.name,
        "years_operating": years_op,
        "construction_cost": construction_cost,
        "equity_investment": equity_investment,
        "total_debt": debt_sched["total_debt"],
        "operating": {
            "revenue": revenue.tolist(),
            "opex": opex.tolist(),
            "ebitda": ebitda.tolist(),
            "ebitda_margin": (ebitda / np.maximum(revenue, 1e-9)).tolist(),
            "depreciation": depreciation,
            "ebit": ebit,
            "fcf": fcf,
        },
        "tax": tax,
        "debt_schedule": debt_sched,
        "valuation": val,
        "equity_irr": equity_irr,
        "project_irr": project_irr,
        "key_metrics": {
            "min_dscr": debt_sched["min_dscr"],
            "avg_dscr": debt_sched["avg_dscr"],
            "equity_irr": equity_irr,
            "project_irr": project_irr,
            "enterprise_value": val["enterprise_value"],
            "equity_value": val["equity_value"],
        },
    }
