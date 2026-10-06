# Inflation Forecasting — TÜİK CPI from web-scraped prices

Long-term goal: forecast Turkish CPI (TÜİK) bottom-up from daily web-scraped prices — product by product, category by
category, then monthly and yearly aggregate inflation. Data come from
[urazkagangunes/InflationResearchStudy](https://github.com/urazkagangunes/InflationResearchStudy)
("A CPI-Weighted Web-Based Price Index for Monitoring Inflation and Cost of Living in Türkiye").

**Current status: pilot completed** — daily regular shelf-price forecasting for one supermarket (Gurmar).
Pilot specification: [handoff.md](handoff.md).

**Site:** https://vinnipukh.github.io/InflationForecasting/ — results and a per-product forecast explorer (TR/EN).
Static files in `site/`; refresh its data with `python -m src.site_export` (needs `data/processed` from notebooks
01–02, retrains the hurdle model with the saved parameters in ~3 min), commit, push — `.github/workflows/pages.yml`
deploys.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| **Pilot** | Gurmar: daily regular shelf price per product (food + other supermarket goods) | **Done** — this README |
| Stage 2 | All food (TÜİK 01): daily product-level forecasting for every market in the upstream repo (Migros, CarrefourSA, A101, Hapeloglu, Marketzade, Macrocenter, Kale, Baskent, Basdas, Arden, Kim, …) | Planned |
| Stage 3 | Other TÜİK categories from the upstream sectors: clothing (03), rent (04), home goods & construction (05), health (06), technology (08), cosmetics / personal care (13) | Planned |
| Stage 4 | Daily → monthly, category by category: aggregate product forecasts into monthly category indices and forecast / nowcast each TÜİK category | Planned |
| Stage 5 | Monthly aggregate CPI: combine category forecasts with TÜİK weights (paper Eq. 2) | Planned |
| Stage 6 | Yearly inflation and longer horizons | Planned |

Pilot rule carried forward: the pilot method is frozen and then applied unchanged to other stores and categories,
so that "it transfers" is a real test (see plans below).

More documentation:
- [docs/decisions_and_lessons.md](docs/decisions_and_lessons.md) — why the first attempt failed, every key decision
  and its reason, pitfalls caught (selection bias, four leakage bugs), references.
- [docs/upstream_data_review.md](docs/upstream_data_review.md) — store coverage, schema problems, upstream code issues
  (input for stage 2).

## Pilot result (Gurmar)

The best model, a **LightGBM hurdle model**, beats the dummy model (tomorrow's price = today's price) in all three
evaluation blocks on the target days it predicts, while the dummy is used on all other days.

Results on **data days** (definition below). Best model per block vs. dummy:

| Block | Test period | Model | Rows | MAE (TRY) | MAPE % | RMSE | R² (return) | R² (price) | Direction acc. % | MAE vs dummy |
|---|---|---|---|---|---|---|---|---|---|---|
| B1 | 2026-04-05 → 05-04 | Dummy (yesterday's price) | 24,010 | 2.675 | 1.603 | 20.665 | −0.003 | 0.9885 | 94.36 | — |
| B1 | | **LightGBM hurdle** | 24,010 | **2.500** | **1.469** | **20.094** | **0.164** | 0.9891 | **94.98** | **−6.5 %** |
| B2 | 2026-09-01 → 09-17 | Dummy (yesterday's price) | 14,672 | 4.970 | 1.943 | 42.229 | −0.041 | 0.9648 | 91.75 | — |
| B2 | | **LightGBM hurdle** | 14,672 | **3.791** | **1.448** | **37.295** | **0.331** | 0.9725 | **94.32** | **−23.7 %** |
| B3 (holdout) | 2026-09-18 → 10-04 | Dummy (yesterday's price) | 3,247 | 0.927 | **0.486** | **9.227** | −0.016 | 0.9977 | 97.91 | — |
| B3 (holdout) | | **LightGBM hurdle** | 3,247 | **0.859** | 0.490 | 10.662 | **0.205** | 0.9969 | **98.25** | **−7.3 %** |

System view (spec Sec. 2.3), **all test days** — model on data days, yesterday's price on every other day:

| Block | Dummy MAE | LightGBM hurdle system MAE | Improvement |
|---|---|---|---|
| B1 | 1.835 | 1.805 | +1.6 % |
| B2 | 3.976 | 3.699 | +7.0 % |
| B3 (holdout) | 1.146 | 1.143 | +0.3 % |

Notes:
- **R² on price** is close to 1 for every method, because knowing yesterday's price already explains almost all of
  the variation in price level (0.5 – 2,890 TRY). **R² on return** (predicted vs. actual % change) is the informative
  one: the dummy scores ≈ 0, the model explains 16–33 % of the variance of price changes.
- Model selection used B1 and B2 only. B3 is the holdout. Its numbers have been looked at, but no modelling decision
  was based on them so far. In B3, labels near the end of the data are the least reliable (see "Known issues").
- On data days, the hurdle model was the best of the four Phase-1 models in every block.

## Target days

The model predicts only on target days. On every other day the forecast is yesterday's price (spec Sec. 2).

| Set | Days | Status |
|---|---|---|
| **Data days** | 1st, 14th, 15th, 16th of the month + national/religious holidays | **Primary from 2026-10-06 on** |
| Spec days | 1st, 15th, last day of the month + holidays (handoff.md Sec. 2.1) | Reported for comparison |

2026 holidays: Jan 1, Ramazan Bayramı (Mar 19–22), Apr 23, May 1, May 19, Kurban Bayramı (May 26–30), Jul 15,
Aug 30, Oct 28–29.

Why data days: the regular-price change rate by day of month is **9.2 % on the 1st**, ~1.4 % on the 14th–16th,
but only **0.04 % on the 30th and 0.23 % on the 31st**. Month-end changes appear on the 1st. With data days the
hurdle model gains more than with spec days in every block (B1 +6.5 % vs +6.4 %, B2 +23.7 % vs +18.9 %,
B3 +7.3 % vs −50.8 %).

## Data findings

| Finding | Detail | Handling |
|---|---|---|
| Product IDs only from 2026-05-07 | Earlier files have names only | Name → ID map (exact, rule-based, one-to-one handover assignment); 82 % of pre-ID rows on a real ID |
| **Scraper outage 2026-05-06 → 08-17** | Files have ~5,100 rows/day but only **275 distinct products** repeated ~19× (pagination bug upstream); 95 % of products have a hole 05-04 → 08-18 | Outage excluded from training/test targets; gaps measured excluding it |
| Exact duplicate rows | 532,614 of 1.09 M rows | Dropped |
| Per-kg price rows | 351 rows (`_1kg`, `(124,90 / Kg)`) on 02-21/22 only | Dropped |
| Catalogue renames | 940 renames under the same ID, in waves (347 on 08-28) | Map uses every name an ID ever had |
| Pack-size changes under one ID | 169 series (real shrinkflation, e.g. 800 g → 750 g, and name flip-flops) | Series split into pack segments |
| Temporary sales | 12 % of observations, mostly two-week campaigns starting on the 1st or 23rd–24th | V-shaped sale filter (Nakamura & Steinsson); target = regular price, carried through sales |

Upstream repo issues noticed: `gurmar_tuik_config.py` labels COICOP 12/13 with pre-2018 numbering (personal care
should be 13) and defaults unknown categories to food (`01`); `gurmar_inflation.py` matches products by raw name and
keeps the first duplicate, while the paper averages duplicates.

## Method

**Target.** `target_pct_change = regular_price_t / R_{t-1} − 1`, where `R` is a *causal* regular price: a price drop
counts as a sale for up to 21 days, then becomes the new regular price. Prediction = `R_{t-1} · (1 + ŷ)`.

**Features** (50, all known by the end of day t−1): regular-price lags (1/7/15/30 calendar days), rolling
mean/std/momentum, days since last change, change counts, shelf-price and sale state, log unit price and unit price
relative to its category median, store/category repricing shares, cyclic calendar + day flags, USD/TRY, Brent in TRY,
TÜİK food CPI (usable from the day after release), and a paper-style daily web inflation index (COICOP, CPI-weighted).

**Leakage test.** Inputs are cut after day T and all prices on day T are scrambled; no feature for days ≤ T may
change. Passes with 0 changed cells (T = 2026-04-15 and 2026-09-15).

What each "external" or derived feature knows when forecasting day t:
- **TÜİK CPI** — the last release published on or before day t−1 (e.g. March food CPI, published 04-03, is used from
  04-04). Never the CPI of the month being forecast.
- **Unit price** — yesterday's regular price divided by the pack size of the latest name seen; never the price of day t.
- **USD/TRY, Brent** — last close dated t−1 or earlier.

Not yet covered: the scramble test cuts only price data, so the external series are safe by construction but not
tested; COICOP category and pack type are treated as fixed product metadata taken from the whole history. The target
deliberately uses hindsight (a sale is known to be a sale once the price returns) — only in the label, never in
features.

**Blocks.** Expanding windows; outage days excluded from training targets.

| Block | Train | Test |
|---|---|---|
| B1 | 02-21 → 04-04 | 04-05 → 05-04 |
| B2 | 02-21 → 08-31 (08-18 → 08-31 rebuilds lags after the outage) | 09-01 → 09-17 |
| B3 | 02-21 → 09-17 | 09-18 → 10-04 (final holdout) |

**Models (Phase 1).** LightGBM, XGBoost and CatBoost regressors and a LightGBM **hurdle** model: a classifier for
"price changes tomorrow" plus an L1 regressor for the size, predicting no change unless P(change) exceeds a tuned
threshold. Loss = absolute error weighted by price (= MAE in TRY). Under MAE the best forecast is the conditional
median, so persistence is hard to beat unless a model finds changes that are more likely than not; the hurdle model
is built for that. Hyperparameters were tuned with Optuna + `TimeSeriesSplit` on B1's training window only and reused
for all blocks.

## Pilot modelling phase 1 (tree-based models) — all models, data days

MAE improvement vs. the better persistence baseline (positive = better):

| Model | B1 | B2 | B3 (holdout) |
|---|---|---|---|
| **LightGBM hurdle** | **+6.5 %** | **+23.7 %** | **+7.3 %** |
| LightGBM | +3.9 % | +8.3 % | −58.2 % |
| XGBoost | +2.6 % | +0.7 % | −91.9 % |
| CatBoost | +0.1 % | −8.5 % | −3.2 % |

Untuned models (library defaults) gave LightGBM +2.6 % / +7.9 % on B1 / B2 data days.

### Ablation (spec Sec. 5.3), LightGBM hurdle, data days

| Run | Features | B1 MAE | B2 MAE | B3 MAE (holdout) | vs dummy B1 / B2 / B3 |
|---|---|---|---|---|---|
| Dummy | yesterday's price | 2.675 | 4.970 | 0.927 | — |
| 1 | `price_lag_1` only | 2.675 | 4.970 | 0.927 | 0 / 0 / 0 % (never predicts a change) |
| 2 | lags + cyclic calendar | 2.675 | 4.810 | 0.952 | 0 / +3.2 / −2.7 % |
| 3 | + USD/TRY | 2.675 | 4.882 | 0.942 | 0 / +1.8 / −1.5 % |
| 4 | + TÜİK + rolling / change history (spec full set) | 2.560 | 3.870 | **0.726** | +4.3 / +22.1 / **+21.7 %** |
| 5 | + oil, sale state, unit price, cross-section, web index (all) | **2.500** | **3.791** | 0.859 | **+6.5 / +23.7** / +7.3 % |

- The big step is run 4: the rolling / change-history features (days since last change, change counts, last change
  size) are what make price changes predictable. Price lags and calendar alone are not enough.
- USD/TRY adds nothing on top of lags + calendar (run 3 ≤ run 2).
- Run 5 is best on the development blocks and stays the selected configuration. Run 4 is better on the B3 holdout;
  this is noted, not acted on.

### Feature-set comparison, data days

Same tuned hyperparameters, three input sets: **(1) price history only** — regular-price lags, rolling statistics,
change history, shelf/sale history; no calendar, category or external data · **(2) + USD/TRY** · **(3) all features**.
MAE improvement vs. the better persistence baseline:

| Feature set | Model | B1 | B2 | B3 (holdout) |
|---|---|---|---|---|
| 1 price history | **LightGBM hurdle** | +5.2 % | **+23.8 %** | **+14.1 %** |
| 1 price history | LightGBM | +4.2 % | +11.1 % | −35.9 % |
| 1 price history | XGBoost | +3.1 % | +1.3 % | −45.2 % |
| 1 price history | CatBoost | −0.5 % | −0.5 % | −24.3 % |
| 2 + USD/TRY | **LightGBM hurdle** | +5.2 % | +23.7 % | +13.4 % |
| 2 + USD/TRY | LightGBM | +4.3 % | +9.3 % | −36.1 % |
| 2 + USD/TRY | XGBoost | +2.9 % | +1.8 % | −51.2 % |
| 2 + USD/TRY | CatBoost | −0.4 % | −2.3 % | −14.3 % |
| 3 all features | **LightGBM hurdle** | **+6.5 %** | +23.7 % | +7.3 % |
| 3 all features | LightGBM | +3.9 % | +8.3 % | −58.2 % |
| 3 all features | XGBoost | +2.6 % | +0.7 % | −91.9 % |
| 3 all features | CatBoost | +0.1 % | −8.5 % | −3.2 % |

System view (hurdle on data days, yesterday's price elsewhere, all test days): price history +1.3 / +7.0 / +0.6 %,
+ USD/TRY +1.3 / +6.9 / +0.6 %, all features +1.6 / +7.0 / +0.3 % (B1 / B2 / B3).

- **The product's own price history carries almost all of the signal.** The hurdle model with price history only is
  within 1.3 points of the full model on B1, equal on B2 and better on the B3 holdout.
- **USD/TRY adds nothing** in any block (also seen in the ablation).
- The extra features (calendar, TÜİK, oil, unit price, cross-section, web index) help a little on B1 and hurt on the
  B3 holdout for every model. For the next phase, the smaller price-history set is the safer default; the choice
  should be confirmed on the development blocks with more data.

## Comparison with academic work

No study found forecasts **daily prices of individual store products** against **yesterday's price**; most work
forecasts **monthly food price indices**. Focused search (not a systematic review):

| Study | Target | Baseline | Result | Comparability |
|---|---|---|---|---|
| Muhammad et al. 2026, Bangladesh ([arXiv 2604.06227](https://arxiv.org/abs/2604.06227)) | Daily retail prices of 5 commodities (market averages) | Naive (yesterday's price) | Naive has the lowest MAE for 4 of 5 commodities; BiLSTM / Transformer worse (garlic 5.34 vs naive 4.66, chickpea 1.91 vs 0.71); only SARIMA on cucumber beats naive (−8 %) | Closest set-up (daily, price level, naive), but commodity averages |
| Beer, Ferstl & Graf 2025, Austria ([OeNB WP 262](https://www.oenb.at/en/Publications/Economics/Working-Papers.html)) | Monthly elementary food indices, web-scraped | Naive = last month's inflation rate; ARIMA, ETS, Prophet | Web-scraped nowcast best in 58 categories; RMSE 2.65 vs naive 4.21 | Aggregate, monthly, weak naive |
| Beck et al. 2024, Germany ([ECB WP 2930](https://www.ecb.europa.eu/pub/pdf/scpwps/ecb.wp2930~05cff276eb.en.pdf)) | Monthly food item inflation, weekly scanner data | Autoregressive model | RMSE −25 % (food groups), −40 to −60 % (fruit/vegetables, dairy) | Aggregate, monthly, model benchmark |
| Macias, Stelmasiak & Szafranek 2023, Poland (*IJF* 39(2)) | Monthly food inflation nowcast, online prices | Benchmarks, judgemental, combinations | Outperforms all | Aggregate, monthly |
| Soybilgen, Yazgan & Kaya 2023, Türkiye (*J. Business Cycle Research* 19(2)) | Monthly TÜİK food inflation, daily online prices | — | Online index nowcasts TÜİK earlier than release | Closest Turkish predecessor; aggregate |

- Index-level gains (25–60 % RMSE) are not comparable to ours: monthly aggregates average out product noise, and
  several studies use a naive that repeats last month's *inflation rate*, which is weaker than repeating yesterday's
  *price*.
- In the closest set-up (daily price level vs. naive) naive usually wins, so our −6.5 % / −23.7 % / −7.3 % MAE on
  target days and positive R² on returns are the substantive result.
- MAPE depends on product volatility (Bangladeshi vegetables up to 16.7 % for naive; our supermarket goods ~1.5 %) and
  cannot be compared across studies.
- Missing for a fair comparison: a significance test and an index-level evaluation against TÜİK — both planned below.

## Planned work

### Pilot follow-ups (Gurmar)

**Diebold–Mariano test — is the gain over the dummy significant?** The number of target days is small (data days: B1 5 — 04-14/15/16, 04-23, 05-01; B2 4 — 09-01, 09-14/15/16;
B3 **1** — 10-01), so a plain time-series DM test on daily losses has almost no observations. Plan:

1. **Loss differentials.** For every product-day: `d_it = L(e_dummy) − L(e_model)` with `L` = absolute error (MAE)
   and, as a robustness check, squared error. `d > 0` means the model is better.
2. **Daily DM test (all test days, system output).** Average `d_it` across products per day → `d_t`; DM statistic
   with Newey–West variance and the Harvey–Leybourne–Newbold small-sample correction; one-sided test
   (H1: model better). Per block (29 / 17 / 17 days) and pooled over blocks.
3. **Panel test for target days.** Regress `d_it` on a constant with standard errors clustered by product and by date
   (two-way); Driscoll–Kraay errors as an alternative for cross-sectional dependence on the same day.
4. **Bootstrap.** Block bootstrap resampling products (and, where possible, days) for a confidence interval on the MAE
   improvement.
5. **More test days.** Rolling-origin evaluation (weekly forecast origins instead of three blocks) and the newer
   upstream data (scraper still running) to grow the number of target days.
6. Implementation: `src/evaluation/significance.py`, called from `notebooks/03_training_phase1.ipynb`; results added
   to the tables above as p-values.

**Other pilot items**

- **B3 labels near the end of the data.** Some products are exactly 50 % off from early September until the data ends.
  The sale filter has to call these permanent cuts, so they are probably mislabelled. Pulling newer upstream data
  will settle it; a round-discount rule is a candidate fix.
- **B2 plain regressors early-stopped at 10–16 trees** because their early-stopping window was the post-outage warm-up
  period. Use a pre-outage window or tuned tree counts.
- B3 hurdle model hit the 2,000-tree cap.
- Extend the leakage test to external series; make COICOP / pack type as-of.
- Product ID as a categorical feature (currently one global model, no product identity) — candidate experiment.
- Model selection used spec target days inside `03_training_phase1.ipynb`; with data days as primary, the selection
  result is the same (LightGBM hurdle).
- Target-day evaluation sets are small: data days B1 5, B2 4, **B3 only 1 (10-01)**. The B3 data-day result rests
  on a single day and should be read as anecdotal until more data arrive.
- Modelling phases 2 and 3 of the pilot specification (deep learning: TFT, N-HiTS; foundation models: TimesFM,
  Chronos, Moirai) not started.

### Stage 2 — all food (TÜİK 01), all markets

1. **Freeze the pilot method** (features, hurdle model, sale filter, target-day rule) before touching other stores.
2. **Shared loader** that standardizes every upstream market: price formats (`₺295,00`, `2.499,00 TL`, `34,99 ₺`),
   header drift (`price` / `Price` / `Fiyat`), five filename date formats, duplicate files (`.tsv` + `.csv`),
   scrape-quality checks (e.g. HappyCenter name/price shifts).
3. **Product identity per store**: most stores have names only (no IDs) — reuse the pilot's name normalization,
   pack-size parsing and precision-first matching across dates.
4. **Food scope**: keep products mapped to COICOP 01 (upstream `product-category-map.csv`, checked first — it has
   string-match errors such as "BİSİKLET YAKA" → bicycle).
5. **Coverage**: most markets stop between mid-May and mid-June 2026; only Gurmar continues. Evaluate on a common
   window (Feb–May) and report store × metric tables; re-run Gurmar on the same window for a fair comparison.
6. **Pooled model** across stores as a second experiment (often helps short series), with store as a feature.

### Stage 3 — other TÜİK categories

Upstream sectors: clothing (03), rental housing (04), home goods and construction supplies (05), health (06),
technology (08), cosmetics / personal care (13). Pricing behaviour differs (seasonal clearance in clothing, listing
prices in rent), so the target-day rule and the sale filter must be re-derived from each category's data, as done for
supermarkets.

### Stage 4 — daily → monthly, category by category

Target: monthly % change of each TÜİK category index, published on the 3rd of the following month.

1. **Monthly category index** from regular prices: elementary indices per COICOP subgroup as the geometric mean of
   product price relatives (Jevons, CPI Manual), aggregated with TÜİK subgroup weights; compare with the paper's
   equal-weight method (Eq. 1–2).
2. **Nowcast**: during month m, the index from the days observed so far → TÜİK m before its release.
3. **Forecast**: fill the remaining days of month m (and m+1) with the daily product forecasts → TÜİK m and m+1.
4. **Baselines**: random walk on monthly inflation (last TÜİK print), AR(1), the paper's web index; RMSE / MAE in
   percentage points, direction of change, DM test.
5. **Data limits (critical)**: for Gurmar today, March, April and September 2026 are full months; May and August are
   partial; June–July have only 275 products (outage). Far too few months for statistical evaluation — needs more
   collection time and more stores (stage 2).
6. **Known biases**: online vs. offline prices, regional chains, categories TÜİK covers that online catalogues
   under-represent (fresh produce, services); TÜİK weight coverage reported per category.

### Stage 5 — monthly aggregate CPI

Combine category forecasts with TÜİK weights (paper Eq. 2, weights re-normalized over covered categories); report
the covered share of the CPI basket (paper: 62 %) and compare with TÜİK, ENAG and İTO as in the paper.

### Stage 6 — yearly inflation and longer horizons

Chain monthly forecasts to annual inflation; multi-month horizons with uncertainty bands.

## Repository layout

```text
├── README.md                     findings and results (this file)
├── handoff.md                    project specification
├── main.py                       runs the notebooks in order: python main.py [preprocess features train feature_sets]
├── pyproject.toml / uv.lock      dependencies (uv); requirements.txt exported from them
├── docs/
│   ├── decisions_and_lessons.md  decisions, pitfalls, references
│   └── upstream_data_review.md   upstream stores, schemas, code issues
├── configs/
│   └── phase1_best_params.json   tuned hyperparameters (Optuna, B1 training window)
├── notebooks/
│   ├── 01_preprocessing.ipynb          loading, name → ID map, outage detection, sale filter, unit price, blocks
│   ├── 02_feature_engineering.ipynb    feature table, leakage test, persistence baselines
│   ├── 03_training_phase1.ipynb        tuning, per-block training, evaluation, ablation
│   ├── 04_feature_set_comparison.ipynb price history / + USD/TRY / all features
│   └── archive/00_forecastingtest_original.ipynb   first attempt (did not beat persistence)
├── src/
│   ├── preprocessing/features.py       feature logic (as-of t−1)
│   ├── models/classical_ml/phase1.py   Phase-1 models, Optuna tuning, per-block training
│   ├── models/classical_ml/defaults_run.py   untuned baseline run (python -m src.models.classical_ml.defaults_run)
│   └── evaluation/metrics.py           MAE, RMSE, MAPE, R² (price and return), direction accuracy, system output
├── data/
│   ├── raw/_upstream/            sparse clone of the upstream Gurmar folder (not in git)
│   ├── external/                 USD/TRY, Brent (Yahoo), TÜİK monthly CPI with sources (in git)
│   └── processed/                panels, features, predictions, result tables (not in git)
└── logs/                         training logs (not in git)
```

## Reproducing

1. `uv sync` (or `pip install -r requirements.txt`).
2. Raw data: sparse clone of the upstream repo into `data/raw/_upstream`
   (`git clone --depth 1 --filter=blob:none --sparse https://github.com/urazkagangunes/InflationResearchStudy.git data/raw/_upstream`
   then `git -C data/raw/_upstream sparse-checkout set InflationItems/Datas/Markets/Gurmar`).
3. External data: `data/external/` (USD/TRY and Brent from Yahoo via `yfinance`, TÜİK values typed in with sources).
4. `python main.py` — preprocessing (~5 min), features (~2 min), Phase 1 training (~80 min), feature-set comparison (~40 min).

`notebooks/01_preprocessing.ipynb` writes `data/processed/gurmar_match_validation.csv` (117 sampled matches); filling
its `is_correct` column and re-running gives matching precision per method.
