"""Is the calendar gate needed? Gurmar hurdle model (frozen pilot params) on every test day.

Per block: retrain with src.models.classical_ml.phase1.train_block, keep P(change) and the size so any
threshold / gate can be replayed. Every test row is put in one class:

* real     — the hindsight regular price really changed from the previous (observed) day
* label_b3 — B3 rows of products held at exactly half price since September (end-of-data label problem)
* diverge  — no real change, but the causal base (yesterday's causal regular price) differs from yesterday's
             hindsight regular price: campaign ends / permanent cuts the causal rule has not caught up with
* flat     — nothing changed and base == hindsight; the model can only lose here

Gain of a policy = Σ |base − y| − |pred − y| (TRY), split by class.
Usage: python -m src.target_days.gate [--report]   (--report: reuse saved rows, no retraining)
"""
from __future__ import annotations

import json
import sys
import logging
from pathlib import Path

import numpy as np
import pandas as pd

from src.models.classical_ml import phase1 as P
from src.preprocessing.features import feature_columns
from src.target_days.calendar import TOL

log = logging.getLogger("gate")
PROCESSED = Path("data/processed")
OUT = Path("reports/target_days")


def row_classes(feat: pd.DataFrame) -> pd.Series:
    f = feat.sort_values(["segment_id", "date"])
    g = f.groupby("segment_id")
    prev_y = g["target_price"].shift()
    prev_obs = g["observed"].shift(fill_value=False)
    real = prev_obs & prev_y.notna() & ((f["target_price"] / prev_y - 1).abs() > TOL)
    diverge = ~real & ~(prev_obs & ((f["base_price"] / prev_y - 1).abs() <= TOL))
    half = (f["target_price"] / f["base_price"] - 0.5).abs() < 0.01
    label_b3 = diverge & half & (f["date"] >= "2026-09-18")
    cls = np.select([real, label_b3, diverge], ["real", "label_b3", "diverge"], "flat")
    return pd.Series(cls, index=f.index).reindex(feat.index)


def run_blocks(feat: pd.DataFrame, blocks: list[dict], params: dict) -> pd.DataFrame:
    """Test rows of every block with base, target, P(change), size, plus out-of-sample validation rows
    (last P.ES_DAYS of each training window, from the early-stopping probe) for threshold choice."""
    features = feature_columns()
    out = []
    for b in blocks:
        final, test, _, n_est = P.train_block("lightgbm_hurdle", params, feat, b, features)
        X = P.xyw(test, features)[0]
        part = test[["segment_id", "date", "base_price", "target_price", "is_target_data", "is_target_spec", "cls"]]
        out.append(part.assign(block=b["block"], split="test",
                               prob=final.models["cls"].predict_proba(X)[:, 1], size=final.models["reg"].predict(X)))
        # validation: refit the probe on the training window minus its last ES_DAYS, predict those days
        train = P.split_rows(feat, b["train_start"], b["train_end"])
        train = train[~train["in_outage"]]
        dates = np.sort(train["date"].unique())
        fit_part, va = train[train["date"] < dates[-P.ES_DAYS]], train[train["date"] >= dates[-P.ES_DAYS]]
        probe = P.fit_model("lightgbm_hurdle", params, P.xyw(fit_part, features), None,
                            n_estimators={k: max(int(v * (len(dates) - P.ES_DAYS) / len(dates)), 10)
                                          for k, v in n_est.items()})
        Xv = P.xyw(va, features)[0]
        part = va[["segment_id", "date", "base_price", "target_price", "is_target_data", "is_target_spec", "cls"]]
        out.append(part.assign(block=b["block"], split="valid",
                               prob=probe.models["cls"].predict_proba(Xv)[:, 1], size=probe.models["reg"].predict(Xv)))
        log.info("%s done (trees %s)", b["block"], n_est)
    return pd.concat(out, ignore_index=True)


def predict(rows: pd.DataFrame, thr_on: float, thr_off: float, on: np.ndarray) -> np.ndarray:
    """Hurdle price with threshold ``thr_on`` on gated days and ``thr_off`` elsewhere (1.0 = persistence)."""
    thr = np.where(on, thr_on, thr_off)
    pct = np.where(rows["prob"].to_numpy() > thr, np.clip(rows["size"].to_numpy(), -P.CLIP, P.CLIP), 0.0)
    return rows["base_price"].to_numpy() * (1 + pct)


def gains(rows: pd.DataFrame, pred: np.ndarray) -> pd.Series:
    y, base = rows["target_price"].to_numpy(), rows["base_price"].to_numpy()
    return pd.Series(np.abs(base - y) - np.abs(pred - y), index=rows.index)


GRID = np.round(np.arange(0.2, 1.0001, 0.05), 2)  # 1.0 = never predict a change (persistence)


def best_thresholds(valid: pd.DataFrame, on: np.ndarray, dual: bool) -> tuple[float, float]:
    y = valid["target_price"].to_numpy()

    def mae(a, b):
        return np.mean(np.abs(predict(valid, a, b, on) - y))

    if not dual:
        t = min(GRID, key=lambda a: mae(a, a))
        return t, t
    return min(((a, b) for a in GRID for b in GRID), key=lambda ab: mae(*ab))


def policies(rows: pd.DataFrame, pilot_thr: float) -> pd.DataFrame:
    """System MAE per block and policy, all on the same test rows; thresholds from that block's validation rows."""
    out = []
    for block, r in rows.groupby("block"):
        test, valid = r[r["split"] == "test"], r[r["split"] == "valid"]
        on_t, on_v = test["is_target_data"].to_numpy(), valid["is_target_data"].to_numpy()
        t_all, _ = best_thresholds(valid, on_v, dual=False)
        t_on, t_off = best_thresholds(valid, on_v, dual=True)
        pol = {
            "persistence": (1.0, 1.0, on_t),
            "calendar gate, pilot threshold (pilot system)": (pilot_thr, 1.0, on_t),
            "every day, pilot threshold": (pilot_thr, pilot_thr, on_t),
            f"every day, threshold tuned on valid ({t_all})": (t_all, t_all, on_t),
            f"dual: target days {t_on} / other days {t_off}": (t_on, t_off, on_t),
        }
        y = test["target_price"].to_numpy()
        base_mae = np.mean(np.abs(test["base_price"].to_numpy() - y))
        for name, (a, b, on) in pol.items():
            pred = predict(test, a, b, on)
            g = gains(test, pred)
            row = {"block": block, "policy": name, "rows": len(test), "MAE": np.mean(np.abs(pred - y)),
                   "vs_persistence_%": 100 * (base_mae - np.mean(np.abs(pred - y))) / base_mae}
            for day, m in (("target", on), ("other", ~on)):
                for c in ("real", "diverge", "label_b3", "flat"):
                    row[f"gain_{day}_{c}"] = g[m & (test["cls"] == c).to_numpy()].sum()
            out.append(row)
    return pd.DataFrame(out)


def dm_test(rows: pd.DataFrame, pred_a: np.ndarray, pred_b: np.ndarray) -> tuple[float, float]:
    """Diebold–Mariano on daily mean absolute-error differences (a − b), HLN small-sample correction, h = 1."""
    from scipy import stats
    y = rows["target_price"].to_numpy()
    d = pd.Series(np.abs(pred_a - y) - np.abs(pred_b - y)).groupby(rows["date"].to_numpy()).mean().to_numpy()
    n = len(d)
    if n < 3 or d.std(ddof=1) == 0:
        return float("nan"), float("nan")
    dm = d.mean() / np.sqrt(d.var(ddof=0) / n) * np.sqrt((n - 1) / n)  # HLN with h = 1
    return float(dm), float(2 * stats.t.sf(abs(dm), n - 1))


def clean_policies(rows: pd.DataFrame, pilot_thr: float) -> pd.DataFrame:
    """Second target (handoff Sec. 5): only rows where yesterday's causal base equals yesterday's hindsight
    regular price (classes real + flat), so any gain is a real regular-price change predicted."""
    out = []
    for block, r in rows[rows["split"] == "test"].groupby("block"):
        for subset, t in (("all rows", r), ("all rows except label_b3", r[r["cls"] != "label_b3"]),
                          ("clean rows (real + flat)", r[r["cls"].isin(["real", "flat"])])):
            on = t["is_target_data"].to_numpy()
            y = t["target_price"].to_numpy()
            base = t["base_price"].to_numpy()
            gate, every = predict(t, pilot_thr, 1.0, on), predict(t, pilot_thr, pilot_thr, on)
            dm, p = dm_test(t, every, gate)
            mae = {k: np.mean(np.abs(v - y)) for k, v in (("persistence", base), ("gate", gate), ("every", every))}
            out.append({"block": block, "subset": subset, "rows": len(t), "MAE_persistence": mae["persistence"],
                        "gate_vs_pers_%": 100 * (1 - mae["gate"] / mae["persistence"]),
                        "every_vs_pers_%": 100 * (1 - mae["every"] / mae["persistence"]),
                        "DM_every_minus_gate": dm, "p": p})
    return pd.DataFrame(out)


def class_table(rows: pd.DataFrame) -> pd.DataFrame:
    t = rows[rows["split"] == "test"].assign(err=lambda d: (d["base_price"] - d["target_price"]).abs())
    return t.groupby(["block", "is_target_data", "cls"]).agg(rows=("err", "size"), persistence_err=("err", "sum")).reset_index()


def report() -> None:
    rows = pd.read_parquet(OUT / "gurmar_hurdle_rows.parquet")
    pilot_thr = json.loads(Path("configs/phase1_best_params.json").read_text())["lightgbm_hurdle"]["threshold"]
    policies(rows, pilot_thr).round(4).to_csv(OUT / "gurmar_policies.csv", index=False)
    clean_policies(rows, pilot_thr).round(4).to_csv(OUT / "gurmar_policies_by_target.csv", index=False)
    class_table(rows).round(2).to_csv(OUT / "gurmar_row_classes.csv", index=False)


def main() -> None:
    feat = pd.read_parquet(PROCESSED / "gurmar_features.parquet")
    feat["cls"] = row_classes(feat)
    blocks = json.loads((PROCESSED / "gurmar_blocks.json").read_text())["blocks"]
    params = json.loads(Path("configs/phase1_best_params.json").read_text())["lightgbm_hurdle"]
    rows = run_blocks(feat, blocks, params)
    OUT.mkdir(parents=True, exist_ok=True)
    rows.to_parquet(OUT / "gurmar_hurdle_rows.parquet", index=False)
    log.info("saved %d rows", len(rows))
    report()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    report() if "--report" in sys.argv else main()
