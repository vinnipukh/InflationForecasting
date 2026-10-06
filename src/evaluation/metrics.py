"""Evaluation metrics and the target-day system output (handoff.md Sec. 2.3 and 5)."""
from __future__ import annotations

import numpy as np
import pandas as pd

TOL = 0.005  # relative change below this counts as "flat"


def direction(pct_change) -> np.ndarray:
    x = np.asarray(pct_change, dtype=float)
    return np.sign(np.where(np.abs(x) > TOL, x, 0.0))


def r2(y, p) -> float:
    """Coefficient of determination: 1 − Σ(y − p)² / Σ(y − ȳ)² (unweighted, one row per product-day)."""
    y, p = np.asarray(y, dtype=float), np.asarray(p, dtype=float)
    ss_tot = np.sum((y - y.mean()) ** 2)
    return float(1 - np.sum((y - p) ** 2) / ss_tot) if ss_tot > 0 else float("nan")


def price_metrics(frame: pd.DataFrame, pred_price) -> dict:
    """MAE, RMSE, MAPE on price, R² on price and on return, and directional accuracy (up / down / flat).

    R² on price is ≈ 1 for any forecast near yesterday's price (prices span 0.5–2,890 TRY); R² on return
    (change vs. ``base_price``) measures forecasting skill — the dummy (0 % change) scores ≈ 0.
    """
    y = frame["target_price"].to_numpy(dtype=float)
    p = np.asarray(pred_price, dtype=float)
    base = frame["base_price"].to_numpy(dtype=float)
    err = p - y
    return {
        "rows": len(frame),
        "MAE": float(np.mean(np.abs(err))),
        "RMSE": float(np.sqrt(np.mean(err ** 2))),
        "MAPE_%": float(100 * np.mean(np.abs(err) / y)),
        "R2_price": r2(y, p),
        "R2_return": r2(y / base - 1, p / base - 1),
        "DA_%": float(100 * np.mean(direction(frame["target_pct_change"]) == direction(p / base - 1))),
    }


def system_prediction(frame: pd.DataFrame, model_price, target_mask) -> np.ndarray:
    """Spec 2.3: model price on target days, persistence (base price) on all other days."""
    return np.where(np.asarray(target_mask), np.asarray(model_price), frame["base_price"].to_numpy())


def baselines(frame: pd.DataFrame) -> dict[str, np.ndarray]:
    return {
        "persistence_causal_regular": frame["base_price"].to_numpy(),
        "persistence_shelf": frame["shelf_price_lag1"].fillna(frame["base_price"]).to_numpy(),
    }


def evaluate(frame: pd.DataFrame, model_price, label: str) -> pd.DataFrame:
    """Metrics for one model on one test frame: spec / data target days and the global system output."""
    rows = []
    subsets = {"spec target days": frame["is_target_spec"].to_numpy(), "data target days": frame["is_target_data"].to_numpy()}
    for name, mask in subsets.items():
        part = frame[mask]
        rows.append({"model": label, "subset": name, **price_metrics(part, np.asarray(model_price)[mask])})
        system = system_prediction(frame, model_price, mask)
        rows.append({"model": label, "subset": f"global (model on {name.split()[0]} days)", **price_metrics(frame, system)})
    rows.append({"model": label, "subset": "all days (model everywhere)", **price_metrics(frame, model_price)})
    return pd.DataFrame(rows)


def add_improvement(results: pd.DataFrame) -> pd.DataFrame:
    """Baseline improvement % (spec 5.2) against each persistence variant and against the better of the two."""
    out = results.copy()
    keys = ["block", "subset"]
    for base in ["persistence_causal_regular", "persistence_shelf"]:
        ref = out[out["model"] == base].set_index(keys)["MAE"].rename(f"MAE_{base}")
        out = out.join(ref, on=keys)
        out[f"impr_vs_{base.split('_', 1)[1]}_%"] = 100 * (out[f"MAE_{base}"] - out["MAE"]) / out[f"MAE_{base}"]
    out["best_baseline_MAE"] = out[["MAE_persistence_causal_regular", "MAE_persistence_shelf"]].min(axis=1)
    out["impr_vs_best_%"] = 100 * (out["best_baseline_MAE"] - out["MAE"]) / out["best_baseline_MAE"]
    out["worse_than_best_baseline"] = out["MAE"] > out["best_baseline_MAE"] + 1e-12
    return out.drop(columns=["MAE_persistence_causal_regular", "MAE_persistence_shelf"])
