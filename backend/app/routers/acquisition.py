from fastapi import APIRouter
import numpy as np
from app.models.schemas import AcquisitionInput
from app.engines.valuation import irr as calc_irr

router = APIRouter()


@router.post("/run")
def run_acquisition_model(inp: AcquisitionInput):
    n = inp.holding_period_years
    entry_ebitda = inp.purchase_price / inp.entry_ebitda_multiple
    debt = inp.purchase_price * (1 - inp.equity_pct)
    equity_invested = inp.purchase_price * inp.equity_pct

    # ── EBITDA Projection ──────────────────────────────────────────────────
    ebitda = np.array([
        entry_ebitda * (1 + inp.ebitda_growth_rate) ** i
        for i in range(1, n + 1)
    ])

    synergies = np.array([
        (inp.revenue_synergies + inp.cost_savings) * min(i / 2.0, 1.0)
        for i in range(1, n + 1)
    ])
    ebitda_adj = ebitda + synergies

    # ── Debt Service ───────────────────────────────────────────────────────
    annual_principal = debt / n
    interest = np.zeros(n)
    principal = np.zeros(n)
    debt_balance = np.zeros(n)

    for i in range(n):
        opening = debt - annual_principal * i
        interest[i] = opening * inp.debt_interest_rate
        principal[i] = annual_principal
        debt_balance[i] = opening - principal[i]

    # ── Net Income / FCF ───────────────────────────────────────────────────
    ebt = ebitda_adj - interest
    taxes = np.maximum(ebt, 0) * inp.tax_rate
    net_income = ebt - taxes
    fcf_to_equity = net_income + (ebitda_adj - net_income - taxes - interest) * 0  # simplified
    fcf_equity = (ebitda_adj - interest - principal - taxes).tolist()

    # ── Exit ───────────────────────────────────────────────────────────────
    exit_ebitda = float(ebitda_adj[-1])
    exit_ev = exit_ebitda * inp.exit_ebitda_multiple
    exit_debt = float(debt_balance[-1])
    exit_equity_proceeds = exit_ev - exit_debt

    # ── Returns ────────────────────────────────────────────────────────────
    equity_cf = [-equity_invested] + fcf_equity[:-1] + [fcf_equity[-1] + exit_equity_proceeds]
    equity_irr = calc_irr(equity_cf)
    moic = exit_equity_proceeds / equity_invested if equity_invested > 0 else 0.0

    years = list(range(1, n + 1))

    return {
        "name": inp.name,
        "years": years,
        "entry": {
            "purchase_price": inp.purchase_price,
            "entry_ebitda": entry_ebitda,
            "entry_multiple": inp.entry_ebitda_multiple,
            "equity_invested": equity_invested,
            "debt": debt,
        },
        "operations": {
            "ebitda": ebitda.tolist(),
            "synergies": synergies.tolist(),
            "ebitda_adj": ebitda_adj.tolist(),
            "interest": interest.tolist(),
            "principal": principal.tolist(),
            "debt_balance": debt_balance.tolist(),
            "ebt": ebt.tolist(),
            "taxes": taxes.tolist(),
            "net_income": net_income.tolist(),
            "fcf_to_equity": fcf_equity,
        },
        "exit": {
            "exit_ebitda": exit_ebitda,
            "exit_ev": exit_ev,
            "exit_multiple": inp.exit_ebitda_multiple,
            "exit_debt": exit_debt,
            "exit_equity_proceeds": exit_equity_proceeds,
        },
        "returns": {
            "equity_irr": equity_irr,
            "moic": moic,
            "equity_cash_flows": equity_cf,
        },
        "key_metrics": {
            "equity_irr": equity_irr,
            "moic": moic,
            "exit_equity_proceeds": exit_equity_proceeds,
            "total_return": exit_equity_proceeds - equity_invested,
        },
    }
