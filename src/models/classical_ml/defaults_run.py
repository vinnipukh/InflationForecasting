"""Unoptimized Phase-1 models: library-default hyperparameters, same objective (L1 on % change, price-weighted).

Usage: python -m src.models.classical_ml.defaults_run [n_threads]
"""
from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path

import lightgbm as lgb
import pandas as pd
import xgboost as xgb
from catboost import CatBoostRegressor, Pool

from src.evaluation import metrics as M
from src.models.classical_ml import phase1 as P
from src.preprocessing.features import feature_columns

log = logging.getLogger("defaults_run")


def make_models(n_threads: int) -> dict:
    return {
        "lightgbm_default": lambda: lgb.LGBMRegressor(objective="l1", random_state=P.SEED, n_jobs=n_threads, verbose=-1),
        "xgboost_default": lambda: xgb.XGBRegressor(objective="reg:absoluteerror", tree_method="hist",
                                                    enable_categorical=True, random_state=P.SEED, n_jobs=n_threads),
        "catboost_default": lambda: CatBoostRegressor(loss_function="MAE", random_seed=P.SEED, verbose=False,
                                                      thread_count=n_threads, allow_writing_files=False),
    }


def main(n_threads: int = 4) -> pd.DataFrame:
    processed = Path("data/processed")
    feat = pd.read_parquet(processed / "gurmar_features.parquet")
    blocks = json.loads((processed / "gurmar_blocks.json").read_text())["blocks"]
    features = feature_columns()

    rows = []
    for block in blocks:
        train = P.split_rows(feat, block["train_start"], block["train_end"])
        train = train[~train["in_outage"]]
        test = P.split_rows(feat, block["test_start"], block["test_end"])
        X, y, w = P.xyw(train, features)
        Xt = P.xyw(test, features)[0]
        for base_name, base_pred in M.baselines(test).items():
            rows.append(M.evaluate(test, base_pred, base_name).assign(block=block["block"]))
        for name, factory in make_models(n_threads).items():
            start = time.time()
            model = factory()
            if name.startswith("catboost"):
                model.fit(Pool(P._cat_frame(X), y, weight=w, cat_features=P.CATEGORICAL))
                pct = model.predict(P._cat_frame(Xt))
            else:
                model.fit(X, y, sample_weight=w)
                pct = model.predict(Xt)
            rows.append(M.evaluate(test, P.to_price(test, pct), name).assign(block=block["block"]))
            log.info("%s %s %.0fs", block["block"], name, time.time() - start)

    res = M.add_improvement(pd.concat(rows, ignore_index=True))
    res.to_csv(processed / "phase1_defaults_results.csv", index=False)
    return res


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 4)
