"""Feature engineering for the Gurmar regular-price panel.

Every feature for prediction day ``t`` uses information up to the end of day ``t - 1`` only
(handoff.md, Sec. 3 / 6.3). Concretely:

* Prices enter features through a *causal* regular price ``R``: a price drop is treated as a sale
  until it has lasted ``SALE_CONFIRM_DAYS`` without returning, then it becomes the new regular price.
  The ex-post sale filter from preprocessing (which looks into the future) is used only for the target.
* All per-segment features are computed on a daily calendar grid and shifted by one day.
* External series (USD/TRY, Brent, TUIK) are joined "as of" ``t - 1`` (last value published before day ``t``).

Target: ``target_pct_change = regular_price_t / base_price_t - 1`` with ``base_price_t = R_{t-1}``.
Persistence baseline = ``base_price_t``.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

TOL = 0.005                # relative tolerance for "same price"
SALE_CONFIRM_DAYS = 21     # an unreturned drop older than this becomes the regular price
FFILL_LIMIT_DAYS = 3       # carry the last price over at most this many missing scrape days
COICOP_WEIGHTS = {"01": 24.44, "05": 7.92, "09": 4.34, "13": 4.49}  # TUIK 2026 weights (paper Table IV)

HOLIDAYS_2026 = pd.to_datetime([
    "2026-01-01", "2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22",   # Ramazan Bayramı (arife + 3 days)
    "2026-04-23", "2026-05-01", "2026-05-19",
    "2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30",   # Kurban Bayramı (arife + 4 days)
    "2026-07-15", "2026-08-30", "2026-10-28", "2026-10-29",
])

FEATURE_GROUPS = {
    "lags": ["price_lag_1", "price_lag_7", "price_lag_15", "price_lag_30"],
    "cyclic": ["dow_sin", "dow_cos", "month_sin", "month_cos", "dom_sin", "dom_cos",
               "is_1st", "is_15th", "is_16th", "is_month_end", "days_to_month_end", "is_holiday"],
    "usd_try": ["usd_try_rate", "usd_try_rate_change", "usd_try_change_7d", "usd_try_change_30d"],
    "oil": ["brent_try", "brent_try_change_7d", "brent_try_change_30d"],
    "tuik": ["tuik_food_mom_last", "tuik_headline_mom_last", "tuik_food_3m_cum", "days_since_tuik_release"],
    "rolling": ["price_7d_mean", "price_7d_std", "price_30d_mean", "price_momentum_7d",
                "ratio_lag1_mean30", "days_since_change", "n_changes_30d", "n_changes_60d", "last_change_size"],
    "sale": ["shelf_price_lag1", "shelf_to_base_lag1", "on_sale_lag1", "sale_depth_lag1", "days_in_sale_lag1",
             "n_sale_days_60d"],
    "unit_price": ["log_unit_price_lag1", "rel_unit_price_lag1"],
    "cross_section": ["store_reprice_share_1d", "store_reprice_share_7d",
                      "cat_reprice_share_1d", "cat_reprice_share_7d"],
    "web_index": ["web_cat_infl_30d", "web_store_infl_30d"],
}
CATEGORICAL = ["coicop", "unit_basis"]


# ── inputs ───────────────────────────────────────────────────────────────────

def load_inputs(processed_dir: Path, external_dir: Path) -> dict:
    regular = pd.read_parquet(processed_dir / "gurmar_panel_regular.parquet")
    mapped = pd.read_parquet(processed_dir / "gurmar_panel_mapped.parquet")
    usd = pd.read_csv(external_dir / "usd_try_yahoo.csv", parse_dates=["date"])
    brent = pd.read_csv(external_dir / "brent_usd_yahoo.csv", parse_dates=["date"])
    tuik = pd.read_csv(external_dir / "tuik_cpi_monthly_2026.csv", parse_dates=["release_date"])
    return {"regular": regular, "mapped": mapped, "usd": usd, "brent": brent, "tuik": tuik}


def pack_segments(regular: pd.DataFrame) -> pd.Series:
    """Segment number per row: increments when the parsed pack changes within a series.

    Rows without a parseable pack inherit the neighbouring pack; a series with no pack at all is one segment.
    Expects ``regular`` sorted by series and date.
    """
    key = regular.groupby("series_id")["pack_key"].transform(lambda s: s.ffill().bfill()).fillna("")
    new = key.ne(key.groupby(regular["series_id"]).shift()) & regular.groupby("series_id").cumcount().gt(0)
    return new.astype(int).groupby(regular["series_id"]).cumsum() + 1


def build_segments(regular: pd.DataFrame, mapped: pd.DataFrame) -> pd.DataFrame:
    """Daily shelf observations (incl. sale days) with a segment id = series × pack segment."""
    shelf = (
        mapped.groupby(["series_id", "date"], as_index=False)
        .agg(shelf_price=("price", "max"), in_outage=("in_outage", "first"))
        .sort_values(["series_id", "date"])
    )
    regular = regular.sort_values(["series_id", "date"]).copy()
    regular["pack_segment"] = pack_segments(regular)
    qty = regular["pack_count"].fillna(1) * regular["pack_size"]
    regular["unit_factor"] = np.where(regular["pack_size"].notna(), 1000 / qty,
                                      np.where(regular["pack_count"].notna(), 1 / regular["pack_count"], np.nan))
    seg = regular[["series_id", "date", "pack_segment", "unit_factor"]].sort_values("date")
    shelf = pd.merge_asof(shelf.sort_values("date"), seg, on="date", by="series_id", direction="backward")
    shelf = shelf.sort_values(["series_id", "date"])
    shelf["pack_segment"] = shelf.groupby("series_id")["pack_segment"].bfill().fillna(1).astype(int)
    shelf["segment_id"] = shelf["series_id"].astype(str) + "#" + shelf["pack_segment"].astype(str)

    target = regular[["series_id", "date", "price", "sale_unresolved"]].rename(columns={"price": "regular_price"})
    shelf = shelf.merge(target, on=["series_id", "date"], how="left")

    # coicop / unit basis are product metadata (store category, pack type), treated as static per segment
    static = (
        regular.groupby(["series_id", "pack_segment"])
        .agg(coicop=("coicop", "first"), unit_basis=("unit_basis", "first"))
        .reset_index()
    )
    return shelf.merge(static, on=["series_id", "pack_segment"], how="left")


# ── per-segment calendar grid ────────────────────────────────────────────────

def _causal_regular(shelf: np.ndarray):
    """Sequential causal regular price. Returns (R, on_sale, sale_depth, days_in_sale) per calendar day."""
    n = len(shelf)
    reg_out = np.full(n, np.nan)
    on_sale = np.zeros(n)
    depth = np.zeros(n)
    in_sale = np.zeros(n)
    reg, sale_start, last_obs = np.nan, -1, -10**9

    for t in range(n):
        p = shelf[t]
        if np.isnan(p):
            if t - last_obs <= FFILL_LIMIT_DAYS:
                reg_out[t] = reg
                on_sale[t] = sale_start >= 0
                in_sale[t] = t - sale_start + 1 if sale_start >= 0 else 0
            continue
        if np.isnan(reg) or t - last_obs > FFILL_LIMIT_DAYS:
            reg, sale_start = p, -1                       # fresh start after a long gap
        elif p < reg * (1 - TOL):
            if sale_start < 0:
                sale_start = t
            if t - sale_start >= SALE_CONFIRM_DAYS:
                reg, sale_start = p, -1                   # unreturned drop: regular price cut
        else:
            reg, sale_start = p, -1                       # increase, or return from a sale
        reg_out[t] = reg
        on_sale[t] = sale_start >= 0
        depth[t] = p / reg - 1 if sale_start >= 0 else 0.0
        in_sale[t] = t - sale_start + 1 if sale_start >= 0 else 0
        last_obs = t
    return reg_out, on_sale, depth, in_sale


def build_grid(obs: pd.DataFrame) -> pd.DataFrame:
    """Expand each segment to a daily calendar and add per-segment features (all shifted by one day)."""
    frames = []
    data_end = obs["date"].max()
    for seg_id, g in obs.groupby("segment_id", sort=False):
        # carry the grid FFILL_LIMIT_DAYS past the last observation, as a real-time system would,
        # so whether a segment "continues" never depends on later data
        end = min(g["date"].max() + pd.Timedelta(days=FFILL_LIMIT_DAYS + 1), data_end)
        days = pd.date_range(g["date"].min(), end, freq="D")
        f = g.set_index("date").reindex(days).rename_axis("date").reset_index()
        f["segment_id"] = seg_id
        for col in ["series_id", "coicop", "unit_basis"]:
            f[col] = g[col].iloc[0]
        f["unit_factor"] = f["unit_factor"].ffill()  # pack known from the latest name seen so far (as of t)
        f["observed"] = f["shelf_price"].notna()
        # sale day: observed shelf price but no regular price (dropped by the ex-post filter). The regular price
        # still exists on that day — the pre-sale level (Kehoe & Midrigan) — so the target is carried through the
        # sale instead of the row being dropped (dropping it would select only permanent cuts → selection bias).
        f["is_sale_day"] = f["observed"] & f["regular_price"].isna()
        f.loc[f["is_sale_day"], "regular_price"] = f["regular_price"].ffill()[f["is_sale_day"]]

        R, on_sale, depth, in_sale = _causal_regular(f["shelf_price"].to_numpy(dtype=float))
        f["R"], f["on_sale"], f["sale_depth"], f["days_in_sale"] = R, on_sale, depth, in_sale
        frames.append(f)

    grid = pd.concat(frames, ignore_index=True)
    grid["sale_unresolved"] = grid["sale_unresolved"].fillna(False).astype(bool)
    log.info("grid: %s rows, %s segments", f"{len(grid):,}", grid["segment_id"].nunique())
    return _segment_features(grid)


def _segment_features(grid: pd.DataFrame) -> pd.DataFrame:
    g = grid.groupby("segment_id", sort=False)
    R = grid["R"]
    R1 = g["R"].shift(1)

    grid["base_price"] = R1
    grid["price_lag_1"] = R1
    for k in (7, 15, 30):
        grid[f"price_lag_{k}"] = g["R"].shift(k)

    shifted = R1.groupby(grid["segment_id"])
    grid["price_7d_mean"] = shifted.transform(lambda s: s.rolling(7, min_periods=4).mean())
    grid["price_7d_std"] = shifted.transform(lambda s: s.rolling(7, min_periods=4).std())
    grid["price_30d_mean"] = shifted.transform(lambda s: s.rolling(30, min_periods=15).mean())
    grid["price_momentum_7d"] = R1 / g["R"].shift(8) - 1
    grid["ratio_lag1_mean30"] = R1 / grid["price_30d_mean"] - 1

    change = ((R / g["R"].shift(1) - 1).abs() > TOL).astype(float).where(R.notna() & g["R"].shift(1).notna())
    grid["reg_change"] = change
    change_size = (R / g["R"].shift(1) - 1).where(change == 1)
    ch_g = change.fillna(0).groupby(grid["segment_id"])
    grid["n_changes_30d"] = ch_g.transform(lambda s: s.shift(1).rolling(30, min_periods=1).sum())
    grid["n_changes_60d"] = ch_g.transform(lambda s: s.shift(1).rolling(60, min_periods=1).sum())
    grid["last_change_size"] = change_size.groupby(grid["segment_id"]).transform(lambda s: s.ffill().shift(1))

    counter = change.fillna(0).groupby(grid["segment_id"]).transform(
        lambda s: s.groupby(s.cumsum()).cumcount())
    grid["days_since_change"] = counter.groupby(grid["segment_id"]).shift(1)

    shelf_ff = g["shelf_price"].transform(lambda s: s.ffill(limit=FFILL_LIMIT_DAYS))
    grid["shelf_price_lag1"] = shelf_ff.groupby(grid["segment_id"]).shift(1)
    grid["shelf_to_base_lag1"] = grid["shelf_price_lag1"] / R1 - 1
    grid["on_sale_lag1"] = g["on_sale"].shift(1)
    grid["sale_depth_lag1"] = g["sale_depth"].shift(1)
    grid["days_in_sale_lag1"] = g["days_in_sale"].shift(1)
    grid["n_sale_days_60d"] = grid.groupby("segment_id", sort=False)["on_sale"].transform(
        lambda s: s.shift(1).rolling(60, min_periods=1).sum())

    grid["log_unit_price_lag1"] = np.log(R1 * g["unit_factor"].shift(1))
    return grid


# ── cross-sectional and external features ────────────────────────────────────

def add_cross_section(grid: pd.DataFrame) -> pd.DataFrame:
    """Repricing shares, relative unit price and a paper-style web inflation index, all as of t-1."""
    daily = grid[grid["observed"]]

    store = daily.groupby("date")["reg_change"].mean()
    cat = daily.groupby(["coicop", "date"])["reg_change"].mean()

    store_df = store.to_frame("s1").asfreq("D")
    store_df["s7"] = store_df["s1"].rolling(7, min_periods=1).mean()
    store_df = store_df.shift(1).rename(columns={"s1": "store_reprice_share_1d", "s7": "store_reprice_share_7d"})
    grid = grid.merge(store_df, left_on="date", right_index=True, how="left")

    cat_wide = cat.unstack("coicop").asfreq("D")
    cat_df = pd.concat({
        "cat_reprice_share_1d": cat_wide.shift(1).stack(),
        "cat_reprice_share_7d": cat_wide.rolling(7, min_periods=1).mean().shift(1).stack(),
    }, axis=1).reset_index()
    grid = grid.merge(cat_df, on=["date", "coicop"], how="left")

    # relative unit price: segment vs cross-sectional median of its (coicop, unit basis) on the same day (both t-1)
    med = grid.groupby(["coicop", "unit_basis", "date"])["log_unit_price_lag1"].transform("median")
    grid["rel_unit_price_lag1"] = grid["log_unit_price_lag1"] - med

    # web index (paper Eq. 1-2, daily chained): equal-weight mean regular log change per COICOP, 30-day sum, as of t-1
    log_chg = np.log(grid["R"] / grid.groupby("segment_id")["R"].shift(1))
    cat_daily = log_chg.where(grid["observed"]).groupby([grid["coicop"], grid["date"]]).mean()
    wide = cat_daily.unstack("coicop").asfreq("D").fillna(0).rolling(30, min_periods=1).sum().shift(1)
    web = wide.stack().rename("web_cat_infl_30d").reset_index()
    weights = pd.Series(COICOP_WEIGHTS).reindex(wide.columns).fillna(0)
    present = wide.notna().mul(weights, axis=1)
    store_infl = (wide.fillna(0).mul(weights, axis=1).sum(axis=1) / present.sum(axis=1)).rename("web_store_infl_30d")
    grid = grid.merge(web, on=["coicop", "date"], how="left")
    return grid.merge(store_infl, left_on="date", right_index=True, how="left")


def _asof_daily(series: pd.DataFrame, value: str, dates: pd.DatetimeIndex) -> pd.Series:
    """Value known at the end of day t-1 for each day t (last observation dated ≤ t-1)."""
    s = series.dropna(subset=[value]).set_index("date")[value].sort_index()
    known = s.reindex(pd.date_range(s.index.min(), dates.max(), freq="D")).ffill()
    return known.shift(1).reindex(dates)


def add_external(grid: pd.DataFrame, usd: pd.DataFrame, brent: pd.DataFrame, tuik: pd.DataFrame) -> pd.DataFrame:
    dates = pd.DatetimeIndex(sorted(grid["date"].unique()))
    ext = pd.DataFrame(index=dates)

    usd_known = _asof_daily(usd, "usd_try", pd.date_range(dates.min() - pd.Timedelta(days=40), dates.max()))
    ext["usd_try_rate"] = usd_known.reindex(dates)
    last_two = usd.dropna().set_index("date")["usd_try"].pct_change()
    ext["usd_try_rate_change"] = _asof_daily(last_two.rename("v").reset_index(), "v", dates)
    ext["usd_try_change_7d"] = ext["usd_try_rate"] / usd_known.shift(7).reindex(dates) - 1
    ext["usd_try_change_30d"] = ext["usd_try_rate"] / usd_known.shift(30).reindex(dates) - 1

    b = brent.merge(usd, on="date", how="inner")
    b["brent_try"] = b["brent_usd"] * b["usd_try"]
    brent_known = _asof_daily(b, "brent_try", pd.date_range(dates.min() - pd.Timedelta(days=40), dates.max()))
    ext["brent_try"] = brent_known.reindex(dates)
    ext["brent_try_change_7d"] = ext["brent_try"] / brent_known.shift(7).reindex(dates) - 1
    ext["brent_try_change_30d"] = ext["brent_try"] / brent_known.shift(30).reindex(dates) - 1

    # TUIK: a release is usable from the day after its release date (data known at end of t-1)
    t = tuik.sort_values("release_date").copy()
    t["food_3m"] = ((1 + t["food_mom_pct"] / 100).rolling(3, min_periods=1).apply(np.prod, raw=True) - 1) * 100
    rel = pd.merge_asof(pd.DataFrame({"date": dates - pd.Timedelta(days=1)}), t,
                        left_on="date", right_on="release_date", direction="backward")
    ext["tuik_food_mom_last"] = rel["food_mom_pct"].to_numpy()
    ext["tuik_headline_mom_last"] = rel["headline_mom_pct"].to_numpy()
    ext["tuik_food_3m_cum"] = rel["food_3m"].to_numpy()
    ext["days_since_tuik_release"] = (dates - pd.DatetimeIndex(rel["release_date"])).days.to_numpy()

    return grid.merge(ext.rename_axis("date").reset_index(), on="date", how="left")


def add_calendar(grid: pd.DataFrame) -> pd.DataFrame:
    d = grid["date"].dt
    grid["dow_sin"] = np.sin(2 * np.pi * d.dayofweek / 7)
    grid["dow_cos"] = np.cos(2 * np.pi * d.dayofweek / 7)
    grid["month_sin"] = np.sin(2 * np.pi * d.month / 12)
    grid["month_cos"] = np.cos(2 * np.pi * d.month / 12)
    grid["dom_sin"] = np.sin(2 * np.pi * d.day / 31)
    grid["dom_cos"] = np.cos(2 * np.pi * d.day / 31)
    grid["is_1st"] = (d.day == 1).astype(int)
    grid["is_15th"] = (d.day == 15).astype(int)
    grid["is_16th"] = (d.day == 16).astype(int)
    grid["is_month_end"] = d.is_month_end.astype(int)
    grid["days_to_month_end"] = d.days_in_month - d.day
    grid["is_holiday"] = grid["date"].isin(HOLIDAYS_2026).astype(int)
    grid["is_target_spec"] = ((d.day == 1) | (d.day == 15) | d.is_month_end | grid["is_holiday"].astype(bool))
    grid["is_target_data"] = (d.day.isin([1, 14, 15, 16]) | grid["is_holiday"].astype(bool))
    return grid


# ── orchestration ────────────────────────────────────────────────────────────

def build_features(inputs: dict, outage: tuple[str, str]) -> pd.DataFrame:
    obs = build_segments(inputs["regular"], inputs["mapped"])
    grid = build_grid(obs)
    grid = add_cross_section(grid)
    grid = add_external(grid, inputs["usd"], inputs["brent"], inputs["tuik"])
    grid = add_calendar(grid)

    grid["in_outage"] = grid["date"].between(*pd.to_datetime(list(outage)))
    grid["target_price"] = grid["regular_price"]
    grid["target_pct_change"] = grid["target_price"] / grid["base_price"] - 1
    grid["usable_target"] = (
        grid["observed"] & grid["target_price"].notna() & grid["base_price"].notna()
        & ~grid["sale_unresolved"] & ~grid["in_outage"]
    )
    for col in CATEGORICAL:
        grid[col] = grid[col].astype("category")
    log.info("usable target rows: %s", f"{int(grid['usable_target'].sum()):,}")
    return grid


def feature_columns(groups: list[str] | None = None) -> list[str]:
    groups = groups or list(FEATURE_GROUPS)
    return [c for grp in groups for c in FEATURE_GROUPS[grp]]
