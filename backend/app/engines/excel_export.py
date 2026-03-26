"""
Excel export engine using openpyxl.
Produces formatted, multi-sheet workbooks for each model type.
"""
from __future__ import annotations
import io
from typing import Any
from openpyxl import Workbook
from openpyxl.styles import (
    Font, PatternFill, Alignment, Border, Side, numbers
)
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.chart.series import DataPoint

# ── Palette ────────────────────────────────────────────────────────────────────
C_DARK   = "0D1117"   # header background
C_MID    = "161B22"   # sub-header
C_ACCENT = "1F6FEB"   # blue accent
C_POS    = "1A7F37"   # positive / green
C_NEG    = "CF222E"   # negative / red
C_WARN   = "9A6700"   # warning / amber
C_LIGHT  = "F0F6FC"   # light text on dark bg
C_BORDER = "30363D"   # border colour
C_ALT    = "0D1117"   # alt-row tint

FMT_USD   = '"$"#,##0'
FMT_USD1  = '"$"#,##0.0'
FMT_PCT   = '0.0%'
FMT_X     = '0.00"x"'
FMT_RATIO = '0.00'
FMT_INT   = '#,##0'


def _side(color: str = C_BORDER) -> Side:
    return Side(style="thin", color=color)


def _border(all_sides: bool = False) -> Border:
    s = _side()
    if all_sides:
        return Border(left=s, right=s, top=s, bottom=s)
    return Border(bottom=s)


def _header_font(size: int = 9, bold: bool = True) -> Font:
    return Font(name="Calibri", size=size, bold=bold, color=C_LIGHT)


def _body_font(size: int = 9, bold: bool = False, color: str = "000000") -> Font:
    return Font(name="Calibri", size=size, bold=bold, color=color)


def _fill(hex_color: str) -> PatternFill:
    return PatternFill("solid", fgColor=hex_color)


def _write_header_row(ws, row: int, labels: list[str], widths: list[int] | None = None) -> None:
    for col, label in enumerate(labels, 1):
        cell = ws.cell(row=row, column=col, value=label)
        cell.font = _header_font()
        cell.fill = _fill(C_DARK)
        cell.alignment = Alignment(horizontal="center" if col > 1 else "left", vertical="center")
        cell.border = _border()
        if widths and col <= len(widths):
            ws.column_dimensions[get_column_letter(col)].width = widths[col - 1]


def _write_sub_header(ws, row: int, label: str, ncols: int) -> None:
    cell = ws.cell(row=row, column=1, value=label)
    cell.font = Font(name="Calibri", size=9, bold=True, color=C_ACCENT)
    cell.fill = _fill(C_MID)
    cell.border = _border()
    for c in range(2, ncols + 1):
        cell2 = ws.cell(row=row, column=c)
        cell2.fill = _fill(C_MID)
        cell2.border = _border()


def _write_data_row(
    ws,
    row: int,
    label: str,
    values: list[Any],
    fmt: str = FMT_USD,
    bold: bool = False,
    color: str | None = None,
) -> None:
    alt = row % 2 == 0
    bg = "1C2128" if alt else "0D1117"

    cell = ws.cell(row=row, column=1, value=label)
    cell.font = _body_font(bold=bold, color=C_LIGHT)
    cell.fill = _fill(bg)
    cell.alignment = Alignment(horizontal="left", indent=1)
    cell.border = _border()

    for col, val in enumerate(values, 2):
        c = ws.cell(row=row, column=col, value=val)
        c.fill = _fill(bg)
        c.alignment = Alignment(horizontal="right")
        c.border = _border()
        if isinstance(val, (int, float)):
            c.number_format = fmt
            if val < 0:
                c.font = _body_font(bold=bold, color=C_NEG)
            elif bold:
                c.font = _body_font(bold=True, color=C_ACCENT if not color else color)
            else:
                c.font = _body_font(color=C_LIGHT)
        else:
            c.font = _body_font(color=C_LIGHT)


def _freeze_and_autofit(ws, freeze: str = "B3") -> None:
    ws.freeze_panes = freeze
    ws.sheet_view.showGridLines = False
    ws.tab_color = C_ACCENT


def _title_block(ws, title: str, subtitle: str) -> None:
    ws.row_dimensions[1].height = 22
    ws.row_dimensions[2].height = 14
    t = ws.cell(row=1, column=1, value=title)
    t.font = Font(name="Calibri", size=13, bold=True, color=C_ACCENT)
    t.fill = _fill(C_DARK)
    s = ws.cell(row=2, column=1, value=subtitle)
    s.font = Font(name="Calibri", size=9, color="8B949E")
    s.fill = _fill(C_DARK)


# ── Corporate Export ───────────────────────────────────────────────────────────

def export_corporate(result: dict) -> bytes:
    wb = Workbook()
    wb.remove(wb.active)  # remove default sheet

    years: list[int] = result["years"]
    n = len(years)
    year_labels = [str(y) for y in years]
    ncols = n + 1

    # ── Sheet 1: Income Statement ──────────────────────────────────────────
    ws = wb.create_sheet("Income Statement")
    _title_block(ws, result.get("name", "Corporate Model"), "Income Statement")
    _write_header_row(ws, 3, [""] + year_labels, [28] + [12] * n)

    is_ = result["income_statement"]
    rows_is = [
        ("Revenue",        is_["revenue"],     FMT_USD, True),
        ("  COGS",         [-v for v in is_["cogs"]], FMT_USD, False),
        ("Gross Profit",   is_["gross_profit"], FMT_USD, True),
        ("  SG&A",         [-v for v in is_["sga"]], FMT_USD, False),
        ("EBITDA",         is_["ebitda"],       FMT_USD, True),
        ("EBITDA Margin",  is_["ebitda_margin"], FMT_PCT, False),
        ("  Depreciation", [-v for v in is_["depreciation"]], FMT_USD, False),
        ("EBIT",           is_["ebit"],         FMT_USD, True),
    ]
    r = 4
    for label, vals, fmt, bold in rows_is:
        _write_data_row(ws, r, label, vals, fmt, bold)
        r += 1
    _freeze_and_autofit(ws)

    # ── Sheet 2: Cash Flow ─────────────────────────────────────────────────
    ws2 = wb.create_sheet("Cash Flow")
    _title_block(ws2, result.get("name", "Corporate Model"), "Cash Flow Statement")
    _write_header_row(ws2, 3, [""] + year_labels, [28] + [12] * n)

    cf = result["cash_flow"]
    tax = result["tax"]
    rows_cf = [
        ("EBITDA",              is_["ebitda"],              FMT_USD, True),
        ("  Cash Taxes",        [-v for v in tax["cash_taxes"]], FMT_USD, False),
        ("  CapEx",             [-v for v in cf["capex"]],  FMT_USD, False),
        ("  Change in NWC",     [-v for v in cf["delta_nwc"]], FMT_USD, False),
        ("Free Cash Flow",      cf["fcf_aftertax"],         FMT_USD, True),
        ("  Interest",         [-v for v in result["debt_schedule"]["interest"]], FMT_USD, False),
        ("  Principal",        [-v for v in result["debt_schedule"]["principal"]], FMT_USD, False),
        ("Equity FCF",          result["debt_schedule"]["equity_fcf"], FMT_USD, True),
    ]
    r = 4
    for label, vals, fmt, bold in rows_cf:
        _write_data_row(ws2, r, label, vals, fmt, bold)
        r += 1
    _freeze_and_autofit(ws2)

    # ── Sheet 3: Debt Schedule ─────────────────────────────────────────────
    ws3 = wb.create_sheet("Debt Schedule")
    _title_block(ws3, result.get("name", "Corporate Model"), "Debt Schedule & DSCR")
    _write_header_row(ws3, 3, [""] + year_labels, [28] + [12] * n)

    ds = result["debt_schedule"]
    rows_debt = [
        ("Opening Balance", ds["opening_balance"],  FMT_USD, False),
        ("New Debt",        ds["new_debt"],          FMT_USD, False),
        ("  Interest",     [-v for v in ds["interest"]], FMT_USD, False),
        ("  Principal",    [-v for v in ds["principal"]], FMT_USD, False),
        ("Closing Balance", ds["closing_balance"],   FMT_USD, True),
        ("DSCR",            ds["dscr"],              FMT_RATIO, True),
        ("Equity FCF",      ds["equity_fcf"],        FMT_USD, True),
    ]
    r = 4
    for label, vals, fmt, bold in rows_debt:
        _write_data_row(ws3, r, label, vals, fmt, bold)
        r += 1
    _freeze_and_autofit(ws3)

    # ── Sheet 4: Tax ───────────────────────────────────────────────────────
    ws4 = wb.create_sheet("Tax Detail")
    _title_block(ws4, result.get("name", "Corporate Model"), "Tax Calculation with NOL Carryforward")
    _write_header_row(ws4, 3, [""] + year_labels, [28] + [12] * n)

    rows_tax = [
        ("EBIT",               tax["ebit"],          FMT_USD, True),
        ("NOL Generated",      tax["nol_generated"], FMT_USD, False),
        ("NOL Used",          [-v for v in tax["nol_used"]], FMT_USD, False),
        ("NOL Balance",        tax["nol_balance"],   FMT_USD, False),
        ("Taxable Income",     tax["taxable_income"], FMT_USD, True),
        ("Cash Taxes",        [-v for v in tax["cash_taxes"]], FMT_USD, True),
        ("Book Taxes",        [-v for v in tax["book_taxes"]], FMT_USD, False),
        ("Effective Tax Rate", tax["effective_tax_rate"], FMT_PCT, False),
    ]
    r = 4
    for label, vals, fmt, bold in rows_tax:
        _write_data_row(ws4, r, label, vals, fmt, bold)
        r += 1
    _freeze_and_autofit(ws4)

    # ── Sheet 5: Valuation Summary ─────────────────────────────────────────
    ws5 = wb.create_sheet("Valuation")
    _title_block(ws5, result.get("name", "Corporate Model"), "DCF Valuation Summary")
    ws5.column_dimensions["A"].width = 30
    ws5.column_dimensions["B"].width = 20

    val = result["valuation"]
    kv = [
        ("Enterprise Value",      val["enterprise_value"],   FMT_USD),
        ("Net Debt",             -val["net_debt"],            FMT_USD),
        ("Equity Value",          val["equity_value"],        FMT_USD),
        ("PV of Explicit FCFs",   val["sum_pv_fcfs"],         FMT_USD),
        ("PV of Terminal Value",  val["pv_terminal_value"],   FMT_USD),
        ("Terminal Value % of EV",val["terminal_value_pct"] / 100, FMT_PCT),
        ("Equity IRR",            result.get("equity_irr", 0), FMT_PCT),
    ]
    r = 4
    for label, val_v, fmt in kv:
        lc = ws5.cell(row=r, column=1, value=label)
        lc.font = _body_font(color=C_LIGHT)
        lc.fill = _fill(C_DARK if r % 2 == 0 else C_MID)
        lc.border = _border()
        vc = ws5.cell(row=r, column=2, value=val_v)
        vc.number_format = fmt
        vc.font = _body_font(bold=True, color=C_ACCENT)
        vc.fill = _fill(C_DARK if r % 2 == 0 else C_MID)
        vc.border = _border()
        vc.alignment = Alignment(horizontal="right")
        r += 1
    ws5.sheet_view.showGridLines = False
    ws5.tab_color = C_POS

    # ── FCF Chart ──────────────────────────────────────────────────────────
    _add_bar_chart(ws5, wb, "Income Statement", 4, 2, n, "Revenue & FCF", 10, 2)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Project Finance Export ────────────────────────────────────────────────────

def export_project(result: dict) -> bytes:
    wb = Workbook()
    wb.remove(wb.active)

    years: list[int] = result["years_operating"]
    n = len(years)
    year_labels = [str(y) for y in years]

    # Operating
    ws = wb.create_sheet("Operations")
    _title_block(ws, result.get("name", "Project Finance"), "Operating Projections")
    _write_header_row(ws, 3, [""] + year_labels, [28] + [12] * n)
    op = result["operating"]
    rows = [
        ("Revenue",         op["revenue"],      FMT_USD, True),
        ("  OpEx",         [-v for v in op["opex"]], FMT_USD, False),
        ("EBITDA",          op["ebitda"],        FMT_USD, True),
        ("EBITDA Margin",   op["ebitda_margin"], FMT_PCT, False),
        ("  Depreciation", [-v for v in op["depreciation"]], FMT_USD, False),
        ("EBIT",            op["ebit"],          FMT_USD, True),
        ("  Cash Taxes",   [-v for v in result["tax"]["cash_taxes"]], FMT_USD, False),
        ("Free Cash Flow",  op["fcf"],           FMT_USD, True),
    ]
    r = 4
    for label, vals, fmt, bold in rows:
        _write_data_row(ws, r, label, vals, fmt, bold)
        r += 1
    _freeze_and_autofit(ws)

    # Debt Schedule
    ws2 = wb.create_sheet("Debt Schedule")
    _title_block(ws2, result.get("name", "Project Finance"), "Debt Schedule & DSCR")
    _write_header_row(ws2, 3, [""] + year_labels, [28] + [12] * n)
    ds = result["debt_schedule"]
    rows2 = [
        ("Opening Balance",      ds["opening_balance"],     FMT_USD, False),
        ("  Interest",          [-v for v in ds["interest"]], FMT_USD, False),
        ("  Principal",         [-v for v in ds["principal"]], FMT_USD, False),
        ("Closing Balance",      ds["closing_balance"],     FMT_USD, True),
        ("DSCR",                 ds["dscr"],                FMT_RATIO, True),
        ("DSRA Balance",         ds["dsra_balance"],        FMT_USD, False),
        ("Equity Distributions", ds["equity_distributions"], FMT_USD, True),
    ]
    r = 4
    for label, vals, fmt, bold in rows2:
        _write_data_row(ws2, r, label, vals, fmt, bold)
        r += 1
    _freeze_and_autofit(ws2)

    # Summary
    ws3 = wb.create_sheet("Summary")
    _title_block(ws3, result.get("name", "Project Finance"), "Key Metrics")
    ws3.column_dimensions["A"].width = 30
    ws3.column_dimensions["B"].width = 20
    km = result["key_metrics"]
    kv = [
        ("Construction Cost",   result["construction_cost"],  FMT_USD),
        ("Total Debt",          result["total_debt"],          FMT_USD),
        ("Equity Investment",   result["equity_investment"],   FMT_USD),
        ("Enterprise Value",    result["valuation"]["enterprise_value"], FMT_USD),
        ("Equity Value",        result["valuation"]["equity_value"], FMT_USD),
        ("Project IRR",         km.get("project_irr") or 0,   FMT_PCT),
        ("Equity IRR",          km.get("equity_irr") or 0,    FMT_PCT),
        ("Min DSCR",            km["min_dscr"],                FMT_RATIO),
        ("Avg DSCR",            km["avg_dscr"],                FMT_RATIO),
    ]
    r = 4
    for label, val_v, fmt in kv:
        lc = ws3.cell(row=r, column=1, value=label)
        lc.font = _body_font(color=C_LIGHT)
        lc.fill = _fill(C_DARK if r % 2 == 0 else C_MID)
        lc.border = _border()
        vc = ws3.cell(row=r, column=2, value=val_v)
        vc.number_format = fmt
        vc.font = _body_font(bold=True, color=C_ACCENT)
        vc.fill = _fill(C_DARK if r % 2 == 0 else C_MID)
        vc.border = _border()
        vc.alignment = Alignment(horizontal="right")
        r += 1
    ws3.sheet_view.showGridLines = False
    ws3.tab_color = C_POS

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Acquisition Export ────────────────────────────────────────────────────────

def export_acquisition(result: dict) -> bytes:
    wb = Workbook()
    wb.remove(wb.active)

    years: list[int] = result["years"]
    n = len(years)
    year_labels = [str(y) for y in years]

    ws = wb.create_sheet("Operations")
    _title_block(ws, result.get("name", "Acquisition"), "Operating Projections")
    _write_header_row(ws, 3, [""] + year_labels, [28] + [12] * n)
    ops = result["operations"]
    rows = [
        ("EBITDA",          ops["ebitda"],      FMT_USD, False),
        ("  Synergies",     ops["synergies"],    FMT_USD, False),
        ("Adj. EBITDA",     ops["ebitda_adj"],   FMT_USD, True),
        ("  Interest",     [-v for v in ops["interest"]], FMT_USD, False),
        ("EBT",             ops["ebt"],          FMT_USD, True),
        ("  Taxes",        [-v for v in ops["taxes"]], FMT_USD, False),
        ("Net Income",      ops["net_income"],   FMT_USD, True),
        ("  Principal",    [-v for v in ops["principal"]], FMT_USD, False),
        ("FCF to Equity",   ops["fcf_to_equity"], FMT_USD, True),
        ("Debt Balance",    ops["debt_balance"],  FMT_USD, False),
    ]
    r = 4
    for label, vals, fmt, bold in rows:
        _write_data_row(ws, r, label, vals, fmt, bold)
        r += 1
    _freeze_and_autofit(ws)

    ws2 = wb.create_sheet("Returns")
    _title_block(ws2, result.get("name", "Acquisition"), "Returns Summary")
    ws2.column_dimensions["A"].width = 30
    ws2.column_dimensions["B"].width = 20
    entry = result["entry"]
    exit_ = result["exit"]
    ret = result["returns"]
    kv = [
        ("Purchase Price",       entry["purchase_price"],      FMT_USD),
        ("Entry EBITDA",         entry["entry_ebitda"],         FMT_USD),
        ("Entry Multiple",       entry["entry_multiple"],       FMT_RATIO),
        ("Equity Invested",      entry["equity_invested"],      FMT_USD),
        ("Entry Debt",           entry["debt"],                 FMT_USD),
        ("Exit EV",              exit_["exit_ev"],              FMT_USD),
        ("Exit Multiple",        exit_["exit_multiple"],        FMT_RATIO),
        ("Exit Equity Proceeds", exit_["exit_equity_proceeds"], FMT_USD),
        ("Equity IRR",           ret.get("equity_irr") or 0,   FMT_PCT),
        ("MOIC",                 ret["moic"],                   FMT_X),
    ]
    r = 4
    for label, val_v, fmt in kv:
        lc = ws2.cell(row=r, column=1, value=label)
        lc.font = _body_font(color=C_LIGHT)
        lc.fill = _fill(C_DARK if r % 2 == 0 else C_MID)
        lc.border = _border()
        vc = ws2.cell(row=r, column=2, value=val_v)
        vc.number_format = fmt
        vc.font = _body_font(bold=True, color=C_ACCENT)
        vc.fill = _fill(C_DARK if r % 2 == 0 else C_MID)
        vc.border = _border()
        vc.alignment = Alignment(horizontal="right")
        r += 1
    ws2.sheet_view.showGridLines = False
    ws2.tab_color = C_POS

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Monte Carlo Export ─────────────────────────────────────────────────────────

def export_monte_carlo(result: dict) -> bytes:
    wb = Workbook()
    wb.remove(wb.active)

    ws = wb.create_sheet("Distribution")
    _title_block(ws, "Monte Carlo Simulation", f"{result['n_simulations']:,} simulations")
    ws.column_dimensions["A"].width = 22
    ws.column_dimensions["B"].width = 20

    pcts = result["percentiles"]
    kv = [
        ("Mean EV",     result["mean_ev"],   FMT_USD),
        ("Std Dev",     result["std_ev"],    FMT_USD),
        ("Min EV",      result["min_ev"],    FMT_USD),
        ("Max EV",      result["max_ev"],    FMT_USD),
        ("P1",          pcts["p1"],          FMT_USD),
        ("P5",          pcts["p5"],          FMT_USD),
        ("P10",         pcts["p10"],         FMT_USD),
        ("P25",         pcts["p25"],         FMT_USD),
        ("P50 (Median)",pcts["p50"],         FMT_USD),
        ("P75",         pcts["p75"],         FMT_USD),
        ("P90",         pcts["p90"],         FMT_USD),
        ("P95",         pcts["p95"],         FMT_USD),
        ("P99",         pcts["p99"],         FMT_USD),
        ("Prob. Positive", result["probability_positive"], FMT_PCT),
    ]
    _write_header_row(ws, 3, ["Metric", "Value"], [22, 20])
    r = 4
    for label, val_v, fmt in kv:
        lc = ws.cell(row=r, column=1, value=label)
        lc.font = _body_font(color=C_LIGHT)
        lc.fill = _fill(C_DARK if r % 2 == 0 else C_MID)
        lc.border = _border()
        vc = ws.cell(row=r, column=2, value=val_v)
        vc.number_format = fmt
        vc.font = _body_font(bold=True, color=C_ACCENT)
        vc.fill = _fill(C_DARK if r % 2 == 0 else C_MID)
        vc.border = _border()
        vc.alignment = Alignment(horizontal="right")
        r += 1
    ws.sheet_view.showGridLines = False

    # Histogram sheet
    ws2 = wb.create_sheet("Histogram Data")
    _title_block(ws2, "Histogram", "Enterprise Value frequency distribution")
    _write_header_row(ws2, 3, ["Bin Centre ($)", "Frequency"], [20, 14])
    hist = result["histogram"]
    for i, (centre, count) in enumerate(zip(hist["bin_centers"], hist["counts"]), 4):
        ws2.cell(row=i, column=1, value=centre).number_format = FMT_USD
        ws2.cell(row=i, column=2, value=count)
        ws2.cell(row=i, column=1).font = _body_font(color=C_LIGHT)
        ws2.cell(row=i, column=2).font = _body_font(color=C_LIGHT)
        for c in [1, 2]:
            ws2.cell(row=i, column=c).fill = _fill(C_DARK if i % 2 == 0 else C_MID)
    ws2.sheet_view.showGridLines = False

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Helper: embed a simple bar chart ──────────────────────────────────────────

def _add_bar_chart(ws, wb, data_sheet: str, data_row_start: int, data_col: int,
                   n_cols: int, title: str, anchor_row: int, anchor_col: int) -> None:
    try:
        chart = BarChart()
        chart.type = "col"
        chart.title = title
        chart.style = 10
        chart.height = 12
        chart.width = 20
        src_ws = wb[data_sheet]
        data_ref = Reference(src_ws, min_col=data_col, max_col=data_col + n_cols - 1,
                              min_row=data_row_start, max_row=data_row_start)
        chart.add_data(data_ref, from_rows=True, titles_from_data=False)
        col_letter = get_column_letter(anchor_col)
        ws.add_chart(chart, f"{col_letter}{anchor_row}")
    except Exception:
        pass  # chart embedding is best-effort
