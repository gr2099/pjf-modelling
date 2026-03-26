"""
Debt scheduling and cash flow waterfall engine.
Supports: straight-line amortization, interest-only periods, DSRA.
"""
from __future__ import annotations
import numpy as np
from app.models.schemas import DebtAssumptions, ProjectDebtAssumptions


def build_debt_schedule(
    fcf: list[float],
    debt: DebtAssumptions,
    n: int,
) -> dict:
    """Corporate debt schedule with cash flow waterfall."""
    opening = np.zeros(n)
    closing = np.zeros(n)
    interest = np.zeros(n)
    principal = np.zeros(n)
    new_debt = np.zeros(n)
    dscr = np.zeros(n)

    new_draws = debt.new_debt_schedule[:n] + [0.0] * max(0, n - len(debt.new_debt_schedule))

    annual_principal = debt.initial_debt / max(debt.amortization_years, 1)

    for i in range(n):
        opening[i] = closing[i - 1] if i > 0 else debt.initial_debt
        new_debt[i] = new_draws[i]
        interest[i] = opening[i] * debt.interest_rate
        scheduled_principal = min(annual_principal, opening[i] + new_debt[i])
        # Waterfall: cap principal at available FCF after interest
        available = max(fcf[i], 0.0)
        debt_service = interest[i] + scheduled_principal
        actual_ds = min(debt_service, available)
        principal[i] = max(actual_ds - interest[i], 0.0)
        closing[i] = opening[i] + new_debt[i] - principal[i]
        dscr[i] = fcf[i] / debt_service if debt_service > 0 else float("inf")

    equity_fcf = [fcf[i] - interest[i] - principal[i] for i in range(n)]

    return {
        "opening_balance": opening.tolist(),
        "new_debt": new_debt.tolist(),
        "interest": interest.tolist(),
        "principal": principal.tolist(),
        "closing_balance": closing.tolist(),
        "equity_fcf": equity_fcf,
        "dscr": dscr.tolist(),
    }


def build_project_debt_schedule(
    construction_cost: float,
    debt_pct: float,
    operating_fcf: list[float],
    debt: ProjectDebtAssumptions,
) -> dict:
    """Project finance debt schedule with DSRA."""
    total_debt = construction_cost * debt_pct
    n = len(operating_fcf)

    amort_years = min(debt.amortization_years, n - debt.grace_period_years)
    annual_principal = total_debt / max(amort_years, 1)

    opening = np.zeros(n)
    closing = np.zeros(n)
    interest = np.zeros(n)
    principal = np.zeros(n)
    dscr = np.zeros(n)
    dsra_balance = np.zeros(n)

    # DSRA target = 6 months of debt service
    dsra_months = debt.debt_service_reserve_months

    for i in range(n):
        opening[i] = closing[i - 1] if i > 0 else total_debt
        interest[i] = opening[i] * debt.interest_rate
        if i < debt.grace_period_years:
            principal[i] = 0.0
        else:
            principal[i] = min(annual_principal, opening[i])

        ds = interest[i] + principal[i]
        # Update DSRA target
        dsra_target = ds * dsra_months / 12.0
        dsra_balance[i] = dsra_target

        dscr[i] = operating_fcf[i] / ds if ds > 0 else float("inf")
        closing[i] = opening[i] - principal[i]

    equity_distributions = [
        max(operating_fcf[i] - interest[i] - principal[i], 0.0) for i in range(n)
    ]

    return {
        "total_debt": total_debt,
        "opening_balance": opening.tolist(),
        "interest": interest.tolist(),
        "principal": principal.tolist(),
        "closing_balance": closing.tolist(),
        "dscr": dscr.tolist(),
        "dsra_balance": dsra_balance.tolist(),
        "equity_distributions": equity_distributions,
        "min_dscr": float(np.min(dscr[debt.grace_period_years:])) if n > debt.grace_period_years else 0.0,
        "avg_dscr": float(np.mean(dscr[debt.grace_period_years:])) if n > debt.grace_period_years else 0.0,
    }
