from fastapi import APIRouter
from app.models.schemas import CorporateModelInput
from app.engines.cash_flow import build_corporate_cash_flows
from app.engines.debt_schedule import build_debt_schedule
from app.engines.tax import build_tax_schedule
from app.engines.valuation import dcf_valuation, irr as calc_irr

router = APIRouter()


@router.post("/run")
def run_corporate_model(inp: CorporateModelInput):
    cf = build_corporate_cash_flows(inp)

    tax = build_tax_schedule(
        ebit=cf["ebit"],
        tax_rate=inp.tax.tax_rate,
        nol_opening=inp.tax.nol_carryforward,
        nol_expiry_years=inp.tax.nol_expiry_years,
    )

    # Post-tax FCF using actual cash taxes
    fcf_aftertax = [
        cf["ebitda"][i] - cf["capex"][i] - cf["delta_nwc"][i] - tax["cash_taxes"][i]
        for i in range(inp.timeline.forecast_years)
    ]

    debt = build_debt_schedule(fcf_aftertax, inp.debt, inp.timeline.forecast_years)

    val = dcf_valuation(
        free_cash_flows=fcf_aftertax,
        discount_rate=inp.timeline.discount_rate,
        terminal_growth_rate=inp.timeline.terminal_growth_rate,
        net_debt=debt["closing_balance"][-1],
    )

    equity_irr = calc_irr([-inp.debt.initial_debt] + debt["equity_fcf"])

    return {
        "name": inp.name,
        "years": cf["years"],
        "income_statement": {
            "revenue": cf["revenue"],
            "cogs": cf["cogs"],
            "gross_profit": cf["gross_profit"],
            "sga": cf["sga"],
            "ebitda": cf["ebitda"],
            "ebitda_margin": cf["ebitda_margin"],
            "depreciation": cf["depreciation"],
            "ebit": cf["ebit"],
        },
        "cash_flow": {
            "capex": cf["capex"],
            "delta_nwc": cf["delta_nwc"],
            "nwc": cf["nwc"],
            "fcf_pretax": cf["fcf_pretax"],
            "fcf_aftertax": fcf_aftertax,
        },
        "tax": tax,
        "debt_schedule": debt,
        "valuation": val,
        "equity_irr": equity_irr,
    }
