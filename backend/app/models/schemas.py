from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


# ── Shared ────────────────────────────────────────────────────────────────────

class TimelineConfig(BaseModel):
    start_year: int = 2024
    forecast_years: int = 10
    terminal_growth_rate: float = Field(0.025, ge=0, le=0.2)
    discount_rate: float = Field(0.10, ge=0, le=1.0)


# ── Corporate Model ───────────────────────────────────────────────────────────

class RevenueAssumptions(BaseModel):
    base_revenue: float = Field(..., gt=0, description="Base revenue (Year 0, $)")
    growth_rates: list[float] = Field(..., description="Annual revenue growth rates (one per forecast year)")
    inflation_rate: float = Field(0.02, ge=0, le=0.5)


class CostAssumptions(BaseModel):
    cogs_pct: float = Field(0.45, ge=0, le=1.0, description="COGS as % of revenue")
    sga_pct: float = Field(0.15, ge=0, le=1.0, description="SG&A as % of revenue")
    ebitda_margin_override: Optional[float] = Field(None, ge=0, le=1.0)


class CapexAssumptions(BaseModel):
    maintenance_capex_pct: float = Field(0.03, ge=0, le=1.0, description="Maintenance capex as % of revenue")
    growth_capex: list[float] = Field(default_factory=list, description="Growth capex per year ($)")
    depreciation_years: int = Field(10, ge=1, le=50)


class WorkingCapitalAssumptions(BaseModel):
    dso_days: float = Field(45, ge=0, description="Days Sales Outstanding")
    dpo_days: float = Field(30, ge=0, description="Days Payable Outstanding")
    dio_days: float = Field(60, ge=0, description="Days Inventory Outstanding")


class DebtAssumptions(BaseModel):
    initial_debt: float = Field(0.0, ge=0, description="Opening debt balance ($)")
    interest_rate: float = Field(0.06, ge=0, le=1.0)
    amortization_years: int = Field(7, ge=1)
    new_debt_schedule: list[float] = Field(default_factory=list, description="New debt drawdowns per year")


class TaxAssumptions(BaseModel):
    tax_rate: float = Field(0.25, ge=0, le=1.0)
    nol_carryforward: float = Field(0.0, ge=0, description="Opening NOL balance ($)")
    nol_expiry_years: int = Field(20, ge=1)


class CorporateModelInput(BaseModel):
    name: str = "New Corporate Model"
    timeline: TimelineConfig = TimelineConfig()
    revenue: RevenueAssumptions
    costs: CostAssumptions = CostAssumptions()
    capex: CapexAssumptions = CapexAssumptions()
    working_capital: WorkingCapitalAssumptions = WorkingCapitalAssumptions()
    debt: DebtAssumptions = DebtAssumptions()
    tax: TaxAssumptions = TaxAssumptions()


# ── Project Finance Model ─────────────────────────────────────────────────────

class ProjectPhase(BaseModel):
    construction_years: int = Field(2, ge=0)
    operating_years: int = Field(20, ge=1)
    decommissioning_years: int = Field(1, ge=0)


class ProjectRevenueAssumptions(BaseModel):
    capacity_mw: Optional[float] = Field(None, description="Capacity (MW or units)")
    capacity_factor: float = Field(0.35, ge=0, le=1.0)
    price_per_unit: float = Field(50.0, gt=0, description="Price per unit ($/MWh or equiv.)")
    price_escalation: float = Field(0.02, ge=-0.1, le=0.2)


class ProjectCostAssumptions(BaseModel):
    construction_cost: float = Field(..., gt=0, description="Total construction cost ($)")
    equity_pct: float = Field(0.30, ge=0, le=1.0)
    opex_per_year: float = Field(0.0, ge=0, description="Annual O&M cost ($)")
    opex_escalation: float = Field(0.02)


class ProjectDebtAssumptions(BaseModel):
    interest_rate: float = Field(0.055, ge=0, le=1.0)
    amortization_years: int = Field(15, ge=1)
    debt_service_reserve_months: int = Field(6, ge=0)
    grace_period_years: int = Field(0, ge=0)


class ProjectFinanceInput(BaseModel):
    name: str = "New Project Finance Model"
    timeline: TimelineConfig = TimelineConfig()
    phases: ProjectPhase = ProjectPhase()
    revenue: ProjectRevenueAssumptions
    costs: ProjectCostAssumptions
    debt: ProjectDebtAssumptions = ProjectDebtAssumptions()
    tax: TaxAssumptions = TaxAssumptions()


# ── Acquisition / LBO Model ───────────────────────────────────────────────────

class AcquisitionInput(BaseModel):
    name: str = "New Acquisition Model"
    purchase_price: float = Field(..., gt=0)
    entry_ebitda_multiple: float = Field(..., gt=0)
    exit_ebitda_multiple: float = Field(..., gt=0)
    holding_period_years: int = Field(5, ge=1, le=20)
    equity_pct: float = Field(0.40, ge=0.01, le=1.0)
    debt_interest_rate: float = Field(0.07, ge=0, le=1.0)
    ebitda_growth_rate: float = Field(0.08, ge=-0.5, le=1.0)
    revenue_synergies: float = Field(0.0, ge=0, description="Annual synergies ($)")
    cost_savings: float = Field(0.0, ge=0, description="Annual cost savings ($)")
    tax_rate: float = Field(0.25, ge=0, le=1.0)


# ── Risk Analysis ─────────────────────────────────────────────────────────────

class SensitivityInput(BaseModel):
    base_npv: float
    variable_name: str
    base_value: float
    low_value: float
    high_value: float
    npv_at_low: float
    npv_at_high: float


class ScenarioInput(BaseModel):
    name: str
    assumptions: dict[str, float]


class MonteCarloInput(BaseModel):
    base_revenue: float = Field(..., gt=0)
    revenue_volatility: float = Field(0.15, ge=0, le=2.0, description="Annual revenue volatility (std dev)")
    base_opex: float = Field(..., gt=0)
    opex_volatility: float = Field(0.10, ge=0)
    discount_rate: float = Field(0.10, ge=0, le=1.0)
    terminal_growth_rate: float = Field(0.025, ge=0)
    forecast_years: int = Field(10, ge=1, le=30)
    n_simulations: int = Field(1000, ge=100, le=10000)
    mean_reversion_speed: float = Field(0.3, ge=0, le=2.0)
    correlation_rev_opex: float = Field(0.3, ge=-1.0, le=1.0)


# ── Valuation ─────────────────────────────────────────────────────────────────

class DCFInput(BaseModel):
    free_cash_flows: list[float] = Field(..., description="FCF per year ($)")
    terminal_growth_rate: float = Field(0.025, ge=0, le=0.15)
    discount_rate: float = Field(0.10, ge=0, le=1.0)
    net_debt: float = Field(0.0, description="Net debt ($) — subtracted from EV to get equity value")
    shares_outstanding: Optional[float] = Field(None, gt=0)


class WACCInput(BaseModel):
    equity_value: float = Field(..., gt=0)
    debt_value: float = Field(..., ge=0)
    cost_of_equity: float = Field(0.12, ge=0, le=1.0)
    cost_of_debt: float = Field(0.06, ge=0, le=1.0)
    tax_rate: float = Field(0.25, ge=0, le=1.0)
