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

class RevenueSegment(BaseModel):
    name: str = "Segment 1"
    base_revenue: float = Field(..., gt=0)
    growth_rates: list[float] = Field(..., description="Annual growth rates per forecast year")

class RevenueAssumptions(BaseModel):
    base_revenue: float = Field(..., gt=0, description="Base revenue (Year 0, $)")
    growth_rates: list[float] = Field(..., description="Annual revenue growth rates (one per forecast year)")
    inflation_rate: float = Field(0.02, ge=0, le=0.5)
    segments: list[RevenueSegment] = Field(default_factory=list)


class CostAssumptions(BaseModel):
    cogs_pct: float = Field(0.45, ge=0, le=1.0, description="COGS as % of revenue")
    sga_pct: float = Field(0.15, ge=0, le=1.0, description="SG&A as % of revenue")
    ebitda_margin_override: Optional[float] = Field(None, ge=0, le=1.0)
    rd_pct: float = Field(0.0, ge=0, le=1.0, description="R&D as % of revenue")
    fixed_costs: float = Field(0.0, ge=0, description="Fixed costs per year ($)")


class CapexAssumptions(BaseModel):
    maintenance_capex_pct: float = Field(0.03, ge=0, le=1.0, description="Maintenance capex as % of revenue")
    growth_capex: list[float] = Field(default_factory=list, description="Growth capex per year ($)")
    depreciation_years: int = Field(10, ge=1, le=50)
    depreciation_method: str = Field("straight_line", description="straight_line | declining_balance")
    declining_balance_rate: float = Field(0.20, ge=0, le=1.0, description="Rate for declining balance method")
    half_year_convention: bool = Field(True)


class WorkingCapitalAssumptions(BaseModel):
    dso_days: float = Field(45, ge=0, description="Days Sales Outstanding")
    dpo_days: float = Field(30, ge=0, description="Days Payable Outstanding")
    dio_days: float = Field(60, ge=0, description="Days Inventory Outstanding")
    other_current_assets_pct: float = Field(0.0, ge=0)
    other_current_liabilities_pct: float = Field(0.0, ge=0)


class DebtAssumptions(BaseModel):
    initial_debt: float = Field(0.0, ge=0, description="Opening debt balance ($)")
    interest_rate: float = Field(0.06, ge=0, le=1.0)
    amortization_years: int = Field(7, ge=1)
    new_debt_schedule: list[float] = Field(default_factory=list, description="New debt drawdowns per year")


class TaxAssumptions(BaseModel):
    tax_rate: float = Field(0.25, ge=0, le=1.0)
    nol_carryforward: float = Field(0.0, ge=0, description="Opening NOL balance ($)")
    nol_expiry_years: int = Field(20, ge=1)
    accelerated_depreciation_pct: float = Field(0.0, ge=0, le=1.0,
        description="Additional % of capex deducted in year 1 for tax (bonus depreciation)")


class HistoricalData(BaseModel):
    years: list[int] = Field(default_factory=list)
    revenue: list[float] = Field(default_factory=list)
    ebitda: list[float] = Field(default_factory=list)
    net_income: list[float] = Field(default_factory=list)
    total_assets: list[float] = Field(default_factory=list)
    total_equity: list[float] = Field(default_factory=list)
    total_debt: list[float] = Field(default_factory=list)


class ROICAssumptions(BaseModel):
    opening_invested_capital: float = Field(0.0, ge=0, description="Opening invested capital ($)")
    shares_outstanding: Optional[float] = Field(None, gt=0)
    # WACC for ROIC spread
    wacc: float = Field(0.10, ge=0, le=1.0)


class CorporateModelInput(BaseModel):
    name: str = "New Corporate Model"
    timeline: TimelineConfig = TimelineConfig()
    revenue: RevenueAssumptions
    costs: CostAssumptions = CostAssumptions()
    capex: CapexAssumptions = CapexAssumptions()
    working_capital: WorkingCapitalAssumptions = WorkingCapitalAssumptions()
    debt: DebtAssumptions = DebtAssumptions()
    tax: TaxAssumptions = TaxAssumptions()
    roic: ROICAssumptions = ROICAssumptions()
    historical: Optional[HistoricalData] = None


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
    ramp_up_years: int = Field(0, ge=0, description="Years to reach full capacity factor")
    annual_degradation: float = Field(0.005, ge=0, le=0.1, description="Annual capacity/volume decline rate")


class ProjectCostAssumptions(BaseModel):
    construction_cost: float = Field(..., gt=0, description="Total construction cost ($)")
    equity_pct: float = Field(0.30, ge=0, le=1.0)
    opex_per_year: float = Field(0.0, ge=0, description="Annual O&M cost ($)")
    opex_escalation: float = Field(0.02)
    opex_variable_pct: float = Field(0.0, ge=0, le=1.0, description="Variable portion of opex (% of revenue)")
    development_costs: float = Field(0.0, ge=0, description="Development/pre-construction costs ($)")
    cost_overrun_pct: float = Field(0.0, ge=0, le=2.0, description="Construction cost overrun as % of base")


class MaintenanceCostEvent(BaseModel):
    year: int = Field(..., ge=1)
    cost: float = Field(..., gt=0)
    description: str = ""


class MaintenanceReserve(BaseModel):
    enabled: bool = False
    events: list[MaintenanceCostEvent] = Field(default_factory=list)
    funding_rate_pct_revenue: float = Field(0.0, ge=0, description="Annual MRA funding as % of revenue")


class ProjectDebtAssumptions(BaseModel):
    interest_rate: float = Field(0.055, ge=0, le=1.0)
    amortization_years: int = Field(15, ge=1)
    debt_service_reserve_months: int = Field(6, ge=0)
    grace_period_years: int = Field(0, ge=0)
    use_sculpting: bool = Field(False, description="Use debt sculpting to target DSCR")
    target_dscr: float = Field(1.30, ge=1.0, le=5.0, description="Target DSCR for debt sculpting")
    upfront_fees_pct: float = Field(0.01, ge=0, le=0.1, description="Upfront arrangement fees as % of debt")
    commitment_fee_pct: float = Field(0.005, ge=0, description="Commitment fee on undrawn balance")
    idc_rate: float = Field(0.0, ge=0, description="Interest rate during construction (0 = same as operations rate)")


class ProjectFinanceInput(BaseModel):
    name: str = "New Project Finance Model"
    timeline: TimelineConfig = TimelineConfig()
    phases: ProjectPhase = ProjectPhase()
    revenue: ProjectRevenueAssumptions
    costs: ProjectCostAssumptions
    debt: ProjectDebtAssumptions = ProjectDebtAssumptions()
    tax: TaxAssumptions = TaxAssumptions()
    maintenance_reserve: MaintenanceReserve = MaintenanceReserve()


# ── Acquisition / LBO Model ───────────────────────────────────────────────────

class DebtTranche(BaseModel):
    name: str = "Senior A"
    amount: float = Field(..., ge=0)
    rate: float = Field(0.07, ge=0, le=1.0)
    tenor_years: int = Field(5, ge=1)
    amortization_type: str = Field("equal_installment",
        description="bullet | equal_installment | annuity")
    is_pik: bool = Field(False, description="Payment in kind (interest accrues to principal)")
    upfront_fee_pct: float = Field(0.0, ge=0)


class AcquisitionInput(BaseModel):
    name: str = "New Acquisition Model"
    purchase_price: float = Field(..., gt=0)
    entry_ebitda_multiple: float = Field(..., gt=0)
    exit_ebitda_multiple: float = Field(..., gt=0)
    holding_period_years: int = Field(5, ge=1, le=20)
    # Financing
    equity_pct: float = Field(0.40, ge=0.01, le=1.0)
    debt_tranches: list[DebtTranche] = Field(default_factory=list,
        description="Multi-tranche debt; if empty uses simple single tranche")
    debt_interest_rate: float = Field(0.07, ge=0, le=1.0,
        description="Used if debt_tranches is empty")
    # Transaction costs
    transaction_fees_pct: float = Field(0.015, ge=0, le=0.1,
        description="Transaction fees as % of purchase price")
    # Operating assumptions
    ebitda_growth_rate: float = Field(0.08, ge=-0.5, le=1.0)
    capex_pct_revenue: float = Field(0.03, ge=0, le=1.0)
    revenue_pct_purchase_price: float = Field(0.5, gt=0,
        description="Entry revenue as % of purchase price (to derive revenue)")
    # Synergies
    revenue_synergies: float = Field(0.0, ge=0, description="Annual run-rate revenue synergies ($)")
    cost_savings: float = Field(0.0, ge=0, description="Annual run-rate cost savings ($)")
    synergy_phase_in_years: int = Field(2, ge=1)
    integration_costs: float = Field(0.0, ge=0, description="One-time integration costs ($)")
    # Working capital & depreciation
    working_capital_pct_revenue: float = Field(0.10, ge=0)
    amortization_of_intangibles: float = Field(0.0, ge=0,
        description="Annual PPA intangibles amortization ($)")
    # Returns waterfall
    preferred_equity_pct: float = Field(0.0, ge=0, le=1.0)
    preferred_return_rate: float = Field(0.08, ge=0, le=1.0)
    carry_pct: float = Field(0.0, ge=0, le=1.0, description="Carried interest above hurdle")
    carry_hurdle: float = Field(0.08, ge=0, le=1.0)
    tax_rate: float = Field(0.25, ge=0, le=1.0)


# ── Merger / M&A Model ────────────────────────────────────────────────────────

class MergerInput(BaseModel):
    name: str = "Merger Analysis"
    # Acquirer standalone
    acquirer_revenue: float = Field(..., gt=0)
    acquirer_ebitda: float = Field(..., gt=0)
    acquirer_ebit: float = Field(..., gt=0)
    acquirer_net_income: float = Field(..., gt=0)
    acquirer_shares: float = Field(..., gt=0, description="Shares outstanding")
    acquirer_share_price: float = Field(..., gt=0)
    acquirer_net_debt: float = Field(0.0, description="Net debt ($)")
    acquirer_growth_rate: float = Field(0.05, ge=-0.5, le=1.0)
    # Target standalone
    target_revenue: float = Field(..., gt=0)
    target_ebitda: float = Field(..., gt=0)
    target_ebit: float = Field(..., gt=0)
    target_net_income: float = Field(..., gt=0)
    target_net_debt: float = Field(0.0)
    target_growth_rate: float = Field(0.08, ge=-0.5, le=1.0)
    # Deal terms
    purchase_price: float = Field(..., gt=0)
    cash_consideration_pct: float = Field(0.5, ge=0, le=1.0)
    stock_consideration_pct: float = Field(0.3, ge=0, le=1.0)
    debt_consideration_pct: float = Field(0.2, ge=0, le=1.0)
    new_debt_rate: float = Field(0.065, ge=0, le=1.0)
    # Synergies
    cost_synergies: float = Field(0.0, ge=0, description="Annual run-rate cost synergies ($)")
    revenue_synergies: float = Field(0.0, ge=0)
    integration_costs: float = Field(0.0, ge=0, description="One-time integration costs ($)")
    synergy_phase_in_years: int = Field(3, ge=1)
    # PPA
    amortization_of_intangibles: float = Field(0.0, ge=0)
    # Tax
    tax_rate: float = Field(0.25, ge=0, le=1.0)
    holding_period_years: int = Field(5, ge=1, le=20)


# ── Real Estate Model ─────────────────────────────────────────────────────────

class RealEstateInput(BaseModel):
    name: str = "Real Estate Model"
    property_type: str = Field("Office", description="Office | Retail | Industrial | Residential | Mixed")
    # Revenue
    rentable_area_sqft: float = Field(..., gt=0)
    rent_per_sqft_per_year: float = Field(..., gt=0)
    rent_growth_rate: float = Field(0.03, ge=-0.1, le=0.3)
    initial_occupancy: float = Field(0.80, ge=0, le=1.0)
    stabilized_occupancy: float = Field(0.92, ge=0, le=1.0)
    stabilization_years: int = Field(2, ge=0)
    vacancy_credit_loss_pct: float = Field(0.02, ge=0, le=0.5,
        description="Additional credit loss beyond vacancy")
    # Expenses
    opex_per_sqft_per_year: float = Field(12.0, ge=0)
    opex_growth_rate: float = Field(0.025, ge=-0.1)
    capex_reserve_per_sqft: float = Field(0.50, ge=0, description="Annual capex reserve per sqft")
    tenant_improvement_per_sqft: float = Field(0.0, ge=0)
    leasing_commissions_pct: float = Field(0.04, ge=0)
    # Financing
    purchase_price: float = Field(..., gt=0)
    equity_pct: float = Field(0.35, ge=0.01, le=1.0)
    debt_rate: float = Field(0.055, ge=0, le=1.0)
    debt_amort_years: int = Field(25, ge=1)
    # Valuation & exit
    entry_cap_rate: float = Field(0.055, gt=0, le=0.2)
    exit_cap_rate: float = Field(0.060, gt=0, le=0.2)
    hold_period_years: int = Field(10, ge=1, le=30)
    tax_rate: float = Field(0.25, ge=0, le=1.0)
    depreciation_years: int = Field(39, ge=10, description="Straight-line life for tax (27.5 residential, 39 commercial)")
    # Portfolio
    additional_properties: list[dict] = Field(default_factory=list,
        description="List of additional property dicts with same fields")


# ── Risk Analysis ─────────────────────────────────────────────────────────────

class SensitivityVariable(BaseModel):
    name: str
    base_value: float
    low_value: float
    high_value: float
    path: str = Field("", description="Dot-path to override in payload (e.g. 'revenue.growth_rates.0')")


class TornadoInput(BaseModel):
    model_type: str = Field("corporate", description="corporate | project | acquisition | dcf")
    base_payload: dict
    variables: list[SensitivityVariable]
    output_metric: str = Field("enterprise_value",
        description="enterprise_value | equity_irr | min_dscr | equity_value | moic")


class SensitivityGrid(BaseModel):
    """2-way sensitivity table: output metric at combinations of two variables."""
    model_type: str = Field("corporate")
    base_payload: dict
    row_variable: SensitivityVariable
    col_variable: SensitivityVariable
    output_metric: str = Field("enterprise_value")


class ScenarioSetInput(BaseModel):
    model_type: str = Field("corporate")
    base_payload: dict
    scenarios: list[dict] = Field(...,
        description="Each dict: {name: str, overrides: {dot.path: value}}")
    output_metrics: list[str] = Field(
        default_factory=lambda: ["enterprise_value", "equity_irr", "min_dscr"])


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
    # Enhanced
    revenue_floor_pct: float = Field(0.0, ge=0, le=1.0, description="Revenue floor as % of base (price boundary)")
    revenue_ceiling_pct: float = Field(0.0, ge=0, description="Revenue ceiling as % of base (0=none)")
    jump_probability: float = Field(0.0, ge=0, le=1.0, description="Annual probability of a jump event")
    jump_size_mean: float = Field(-0.15, description="Mean jump size (negative=downside)")
    jump_size_std: float = Field(0.05, ge=0, description="Jump size standard deviation")
    target_dscr_threshold: float = Field(1.2, ge=1.0, description="DSCR threshold for breach probability")
    target_irr: float = Field(0.12, ge=0, le=1.0, description="Target IRR for probability calculation")
    debt_amount: float = Field(0.0, ge=0, description="Debt for DSCR simulation (0=no debt)")
    debt_service: float = Field(0.0, ge=0, description="Annual debt service for DSCR (0=no debt)")


# ── Valuation ─────────────────────────────────────────────────────────────────

class DCFInput(BaseModel):
    free_cash_flows: list[float] = Field(..., description="FCF per year ($)")
    terminal_growth_rate: float = Field(0.025, ge=0, le=0.15)
    discount_rate: float = Field(0.10, ge=0, le=1.0)
    net_debt: float = Field(0.0, description="Net debt ($) — subtracted from EV to get equity value")
    shares_outstanding: Optional[float] = Field(None, gt=0)
    # Terminal value method
    tv_method: str = Field("gordon_growth",
        description="gordon_growth | ev_ebitda | value_driver | all")
    ebitda_last: Optional[float] = Field(None, description="Last year EBITDA (for EV/EBITDA method)")
    ev_ebitda_multiple: float = Field(10.0, gt=0)
    roic: float = Field(0.15, gt=0, description="ROIC for value driver formula")
    nopat_last: Optional[float] = Field(None, description="Last year NOPAT")
    # Normalization
    normalized_capex_dep_ratio: float = Field(1.05, gt=0,
        description="Normalized CapEx/Depreciation ratio for terminal year")
    wc_pct_revenue: float = Field(0.10, ge=0, description="Working capital as % of revenue")
    depreciation_last: Optional[float] = Field(None)
    revenue_last: Optional[float] = Field(None)
    revenue_growth_terminal: Optional[float] = Field(None,
        description="Terminal revenue growth (defaults to terminal_growth_rate)")
    # Minority interest, pension etc.
    minority_interest: float = Field(0.0, ge=0)
    pension_deficit: float = Field(0.0, ge=0)


class WACCInput(BaseModel):
    equity_value: float = Field(..., gt=0)
    debt_value: float = Field(..., ge=0)
    cost_of_equity: float = Field(0.12, ge=0, le=1.0)
    cost_of_debt: float = Field(0.06, ge=0, le=1.0)
    tax_rate: float = Field(0.25, ge=0, le=1.0)


class WACCCAPMInput(BaseModel):
    """Full CAPM-based WACC calculation."""
    # Cost of equity via CAPM
    risk_free_rate: float = Field(0.04, ge=0, le=0.2, description="Risk-free rate (e.g., 10yr treasury)")
    equity_risk_premium: float = Field(0.055, ge=0, le=0.2, description="Equity risk premium (market premium)")
    beta: float = Field(1.0, ge=0, le=5.0, description="Levered beta")
    beta_unlevered: Optional[float] = Field(None, ge=0, description="Unlevered beta (if re-levering needed)")
    size_premium: float = Field(0.0, ge=0, le=0.1, description="Size risk premium (Duff & Phelps)")
    country_risk_premium: float = Field(0.0, ge=0, le=0.2, description="Country risk premium")
    company_specific_premium: float = Field(0.0, ge=0, le=0.2)
    # Capital structure
    debt_value: float = Field(..., ge=0, description="Market value of debt ($)")
    equity_value: float = Field(..., gt=0, description="Market value of equity ($)")
    target_debt_to_equity: Optional[float] = Field(None, ge=0, description="Target D/E (overrides market value weights)")
    # Cost of debt
    cost_of_debt_pretax: float = Field(0.06, ge=0, le=1.0)
    tax_rate: float = Field(0.25, ge=0, le=1.0)


class ComparableCompany(BaseModel):
    name: str
    ev: float
    ebitda: float
    revenue: float
    net_income: float
    growth_rate: float
    roic: Optional[float] = None


class ValuationInput(BaseModel):
    """Comprehensive valuation with multiple methods."""
    free_cash_flows: list[float] = Field(..., description="Explicit period FCFs ($)")
    discount_rate: float = Field(0.10, ge=0, le=1.0)
    terminal_growth_rate: float = Field(0.025, ge=0, le=0.15)
    net_debt: float = Field(0.0)
    minority_interest: float = Field(0.0, ge=0)
    shares_outstanding: Optional[float] = Field(None, gt=0)
    # For EV/EBITDA method
    ebitda_last: float = Field(0.0, ge=0)
    ev_ebitda_exit_multiple: float = Field(10.0, gt=0)
    # For value driver method
    roic: float = Field(0.15, gt=0)
    nopat_last: float = Field(0.0)
    # Normalized terminal year adjustments
    depreciation_last: float = Field(0.0, ge=0)
    capex_dep_ratio_terminal: float = Field(1.05, gt=0)
    wc_pct_revenue: float = Field(0.10, ge=0)
    revenue_last: float = Field(0.0, ge=0)
    # Comparables
    comparable_companies: list[ComparableCompany] = Field(default_factory=list)


# ── Export schemas ────────────────────────────────────────────────────────────

class ExportCorporateInput(BaseModel):
    model_input: CorporateModelInput
    model_result: dict


class ExportProjectInput(BaseModel):
    model_input: ProjectFinanceInput
    model_result: dict
