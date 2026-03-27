"""
Debt scheduling, project finance waterfall, LLCR/PLCR, MRA, and debt sculpting.
"""
from __future__ import annotations
import math
import numpy as np
from app.models.schemas import DebtAssumptions, ProjectDebtAssumptions, MaintenanceReserve


def _safe_dscr(fcf: float, debt_service: float) -> float | None:
    if debt_service < 1.0:
        return None
    ratio = fcf / debt_service
    return None if ratio > 20.0 else round(float(ratio), 4)


def _npv_at_rate(cash_flows: list[float], rate: float) -> float:
    return sum(cf / (1 + rate) ** (i + 1) for i, cf in enumerate(cash_flows))


# ── Corporate Debt Schedule ────────────────────────────────────────────────────

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
    min_ds = math.inf
    max_ds = 0.0

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

    # Interest coverage
    ebitda_proxy = [fcf[i] + interest[i] for i in range(n)]
    interest_coverage = [
        round(float(ebitda_proxy[i] / interest[i]), 4) if interest[i] > 0 else None
        for i in range(n)
    ]

    return {
        "opening_balance": opening.tolist(),
        "new_debt": new_debt.tolist(),
        "interest": interest.tolist(),
        "principal": principal.tolist(),
        "closing_balance": closing.tolist(),
        "equity_fcf": equity_fcf,
        "dscr": dscr,
        "interest_coverage": interest_coverage,
    }


# ── Project Finance Debt Schedule ──────────────────────────────────────────────

def build_project_debt_schedule(
    construction_cost: float,
    debt_pct: float,
    operating_fcf: list[float],
    debt: ProjectDebtAssumptions,
    maintenance_reserve: MaintenanceReserve | None = None,
    tax_rate: float = 0.25,
) -> dict:
    """
    Full project finance debt schedule with:
    - DSRA (Debt Service Reserve Account)
    - MRA (Maintenance Reserve Account)
    - LLCR (Loan Life Coverage Ratio)
    - PLCR (Project Life Coverage Ratio)
    - Debt sculpting (target DSCR method)
    - Cash flow waterfall
    - Covenant breach detection
    """
    total_debt = construction_cost * debt_pct
    n = len(operating_fcf)
    cfads = np.array(operating_fcf, dtype=float)

    # ── MRA setup ──────────────────────────────────────────────────────────
    mra_draw = np.zeros(n)
    if maintenance_reserve and maintenance_reserve.enabled:
        for event in maintenance_reserve.events:
            idx = event.year - 1
            if 0 <= idx < n:
                mra_draw[idx] += event.cost
    mra_annual_funding = np.zeros(n)
    if maintenance_reserve and maintenance_reserve.enabled and maintenance_reserve.funding_rate_pct_revenue > 0:
        mra_annual_funding = cfads * maintenance_reserve.funding_rate_pct_revenue

    # Net CFADS available for debt service (after MRA funding)
    cfads_net = cfads - mra_annual_funding

    grace = debt.grace_period_years
    amort_years = min(debt.amortization_years, n - grace)
    interest_rate = debt.interest_rate

    opening = np.zeros(n)
    closing = np.zeros(n)
    interest = np.zeros(n)
    principal = np.zeros(n)
    dsra_opening = np.zeros(n)
    dsra_closing = np.zeros(n)
    dsra_topup = np.zeros(n)
    dsra_release = np.zeros(n)
    dsra_interest = np.zeros(n)
    mra_balance = np.zeros(n)

    dscr: list[float | None] = []
    covenant_breach: list[bool] = []
    min_dscr_threshold = 1.20

    if debt.use_sculpting:
        # ── Debt Sculpting (backward induction) ───────────────────────────
        target = debt.target_dscr
        # Compute sculpted principal: P[i] = CFADS[i]/target - Interest[i]
        # Iterate: interest depends on opening balance, opening depends on principal
        # Use backward induction: closing balance at end = 0
        principal_sculpted = np.zeros(n)
        opening_sculpted = np.zeros(n)
        closing_sculpted = np.zeros(n)
        interest_sculpted = np.zeros(n)

        # Forward pass with best estimate of interest
        balance = total_debt
        for i in range(n):
            opening_sculpted[i] = balance
            interest_sculpted[i] = balance * interest_rate
            if i < grace:
                principal_sculpted[i] = 0.0
            else:
                target_ds = cfads_net[i] / target
                p = max(target_ds - interest_sculpted[i], 0.0)
                p = min(p, balance)  # can't pay more than balance
                principal_sculpted[i] = p
            closing_sculpted[i] = balance - principal_sculpted[i]
            balance = closing_sculpted[i]

        opening = opening_sculpted
        principal = principal_sculpted
        closing = closing_sculpted
        interest = interest_sculpted
    else:
        # ── Standard Amortization ──────────────────────────────────────────
        annual_principal = total_debt / max(amort_years, 1)
        balance = total_debt
        for i in range(n):
            opening[i] = balance
            interest[i] = balance * interest_rate
            if i < grace:
                principal[i] = 0.0
            else:
                principal[i] = min(annual_principal, max(balance, 0.0))
            closing[i] = balance - principal[i]
            balance = closing[i]

    # ── DSRA (Debt Service Reserve Account) ─────────────────────────────────
    dsra_months = debt.debt_service_reserve_months
    for i in range(n):
        dsra_opening[i] = dsra_closing[i - 1] if i > 0 else 0.0
        ds = interest[i] + principal[i]
        required_balance = ds * dsra_months / 12.0
        # Interest earned on DSRA (simplified)
        dsra_interest[i] = dsra_opening[i] * interest_rate * 0.5  # half rate on reserve

        available_for_dsra = cfads_net[i] - ds
        if available_for_dsra >= 0 and dsra_opening[i] < required_balance:
            topup = min(required_balance - dsra_opening[i], available_for_dsra)
            dsra_topup[i] = topup
        elif available_for_dsra < 0 and dsra_opening[i] > 0:
            # Tap DSRA to cover shortfall
            release = min(abs(available_for_dsra), dsra_opening[i])
            dsra_release[i] = release
        dsra_closing[i] = dsra_opening[i] + dsra_interest[i] + dsra_topup[i] - dsra_release[i]
        dsra_closing[i] = max(dsra_closing[i], 0.0)

    # ── MRA Balance ──────────────────────────────────────────────────────────
    mra_bal = 0.0
    for i in range(n):
        mra_bal += mra_annual_funding[i] - mra_draw[i]
        mra_balance[i] = max(mra_bal, 0.0)

    # ── Cash Flow Waterfall & DSCR ───────────────────────────────────────────
    equity_distributions = np.zeros(n)
    waterfall_operating = cfads.copy()
    waterfall_debt_service = np.zeros(n)
    waterfall_dsra = np.zeros(n)
    waterfall_mra = np.zeros(n)
    waterfall_equity = np.zeros(n)

    for i in range(n):
        ds = interest[i] + principal[i]
        waterfall_debt_service[i] = ds
        remaining = cfads[i]

        # Step 1: Debt service
        remaining -= ds
        # Step 2: DSRA top-up
        remaining -= dsra_topup[i]
        # Step 3: MRA funding
        remaining -= mra_annual_funding[i]
        # Step 4: Equity distributions
        equity_distributions[i] = max(remaining, 0.0)
        waterfall_equity[i] = equity_distributions[i]

        d_val = _safe_dscr(cfads_net[i], ds)
        dscr.append(d_val)
        covenant_breach.append(d_val is not None and d_val < min_dscr_threshold)

    # ── LLCR & PLCR ──────────────────────────────────────────────────────────
    llcr: list[float | None] = []
    plcr: list[float | None] = []

    for i in range(n):
        remaining_cfads = cfads_net[i:].tolist()
        remaining_debt_service = (interest[i:] + principal[i:]).tolist()
        debt_bal = opening[i]

        # LLCR: NPV of CFADS during loan life / opening debt balance
        # Loan life = from period i to debt maturity
        loan_periods = sum(1 for p in principal[i:] if p > 0)
        if loan_periods == 0 or debt_bal < 1.0:
            llcr.append(None)
        else:
            loan_cfads = cfads_net[i:i + loan_periods + debt.grace_period_years].tolist()
            pv_loan_cfads = _npv_at_rate(loan_cfads, interest_rate)
            llcr.append(round(pv_loan_cfads / debt_bal, 4) if debt_bal > 0 else None)

        # PLCR: NPV of all remaining CFADS / opening debt balance
        if debt_bal < 1.0:
            plcr.append(None)
        else:
            pv_all_cfads = _npv_at_rate(cfads_net[i:].tolist(), interest_rate)
            plcr.append(round(pv_all_cfads / debt_bal, 4) if debt_bal > 0 else None)

    # ── Summary metrics ───────────────────────────────────────────────────────
    finite_dscr = [v for v in dscr[grace:] if v is not None and math.isfinite(v)]
    finite_llcr = [v for v in llcr if v is not None and math.isfinite(v)]

    return {
        "total_debt": float(total_debt),
        "opening_balance": opening.tolist(),
        "interest": interest.tolist(),
        "principal": principal.tolist(),
        "closing_balance": closing.tolist(),
        "dscr": dscr,
        "llcr": llcr,
        "plcr": plcr,
        "covenant_breach": covenant_breach,
        # DSRA
        "dsra_opening": dsra_opening.tolist(),
        "dsra_topup": dsra_topup.tolist(),
        "dsra_release": dsra_release.tolist(),
        "dsra_interest": dsra_interest.tolist(),
        "dsra_closing": dsra_closing.tolist(),
        # MRA
        "mra_funding": mra_annual_funding.tolist(),
        "mra_draw": mra_draw.tolist(),
        "mra_balance": mra_balance.tolist(),
        # Waterfall
        "cfads": cfads.tolist(),
        "cfads_net": cfads_net.tolist(),
        "debt_service": waterfall_debt_service.tolist(),
        "equity_distributions": equity_distributions.tolist(),
        # Summary
        "min_dscr": float(min(finite_dscr)) if finite_dscr else None,
        "avg_dscr": float(sum(finite_dscr) / len(finite_dscr)) if finite_dscr else None,
        "min_llcr": float(min(finite_llcr)) if finite_llcr else None,
        "avg_llcr": float(sum(finite_llcr) / len(finite_llcr)) if finite_llcr else None,
        "n_covenant_breaches": int(sum(covenant_breach)),
        "sculpted": debt.use_sculpting,
        # Legacy alias
        "dsra_balance": dsra_closing.tolist(),
        "dsra_required": (dsra_topup + dsra_closing).tolist(),
    }


# ── Multi-Tranche LBO Debt Schedule ───────────────────────────────────────────

def build_lbo_debt_schedule(
    tranches: list[dict],
    ebitda: list[float],
    capex: list[float],
    delta_nwc: list[float],
    cash_taxes: list[float],
    n: int,
) -> dict:
    """
    Multi-tranche debt schedule for LBO.
    Repays in order of seniority (Tranche A first, then B, etc.)
    Supports bullet, equal_installment, annuity, and PIK.
    """
    from math import log, exp

    n_tranches = len(tranches)
    tranche_opening = [np.zeros(n) for _ in range(n_tranches)]
    tranche_closing = [np.zeros(n) for _ in range(n_tranches)]
    tranche_interest = [np.zeros(n) for _ in range(n_tranches)]
    tranche_principal = [np.zeros(n) for _ in range(n_tranches)]
    tranche_pik = [np.zeros(n) for _ in range(n_tranches)]

    # FCF available for debt service (before interest)
    ebitda_arr = np.array(ebitda)
    capex_arr = np.array(capex)
    delta_nwc_arr = np.array(delta_nwc)
    taxes_arr = np.array(cash_taxes)

    for t_idx, tranche in enumerate(tranches):
        amount = tranche["amount"]
        rate = tranche["rate"]
        tenor = min(tranche["tenor_years"], n)
        amort_type = tranche.get("amortization_type", "equal_installment")
        is_pik = tranche.get("is_pik", False)

        balance = amount
        for i in range(n):
            tranche_opening[t_idx][i] = balance

            if is_pik:
                pik_accrual = balance * rate
                tranche_pik[t_idx][i] = pik_accrual
                tranche_interest[t_idx][i] = 0.0
                tranche_principal[t_idx][i] = 0.0
                balance = balance + pik_accrual
            else:
                cash_interest = balance * rate
                tranche_interest[t_idx][i] = cash_interest

                if i >= tenor or balance < 1.0:
                    p = balance if balance > 0 else 0.0
                    tranche_principal[t_idx][i] = p
                    balance = 0.0
                elif amort_type == "bullet":
                    tranche_principal[t_idx][i] = 0.0
                elif amort_type == "equal_installment":
                    annual_p = amount / tenor
                    tranche_principal[t_idx][i] = min(annual_p, balance)
                    balance = balance - tranche_principal[t_idx][i]
                elif amort_type == "annuity":
                    try:
                        pmt = amount * rate / (1 - (1 + rate) ** (-tenor))
                    except ZeroDivisionError:
                        pmt = amount / tenor
                    p = pmt - cash_interest
                    p = max(p, 0.0)
                    tranche_principal[t_idx][i] = min(p, balance)
                    balance = balance - tranche_principal[t_idx][i]
                else:
                    annual_p = amount / tenor
                    tranche_principal[t_idx][i] = min(annual_p, balance)
                    balance = balance - tranche_principal[t_idx][i]

                # Bullet maturity
                if i == tenor - 1 and amort_type == "bullet":
                    tranche_principal[t_idx][i] += balance
                    balance = 0.0

            tranche_closing[t_idx][i] = balance

    # Aggregate
    total_interest = sum(tranche_interest[t] + tranche_pik[t] for t in range(n_tranches))
    total_principal = sum(tranche_principal[t] for t in range(n_tranches))
    total_debt = sum(tranche_closing[t] for t in range(n_tranches))
    total_debt_service = total_interest + total_principal

    # FCF to equity
    operating_fcf = ebitda_arr - capex_arr - delta_nwc_arr - taxes_arr
    fcf_to_equity = operating_fcf - total_debt_service

    # DSCR
    dscr = []
    for i in range(n):
        ds = float(total_debt_service[i])
        cf = float(operating_fcf[i]) + float(total_interest[i])
        dscr.append(_safe_dscr(cf, ds))

    return {
        "tranche_details": [
            {
                "name": t["name"],
                "opening_balance": tranche_opening[ti].tolist(),
                "closing_balance": tranche_closing[ti].tolist(),
                "interest": tranche_interest[ti].tolist(),
                "principal": tranche_principal[ti].tolist(),
                "pik_accrual": tranche_pik[ti].tolist(),
            }
            for ti, t in enumerate(tranches)
        ],
        "total_interest": total_interest.tolist(),
        "total_principal": total_principal.tolist(),
        "total_debt_balance": total_debt.tolist(),
        "total_debt_service": total_debt_service.tolist(),
        "operating_fcf": operating_fcf.tolist(),
        "fcf_to_equity": fcf_to_equity.tolist(),
        "dscr": dscr,
    }
