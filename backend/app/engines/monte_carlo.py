"""
Monte Carlo simulation engine with mean reversion and correlated variables.
"""
from __future__ import annotations
import numpy as np
from app.engines.valuation import dcf_valuation
from app.models.schemas import MonteCarloInput


def cholesky_correlated(rng: np.random.Generator, n: int, corr: float) -> tuple[np.ndarray, np.ndarray]:
    """Generate two correlated standard normal series."""
    z1 = rng.standard_normal(n)
    z2 = rng.standard_normal(n)
    z2_corr = corr * z1 + np.sqrt(1 - corr**2) * z2
    return z1, z2_corr


def mean_reverting_path(
    rng: np.random.Generator,
    base: float,
    volatility: float,
    speed: float,
    n: int,
    shocks: np.ndarray,
) -> np.ndarray:
    """Ornstein-Uhlenbeck mean-reverting process."""
    path = np.zeros(n)
    path[0] = base
    for t in range(1, n):
        drift = speed * (base - path[t - 1])
        diffusion = volatility * path[t - 1] * shocks[t]
        path[t] = max(path[t - 1] + drift + diffusion, 0.0)
    return path


def run_monte_carlo(inp: MonteCarloInput) -> dict:
    rng = np.random.default_rng(42)
    n = inp.forecast_years
    results_ev = np.zeros(inp.n_simulations)
    terminal_growth = inp.terminal_growth_rate
    discount_rate = inp.discount_rate

    revenue_paths = []
    opex_paths = []

    for sim in range(inp.n_simulations):
        z_rev, z_opex = cholesky_correlated(rng, n, inp.correlation_rev_opex)

        rev_path = mean_reverting_path(rng, inp.base_revenue, inp.revenue_volatility, inp.mean_reversion_speed, n, z_rev)
        opex_path = mean_reverting_path(rng, inp.base_opex, inp.opex_volatility, inp.mean_reversion_speed, n, z_opex)

        fcf = (rev_path - opex_path).tolist()
        val = dcf_valuation(fcf, discount_rate, terminal_growth)
        results_ev[sim] = val["enterprise_value"]

        if sim < 200:
            revenue_paths.append(rev_path.tolist())
            opex_paths.append(opex_path.tolist())

    sorted_ev = np.sort(results_ev)
    percentiles = [1, 5, 10, 25, 50, 75, 90, 95, 99]
    pct_values = {f"p{p}": float(np.percentile(sorted_ev, p)) for p in percentiles}

    hist_counts, hist_edges = np.histogram(results_ev, bins=50)

    return {
        "n_simulations": inp.n_simulations,
        "mean_ev": float(np.mean(results_ev)),
        "std_ev": float(np.std(results_ev)),
        "min_ev": float(np.min(results_ev)),
        "max_ev": float(np.max(results_ev)),
        "percentiles": pct_values,
        "histogram": {
            "counts": hist_counts.tolist(),
            "edges": hist_edges.tolist(),
            "bin_centers": ((hist_edges[:-1] + hist_edges[1:]) / 2).tolist(),
        },
        "probability_positive": float(np.mean(results_ev > 0)),
        "sample_revenue_paths": revenue_paths[:20],
        "sample_opex_paths": opex_paths[:20],
    }
