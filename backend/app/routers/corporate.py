from fastapi import APIRouter
from app.models.schemas import CorporateModelInput
from app.engines.cash_flow import build_corporate_cash_flows, build_balance_sheet
from app.engines.debt_schedule import build_debt_schedule
from app.engines.tax import build_tax_schedule
from app.engines.valuation import dcf_valuation, irr as calc_irr

router = APIRouter()


@router.post("/run")
def run_corporate_model(inp: CorporateModelInput):
    cf = build_corporate_cash_flows(inp)
    n = inp.timeline.forecast_years

    tax = build_tax_schedule(
        ebit=cf["ebit"],
        tax_rate=inp.tax.tax_rate,
        nol_opening=inp.tax.nol_carryforward,
        nol_expiry_years=inp.tax.nol_expiry_years,
        depreciation_book=cf["depreciation"],
        depreciation_tax=cf["tax_depreciation"],
    )

    # Post-tax FCF using actual cash taxes
    fcf_aftertax = [
        cf["ebitda"][i] - cf["capex"][i] - cf["delta_nwc"][i] - tax["cash_taxes"][i]
        for i in range(n)
    ]

    debt = build_debt_schedule(fcf_aftertax, inp.debt, n)

    # Balance Sheet
    bs = build_balance_sheet(cf, tax, debt, n)

    val = dcf_valuation(
        free_cash_flows=fcf_aftertax,
        discount_rate=inp.timeline.discount_rate,
        terminal_growth_rate=inp.timeline.terminal_growth_rate,
        net_debt=max(debt["closing_balance"][-1], 0.0),
        shares_outstanding=inp.roic.shares_outstanding,
        ebitda_last=cf["ebitda"][-1],
        ev_ebitda_multiple=8.0,
        roic=float(max(cf["roic"][-1], 0.05)),
        nopat_last=cf["nopat"][-1],
        tv_method="all",
        depreciation_last=cf["depreciation"][-1],
        revenue_last=cf["revenue"][-1],
    )

    equity_irr = calc_irr([-inp.debt.initial_debt] + debt["equity_fcf"])

    # ROIC spread chart data
    roic_chart = [
        {
            "year": cf["years"][i],
            "roic": round(float(cf["roic"][i]) * 100, 2),
            "wacc": round(inp.roic.wacc * 100, 2),
            "spread": round(float(cf["roic_spread"][i]) * 100, 2),
            "economic_profit": cf["economic_profit"][i],
            "invested_capital": cf["avg_invested_capital"][i],
        }
        for i in range(n)
    ]

    # Financial ratios summary
    ratios = {
        "gross_margin": [round(cf["gross_profit"][i] / max(cf["revenue"][i], 1e-9), 4) for i in range(n)],
        "ebitda_margin": cf["ebitda_margin"],
        "ebit_margin": cf["ebit_margin"],
        "roic": cf["roic"],
        "roic_spread": cf["roic_spread"],
        "economic_profit": cf["economic_profit"],
        "dscr": debt["dscr"],
        "interest_coverage": debt["interest_coverage"],
        "debt_to_ebitda": bs["debt_to_ebitda"],
        "debt_to_equity": bs["debt_to_equity"],
        "current_ratio": bs["current_ratio"],
        "roe": bs["roe"],
    }

    return {
        "name": inp.name,
        "years": cf["years"],
        "income_statement": {
            "revenue": cf["revenue"],
            "cogs": cf["cogs"],
            "gross_profit": cf["gross_profit"],
            "gross_margin": ratios["gross_margin"],
            "sga": cf["sga"],
            "rd": cf["rd"],
            "ebitda": cf["ebitda"],
            "ebitda_margin": cf["ebitda_margin"],
            "depreciation": cf["depreciation"],
            "ebit": cf["ebit"],
            "ebit_margin": cf["ebit_margin"],
            "interest": debt["interest"],
            "ebt": [cf["ebit"][i] - debt["interest"][i] for i in range(n)],
            "cash_taxes": tax["cash_taxes"],
            "net_income": bs["net_income"],
            "net_margin": [
                round(bs["net_income"][i] / max(cf["revenue"][i], 1e-9), 4) for i in range(n)
            ],
        },
        "cash_flow_statement": {
            "net_income": bs["net_income"],
            "depreciation": cf["depreciation"],
            "delta_nwc": cf["delta_nwc"],
            "operating_cash_flow": bs["operating_cash_flow"],
            "capex": cf["capex"],
            "maintenance_capex": cf["maintenance_capex"],
            "growth_capex": cf["growth_capex"],
            "investing_cash_flow": [-v for v in cf["capex"]],
            "new_debt": debt["new_debt"],
            "principal_repayment": debt["principal"],
            "financing_cash_flow": [
                debt["new_debt"][i] - debt["principal"][i] - debt["interest"][i]
                for i in range(n)
            ],
            "fcf_pretax": cf["fcf_pretax"],
            "fcf_aftertax": fcf_aftertax,
            "nwc": cf["nwc"],
            "delta_nwc": cf["delta_nwc"],
        },
        "balance_sheet": {
            "cash": bs["cash"],
            "accounts_receivable": bs["accounts_receivable"],
            "inventory": bs["inventory"],
            "total_current_assets": bs["total_current_assets"],
            "net_ppe": bs["net_ppe"],
            "total_assets": bs["total_assets"],
            "accounts_payable": bs["accounts_payable"],
            "total_current_liabilities": bs["total_current_liabilities"],
            "long_term_debt": bs["long_term_debt"],
            "total_liabilities": bs["total_liabilities"],
            "total_equity": bs["total_equity"],
        },
        "working_capital": {
            "ar": cf["ar"],
            "inventory": cf["inventory"],
            "ap": cf["ap"],
            "nwc": cf["nwc"],
            "delta_nwc": cf["delta_nwc"],
        },
        "tax": tax,
        "debt_schedule": debt,
        "roic_analysis": {
            "invested_capital": cf["invested_capital"],
            "avg_invested_capital": cf["avg_invested_capital"],
            "nopat": cf["nopat"],
            "roic": cf["roic"],
            "wacc": [inp.roic.wacc] * n,
            "roic_spread": cf["roic_spread"],
            "economic_profit": cf["economic_profit"],
            "chart_data": roic_chart,
        },
        "valuation": val,
        "ratios": ratios,
        "equity_irr": equity_irr,
        "key_metrics": {
            "enterprise_value": val["enterprise_value"],
            "equity_value": val["equity_value"],
            "equity_irr": equity_irr,
            "tv_pct_ev": val["terminal_value_pct"],
            "peak_ebitda": max(cf["ebitda"]),
            "peak_roic": max(cf["roic"]),
            "terminal_roic": cf["roic"][-1],
            "avg_roic_spread": sum(cf["roic_spread"]) / n,
            "net_debt_exit": debt["closing_balance"][-1],
            "ebitda_margin_exit": cf["ebitda_margin"][-1],
            "football_field": val["football_field"],
        },
    }
