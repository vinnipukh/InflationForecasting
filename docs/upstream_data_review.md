# Upstream data review — urazkagangunes/InflationResearchStudy

Review done on 2026-10-05 from the repository file tree (~11.5k files) and the first lines of each store's files.
Input for stage 2 (all food, all markets).

## Layout

- `InflationItems/Codes/<Sector>/<Store>/` — scrapers (Selenium / requests), one per store, different authors.
- `InflationItems/Datas/<Sector>/<Store>/` — raw daily CSVs, one file per store per day.
- `Inflations/Codes|Datas/` — per-store inflation calculators and outputs, cross-store comparison, hunger thresholds,
  Turkey-wide report (`Final_Reports`).
- Sectors: Markets, ClothingStores, ConstructionSuppliesMarkets, Cosmetics, HomeGoods, HousesRent,
  TechnologicalProducts, Health, PublicTransportation (+ small others).

## Market coverage (as of 2026-10-05)

| Store | Days | Range | Coverage | Usable for stage 2 |
|---|---|---|---|---|
| Gurmar | 223 | 02-21 → 10-04 | 99 % (outage 05-06 → 08-17: 275 products only) | pilot |
| Marketzade | 107 | 02-24 → 06-10 | 100 % | yes |
| Hapeloglu | 98 | 02-24 → 06-02 | 99 % | yes (rich schema from ~June) |
| Baskent | 96 | 02-24 → 06-01 | 98 % | yes |
| Basdas | 93 | 02-21 → 05-31 | 93 % | yes |
| Migros | 92 | 02-24 → 05-26 | 100 % | yes |
| Kim | 86 | 02-23 → 05-26 | 92 % (one 7-day gap) | yes |
| Kale | 81 | 03-01 → 05-26 | 93 % | yes |
| CarrefourSA | 80 | 02-23 → 05-18 | 94 % | yes |
| Arden | 75 | 03-02 → 05-28 | 85 % | yes |
| Macrocenter | 70 | 02-20 → 05-19 | 79 % | yes |
| A101 | 68 | 03-13 → 05-29 | 87 % | yes |
| SozSanal, BizimMarket, Ideal, sok_market, HappyCenter, sehzade, Sariyer, Cagri, Mopas | 4–31 | stopped in March | — | no |
| Onur, Tarım Kredi Kooperatif | 14 / 8 | spread over months | 6 % / 4 % | no |

Only Gurmar is still scraped after early June.

## Schema problems to standardize

- Most files: `product_name, price` only — no ID, category or URL. Exceptions: Hapeloglu (from ~June:
  `product_id, regular_price, is_discounted, discount_pct, category, in_stock, ...`), Gurmar (`product-id` from 05-07).
- Price formats: `"₺295,00"` (A101, Arden), `"2.499,00 TL"` (Baskent), `"34,99 ₺"` (Kim), `"189,90"`, `74.95`,
  and Gurmar per-kg strings `"(124,90 / Kg)"`.
- Header drift: `price` → `Price` (Baskent), `Ürün Adı, Fiyat` (Tarım Kredi).
- Filename dates: `X_YYYY-MM-DD`, `YYYY-MM-DD.csv`, `X_YYYYMMDD_HHMM`, `onur_DD.MM.YYYY`, Kim `products3-14.csv`
  (no year); Hapeloglu `.tsv` duplicates for 02-24 → 03-09.
- Scrape-quality issues: HappyCenter name/price shifts (`240 Gr,199.7` → `38.85`); ALL-CAPS names (Kim, Baskent).
- Discounts not separated except Hapeloglu's new schema → the pilot's sale filter is needed for every store.

## Useful assets

- `Inflations/Codes/product-to-ctagory/tuik_cpi_categories_comma.csv` — TÜİK COICOP tree with weights.
- `product-category-map.csv` (4.6 MB) — product name → COICOP code; string-matched and noisy
  ("%100 PAMUK ... BİSİKLET YAKA" → Bicycle). Check food matches before use.
- `Inflations/Codes/turkey_inflation_methodology.md`, `Markets/Gurmar/gurmar_tuik_config.py` — methodology, weights.
- Hunger-threshold detail files — a 16-item food basket with matched products per store (cross-store anchors).

## Issues found in the upstream code

- `gurmar_tuik_config.py` labels COICOP 12 as personal care and 13 as insurance (pre-2018 numbering); the repo's own
  `tuik_cpi_categories_comma.csv` and the paper (Table IV) use COICOP 2018 (13 = personal care). Weights are right,
  codes mislabelled.
- The same config maps unknown categories silently to food (`01`).
- `gurmar_inflation.py` matches products across dates by raw name and keeps the first duplicate; the paper says
  duplicates are averaged.
- Derived files: `_CrossStore` / `Final_Reports` contain implausible averages (TOTAL_AvgPrice ≈ 7.3 M, Migros ≈ 27.8 M)
  — outliers not removed.
- URL numbers in Gurmar's 02-24 file are a different numbering from `product-id` (1 of 3,218 agree).

## Note for the paper

The paper (Sec. V, Table V) attributes the June contraction of the dataset to "the early stage of June data collection".
For Gurmar the cause is a scraper pagination failure from **2026-05-06**: ~5,100 rows/day but only 275 distinct
products repeated ~19×, until 2026-08-17. Worth checking for the other stores and noting in a revision.
