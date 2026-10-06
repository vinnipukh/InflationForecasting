"""When do regular prices change? Hindsight regular price, change counting and causal target-day rules.

Change definition (docs/handoff_target_days.md Sec. 2): the hindsight regular price moved by more than TOL from
the previous calendar day, both days observed. One change per product whatever its size.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

TOL = 0.005
SALE_WINDOW_DAYS = 35   # pilot V-filter window
RESOLVE_MIN_DAYS = 21   # an unreturned drop with fewer days of data after it is "unresolved" (end of data)
MAX_GAP_DAYS = 7        # a scrape gap longer than this resets the filter (pilot: never search across the outage)


def flag_sales(days: np.ndarray, prices: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Pilot V-shaped sale filter (notebook 01) on one series; ``days`` are integer day numbers.

    Returns (sale, unresolved) boolean arrays.
    """
    n = len(prices)
    sale = np.zeros(n, dtype=bool)
    unresolved = np.zeros(n, dtype=bool)
    if n == 0:
        return sale, unresolved
    ref = prices[0]
    i = 1
    while i < n:
        p = prices[i]
        if days[i] - days[i - 1] > MAX_GAP_DAYS:
            ref = p
            i += 1
            continue
        if p < ref * (1 - TOL):
            j, found, blocked = i + 1, -1, False
            while j < n and days[j] - days[i] <= SALE_WINDOW_DAYS:
                if days[j] - days[j - 1] > MAX_GAP_DAYS:
                    blocked = True
                    break
                if prices[j] >= ref * (1 - TOL):
                    found = j
                    break
                j += 1
            if found >= 0:
                sale[i:found] = True
                ref = prices[found]
                i = found + 1
                continue
            if not blocked and j >= n and days[-1] - days[i] < RESOLVE_MIN_DAYS:
                unresolved[i:] = True
        ref = p
        i += 1
    return sale, unresolved


def regular_prices(shelf: pd.DataFrame) -> pd.DataFrame:
    """(store, name, date, price) -> adds is_sale, unresolved and the hindsight ``regular`` price.

    On a sale day the regular price is the pre-sale level (carried forward), as in the pilot's target.
    """
    f = shelf.sort_values(["store", "name", "date"]).reset_index(drop=True)
    day = ((f["date"] - pd.Timestamp("2026-01-01")).dt.days).to_numpy()
    price = f["price"].to_numpy(dtype=float)
    key = f["store"] + "\x00" + f["name"]
    bounds = np.flatnonzero(key.ne(key.shift()).to_numpy())
    bounds = np.append(bounds, len(f))
    sale = np.zeros(len(f), dtype=bool)
    unres = np.zeros(len(f), dtype=bool)
    for a, b in zip(bounds[:-1], bounds[1:]):
        sale[a:b], unres[a:b] = flag_sales(day[a:b], price[a:b])
    f["is_sale"], f["unresolved"] = sale, unres
    f["regular"] = f["price"].where(~f["is_sale"])
    f["regular"] = f.groupby(["store", "name"])["regular"].ffill()
    return f


def count_changes(reg: pd.DataFrame) -> pd.DataFrame:
    """One row per (store, product, day) with the previous calendar day also observed.

    ``changed``: hindsight regular price moved > TOL; ``err``: persistence absolute error in TRY.
    """
    g = reg.groupby(["store", "name"])
    prev_date, prev_reg, prev_unres = g["date"].shift(), g["regular"].shift(), g["unresolved"].shift(fill_value=True)
    ok = (reg["date"] - prev_date).dt.days.eq(1) & reg["regular"].notna() & prev_reg.notna()
    ok &= ~reg["unresolved"] & ~prev_unres
    out = reg.loc[ok, ["store", "name", "date"]].copy()
    out["changed"] = ((reg["regular"] / prev_reg - 1).abs() > TOL)[ok]
    out["err"] = (reg["regular"] - prev_reg).abs()[ok]
    return out.reset_index(drop=True)


def daily_rates(changes: pd.DataFrame) -> pd.DataFrame:
    """Per store and date: products comparable, changes, persistence error."""
    d = changes.groupby(["store", "date"]).agg(products=("changed", "size"), changes=("changed", "sum"),
                                                err=("err", "sum")).reset_index()
    d["rate"] = d["changes"] / d["products"]
    d["dom"] = d["date"].dt.day
    d["dow"] = d["date"].dt.dayofweek
    return d


# ── target-day rules ─────────────────────────────────────────────────────────

HOLIDAYS_2026 = pd.to_datetime([
    "2026-01-01", "2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22", "2026-04-23", "2026-05-01", "2026-05-19",
    "2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30", "2026-07-15", "2026-08-30",
    "2026-10-28", "2026-10-29",
])


def fixed_rule(name: str):
    """Baseline rules from the handoff (Sec. 5). Each maps a DatetimeIndex to a boolean mask."""
    rules = {
        "every_day": lambda d: np.ones(len(d), dtype=bool),
        "pilot_1_14_15_16_hol": lambda d: d.day.isin([1, 14, 15, 16]) | d.isin(HOLIDAYS_2026),
        "spec_1_15_end_hol": lambda d: d.day.isin([1, 15]) | d.is_month_end | d.isin(HOLIDAYS_2026),
        "1st_only": lambda d: d.day == 1,
    }
    return rules[name]


def select_target_days(daily: pd.DataFrame, train_end, k: int = 4, by: str = "dom",
                       shrink: float = 0.0, pooled: pd.Series | None = None) -> set[int]:
    """Top-k days of month (``by='dom'``) or weekdays (``by='dow'``) by change rate, from data up to ``train_end``.

    ``daily`` = daily_rates() for one store. Rate per day = changes / products over all training dates.
    With ``shrink`` > 0 the store rate is pulled towards ``pooled`` (rate by the same key across other stores):
    (changes + shrink * pooled) / (products_days + shrink), counted in days so a key seen once is pulled hard.
    """
    t = daily[daily["date"] <= pd.Timestamp(train_end)]
    s = t.groupby(by).agg(changes=("rate", "sum"), n=("rate", "size"))
    rate = s["changes"] / s["n"]  # mean daily rate per key: every date weighs the same
    if shrink > 0 and pooled is not None:
        rate = (s["changes"] + shrink * pooled.reindex(s.index).fillna(pooled.mean())) / (s["n"] + shrink)
    return set(rate.sort_values(ascending=False).index[:k].astype(int))


def rule_mask(dates: pd.DatetimeIndex, days: set[int], by: str = "dom") -> np.ndarray:
    key = dates.day if by == "dom" else dates.dayofweek
    return np.asarray(key.isin(sorted(days)))


if __name__ == "__main__":  # smallest checks of the filter and the change count
    d = np.arange(10)
    s, u = flag_sales(d, np.array([10, 10, 8, 8, 10, 10, 12, 12, 12, 12.0]))
    assert s.tolist() == [0, 0, 1, 1, 0, 0, 0, 0, 0, 0], s
    s, u = flag_sales(d, np.array([10, 10, 10, 10, 10, 10, 10, 10, 8, 8.0]))
    assert u[-2:].all() and not s.any()  # drop at the end of data: unresolved, not a sale
    s, _ = flag_sales(np.array([0, 1, 30, 31]), np.array([10, 8, 8, 10.0]))
    assert not s.any()  # a drop is never matched across a scrape gap > MAX_GAP_DAYS
    shelf = pd.DataFrame({"store": "x", "name": "a", "date": pd.date_range("2026-03-01", periods=6),
                          "price": [10, 10, 8, 10, 11, 11.0]})
    ch = count_changes(regular_prices(shelf))
    assert ch["changed"].tolist() == [False, False, False, True, False], ch  # sale day is not a change; 10→11 is
    dates = pd.date_range("2026-03-01", "2026-04-30")
    daily = pd.DataFrame({"date": dates, "rate": np.where(dates.day == 1, 0.1, 0.01)})
    daily["dom"], daily["dow"] = dates.day, dates.dayofweek
    daily.loc[daily["date"] == "2026-04-01", "rate"] = 0.0  # after train_end: must be ignored
    assert select_target_days(daily, "2026-03-31", k=1) == {1}
    assert rule_mask(pd.DatetimeIndex(["2026-04-01", "2026-04-02"]), {1}).tolist() == [True, False]
    print("ok")
