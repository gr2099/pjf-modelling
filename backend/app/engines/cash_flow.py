"""
Free cash flow calculation engine.
Implements: Revenue → EBITDA → EBIT → NOPAT → FCF
"""
from __future__ import annotations
import numpy as np
from app.models.schemas import CorporateModelInput


def build_corporate_cash_flows(inp: CorporateModelInput) -> dict:
    n = inp.timeline.forecast_years
    years = list(range(inp.timeline.start_year, inp.timeline.start_year + n))

    # ── Revenue ────────────────────────────────────────────────────────────
    growth = inp.revenue.growth_rates
    if len(growth) < n:
        growth = growth + [growth[-1]] * (n - len(growth))
    growth = growth[:n]

    revenue = np.zeros(n)
    revenue[0] = inp.revenue.base_revenue * (1 + growth[0])
    for i in range(1, n):
        revenue[i] = revenue[i - 1] * (1 + growth[i])

    # ── EBITDA ─────────────────────────────────────────────────────────────
    cogs = revenue * inp.costs.cogs_pct
    gross_profit = revenue - cogs
    sga = revenue * inp.costs.sga_pct
    ebitda = gross_profit - sga
    if inp.costs.ebitda_margin_override is not None:
        ebitda = revenue * inp.costs.ebitda_margin_override

    # ── Capex & Depreciation ───────────────────────────────────────────────
    maintenance_capex = revenue * inp.capex.maintenance_capex_pct
    growth_capex = np.zeros(n)
    for i, v in enumerate(inp.capex.growth_capex[:n]):
        growth_capex[i] = v
    total_capex = maintenance_capex + growth_capex

    dep_life = inp.capex.depreciation_years
    depreciation = np.zeros(n)
    for i in range(n):
        cap = total_capex[i]
        for j in range(i, min(i + dep_life, n)):
            depreciation[j] += cap / dep_life

    # ── Working Capital ────────────────────────────────────────────────────
    wc = inp.working_capital
    nwc = revenue * (wc.dso_days + wc.dio_days - wc.dpo_days) / 365.0
    delta_nwc = np.diff(nwc, prepend=nwc[0])
    delta_nwc[0] = 0.0

    # ── Operating FCF (pre-financing) ──────────────────────────────────────
    ebit = ebitda - depreciation
    taxes_on_ebit = np.maximum(ebit, 0) * inp.tax.tax_rate
    nopat = ebit - taxes_on_ebit
    fcf_pretax = ebitda - total_capex - delta_nwc
    fcf_aftertax = nopat + depreciation - total_capex - delta_nwc

    return {
        "years": years,
        "revenue": revenue.tolist(),
        "cogs": cogs.tolist(),
        "gross_profit": gross_profit.tolist(),
        "sga": sga.tolist(),
        "ebitda": ebitda.tolist(),
        "ebitda_margin": (ebitda / revenue).tolist(),
        "depreciation": depreciation.tolist(),
        "ebit": ebit.tolist(),
        "capex": total_capex.tolist(),
        "delta_nwc": delta_nwc.tolist(),
        "nwc": nwc.tolist(),
        "fcf_pretax": fcf_pretax.tolist(),
        "fcf_aftertax": fcf_aftertax.tolist(),
        "taxes_on_ebit": taxes_on_ebit.tolist(),
        "nopat": nopat.tolist(),
    }
