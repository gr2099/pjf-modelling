"""
Tax calculation engine.
Supports: NOL carryforwards with expiration, deferred tax tracking.
"""
from __future__ import annotations
import numpy as np


def build_tax_schedule(
    ebit: list[float],
    tax_rate: float,
    nol_opening: float = 0.0,
    nol_expiry_years: int = 20,
    depreciation_book: list[float] | None = None,
    depreciation_tax: list[float] | None = None,
) -> dict:
    n = len(ebit)
    ebit_arr = np.array(ebit)

    nol_generated = np.maximum(-ebit_arr, 0.0)
    nol_balance = np.zeros(n)
    nol_used = np.zeros(n)
    taxable_income = np.zeros(n)
    cash_taxes = np.zeros(n)
    book_taxes = np.zeros(n)
    deferred_tax_change = np.zeros(n)

    # Track NOL by vintage for expiration
    nol_vintages: list[tuple[float, int]] = [(nol_opening, 0)]  # (amount, year_created)

    for i in range(n):
        # Add new NOL
        if nol_generated[i] > 0:
            nol_vintages.append((nol_generated[i], i + 1))

        # Expire old vintages
        nol_vintages = [(amt, yr) for (amt, yr) in nol_vintages if (i + 1 - yr) < nol_expiry_years]

        raw_taxable = ebit_arr[i]
        if raw_taxable > 0:
            # Use oldest NOL first (FIFO)
            remaining = raw_taxable
            used_this_year = 0.0
            new_vintages = []
            for amt, yr in nol_vintages:
                if remaining <= 0:
                    new_vintages.append((amt, yr))
                    continue
                use = min(amt, remaining)
                used_this_year += use
                remaining -= use
                if amt - use > 0:
                    new_vintages.append((amt - use, yr))
            nol_vintages = new_vintages
            nol_used[i] = used_this_year
            taxable_income[i] = max(raw_taxable - used_this_year, 0.0)
        else:
            taxable_income[i] = 0.0

        cash_taxes[i] = taxable_income[i] * tax_rate

        # Book taxes (on pre-NOL EBIT)
        book_taxes[i] = max(ebit_arr[i], 0.0) * tax_rate

        # Deferred tax (book/tax depreciation difference)
        if depreciation_book and depreciation_tax:
            temp_diff = depreciation_tax[i] - depreciation_book[i]
            deferred_tax_change[i] = temp_diff * tax_rate

        nol_balance[i] = sum(amt for amt, _ in nol_vintages)

    effective_tax_rate = np.where(
        ebit_arr > 0, cash_taxes / np.maximum(ebit_arr, 1e-9), 0.0
    )

    return {
        "ebit": ebit_arr.tolist(),
        "nol_generated": nol_generated.tolist(),
        "nol_used": nol_used.tolist(),
        "nol_balance": nol_balance.tolist(),
        "taxable_income": taxable_income.tolist(),
        "cash_taxes": cash_taxes.tolist(),
        "book_taxes": book_taxes.tolist(),
        "deferred_tax_change": deferred_tax_change.tolist(),
        "effective_tax_rate": effective_tax_rate.tolist(),
    }
