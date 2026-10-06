"""Phase 1 (handoff.md Sec. 4): tree-based models on the Gurmar feature table.

* Target: ``target_pct_change``; loss = absolute error weighted by ``base_price`` (= MAE in TRY).
* Models: LightGBM, XGBoost, CatBoost regressors and a LightGBM hurdle model
  (classifier for "price changes" + L1 regressor for the size; predicts 0 unless P(change) > threshold).
* Tuning: Optuna with ``TimeSeriesSplit`` over the dates of B1's training window only; the best parameters
  are reused for every block, so tuning never sees a test period.
* Per block: early stopping on the last ``ES_DAYS`` of the training window, then refit on the full window.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import lightgbm as lgb
import numpy as np
import optuna
import pandas as pd
import xgboost as xgb
from catboost import CatBoostRegressor, Pool
from sklearn.model_selection import TimeSeriesSplit

from src.evaluation.metrics import TOL

log = logging.getLogger(__name__)

SEED = 42
CLIP = 0.8          # paper IV-A: |change| > 80 % is treated as an artifact
ES_DAYS = 14
MAX_TREES = 2000
EARLY_STOP = 100
CATEGORICAL = ["coicop", "unit_basis"]


# ── data ─────────────────────────────────────────────────────────────────────

def split_rows(frame: pd.DataFrame, start: str, end: str) -> pd.DataFrame:
    return frame[frame["usable_target"] & frame["date"].between(start, end)]


def xyw(frame: pd.DataFrame, features: list[str], categorical: bool = True):
    X = frame[features + (CATEGORICAL if categorical else [])]
    y = frame["target_pct_change"].clip(-CLIP, CLIP).to_numpy()
    w = frame["base_price"].to_numpy()
    return X, y, w


def to_price(frame: pd.DataFrame, pct) -> np.ndarray:
    return frame["base_price"].to_numpy() * (1 + np.clip(pct, -CLIP, CLIP))


# ── model wrappers ───────────────────────────────────────────────────────────

@dataclass
class Fitted:
    name: str
    params: dict
    models: dict = field(default_factory=dict)
    best_iter: dict = field(default_factory=dict)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if self.name == "lightgbm_hurdle":
            p = self.models["cls"].predict_proba(X)[:, 1]
            size = self.models["reg"].predict(X)
            return np.where(p > self.params["threshold"], size, 0.0)
        if self.name == "catboost":
            return self.models["reg"].predict(_cat_frame(X))
        return self.models["reg"].predict(X)


def _cats(X: pd.DataFrame) -> list[str]:
    return [c for c in CATEGORICAL if c in X.columns]


def _cat_frame(X: pd.DataFrame) -> pd.DataFrame:
    X = X.copy()
    for c in _cats(X):
        X[c] = X[c].astype(str).fillna("na")
    return X


def _lgb_reg(params, n_estimators):
    keys = ["learning_rate", "num_leaves", "min_child_samples", "feature_fraction", "bagging_fraction",
            "lambda_l1", "lambda_l2"]
    return lgb.LGBMRegressor(objective="l1", n_estimators=n_estimators, bagging_freq=1, random_state=SEED,
                             n_jobs=-1, verbose=-1, **{k: params[k] for k in keys})


def fit_model(name: str, params: dict, train: tuple, valid: tuple | None, n_estimators: dict | None = None) -> Fitted:
    """Fit one model. With ``valid`` → early stopping; with ``n_estimators`` → fixed number of trees."""
    X, y, w = train
    fitted = Fitted(name, params)
    es = [lgb.early_stopping(EARLY_STOP, verbose=False)]

    if name == "lightgbm":
        m = _lgb_reg(params, (n_estimators or {}).get("reg", MAX_TREES))
        if valid:
            m.fit(X, y, sample_weight=w, eval_set=[(valid[0], valid[1])], eval_sample_weight=[valid[2]],
                  eval_metric="l1", callbacks=es)
            fitted.best_iter["reg"] = m.best_iteration_ or MAX_TREES
        else:
            m.fit(X, y, sample_weight=w)
        fitted.models["reg"] = m

    elif name == "xgboost":
        kw = dict(objective="reg:absoluteerror", tree_method="hist", enable_categorical=True, max_cat_to_onehot=1,
                  random_state=SEED, n_jobs=-1, eval_metric="mae",
                  max_depth=params["max_depth"], learning_rate=params["learning_rate"],
                  min_child_weight=params["min_child_weight"], subsample=params["subsample"],
                  colsample_bytree=params["colsample_bytree"], reg_lambda=params["reg_lambda"],
                  reg_alpha=params["reg_alpha"])
        if valid:
            m = xgb.XGBRegressor(n_estimators=MAX_TREES, early_stopping_rounds=EARLY_STOP, **kw)
            m.fit(X, y, sample_weight=w, eval_set=[(valid[0], valid[1])], sample_weight_eval_set=[valid[2]],
                  verbose=False)
            fitted.best_iter["reg"] = int(m.best_iteration) + 1
        else:
            m = xgb.XGBRegressor(n_estimators=n_estimators["reg"], **kw)
            m.fit(X, y, sample_weight=w, verbose=False)
        fitted.models["reg"] = m

    elif name == "catboost":
        kw = dict(loss_function="MAE", learning_rate=params["learning_rate"], depth=params["depth"],
                  l2_leaf_reg=params["l2_leaf_reg"], random_seed=SEED, verbose=False, thread_count=-1,
                  allow_writing_files=False)
        train_pool = Pool(_cat_frame(X), y, weight=w, cat_features=_cats(X))
        if valid:
            m = CatBoostRegressor(iterations=MAX_TREES, od_type="Iter", od_wait=EARLY_STOP, **kw)
            m.fit(train_pool, eval_set=Pool(_cat_frame(valid[0]), valid[1], weight=valid[2], cat_features=_cats(X)),
                  use_best_model=True)
            fitted.best_iter["reg"] = int(m.get_best_iteration()) + 1
        else:
            m = CatBoostRegressor(iterations=n_estimators["reg"], **kw)
            m.fit(train_pool)
        fitted.models["reg"] = m

    elif name == "lightgbm_hurdle":
        changed = np.abs(y) > TOL
        cls_keys = ["learning_rate", "num_leaves", "min_child_samples", "feature_fraction"]
        cls = lgb.LGBMClassifier(objective="binary", n_estimators=(n_estimators or {}).get("cls", MAX_TREES),
                                 bagging_freq=1, bagging_fraction=0.8, random_state=SEED, n_jobs=-1, verbose=-1,
                                 **{k: params[f"cls_{k}"] for k in cls_keys})
        reg = _lgb_reg({k[4:]: v for k, v in params.items() if k.startswith("reg_")},
                       (n_estimators or {}).get("reg", MAX_TREES))
        if valid:
            v_changed = np.abs(valid[1]) > TOL
            cls.fit(X, changed.astype(int), eval_set=[(valid[0], v_changed.astype(int))], eval_metric="binary_logloss",
                    callbacks=es)
            reg.fit(X[changed], y[changed], sample_weight=w[changed],
                    eval_set=[(valid[0][v_changed], valid[1][v_changed])], eval_sample_weight=[valid[2][v_changed]],
                    eval_metric="l1", callbacks=es)
            fitted.best_iter = {"cls": cls.best_iteration_ or MAX_TREES, "reg": reg.best_iteration_ or MAX_TREES}
        else:
            cls.fit(X, changed.astype(int))
            reg.fit(X[changed], y[changed], sample_weight=w[changed])
        fitted.models = {"cls": cls, "reg": reg}
    else:
        raise ValueError(name)
    return fitted


# ── tuning ───────────────────────────────────────────────────────────────────

def suggest(name: str, trial: optuna.Trial) -> dict:
    if name == "lightgbm":
        return {
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 15, 255, log=True),
            "min_child_samples": trial.suggest_int("min_child_samples", 20, 500, log=True),
            "feature_fraction": trial.suggest_float("feature_fraction", 0.5, 1.0),
            "bagging_fraction": trial.suggest_float("bagging_fraction", 0.5, 1.0),
            "lambda_l1": trial.suggest_float("lambda_l1", 1e-3, 10, log=True),
            "lambda_l2": trial.suggest_float("lambda_l2", 1e-3, 10, log=True),
        }
    if name == "xgboost":
        return {
            "max_depth": trial.suggest_int("max_depth", 3, 10),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "min_child_weight": trial.suggest_float("min_child_weight", 1, 200, log=True),
            "subsample": trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10, log=True),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 10, log=True),
        }
    if name == "catboost":
        return {
            "learning_rate": trial.suggest_float("learning_rate", 0.02, 0.2, log=True),
            "depth": trial.suggest_int("depth", 4, 10),
            "l2_leaf_reg": trial.suggest_float("l2_leaf_reg", 1, 30, log=True),
        }
    if name == "lightgbm_hurdle":
        return {
            "cls_learning_rate": trial.suggest_float("cls_learning_rate", 0.01, 0.2, log=True),
            "cls_num_leaves": trial.suggest_int("cls_num_leaves", 15, 255, log=True),
            "cls_min_child_samples": trial.suggest_int("cls_min_child_samples", 20, 500, log=True),
            "cls_feature_fraction": trial.suggest_float("cls_feature_fraction", 0.5, 1.0),
            "reg_learning_rate": trial.suggest_float("reg_learning_rate", 0.01, 0.2, log=True),
            "reg_num_leaves": trial.suggest_int("reg_num_leaves", 7, 127, log=True),
            "reg_min_child_samples": trial.suggest_int("reg_min_child_samples", 5, 200, log=True),
            "reg_feature_fraction": trial.suggest_float("reg_feature_fraction", 0.5, 1.0),
            "reg_bagging_fraction": trial.suggest_float("reg_bagging_fraction", 0.5, 1.0),
            "reg_lambda_l1": trial.suggest_float("reg_lambda_l1", 1e-3, 10, log=True),
            "reg_lambda_l2": trial.suggest_float("reg_lambda_l2", 1e-3, 10, log=True),
            "threshold": trial.suggest_float("threshold", 0.2, 0.9),
        }
    raise ValueError(name)


def target_day_mae(frame: pd.DataFrame, pct) -> float:
    """System MAE (TRY) on target days (spec ∪ data set); all rows if a fold has no target day."""
    mask = (frame["is_target_spec"] | frame["is_target_data"]).to_numpy()
    if not mask.any():
        mask = np.ones(len(frame), dtype=bool)
    price = to_price(frame, pct)
    return float(np.mean(np.abs(price[mask] - frame["target_price"].to_numpy()[mask])))


def tune(name: str, train: pd.DataFrame, features: list[str], n_trials: int, n_splits: int = 3) -> optuna.Study:
    dates = np.sort(train["date"].unique())
    folds = []
    for tr_idx, va_idx in TimeSeriesSplit(n_splits=n_splits).split(dates):
        tr = train[train["date"].isin(dates[tr_idx])]
        va = train[train["date"].isin(dates[va_idx])]
        folds.append((tr, va, xyw(tr, features), xyw(va, features)))

    def objective(trial):
        params = suggest(name, trial)
        scores, iters = [], []
        for tr, va, tr_xyw, va_xyw in folds:
            fitted = fit_model(name, params, tr_xyw, va_xyw)
            scores.append(target_day_mae(va, fitted.predict(va_xyw[0])))
            iters.append(fitted.best_iter)
        trial.set_user_attr("best_iter", {k: int(np.mean([i[k] for i in iters])) for k in iters[0]})
        return float(np.mean(scores))

    study = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=SEED),
                                study_name=f"phase1_{name}")
    start = time.time()
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    log.info("%s: %d trials in %.0fs, best fold-mean target-day MAE %.4f", name, n_trials, time.time() - start,
             study.best_value)
    return study


# ── per-block training ───────────────────────────────────────────────────────

def train_block(name: str, params: dict, frame: pd.DataFrame, block: dict, features: list[str],
                categorical: bool = True):
    """Early stopping on the last ES_DAYS of the training window, refit on the full window, predict the test window."""
    train = split_rows(frame, block["train_start"], block["train_end"])
    train = train[~train["in_outage"]]
    test = split_rows(frame, block["test_start"], block["test_end"])

    dates = np.sort(train["date"].unique())
    es_start = dates[-ES_DAYS]
    fit_part, es_part = train[train["date"] < es_start], train[train["date"] >= es_start]
    probe = fit_model(name, params, xyw(fit_part, features, categorical), xyw(es_part, features, categorical))
    n_est = {k: max(int(v * len(dates) / (len(dates) - ES_DAYS)), 10) for k, v in probe.best_iter.items()}

    final = fit_model(name, params, xyw(train, features, categorical), None, n_estimators=n_est)
    pct = final.predict(xyw(test, features, categorical)[0])
    return final, test, pct, n_est
