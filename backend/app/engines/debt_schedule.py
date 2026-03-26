"""
Debt scheduling and cash flow waterfall engine.
Supports: straight-line amortization, interest-only periods, DSRA.
"""
from __future__ import annotations
import math
import numpy as np
from app.models.schemas import DebtAssumptions, ProjectDebtAssumptions


def _safe_dscr(fcf: float, debt_service: float) -> float | None:
    """Return DSCR, or None when debt service is zero/negligible (debt paid off).
    Values above 20x are capped to None — they only occur when rounding leaves
    a sub-dollar balance and the ratio becomes meaninglessly large.
    """
    if debt_service < 1.0:   # effectively zero (debt repaid or rounding artifact)
        return None
    ratio = fcf / debt_service
    return None if ratio > 20.0 else round(float(ratio), 4)


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

    new_draws = debt.new_debt_schedule[:n] + [0.0] * max(0, n - len(debt.new_debt_schedule))
    annual_principal = debt.initial_debt / max(debt.amortization_years, 1)

    dscr: list[float | None] = []

    for i in range(n):
        opening[i] = closing[i - 1] if i > 0 else debt.initial_debt
        new_debt[i] = new_draws[i]
        interest[i] = opening[i] * debt.interest_rate
        scheduled_principal = min(annual_principal, max(opening[i] + new_debt[i], 0.0))
        available = max(fcf[i], 0.0)
        debt_service = interest[i] + scheduled_principal
        actual_ds = min(debt_service, available)
        principal[i] = max(actual_ds - interest[i], 0.0)
        closing[i] = opening[i] + new_debt[i] - principal[i]
        dscr.append(_safe_dscr(fcf[i], debt_service))

    equity_fcf = [fcf[i] - interest[i] - principal[i] for i in range(n)]

    return {
        "opening_balance": opening.tolist(),
        "new_debt": new_debt.tolist(),
        "interest": interest.tolist(),
        "principal": principal.tolist(),
        "closing_balance": closing.tolist(),
        "equity_fcf": equity_fcf,
        "dscr": dscr,
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
    dsra_balance = np.zeros(n)

    dscr: list[float | None] = []

    for i in range(n):
        opening[i] = closing[i - 1] if i > 0 else total_debt
        interest[i] = opening[i] * debt.interest_rate
        if i < debt.grace_period_years:
            principal[i] = 0.0
        else:
            principal[i] = min(annual_principal, max(opening[i], 0.0))

        ds = interest[i] + principal[i]
        dsra_balance[i] = ds * debt.debt_service_reserve_months / 12.0
        dscr.append(_safe_dscr(operating_fcf[i], ds))
        closing[i] = opening[i] - principal[i]

    equity_distributions = [
        max(operating_fcf[i] - interest[i] - principal[i], 0.0) for i in range(n)
    ]

    # Exclude None and grace-period years from min/avg DSCR
    finite_dscr = [
        v for v in dscr[debt.grace_period_years:]
        if v is not None and math.isfinite(v)
    ]

    return {
        "total_debt": total_debt,
        "opening_balance": opening.tolist(),
        "interest": interest.tolist(),
        "principal": principal.tolist(),
        "closing_balance": closing.tolist(),
        "dscr": dscr,
        "dsra_balance": dsra_balance.tolist(),
        "equity_distributions": equity_distributions,
        "min_dscr": float(min(finite_dscr)) if finite_dscr else None,
        "avg_dscr": float(sum(finite_dscr) / len(finite_dscr)) if finite_dscr else None,
    }
