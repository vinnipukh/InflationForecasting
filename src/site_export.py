"""Data for the GitHub Pages site (site/): retrains the LightGBM hurdle model per block with the tuned
parameters in configs/phase1_best_params.json (no re-tuning) and writes

* site/data/summary.json  — data-target-day metrics (model vs. yesterday's price) and system MAE per block
* site/data/products.json — per product: regular price as change points, target-day forecasts

Needs data/processed from notebooks 01 and 02.
Usage: python -m src.site_export
"""
from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from src.evaluation import metrics as M
from src.models.classical_ml import phase1 as P
from src.preprocessing.features import feature_columns

log = logging.getLogger("site_export")
MODEL = "lightgbm_hurdle"
OUT = Path("site/data")


def change_points(values: np.ndarray) -> list:
    """[[day_index, value|None], …] at every day the (rounded) value differs from the day before."""
    out, prev = [], object()
    for i, v in enumerate(values):
        v = None if np.isnan(v) else round(float(v), 2)
        if v != prev:
            out.append([i, v])
            prev = v
    return out


def main() -> None:
    processed = Path("data/processed")
    feat = pd.read_parquet(processed / "gurmar_features.parquet")
    blocks = json.loads((processed / "gurmar_blocks.json").read_text())["blocks"]
    params = json.loads(Path("configs/phase1_best_params.json").read_text())[MODEL]
    features = feature_columns()

    summary_blocks, preds = [], []
    for block in blocks:
        _, test, pct, n_est = P.train_block(MODEL, params, feat, block, features)
        price = P.to_price(test, pct)
        dummy = M.baselines(test)["persistence_causal_regular"]
        ev = {label: M.evaluate(test, p, label).set_index("subset") for label, p in (("dummy", dummy), ("model", price))}
        summary_blocks.append({
            "block": block["block"], "test_start": block["test_start"], "test_end": block["test_end"],
            "dummy": ev["dummy"].loc["data target days"].drop("model").to_dict(),
            "model": ev["model"].loc["data target days"].drop("model").to_dict(),
            "system": {"dummy_MAE": ev["dummy"].loc["global (model on data days)", "MAE"],
                       "model_MAE": ev["model"].loc["global (model on data days)", "MAE"]},
        })
        mask = test["is_target_data"].to_numpy()
        preds.append(test.loc[mask, ["segment_id", "date", "base_price", "target_price"]]
                     .assign(pred_price=price[mask], block=block["block"]))
        log.info("%s: trees=%s, data-day MAE dummy %.3f model %.3f", block["block"], n_est,
                 summary_blocks[-1]["dummy"]["MAE"], summary_blocks[-1]["model"]["MAE"])
    preds = pd.concat(preds, ignore_index=True)

    dates = pd.date_range(feat["date"].min(), feat["date"].max(), freq="D")
    day_index = {d: i for i, d in enumerate(dates)}
    panel = pd.read_parquet(processed / "gurmar_panel_regular.parquet", columns=["series_id", "pack_segment", "date", "name", "coicop"])
    meta = (panel.sort_values("date").groupby(["series_id", "pack_segment"]).last()
            .reset_index().assign(segment_id=lambda d: d["series_id"].astype(str) + "#" + d["pack_segment"].astype(str))
            .set_index("segment_id"))
    pred_by_seg = {seg: g for seg, g in preds.groupby("segment_id")}

    products = []
    for seg, g in feat.groupby("segment_id", sort=False):
        g = g.set_index("date").reindex(dates)
        p = pred_by_seg.get(seg)
        rows = [] if p is None else [
            [day_index[r.date], round(r.base_price, 2), round(float(r.pred_price), 2), round(r.target_price, 2), r.block]
            for r in p.sort_values("date").itertuples()]
        products.append({
            "id": seg, "n": meta.at[seg, "name"] if seg in meta.index else seg,
            "c": g["coicop"].dropna().iloc[0] if g["coicop"].notna().any() else "unknown",
            "r": change_points(g["target_price"].to_numpy(dtype=float)),
            "p": rows,
            "chg": any(abs(pred / base - 1) > M.TOL for _, base, pred, _, _ in rows),
        })
    products.sort(key=lambda p: p["n"].casefold())

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "summary.json").write_text(json.dumps({
        "generated": date.today().isoformat(), "data_end": dates[-1].date().isoformat(), "model": MODEL,
        "outage": json.loads((processed / "gurmar_blocks.json").read_text())["outage"],
        "n_products": len(products), "n_days": int(feat.loc[feat["observed"], "date"].nunique()),
        "blocks": summary_blocks,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "products.json").write_text(json.dumps(
        {"dates": [d.date().isoformat() for d in dates], "products": products},
        ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log.info("%d products, %d target-day forecasts", len(products), len(preds))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    main()
