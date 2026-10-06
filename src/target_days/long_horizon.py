"""Long-horizon test of target-day rules: choose on Feb–Jun, freeze, score on Aug–Oct (3–5 months later).

The longest out-of-sample gap the data allow (stores pause in Jun–Jul). Writes to reports/target_days/:

* weekly_vs_monthly.csv  — top-k weekdays vs top days of month at matched budgets (1–4 weekdays ≈ 4/9/13/17 days)
* long_horizon_families.csv — weekly / monthly / mixed ranking at a 15 / 30 / 45 % training day budget
* weekday_curve.csv     — A101 and Migros: coverage as weekdays are added, test and month by month
* triggers.csv          — calendar rule + "yesterday's change rate was high" (own store / competitors)

Kale, Arden and Marketzade are left out (small stores, few shoppers; Marketzade's peaks are one-off repricings).
Usage: python -m src.target_days.long_horizon   (needs reports/target_days/daily_rates.csv from evaluate.py)
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

OUT = Path("reports/target_days")
MIN_PRODUCTS = 50
TRAIN_END, TEST_START = pd.Timestamp("2026-06-30"), pd.Timestamp("2026-08-01")
STORES = ["A101", "Migros", "Gurmar", "Kim", "Macrocenter", "Hapeloglu"]
DOW = "Pzt Sal Çar Per Cum Cmt Paz".split()


def rank_keys(train: pd.DataFrame, family: str) -> list[tuple[str, int]]:
    """Calendar keys ('dow', k) / ('dom', k) by mean daily change rate on the training days, highest first."""
    keys = []
    for by in ("dow", "dom"):
        if family in (by, "mix"):
            keys += [((by, k), v) for k, v in train.groupby(by)["rate"].mean().items()]
    return [k for k, _ in sorted(keys, key=lambda t: -t[1])]


def on(x: pd.DataFrame, sel) -> pd.Series:
    return x["dom"].isin({k for f, k in sel if f == "dom"}) | x["dow"].isin({k for f, k in sel if f == "dow"})


def coverage(x: pd.DataFrame, m) -> dict:
    m = pd.Series(m, index=x.index)
    return {"chg": x.loc[m, "changes"].sum() / x["changes"].sum(), "tl": x.loc[m, "err"].sum() / x["err"].sum(),
            "days": m.mean()}


def label(sel) -> str:
    return ", ".join(str(k) if f == "dom" else DOW[k] for f, k in sel)


def within_budget(train: pd.DataFrame, family: str, budget: float) -> list:
    """Add keys in rank order, skipping any that pushes the training day share above the budget."""
    sel = []
    for k in rank_keys(train, family):
        sel.append(k)
        if on(train, sel).mean() > budget:
            sel.pop()
    return sel


def main() -> None:
    d = pd.read_csv(OUT / "daily_rates.csv", parse_dates=["date"])
    d = d[d["products"] >= MIN_PRODUCTS]
    split = {s: (x[x["date"] <= TRAIN_END], x[x["date"] >= TEST_START]) for s, x in d.groupby("store")}

    rows = []
    for s in STORES:
        tr, te = split[s]
        ow, od = rank_keys(tr, "dow"), rank_keys(tr, "dom")
        for kw, kd in ((1, 4), (2, 9), (3, 13), (4, 17)):
            w, m = coverage(te, on(te, ow[:kw])), coverage(te, on(te, od[:kd]))
            rows.append({"store": s, "days_per_month": round(kw * 30.4 / 7), "weekly_rule": label(ow[:kw]),
                         "monthly_rule": label(od[:kd]), **{f"weekly_{k}": v for k, v in w.items()},
                         **{f"monthly_{k}": v for k, v in m.items()}})
    pd.DataFrame(rows).round(3).to_csv(OUT / "weekly_vs_monthly.csv", index=False)

    rows = []
    for s in STORES:
        tr, te = split[s]
        for budget in (0.15, 0.30, 0.45):
            for fam in ("dow", "dom", "mix"):
                sel = within_budget(tr, fam, budget + 0.02)
                rows.append({"store": s, "train_budget": budget, "family": fam, "rule": label(sel),
                             **coverage(te, on(te, sel))})
    pd.DataFrame(rows).round(3).to_csv(OUT / "long_horizon_families.csv", index=False)

    rows = []
    for s in ("A101", "Migros"):
        tr, te = split[s]
        full = d[d["store"] == s]
        order = rank_keys(tr, "dow")
        for k in range(1, 8):
            sel = order[:k]
            months = {f"cov_{m}": coverage(z, on(z, sel))["chg"]
                      for m, z in full.groupby(full["date"].dt.strftime("%Y-%m"))}
            rows.append({"store": s, "rule": label(sel), "days_per_month": round(k * 30.4 / 7, 1),
                         "train_chg": coverage(tr, on(tr, sel))["chg"],
                         **{f"test_{k_}": v for k_, v in coverage(te, on(te, sel)).items()}, **months})
    pd.DataFrame(rows).round(3).to_csv(OUT / "weekday_curve.csv", index=False)

    # triggers: yesterday's change rate (own store / mean of every other store) above its training 90th percentile
    piv = d.pivot_table(index="date", columns="store", values="rate")
    own = piv.shift(1, freq="D")
    comp = piv.apply(lambda c: piv.drop(columns=c.name).mean(axis=1)).shift(1, freq="D")
    rows = []
    for s in STORES:
        tr, te = split[s]
        cal = on(te, within_budget(tr, "mix", 0.17)).to_numpy()
        rows.append({"store": s, "policy": "calendar", **coverage(te, cal)})
        for name, sig in (("own", own[s]), ("competitors", comp[s])):
            thr = sig.reindex(tr["date"]).quantile(0.9)
            trig = (sig.reindex(te["date"]) > thr).fillna(False).to_numpy()
            rows.append({"store": s, "policy": f"{name} trigger", **coverage(te, trig)})
            rows.append({"store": s, "policy": f"calendar + {name} trigger", **coverage(te, cal | trig)})
    pd.DataFrame(rows).round(3).to_csv(OUT / "triggers.csv", index=False)


if __name__ == "__main__":
    main()
