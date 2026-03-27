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
    construction_cost = inp.costs.construction_cost * (1 + inp.costs.cost_overrun_pct)
    development_cost = inp.costs.development_costs
    total_project_cost = construction_cost + development_cost
    equity_pct = inp.costs.equity_pct
    debt_pct = 1.0 - equity_pct
    equity_investment = total_project_cost * equity_pct

    # ── Operating Revenue (with degradation and ramp) ─────────────────────────
    years_op = list(range(
        inp.timeline.start_year + phases.construction_years,
        inp.timeline.start_year + phases.construction_years + n_op,
    ))
    rev = inp.revenue

    if rev.capacity_mw:
        base_gen = rev.capacity_mw * rev.capacity_factor * 8760
    else:
        base_gen = 1.0

    revenue = np.zeros(n_op)
    for i in range(n_op):
        # Ramp-up
        ramp_factor = min((i + 1) / max(rev.ramp_up_years, 1), 1.0) if rev.ramp_up_years > 0 else 1.0
        # Annual degradation
        degradation_factor = (1 - rev.annual_degradation) ** i
        gen = base_gen * ramp_factor * degradation_factor
        price = rev.price_per_unit * (1 + rev.price_escalation) ** i
        revenue[i] = gen * price

    # Operating costs
    opex = np.zeros(n_op)
    for i in range(n_op):
        fixed_opex = inp.costs.opex_per_year * (1 + inp.costs.opex_escalation) ** i
        variable_opex = revenue[i] * inp.costs.opex_variable_pct
        opex[i] = fixed_opex + variable_opex

    ebitda = revenue - opex
    ebitda_margin = (ebitda / np.maximum(revenue, 1e-9)).tolist()

    # ── Debt Schedule (with LLCR/PLCR/sculpting/MRA/DSRA) ───────────────────
    mra = inp.maintenance_reserve if hasattr(inp, 'maintenance_reserve') else None

    debt_sched = build_project_debt_schedule(
        construction_cost=total_project_cost,
        debt_pct=debt_pct,
        operating_fcf=ebitda.tolist(),
        debt=inp.debt,
        maintenance_reserve=mra,
        tax_rate=inp.tax.tax_rate,
    )

    # ── Tax ───────────────────────────────────────────────────────────────────
    annual_dep = total_project_cost / n_op
    depreciation = [annual_dep] * n_op
    ebit = (ebitda - np.array(depreciation)).tolist()
    tax = build_tax_schedule(
        ebit=ebit,
        tax_rate=inp.tax.tax_rate,
        nol_opening=inp.tax.nol_carryforward,
        nol_expiry_years=inp.tax.nol_expiry_years,
    )

    # CFADS (after tax)
    cfads = [ebitda[i] - tax["cash_taxes"][i] for i in range(n_op)]

    # ── Equity Cash Flows ──────────────────────────────────────────────────────
    constr_yr = phases.construction_years
    equity_per_construction_yr = equity_investment / max(constr_yr, 1)
    construction_equity = [-equity_per_construction_yr] * constr_yr

    idc_rate = inp.debt.idc_rate if inp.debt.idc_rate > 0 else inp.debt.interest_rate
    total_debt = debt_sched["total_debt"]
    # IDC: interest accrued during construction (capitalised into project cost)
    idc = total_debt * idc_rate * constr_yr / 2  # simplified average

    equity_ops = debt_sched["equity_distributions"]
    all_equity_cf = construction_equity + equity_ops

    equity_irr = calc_irr(all_equity_cf)
    project_irr = calc_irr(
        [-total_project_cost] + cfads
    )

    val = dcf_valuation(
        free_cash_flows=cfads,
        discount_rate=inp.timeline.discount_rate,
        terminal_growth_rate=0.0,
        net_debt=debt_sched["closing_balance"][-1],
    )

    # ── Construction Phase Summary ─────────────────────────────────────────────
    construction_summary = {
        "construction_years": constr_yr,
        "base_construction_cost": inp.costs.construction_cost,
        "cost_overrun_pct": inp.costs.cost_overrun_pct,
        "development_costs": inp.costs.development_costs,
        "total_project_cost": total_project_cost,
        "total_debt": total_debt,
        "equity_investment": equity_investment,
        "idc_estimate": idc,
        "debt_pct": debt_pct,
        "equity_pct": equity_pct,
        "upfront_fees": total_debt * inp.debt.upfront_fees_pct,
    }

    # ── Cash flow waterfall data for charts ────────────────────────────────────
    waterfall_data = []
    for i in range(n_op):
        ds = debt_sched["debt_service"][i]
        dsra_topup = debt_sched["dsra_topup"][i]
        mra_fund = debt_sched["mra_funding"][i]
        eq_dist = debt_sched["equity_distributions"][i]
        waterfall_data.append({
            "year": years_op[i],
            "Revenue": revenue[i],
            "OpEx": -opex[i],
            "EBITDA": ebitda[i],
            "Tax": -tax["cash_taxes"][i],
            "Debt Service": -ds,
            "DSRA Top-up": -dsra_topup,
            "MRA Funding": -mra_fund,
            "Equity Distributions": eq_dist,
        })

    # ── Key metrics ───────────────────────────────────────────────────────────
    finite_dscr = [v for v in debt_sched["dscr"] if v is not None]
    finite_llcr = [v for v in debt_sched["llcr"] if v is not None]

    return {
        "name": inp.name,
        "years_operating": years_op,
        "construction_summary": construction_summary,
        "construction_cost": total_project_cost,
        "equity_investment": equity_investment,
        "total_debt": total_debt,
        "operating": {
            "revenue": revenue.tolist(),
            "opex": opex.tolist(),
            "ebitda": ebitda.tolist(),
            "ebitda_margin": ebitda_margin,
            "depreciation": depreciation,
            "ebit": ebit,
            "cfads": cfads,
        },
        "tax": tax,
        "debt_schedule": debt_sched,
        "waterfall_data": waterfall_data,
        "valuation": val,
        "equity_irr": equity_irr,
        "project_irr": project_irr,
        "all_equity_cash_flows": all_equity_cf,
        "key_metrics": {
            "project_irr": project_irr,
            "equity_irr": equity_irr,
            "min_dscr": debt_sched["min_dscr"],
            "avg_dscr": debt_sched["avg_dscr"],
            "min_llcr": debt_sched["min_llcr"],
            "avg_llcr": debt_sched["avg_llcr"],
            "n_covenant_breaches": debt_sched["n_covenant_breaches"],
            "enterprise_value": val["enterprise_value"],
            "equity_value": val["equity_value"],
            "total_project_cost": total_project_cost,
            "debt_pct": debt_pct,
            "equity_pct": equity_pct,
            "use_sculpting": inp.debt.use_sculpting,
            "target_dscr": inp.debt.target_dscr,
        },
    }
