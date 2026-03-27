from fastapi import APIRouter
import numpy as np
from app.models.schemas import AcquisitionInput
from app.engines.debt_schedule import build_lbo_debt_schedule
from app.engines.tax import build_tax_schedule
from app.engines.valuation import irr as calc_irr

router = APIRouter()


@router.post("/run")
def run_acquisition_model(inp: AcquisitionInput):
    n = inp.holding_period_years
    entry_ebitda = inp.purchase_price / inp.entry_ebitda_multiple
    transaction_fees = inp.purchase_price * inp.transaction_fees_pct

    # ── Sources & Uses ────────────────────────────────────────────────────────
    total_uses = inp.purchase_price + transaction_fees

    if inp.debt_tranches:
        total_debt = sum(t.amount for t in inp.debt_tranches)
    else:
        total_debt = inp.purchase_price * (1 - inp.equity_pct)

    preferred_equity = total_uses * inp.preferred_equity_pct
    common_equity = total_uses - total_debt - preferred_equity
    equity_invested = common_equity + preferred_equity

    tranches_raw = []
    if inp.debt_tranches:
        for t in inp.debt_tranches:
            tranches_raw.append({
                "name": t.name,
                "amount": t.amount,
                "rate": t.rate,
                "tenor_years": min(t.tenor_years, n),
                "amortization_type": t.amortization_type,
                "is_pik": t.is_pik,
            })
    else:
        # Default: single tranche
        tranches_raw = [{
            "name": "Senior",
            "amount": total_debt,
            "rate": inp.debt_interest_rate,
            "tenor_years": n,
            "amortization_type": "equal_installment",
            "is_pik": False,
        }]

    sources_uses = {
        "uses": {
            "purchase_price": inp.purchase_price,
            "transaction_fees": transaction_fees,
            "total_uses": total_uses,
        },
        "sources": {
            "senior_debt": sum(t["amount"] for t in tranches_raw if "Senior" in t["name"]),
            "total_debt": total_debt,
            "preferred_equity": preferred_equity,
            "common_equity": common_equity,
            "total_equity": equity_invested,
            "total_sources": total_debt + equity_invested,
        },
        "leverage_metrics": {
            "entry_ebitda_multiple": inp.entry_ebitda_multiple,
            "debt_to_ebitda": total_debt / max(entry_ebitda, 1e-9),
            "equity_contribution_pct": common_equity / total_uses if total_uses > 0 else 0,
        }
    }

    # ── EBITDA Projection ──────────────────────────────────────────────────────
    entry_revenue = inp.purchase_price * inp.revenue_pct_purchase_price

    ebitda = np.zeros(n)
    revenue = np.zeros(n)
    for i in range(n):
        ebitda[i] = entry_ebitda * (1 + inp.ebitda_growth_rate) ** i

    # Revenue (back-derived; grows at same rate for working capital)
    for i in range(n):
        revenue[i] = entry_revenue * (1 + inp.ebitda_growth_rate * 0.8) ** i

    # Synergies with phase-in
    phase = inp.synergy_phase_in_years
    synergies = np.array([
        (inp.revenue_synergies + inp.cost_savings) * min((i + 1) / phase, 1.0)
        for i in range(n)
    ])
    integration_costs = np.zeros(n)
    integration_costs[0] = inp.integration_costs

    ebitda_adj = ebitda + synergies - integration_costs

    # CapEx
    capex = revenue * inp.capex_pct_revenue

    # Working capital change
    nwc = revenue * inp.working_capital_pct_revenue
    delta_nwc = np.diff(nwc, prepend=nwc[0])
    delta_nwc[0] = 0.0

    # Amortization of intangibles
    amort_intangibles = np.full(n, inp.amortization_of_intangibles)

    # ── Tax & Debt Service ─────────────────────────────────────────────────────
    # Build multi-tranche debt schedule
    debt_sched = build_lbo_debt_schedule(
        tranches=tranches_raw,
        ebitda=ebitda_adj.tolist(),
        capex=capex.tolist(),
        delta_nwc=delta_nwc.tolist(),
        cash_taxes=[0.0] * n,  # placeholder, updated below
        n=n,
    )

    total_interest = np.array(debt_sched["total_interest"])
    total_principal = np.array(debt_sched["total_principal"])
    total_debt_balance = np.array(debt_sched["total_debt_balance"])

    # EBIT & taxes
    ebit = ebitda_adj - amort_intangibles
    tax_sched = build_tax_schedule(
        ebit=(ebit - total_interest).tolist(),
        tax_rate=inp.tax_rate,
    )
    cash_taxes = np.array(tax_sched["cash_taxes"])
    net_income = np.maximum(ebit - total_interest, 0) - cash_taxes

    # Rebuild debt schedule with actual taxes
    debt_sched = build_lbo_debt_schedule(
        tranches=tranches_raw,
        ebitda=ebitda_adj.tolist(),
        capex=capex.tolist(),
        delta_nwc=delta_nwc.tolist(),
        cash_taxes=cash_taxes.tolist(),
        n=n,
    )
    total_interest = np.array(debt_sched["total_interest"])
    total_principal = np.array(debt_sched["total_principal"])
    total_debt_balance = np.array(debt_sched["total_debt_balance"])
    fcf_to_equity = np.array(debt_sched["fcf_to_equity"])

    # ── Exit ──────────────────────────────────────────────────────────────────
    exit_ebitda = float(ebitda_adj[-1])
    exit_ev = exit_ebitda * inp.exit_ebitda_multiple
    exit_debt = float(total_debt_balance[-1])
    exit_equity_proceeds = exit_ev - exit_debt

    # ── Returns Waterfall ─────────────────────────────────────────────────────
    # 1. Preferred equity: return of capital + preferred return
    preferred_return = preferred_equity * ((1 + inp.preferred_return_rate) ** n - 1)
    preferred_total_return = preferred_equity + preferred_return
    available_for_common = max(exit_equity_proceeds - preferred_total_return, 0.0)

    # 2. Carry/promote
    common_equity_cost = common_equity
    common_return = available_for_common - common_equity_cost
    carry_amount = 0.0
    if inp.carry_pct > 0 and common_return > 0:
        irr_proxy = (available_for_common / max(common_equity_cost, 1e-9)) ** (1 / n) - 1
        if irr_proxy > inp.carry_hurdle:
            carry_amount = common_return * inp.carry_pct
    common_equity_net = available_for_common - carry_amount

    returns_waterfall = {
        "preferred_equity": {
            "invested": preferred_equity,
            "preferred_return": preferred_return,
            "total_return": preferred_total_return,
        },
        "common_equity": {
            "invested": common_equity,
            "exit_proceeds": common_equity_net,
            "total_return": common_equity_net - common_equity,
            "moic": common_equity_net / common_equity if common_equity > 0 else 0,
        },
        "carry": carry_amount,
    }

    # ── Equity IRR / MOIC ─────────────────────────────────────────────────────
    equity_cf = [-equity_invested] + fcf_to_equity[:-1].tolist() + [
        float(fcf_to_equity[-1]) + exit_equity_proceeds
    ]
    equity_irr = calc_irr(equity_cf)
    moic = exit_equity_proceeds / equity_invested if equity_invested > 0 else 0.0

    # IRR by tranche
    tranche_irrs = {}
    for td in debt_sched["tranche_details"]:
        # IRR = cost of debt for fully-served tranches; simplified here
        tranche_irrs[td["name"]] = None  # computed separately if needed

    years = list(range(1, n + 1))

    return {
        "name": inp.name,
        "years": years,
        "sources_uses": sources_uses,
        "entry": {
            "purchase_price": inp.purchase_price,
            "entry_ebitda": entry_ebitda,
            "entry_multiple": inp.entry_ebitda_multiple,
            "equity_invested": equity_invested,
            "common_equity": common_equity,
            "preferred_equity": preferred_equity,
            "total_debt": total_debt,
            "transaction_fees": transaction_fees,
            "tranches": tranches_raw,
        },
        "operations": {
            "revenue": revenue.tolist(),
            "ebitda": ebitda.tolist(),
            "synergies": synergies.tolist(),
            "integration_costs": integration_costs.tolist(),
            "ebitda_adj": ebitda_adj.tolist(),
            "capex": capex.tolist(),
            "delta_nwc": delta_nwc.tolist(),
            "amortization_intangibles": amort_intangibles.tolist(),
            "ebit": ebit.tolist(),
            "interest": total_interest.tolist(),
            "ebt": (ebit - total_interest).tolist(),
            "taxes": cash_taxes.tolist(),
            "net_income": net_income.tolist(),
            "principal": total_principal.tolist(),
            "fcf_to_equity": fcf_to_equity.tolist(),
            "debt_balance": total_debt_balance.tolist(),
            "dscr": debt_sched["dscr"],
        },
        "tranche_details": debt_sched["tranche_details"],
        "exit": {
            "exit_ebitda": exit_ebitda,
            "exit_ev": exit_ev,
            "exit_multiple": inp.exit_ebitda_multiple,
            "exit_debt": exit_debt,
            "exit_equity_proceeds": exit_equity_proceeds,
        },
        "returns_waterfall": returns_waterfall,
        "returns": {
            "equity_irr": equity_irr,
            "moic": moic,
            "equity_cash_flows": equity_cf,
        },
        "credit_metrics": {
            "entry_leverage": total_debt / max(entry_ebitda, 1e-9),
            "exit_leverage": exit_debt / max(exit_ebitda, 1e-9),
            "debt_to_ebitda": (total_debt_balance / np.maximum(ebitda_adj, 1e-9)).tolist(),
            "interest_coverage": (ebitda_adj / np.maximum(total_interest, 1e-9)).tolist(),
        },
        "key_metrics": {
            "equity_irr": equity_irr,
            "moic": moic,
            "entry_ebitda": entry_ebitda,
            "exit_ebitda": exit_ebitda,
            "exit_equity_proceeds": exit_equity_proceeds,
            "total_return": exit_equity_proceeds - equity_invested,
            "entry_leverage": total_debt / max(entry_ebitda, 1e-9),
            "exit_leverage": exit_debt / max(exit_ebitda, 1e-9),
        },
    }
