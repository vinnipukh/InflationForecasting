"""Rolling-origin comparison of target-day rules across stores (handoff Sec. 5).

Origin = first day of each month. Rules are chosen on data before the origin only and scored on that month:
share of comparable days selected, share of regular-price changes and of persistence error (TRY) on those days.
Usage: python -m src.target_days.evaluate
"""
from __future__ import annotations

from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from src.target_days.calendar import HOLIDAYS_2026, daily_rates, fixed_rule, rule_mask, select_target_days

PROCESSED = Path("data/processed")
OUT = Path("reports/target_days")
MIN_PRODUCTS = 50       # a scrape day with fewer comparable products is dropped
MIN_TRAIN_DAYS = 20
MIN_TEST_DAYS = 5
GATE_BUDGET = 4 / 30    # learned gate: same day budget as the 4-day rules
ORIGINS = pd.date_range("2026-04-01", "2026-10-01", freq="MS")


def causal_day_features(daily: pd.DataFrame) -> pd.DataFrame:
    """Day-level features for the learned gate, each known before the day starts."""
    d = daily.sort_values(["store", "date"]).copy()
    for key in ("dom", "dow"):
        g = d.groupby(["store", key])["rate"]
        d[f"hist_{key}"] = g.transform(lambda s: s.shift().expanding().mean())
        d[f"hist_{key}_n"] = g.cumcount()
    d["store_mean"] = d.groupby("store")["rate"].transform(lambda s: s.shift().expanding().mean())
    for key in ("hist_dom", "hist_dow"):
        d[f"{key}_rel"] = d[key] / d["store_mean"]
    lag1 = d[["store", "date", "rate"]].assign(date=d["date"] + pd.Timedelta(days=1)).rename(columns={"rate": "rate_lag1"})
    d = d.merge(lag1, on=["store", "date"], how="left")  # yesterday's rate (NaN if yesterday not scraped)
    d["rate_7d"] = d.groupby("store")["rate"].transform(lambda s: s.shift().rolling(7, min_periods=1).mean())
    d["is_holiday"] = d["date"].isin(HOLIDAYS_2026).astype(int)
    d["days_to_month_end"] = d["date"].dt.days_in_month - d["dom"]
    return d


GATE_FEATURES = ["dom", "dow", "hist_dom_rel", "hist_dow_rel", "hist_dom_n", "rate_lag1", "rate_7d",
                 "is_holiday", "days_to_month_end"]


def evaluate(daily: pd.DataFrame) -> pd.DataFrame:
    daily = daily[daily["products"] >= MIN_PRODUCTS].copy()
    feats = causal_day_features(daily)
    rows = []
    for origin in ORIGINS:
        test_end = origin + pd.offsets.MonthEnd(0)
        train_all = daily[daily["date"] < origin]
        pooled_dom = train_all.groupby("dom")["rate"].mean()
        # learned gate: one pooled model per origin, trained on all stores' days before the origin
        tr = feats[feats["date"] < origin].dropna(subset=["hist_dom_rel"])
        gate = None
        if len(tr) > 200:
            gate = lgb.LGBMRegressor(n_estimators=200, learning_rate=0.05, num_leaves=15, min_child_samples=20,
                                     random_state=42, verbose=-1).fit(tr[GATE_FEATURES], tr["rate"] / tr["store_mean"])
        for store, s in daily.groupby("store"):
            train = s[s["date"] < origin]
            test = s[s["date"].between(origin, test_end)]
            if len(train) < MIN_TRAIN_DAYS or len(test) < MIN_TEST_DAYS:
                continue
            dates = pd.DatetimeIndex(test["date"])
            masks = {name: fixed_rule(name)(dates) for name in
                     ["every_day", "pilot_1_14_15_16_hol", "spec_1_15_end_hol", "1st_only"]}
            for k in (2, 4, 6):
                masks[f"dom_top{k}"] = rule_mask(dates, select_target_days(s, origin - pd.Timedelta(days=1), k))
            masks["dom_top4_shrunk"] = rule_mask(dates, select_target_days(
                s, origin - pd.Timedelta(days=1), 4, shrink=2.0, pooled=pooled_dom))
            masks["pooled_dom_top4"] = rule_mask(dates, set(pooled_dom.sort_values(ascending=False).index[:4]))
            for k in (1, 2):
                masks[f"dow_top{k}"] = rule_mask(dates, select_target_days(s, origin - pd.Timedelta(days=1), k, by="dow"),
                                                 by="dow")
            masks["dom_top2+dow_top1"] = masks["dom_top2"] | masks["dow_top1"]
            if gate is not None:
                tf = feats[(feats["store"] == store) & feats["date"].between(origin, test_end)]
                trs = tr[tr["store"] == store]
                if len(trs) >= MIN_TRAIN_DAYS and len(tf) == len(test):
                    cut = np.quantile(gate.predict(trs[GATE_FEATURES]), 1 - GATE_BUDGET)
                    masks["learned_gate"] = gate.predict(tf[GATE_FEATURES]) > cut
            for name, m in masks.items():
                m = np.asarray(m)
                rows.append({"store": store, "origin": origin.strftime("%Y-%m"), "method": name,
                             "days": len(test), "sel_days": int(m.sum()),
                             "changes": int(test["changes"].sum()), "sel_changes": int(test["changes"].to_numpy()[m].sum()),
                             "err": float(test["err"].sum()), "sel_err": float(test["err"].to_numpy()[m].sum())})
    return pd.DataFrame(rows)


CANDIDATES = ["1st_only", "dom_top2", "dom_top4", "dom_top4_shrunk", "dow_top1", "dow_top2", "dom_top2+dow_top1",
              "pilot_1_14_15_16_hol"]


def add_store_best(res: pd.DataFrame) -> pd.DataFrame:
    """Per store and origin, use the candidate rule with the highest excess capture (change share − day share)
    over that store's *earlier* origins; the pilot rule until a store has an earlier origin."""
    picks = []
    for store, s in res[res["method"].isin(CANDIDATES)].groupby("store"):
        for origin in sorted(s["origin"].unique()):
            past = s[s["origin"] < origin].groupby("method")[["sel_changes", "changes", "sel_days", "days"]].sum()
            best = "pilot_1_14_15_16_hol"
            if len(past):
                excess = past["sel_changes"] / past["changes"].clip(lower=1) - past["sel_days"] / past["days"]
                best = excess.idxmax()
            row = s[(s["origin"] == origin) & (s["method"] == best)].iloc[0].copy()
            row["method"], row["picked"] = "store_best", best
            picks.append(row)
    return pd.concat([res, pd.DataFrame(picks)], ignore_index=True)


def summarise(res: pd.DataFrame) -> pd.DataFrame:
    """Per store × method, summed over origins; plus the per-origin spread of change capture."""
    g = res.groupby(["store", "method"])
    out = g[["days", "sel_days", "changes", "sel_changes", "err", "sel_err"]].sum()
    out["day_share"] = out["sel_days"] / out["days"]
    out["change_capture"] = out["sel_changes"] / out["changes"]
    out["err_capture"] = out["sel_err"] / out["err"]
    out["lift"] = out["change_capture"] / out["day_share"]
    cap = res.assign(c=res["sel_changes"] / res["changes"].replace(0, np.nan))
    out["capture_min_month"] = cap.groupby(["store", "method"])["c"].min()
    out["origins"] = g.size()
    return out.reset_index()


def bootstrap_dom(daily: pd.DataFrame, reps: int = 1000, seed: int = 42) -> pd.DataFrame:
    """Mean daily change rate per store × day of month with a 90 % bootstrap interval over dates."""
    rng = np.random.default_rng(seed)
    rows = []
    for (store, dom), x in daily[daily["products"] >= MIN_PRODUCTS].groupby(["store", "dom"]):
        r = x["rate"].to_numpy()
        boots = rng.choice(r, size=(reps, len(r))).mean(axis=1)
        rows.append({"store": store, "dom": dom, "n_dates": len(r), "rate": r.mean(),
                     "lo": np.quantile(boots, 0.05), "hi": np.quantile(boots, 0.95)})
    return pd.DataFrame(rows)


def main() -> None:
    changes = pd.read_parquet(PROCESSED / "all_stores_changes.parquet")
    daily = daily_rates(changes)
    OUT.mkdir(parents=True, exist_ok=True)
    daily.to_csv(OUT / "daily_rates.csv", index=False)
    bootstrap_dom(daily).to_csv(OUT / "dom_rates_ci.csv", index=False)
    res = add_store_best(evaluate(daily))
    res.to_csv(OUT / "rules_by_origin.csv", index=False)
    summarise(res).to_csv(OUT / "rules_summary.csv", index=False)


if __name__ == "__main__":
    main()
