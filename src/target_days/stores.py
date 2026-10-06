"""Load every upstream market folder into one (store, name, date, price) frame.

Upstream files differ per store in file-name date format, header, price format and
column names (docs/upstream_data_review.md). Product identity is the folded name:
most stores have no ID, and name-only is the same rule for every store.
"""
from __future__ import annotations

import csv
import re
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

MARKETS = Path("data/raw/_upstream/InflationItems/Datas/Markets")

# (regex on file name, group order) — first match wins
DATE_PATTERNS = [
    (r"(\d{4})-(\d{2})-(\d{2})", "ymd"),
    (r"(\d{4})(\d{2})(\d{2})_\d{4,6}", "ymd"),
    (r"(\d{2})\.(\d{2})\.(\d{4})", "dmy"),
    (r"products-?(\d{1,2})-(\d{1,2})$", "md"),  # Kim: no year
]
NAME_COLS = ["product_name", "name", "isim", "ad", "Name", "Ürün Adı"]
PRICE_COLS = ["price", "Price", "fiyat", "Fiyat", "product_price", "price (TL)", "price_tl"]
# upstream misfiling: Kale's 2026-08-25 scrape sits in Marketzade/ (93 % name overlap with Kale, 1 % with Marketzade)
MISFILED = {"Marketzade/kalemarketleri_prices_2026-08-25.csv": "Kale"}
TR_MAP = str.maketrans("çğıöşüâîû", "cgiosuaiu")


def file_date(path: Path) -> pd.Timestamp | None:
    for pattern, order in DATE_PATTERNS:
        m = re.search(pattern, path.stem)
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        y, mo, d = {"ymd": g, "dmy": g[::-1], "md": [2026, *g]}[order]
        try:
            return pd.Timestamp(y, mo, d)
        except ValueError:
            return None
    return None


def parse_price(text) -> float:
    """'₺295,00', '2.499,00 TL', '34,99 ₺', '74.95' -> float."""
    if pd.isna(text):
        return np.nan
    s = re.sub(r"[^\d,\.]", "", str(text).split("/")[0])
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return np.nan


def fold(text) -> str:
    text = unicodedata.normalize("NFKC", str(text)).replace("İ", "i").replace("I", "ı")
    return re.sub(r"\s+", " ", text.lower().translate(TR_MAP)).strip()


def _read(path: Path) -> pd.DataFrame | None:
    try:
        df = pd.read_csv(path, encoding="utf-8-sig", sep=None, engine="python", dtype=str, on_bad_lines="skip")
    except (pd.errors.ParserError, pd.errors.EmptyDataError, csv.Error):
        return None
    name = next((c for c in NAME_COLS if c in df.columns), None)
    price = next((c for c in PRICE_COLS if c in df.columns), None)
    if name is None or price is None:
        if df.shape[1] == 2:  # headerless two-column file (Kim): header row is data
            df = pd.read_csv(path, encoding="utf-8-sig", header=None, names=["n", "p"], dtype=str)
            name, price = "n", "p"
        else:
            return None
    return pd.DataFrame({"name_raw": df[name], "price": df[price].map(parse_price)})


def load_store(store: str, root: Path = MARKETS) -> pd.DataFrame:
    """One row per (name, date): the highest same-day price (lower duplicate = sale tag, pilot rule 1)."""
    frames = []
    paths = [p for p in (root / store).glob("*.csv") if f"{store}/{p.name}" not in MISFILED]
    paths += [root / f for f, owner in MISFILED.items() if owner == store]
    for path in sorted(paths):
        date = file_date(path)
        if date is None:
            continue
        df = _read(path)
        if df is None:
            continue
        frames.append(df.assign(date=date, file=path.name))
    if not frames:
        return pd.DataFrame(columns=["store", "name", "date", "price"])
    raw = pd.concat(frames, ignore_index=True).dropna(subset=["name_raw", "price"])
    raw = raw[raw["price"] > 0]
    raw["name"] = raw["name_raw"].map(fold)
    out = raw.groupby(["name", "date"], as_index=False)["price"].max()
    return out.assign(store=store)[["store", "name", "date", "price"]]


def scrape_health(panel: pd.DataFrame) -> pd.DataFrame:
    """Per scrape day: rows and distinct names; low distinct/median flags a pagination failure."""
    d = panel.groupby("date")["name"].nunique().rename("products").to_frame()
    d["ratio_to_median"] = d["products"] / d["products"].median()
    return d


GURMAR_OUTAGE = ("2026-05-06", "2026-08-17")  # pilot: pagination failure, see gurmar_blocks.json

if __name__ == "__main__":  # python -m src.target_days.stores  → data/processed/all_stores_*.parquet
    from src.target_days.calendar import count_changes, regular_prices

    out = Path("data/processed")
    shelf = pd.concat([load_store(p.name) for p in sorted(MARKETS.iterdir()) if p.is_dir()], ignore_index=True)
    shelf.to_parquet(out / "all_stores_shelf.parquet", index=False)
    reg = regular_prices(shelf)
    reg[["store", "name", "date", "price", "regular", "is_sale", "unresolved"]].to_parquet(
        out / "all_stores_regular.parquet", index=False)
    ch = count_changes(reg)
    ch = ch[~((ch["store"] == "Gurmar") & ch["date"].between(*GURMAR_OUTAGE))]
    ch.to_parquet(out / "all_stores_changes.parquet", index=False)
    print(f"{len(shelf):,} shelf rows, {len(ch):,} comparable product-days")
