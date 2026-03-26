from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.models.schemas import MonteCarloInput
from app.engines.monte_carlo import run_monte_carlo
from app.engines.risk import tornado_data, waterfall_data, break_even_analysis
from app.engines.valuation import dcf_valuation

router = APIRouter()


class TornadoRequest(BaseModel):
    base_npv: float
    sensitivities: list[dict]  # [{variable, base_npv, npv_at_low, npv_at_high}]


class WaterfallRequest(BaseModel):
    base_npv: float
    impacts: list[dict]  # [{label, delta}]


class BreakEvenRequest(BaseModel):
    base_fcfs: list[float]
    discount_rate: float = 0.10
    terminal_growth_rate: float = 0.025
    variable_low: float
    variable_high: float
    variable_name: str = "Variable"


@router.post("/monte-carlo")
def monte_carlo(inp: MonteCarloInput):
    return run_monte_carlo(inp)


@router.post("/tornado")
def tornado(req: TornadoRequest):
    return {"rows": tornado_data(req.sensitivities)}


@router.post("/waterfall")
def waterfall(req: WaterfallRequest):
    return {"rows": waterfall_data(req.base_npv, req.impacts)}


@router.post("/break-even")
def break_even(req: BreakEvenRequest):
    # Simple linear interpolation approach without needing a callback
    import numpy as np
    n_points = 50
    values = np.linspace(req.variable_low, req.variable_high, n_points)
    npvs = []
    for v in values:
        # Scale first FCF by the ratio of v to mid-range
        mid = (req.variable_low + req.variable_high) / 2.0
        scale = v / mid if mid != 0 else 1.0
        scaled_fcfs = [cf * scale for cf in req.base_fcfs]
        val = dcf_valuation(scaled_fcfs, req.discount_rate, req.terminal_growth_rate)
        npvs.append(val["enterprise_value"])

    npv_arr = np.array(npvs)
    break_even = None
    for i in range(len(npv_arr) - 1):
        if npv_arr[i] * npv_arr[i + 1] <= 0:
            t = npv_arr[i] / (npv_arr[i] - npv_arr[i + 1])
            break_even = float(values[i] + t * (values[i + 1] - values[i]))
            break

    return {
        "variable": req.variable_name,
        "values": values.tolist(),
        "npvs": npvs,
        "break_even": break_even,
    }
