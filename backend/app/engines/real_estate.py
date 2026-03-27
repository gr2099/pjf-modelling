"""
Real estate financial model engine.
Implements: NOI, debt service, cash flow waterfall, IRR, cap rate valuation.
"""
from __future__ import annotations
import numpy as np
from app.models.schemas import RealEstateInput
from app.engines.valuation import irr as calc_irr


def build_real_estate_model(inp: RealEstateInput) -> dict:
    n = inp.hold_period_years
    tax = inp.tax_rate

    # ── Sources & Uses ────────────────────────────────────────────────────────
    debt_amount = inp.purchase_price * (1 - inp.equity_pct)
    equity_invested = inp.purchase_price * inp.equity_pct
    ltv = 1 - inp.equity_pct

    sources_uses = {
        "purchase_price": inp.purchase_price,
        "equity": equity_invested,
        "debt": debt_amount,
        "loan_to_value": ltv,
    }

    # ── Occupancy Ramp ────────────────────────────────────────────────────────
    occupancy = np.zeros(n)
    stab_yr = inp.stabilization_years
    for i in range(n):
        if stab_yr <= 0:
            occupancy[i] = inp.stabilized_occupancy
        elif i < stab_yr:
            # Linear ramp from initial to stabilized
            occupancy[i] = inp.initial_occupancy + (
                (inp.stabilized_occupancy - inp.initial_occupancy) * (i + 1) / stab_yr
            )
        else:
            occupancy[i] = inp.stabilized_occupancy

    # ── Revenue ───────────────────────────────────────────────────────────────
    rent_per_sqft = np.array([
        inp.rent_per_sqft_per_year * (1 + inp.rent_growth_rate) ** i
        for i in range(n)
    ])
    gross_potential_rent = inp.rentable_area_sqft * rent_per_sqft
    vacancy_loss = gross_potential_rent * (1 - occupancy)
    credit_loss = gross_potential_rent * inp.vacancy_credit_loss_pct
    effective_gross_income = gross_potential_rent - vacancy_loss - credit_loss

    # ── Operating Expenses ────────────────────────────────────────────────────
    opex = np.array([
        inp.opex_per_sqft_per_year * inp.rentable_area_sqft * (1 + inp.opex_growth_rate) ** i
        for i in range(n)
    ])
    capex_reserve = inp.capex_reserve_per_sqft * inp.rentable_area_sqft * np.ones(n)

    noi = effective_gross_income - opex
    noi_after_reserves = noi - capex_reserve

    # Leasing costs — occurs at stabilization year and every 5 years (lease roll)
    leasing_costs = np.zeros(n)
    tenant_improvements = np.zeros(n)
    for i in range(n):
        if i == 0 or (i > 0 and i % 5 == 0):
            leasing_costs[i] = effective_gross_income[i] * inp.leasing_commissions_pct
            tenant_improvements[i] = inp.tenant_improvement_per_sqft * inp.rentable_area_sqft

    # ── Debt Service ──────────────────────────────────────────────────────────
    # Amortizing mortgage
    rate = inp.debt_rate
    amort = inp.debt_amort_years
    # Monthly payment
    monthly_rate = rate / 12
    n_payments = amort * 12
    if monthly_rate > 0:
        monthly_pmt = debt_amount * monthly_rate * (1 + monthly_rate) ** n_payments / (
            (1 + monthly_rate) ** n_payments - 1
        )
    else:
        monthly_pmt = debt_amount / n_payments
    annual_debt_service = monthly_pmt * 12

    # Build debt schedule (annual)
    debt_opening = np.zeros(n)
    debt_closing = np.zeros(n)
    interest_paid = np.zeros(n)
    principal_paid = np.zeros(n)
    balance = debt_amount

    for i in range(n):
        debt_opening[i] = balance
        # Approximate annual interest/principal split
        annual_interest = balance * rate
        annual_principal = annual_debt_service - annual_interest
        annual_principal = max(min(annual_principal, balance), 0.0)
        interest_paid[i] = annual_interest
        principal_paid[i] = annual_principal
        balance = balance - annual_principal
        debt_closing[i] = max(balance, 0.0)

    # ── Cash Flow to Equity ───────────────────────────────────────────────────
    # Pre-tax
    cfbt = (noi_after_reserves - annual_debt_service
            - leasing_costs - tenant_improvements)

    # Tax: simplified (no depreciation tax shield modeled in detail)
    # Depreciation for tax purposes
    annual_dep_tax = inp.purchase_price * (1 - 0.20) / inp.depreciation_years  # 80% depreciable
    taxable_income = noi - interest_paid - annual_dep_tax
    income_tax = np.maximum(taxable_income, 0) * tax

    cfat = cfbt - income_tax  # after-tax cash flow to equity

    # ── Cap Rate & Valuation ──────────────────────────────────────────────────
    # Entry valuation check
    implied_entry_cap_rate = noi[0] / inp.purchase_price

    # Exit: NOI in year n / exit cap rate
    exit_noi = noi[-1] * (1 + inp.rent_growth_rate)  # stabilized NOI at exit
    exit_ev = exit_noi / inp.exit_cap_rate
    exit_debt = float(debt_closing[-1])
    exit_equity_proceeds_pre_tax = exit_ev - exit_debt

    # Capital gains tax on exit
    book_value = inp.purchase_price - annual_dep_tax * n
    capital_gain = exit_ev - book_value
    cg_tax = max(capital_gain * tax * 0.80, 0)  # assume LT CGT at 80% of income tax rate
    exit_equity_net = exit_equity_proceeds_pre_tax - cg_tax

    # ── Returns ───────────────────────────────────────────────────────────────
    equity_cf = [-equity_invested] + cfat[:-1].tolist() + [float(cfat[-1]) + exit_equity_net]
    equity_irr = calc_irr(equity_cf)
    moic = (sum(max(cf, 0) for cf in equity_cf[1:]) + exit_equity_net) / equity_invested
    cash_on_cash = [float(cf / equity_invested) for cf in cfat]

    # Unlevered IRR (all-equity)
    unlevered_cf = [-inp.purchase_price] + noi_after_reserves[:-1].tolist() + [
        float(noi_after_reserves[-1]) + exit_ev
    ]
    unlevered_irr = calc_irr(unlevered_cf)

    # DSCR
    dscr = [round(float(noi[i] / annual_debt_service), 4) if annual_debt_service > 0 else None
            for i in range(n)]

    # ── Per-Unit Metrics ──────────────────────────────────────────────────────
    sqft = inp.rentable_area_sqft
    years = list(range(1, n + 1))

    # ── NOI Yield ─────────────────────────────────────────────────────────────
    noi_yield = (noi / inp.purchase_price).tolist()

    return {
        "name": inp.name,
        "years": years,
        "sources_uses": sources_uses,
        "property": {
            "rentable_area_sqft": sqft,
            "property_type": inp.property_type,
        },
        "revenue": {
            "rent_per_sqft": rent_per_sqft.tolist(),
            "gross_potential_rent": gross_potential_rent.tolist(),
            "occupancy": occupancy.tolist(),
            "vacancy_loss": vacancy_loss.tolist(),
            "effective_gross_income": effective_gross_income.tolist(),
        },
        "expenses": {
            "opex": opex.tolist(),
            "capex_reserve": capex_reserve.tolist(),
            "leasing_costs": leasing_costs.tolist(),
            "tenant_improvements": tenant_improvements.tolist(),
        },
        "noi": noi.tolist(),
        "noi_after_reserves": noi_after_reserves.tolist(),
        "noi_yield": noi_yield,
        "debt_schedule": {
            "opening_balance": debt_opening.tolist(),
            "interest": interest_paid.tolist(),
            "principal": principal_paid.tolist(),
            "closing_balance": debt_closing.tolist(),
            "annual_debt_service": [annual_debt_service] * n,
            "dscr": dscr,
        },
        "cash_flow": {
            "cfbt": cfbt.tolist(),
            "income_tax": income_tax.tolist(),
            "cfat": cfat.tolist(),
            "cash_on_cash": cash_on_cash,
        },
        "exit": {
            "exit_noi": float(exit_noi),
            "exit_cap_rate": inp.exit_cap_rate,
            "exit_ev": exit_ev,
            "exit_debt": exit_debt,
            "exit_equity_pretax": exit_equity_proceeds_pre_tax,
            "capital_gains_tax": cg_tax,
            "exit_equity_net": exit_equity_net,
            "implied_entry_cap_rate": round(implied_entry_cap_rate, 4),
        },
        "returns": {
            "equity_irr": equity_irr,
            "unlevered_irr": unlevered_irr,
            "equity_multiple": moic,
            "total_equity_distributions": sum(max(cf, 0) for cf in cfat),
            "equity_cash_flows": equity_cf,
        },
        "key_metrics": {
            "equity_irr": equity_irr,
            "unlevered_irr": unlevered_irr,
            "equity_multiple": moic,
            "min_dscr": min(v for v in dscr if v is not None) if dscr else None,
            "avg_dscr": sum(v for v in dscr if v is not None) / max(sum(1 for v in dscr if v is not None), 1),
            "entry_cap_rate": round(implied_entry_cap_rate, 4),
            "exit_cap_rate": inp.exit_cap_rate,
            "noi_year_1": float(noi[0]),
            "stabilized_noi": float(noi[min(stab_yr, n - 1)]),
            "ltv": ltv,
            "equity_invested": equity_invested,
            "exit_equity_net": exit_equity_net,
        }
    }
