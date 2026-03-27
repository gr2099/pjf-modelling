from fastapi import APIRouter
from app.models.schemas import DCFInput, WACCInput, WACCCAPMInput, ValuationInput
from app.engines.valuation import (
    dcf_valuation, wacc, wacc_capm, comparable_analysis, implied_ev_ebitda
)
from pydantic import BaseModel

router = APIRouter()


class ImpliedMultipleInput(BaseModel):
    growth_rate: float = 0.05
    roic: float = 0.15
    wacc: float = 0.10


@router.post("/dcf")
def run_dcf(inp: DCFInput):
    return dcf_valuation(
        free_cash_flows=inp.free_cash_flows,
        discount_rate=inp.discount_rate,
        terminal_growth_rate=inp.terminal_growth_rate,
        net_debt=inp.net_debt,
        shares_outstanding=inp.shares_outstanding,
        ebitda_last=inp.ebitda_last or 0.0,
        ev_ebitda_multiple=inp.ev_ebitda_multiple,
        roic=inp.roic,
        nopat_last=inp.nopat_last or 0.0,
        tv_method=inp.tv_method,
        minority_interest=inp.minority_interest,
        pension_deficit=inp.pension_deficit,
        normalized_capex_dep_ratio=inp.normalized_capex_dep_ratio,
        wc_pct_revenue=inp.wc_pct_revenue,
        depreciation_last=inp.depreciation_last or 0.0,
        revenue_last=inp.revenue_last or 0.0,
        revenue_growth_terminal=inp.revenue_growth_terminal,
    )


@router.post("/wacc")
def calc_wacc(inp: WACCInput):
    return wacc(
        equity_value=inp.equity_value,
        debt_value=inp.debt_value,
        cost_of_equity=inp.cost_of_equity,
        cost_of_debt=inp.cost_of_debt,
        tax_rate=inp.tax_rate,
    )


@router.post("/wacc-capm")
def run_wacc_capm(inp: WACCCAPMInput):
    return wacc_capm(
        risk_free_rate=inp.risk_free_rate,
        equity_risk_premium=inp.equity_risk_premium,
        beta=inp.beta,
        size_premium=inp.size_premium,
        country_risk_premium=inp.country_risk_premium,
        company_specific_premium=inp.company_specific_premium,
        cost_of_debt_pretax=inp.cost_of_debt_pretax,
        tax_rate=inp.tax_rate,
        debt_value=inp.debt_value,
        equity_value=inp.equity_value,
        target_debt_to_equity=inp.target_debt_to_equity,
        beta_unlevered=inp.beta_unlevered,
    )


@router.post("/comprehensive")
def run_comprehensive_valuation(inp: ValuationInput):
    dcf = dcf_valuation(
        free_cash_flows=inp.free_cash_flows,
        discount_rate=inp.discount_rate,
        terminal_growth_rate=inp.terminal_growth_rate,
        net_debt=inp.net_debt,
        shares_outstanding=inp.shares_outstanding,
        ebitda_last=inp.ebitda_last,
        ev_ebitda_multiple=inp.ev_ebitda_exit_multiple,
        roic=inp.roic,
        nopat_last=inp.nopat_last,
        tv_method="all",
        minority_interest=inp.minority_interest,
        depreciation_last=inp.depreciation_last,
        revenue_last=inp.revenue_last,
        normalized_capex_dep_ratio=inp.capex_dep_ratio_terminal,
        wc_pct_revenue=inp.wc_pct_revenue,
    )

    comps = comparable_analysis(
        comparables=[c.model_dump() for c in inp.comparable_companies],
        target_ebitda=inp.ebitda_last,
        target_revenue=inp.revenue_last,
        target_net_income=inp.nopat_last,
        net_debt=inp.net_debt,
    )

    impl = implied_ev_ebitda(inp.terminal_growth_rate, inp.roic, inp.discount_rate)

    return {
        "dcf": dcf,
        "comparable_analysis": comps,
        "implied_ev_ebitda_fundamental": impl,
        "football_field": dcf.get("football_field", {}),
    }


@router.post("/implied-multiple")
def implied_multiple(inp: ImpliedMultipleInput):
    multiple = implied_ev_ebitda(inp.growth_rate, inp.roic, inp.wacc)
    return {
        "implied_ev_ebitda": multiple,
        "growth_rate": inp.growth_rate,
        "roic": inp.roic,
        "wacc": inp.wacc,
    }
