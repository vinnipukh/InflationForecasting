# Decisions and lessons (pilot, Gurmar)

Record of the decisions taken during the pilot, why they were taken, and the mistakes caught along the way.
Results are in the [README](../README.md).

## Why the first attempt failed

`notebooks/archive/00_forecastingtest_original.ipynb` (Feb–Aug data, 442 products) never beat "price = yesterday's
price":

| Set-up | Model MAE | Persistence MAE |
|---|---|---|
| Single split (test from 2026-07-01), HistGradientBoosting | 7.17 | 2.67 |
| Walk-forward, best model (LightGBM), mean of 3 folds | 4.08 | 2.20 (0 of 3 folds won) |

Causes found:

1. **Raw price as target.** Prices span 0.5–2,890 TRY; trees cannot extrapolate levels, errors scale with price.
   → Predict the % change.
2. **Squared-error loss.** ~93–97 % of days have no price change; a squared-loss model outputs small non-zero changes
   every day (e.g. 38.06 / 38.10 / 37.99 for a product flat at 37.95), and each one costs MAE.
   → Absolute-error loss and a hurdle model that predicts "no change" unless confident.
3. **Lags counted in rows, not days.** Missing scrape days made `shift(7)` ≠ 7 days. → Daily calendar grid.
4. **Product identity.** `product_id` was null for 87 % of rows; one product could become two series.
   → Name → ID mapping (preprocessing notebook).
5. **Test period inside the scraper outage.** The July test set had ~275 products/day — the outage, not the market.

## Key decisions

| Decision | Reason |
|---|---|
| Pilot on Gurmar only, then freeze the method and transfer | Longest series (223 days) and the only store still scraped; transfer to other stores is a real test only if the method is frozen first |
| Precision-first product matching | A wrong link creates fake price jumps on exactly the rare change days the model must predict; a missed link only shortens a series |
| One-to-one handover assignment instead of clustering | Statistical-office clustering (ONS CLIP) groups *similar* products for indices; forecasting needs *identical* products. Renames are one old name → one new ID |
| Drop `_1kg` rows | Per-kg labels scraped on 02-21/22 instead of shelf prices — same product, different price basis (≈2× fake jumps) |
| Pack-size guard in matching (`420 g` ≠ `210 g`, `5000 ml` = `5 l`) | Fuzzy name similarity alone matched different pack sizes |
| Pack segments within a series | Pack size changes under one ID (shrinkflation and name flip-flops) |
| Regular prices only, V-shaped sale filter (35-day window, 21 days to confirm) | Project spec; sale episodes median 14 days, start on the 1st or 23rd–24th |
| Target on sale days = pre-sale regular price (not dropped) | See "selection bias" below |
| Causal regular price for features (drop = sale for ≤ 21 days) | The ex-post sale filter looks into the future |
| Unit price only as a feature | For a fixed pack, unit-price returns equal price returns exactly (verified: max difference 1.8e-15) — no gain as target |
| **Data days** (1st, 14th–16th, holidays) instead of spec days | Regular-price change rate: 9.2 % on the 1st, ~1.4 % on 14th–16th, 0.04 % on the 30th; month-end changes appear on the 1st |
| Three expanding blocks, B3 as holdout | Outage splits the data in two full-coverage segments; model selection on B1/B2 only |
| Tune once on B1's training window, reuse for all blocks | No tuning ever sees a test period; affordable runtime |
| L1 loss weighted by price | Equals MAE in TRY, the evaluation metric |
| Hurdle model | Under MAE the optimal forecast is the conditional *median*; with change probability < 50 % the median is "no change", so a model gains only where it finds confident changes. Classifier AUC 0.80 on B1 test; at P > 0.5 it flags 1.3 % of rows with 78 % precision |
| One global model across products | ~118 full-coverage days and 2–4 regular changes per product are too few for per-product models |

## Pitfalls caught

### Selection bias from dropping sale days

The first feature table dropped sale days as target rows. Among the remaining rows where the causal filter said
"on sale", 79 % were price changes — they were exactly the drops that turned out to be permanent cuts. A model would
learn "on sale → regular price dropped" (wrong for most real sales) and the test set had the same bias, so scores would
look good and mean nothing (classifier AUC 0.89 → 0.80 after the fix). Fix: keep sale days with the pre-sale regular
price as target (Kehoe & Midrigan's regular-price definition).

### Four leakage bugs found by the truncate-and-scramble test

Test: cut inputs after day T, scramble all prices on day T; no feature for days ≤ T may change.

1. Pack segments: a bug made every row a new segment for series without a parseable pack (52k segments instead of 7.3k).
2. Pack-size factor taken from a segment's first known pack — which could come from a later product name.
3. The daily grid ended at a segment's last observation, so whether its last price was carried forward depended on
   whether the product appeared again later (affected a cross-sectional median).
4. Off-by-one: the grid must run one more day so the row whose lag points at the last carried-forward day exists.

### Baseline choice

Two persistence variants exist once sales are involved: the causal regular price of t−1 and the shelf price of t−1.
With sale days kept as targets, the causal regular price is the stronger baseline on every block; all results compare
against the better of the two.

### Early stopping on an unrepresentative window

B2's early-stopping window (last 14 training days) is the post-outage warm-up; LightGBM/XGBoost/CatBoost stopped at
10–16 trees there. Open item.

### B3 end-of-data labels

Products 50 % off from early September until the data ends: the sale filter must call them permanent cuts after
21 days. Likely mislabelled; the B3 "model everywhere" gain of +36–42 % is partly this artifact.

## Leakage status of external features

- TÜİK CPI: last release published on or before t−1 (March, published 04-03, used from 04-04).
- USD/TRY, Brent: last close dated ≤ t−1.
- Unit price: yesterday's regular price ÷ pack size of the latest name seen.
- Not covered by the scramble test: external series (safe by construction). COICOP category and pack type are fixed
  product metadata from the whole history.

## References

- Nakamura, E. & Steinsson, J. (2008). Five facts about prices. *QJE* — sale filter / V-shaped sales.
- Kehoe, P. & Midrigan, V. (2015). Prices are sticky after all. *JME* — regular vs. temporary prices.
- Eichenbaum, M., Jaimovich, N. & Rebelo, S. (2011). Reference prices, costs, and nominal rigidities. *AER*.
- Cavallo, A. & Rigobon, R. (2016). The Billion Prices Project. *JEP*.
- ONS (2016). Clustering large datasets into price indices (CLIP).
- Chessa, A. G. (CBS). Defining products and linking GTINs with MARS (relaunches).
- Peeters, R., Bizer, C. et al. WDC Products benchmark; Li, Y. et al. (2020) Ditto — product matching.
- Muhammad, T. et al. (2026). Agricultural commodity price forecasting benchmark, Bangladesh. arXiv:2604.06227.
- Beer, C., Ferstl, R. & Graf, B. (2025). Improving disaggregated short-term food inflation forecasts with webscraped
  data. OeNB WP 262.
- Beck, G. W. et al. (2024). Nowcasting consumer price inflation using high-frequency scanner data. ECB WP 2930.
- Macias, P., Stelmasiak, D. & Szafranek, K. (2023). Nowcasting food inflation with a massive amount of online prices.
  *IJF* 39(2).
- Soybilgen, B., Yazgan, M. E. & Kaya, H. (2023). Nowcasting Turkish food inflation using daily online prices.
  *J. Business Cycle Research* 19(2).
- Diebold, F. X. & Mariano, R. S. (1995); Harvey, Leybourne & Newbold (1997) — forecast-accuracy tests (planned).
