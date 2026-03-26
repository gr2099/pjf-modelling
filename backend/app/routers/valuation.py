from fastapi import APIRouter
from app.models.schemas import DCFInput, WACCInput
from app.engines.valuation import dcf_valuation, wacc, implied_ev_ebitda
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class ImpliedMultipleInput(BaseModel):
    growth_rate: float = 0.05
    roic: float = 0.15
    wacc: float = 0.10


@router.post("/dcf")
def dcf(inp: DCFInput):
    return dcf_valuation(
        free_cash_flows=inp.free_cash_flows,
        discount_rate=inp.discount_rate,
        terminal_growth_rate=inp.terminal_growth_rate,
        net_debt=inp.net_debt,
        shares_outstanding=inp.shares_outstanding,
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


@router.post("/implied-multiple")
def implied_multiple(inp: ImpliedMultipleInput):
    multiple = implied_ev_ebitda(inp.growth_rate, inp.roic, inp.wacc)
    return {
        "implied_ev_ebitda": multiple,
        "growth_rate": inp.growth_rate,
        "roic": inp.roic,
        "wacc": inp.wacc,
    }
