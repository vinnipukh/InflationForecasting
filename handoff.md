```markdown
# Project Specification: Daily Supermarket Food Price Forecasting

## 1. Project Overview & Context
**Domain:** Retail / Supermarket (specifically focusing on the TUIK - Turkish Statistical Institute - food basket items).
**Objective:** Forecast daily product prices for specific food categories.
**Context:** This is an **academic research project**. Therefore, we are allowed to use models with restrictive licenses (e.g., TimesFM 3.0 non-commercial license) if they yield the best academic results. 
**Data Constraint:** We are strictly using **normal (regular) prices**. Membership-based discounts (e.g., "Migros Kart" special discounts) are EXCLUDED from the dataset.

## 2. Core Prediction Strategy & Constraints (CRITICAL)
This is the most important business logic constraint. We are NOT predicting every single day independently. 

### 2.1 The "Target Day" Rule
The model will **ONLY** generate active predictions on specific, high-volatility days:
1. The 1st day of the month.
2. The 15th day of the month.
3. The last day of the month.
4. National and religious holidays.

### 2.2 The "Persistent Baseline" Rule
For **ALL OTHER DAYS** (days not listed in 2.1), the model will NOT predict. Instead, it will apply a **Persistent Baseline**: 
`Price(t) = Price(t-1)`

### 2.3 Implementation Logic for the Agent
When reconstructing the final forecasted time series for evaluation:
```python
# Pseudo-code for final series reconstruction
final_forecast = []
for day in test_dates:
    if day in [1st, 15th, last_day, holidays]:
        final_forecast.append(model.predict(day_features))
    else:
        final_forecast.append(actual_price[day - 1]) # Persistent baseline
```
*Note for Agent: Ensure the evaluation metrics (MAE, RMSE, etc.) are calculated ONLY on the "Target Days" to measure the model's actual predictive power, but also calculate a "Global MAE" including the persistent baseline days to show the overall system performance.*

---

## 3. Feature Engineering (Strict No-Leakage Policy)
Data leakage is the biggest risk in this project. **All features representing the past must be strictly shifted by at least 1 day (`shift(1)`) relative to the prediction day `t`.** If the model sees data from day `t` to predict day `t`, the experiment is invalid.

### 3.1 Lag Features (Past Prices)
```python
df['price_lag_1'] = df['price'].shift(1)
df['price_lag_7'] = df['price'].shift(7)
df['price_lag_15'] = df['price'].shift(15)
df['price_lag_30'] = df['price'].shift(30)
```

### 3.2 Rolling Statistics (Past Volatility & Trends)
*CRITICAL: Apply `.shift(1)` AFTER the rolling window calculation to prevent the window from including day `t`.*
```python
df['price_7d_mean'] = df['price'].rolling(window=7).mean().shift(1)
df['price_7d_std'] = df['price'].rolling(window=7).std().shift(1)
df['price_30d_mean'] = df['price'].rolling(window=30).mean().shift(1)

# 7-day momentum
df['price_momentum_7d'] = ((df['price'] / df['price'].shift(7)) - 1).shift(1)
```

### 3.3 Macroeconomic Variables (USD/TRY)
```python
df['usd_try_rate'] = df['usd_try'].shift(1)
df['usd_try_rate_change'] = df['usd_try'].pct_change().shift(1)
```

### 3.4 TUIK Food Index (Inflation)
TUIK releases the previous month's data in the current month. We must simulate this real-world delay.
```python
# Assuming 'tufe_gida_index' is merged as monthly data and forward-filled to daily
# We shift by 1 MONTH (approx 30 days, or use a proper period shift) to ensure 
# day 't' only sees the index from month 't-1'.
df['tufe_gida_prev_month'] = df.groupby('product_id')['tufe_gida_index'].shift(1) # Shift by period
df['tufe_gida_change'] = df['tufe_gida_prev_month'].pct_change()
```

### 3.5 Cyclic Encoding (Temporal Features)
Do not use raw integers for time. Use sine and cosine transformations to capture the periodic nature of time.
```python
import numpy as np

# Day of Week (0-6)
df['dow_sin'] = np.sin(2 * np.pi * df['date'].dt.dayofweek / 7)
df['dow_cos'] = np.cos(2 * np.pi * df['date'].dt.dayofweek / 7)

# Month (1-12)
df['month_sin'] = np.sin(2 * np.pi * df['date'].dt.month / 12)
df['month_cos'] = np.cos(2 * np.pi * df['date'].dt.month / 12)

# Day of Month (1-31) - Crucial for identifying the 1st, 15th, and last day patterns
df['dom_sin'] = np.sin(2 * np.pi * df['date'].dt.day / 31)
df['dom_cos'] = np.cos(2 * np.pi * df['date'].dt.day / 31)
```

### 3.6 Target Variable Transformation
**Do not predict the raw price.** Raw prices are non-stationary. Predict the **percentage change** (returns).
```python
df['target_pct_change'] = (df['price'] / df['price_lag_1']) - 1
```
*Agent Instruction: Train all models to predict `target_pct_change`. During inference, inverse transform it: `predicted_price = actual_price_lag_1 * (1 + predicted_pct_change)`.*

---

## 4. Modeling Pipeline
The agent must implement a sequential 3-phase modeling pipeline. Do not skip phases.

### Phase 1: Classical Machine Learning (Tree-Based)
These models will serve as the primary tabular baselines. They excel at handling the engineered features (lags, rolling, external vars).
*   **Models to implement:**
    1.  **XGBoost** (`xgboost.XGBRegressor`)
    2.  **LightGBM** (`lightgbm.LGBMRegressor`)
    3.  **CatBoost** (`catboost.CatBoostRegressor`) - *Use this for categorical variables like `product_id` if not one-hot encoded.*
*   **Hyperparameter Tuning:** Use Optuna with Time-Series Cross-Validation (`TimeSeriesSplit`). Do not use random K-Fold.

### Phase 2: Deep Learning Methods
Implement standard deep learning architectures adapted for tabular/time-series data.
*   **Models to implement:**
    1.  **Temporal Fusion Transformer (TFT):** Use `pytorch_forecasting` or `darts`. It natively handles static covariates, past covariates, and future covariates.
    2.  **N-HiTS / N-BEATS:** Use `darts` or `neuralforecast`. Good for capturing complex non-linear trends and seasonality.
*   **Input formatting:** Ensure past covariates (USD, TUIK, Lags) are strictly separated from future known covariates (Cyclic time encodings, holiday flags).

### Phase 3: Time Series Foundation Models (SOTA)
Implement the latest zero-shot / fine-tuned foundation models. Since this is academic research, use the absolute latest versions regardless of commercial licensing.
*   **Models to implement:**
    1.  **Google TimesFM 3.0 (or 2.5):** 
        *   *Repo:* `google-research/timesfm`
        *   *Note:* TimesFM 3.0 supports multivariate and covariates. Pass USD and TUIK as `past_covariates`.
    2.  **Amazon Chronos-2 (and Chronos-Bolt):**
        *   *Repo:* `amazon-science/chronos-forecasting`
        *   *Note:* Chronos-2 is an encoder-only model (120M params). Very fast.
    3.  **Salesforce Moirai 2.0 (or Moirai-MoE):**
        *   *Repo:* `SalesforceAIResearch/uni2ts`
        *   *Note:* Moirai 2.0 uses a new 36M time-series corpus. Excellent zero-shot performance.
*   **Agent Instruction for Foundation Models:** 
    *   First, evaluate them in **Zero-Shot** mode (no training on our data).
    *   Second, perform **Fine-Tuning** (In-context fine-tuning or full fine-tuning if supported) on our specific supermarket dataset to see if it beats zero-shot.

---

## 5. Evaluation Strategy & Metrics
The agent must implement a robust evaluation script.

### 5.1 Metrics
Calculate the following metrics **specifically for the "Target Days"** (1st, 15th, last day, holidays):
1.  **MAE** (Mean Absolute Error)
2.  **RMSE** (Root Mean Squared Error)
3.  **MAPE** (Mean Absolute Percentage Error)
4.  **Directional Accuracy (DA):** Percentage of times the model correctly predicted the *direction* of the price change (Up/Down/Flat). *Crucial for retail pricing.*

### 5.2 Baseline Comparison
Every model's performance must be compared against the **Persistent Baseline** (Naive Forecast).
*   Calculate **Baseline Improvement (%)**: `((Baseline_MAE - Model_MAE) / Baseline_MAE) * 100`
*   If a model's MAE is higher than the Persistent Baseline, flag it in the results table.

### 5.3 Ablation Study
The agent must run an ablation study using the best performing model from Phase 1 (likely LightGBM/XGBoost) to prove the value of the feature engineering:
*   Run 1: Only `price_lag_1`
*   Run 2: Lags + Cyclic Encoding
*   Run 3: Lags + Cyclic + USD/TRY
*   Run 4: Full Feature Set (including TUIK and Rolling)

---

## 6. Implementation Guidelines for the Coding Agent

### 6.1 Tech Stack
*   **Language:** Python 3.10+
*   **Data Manipulation:** `pandas`, `numpy`, `polars` (optional for speed)
*   **ML/DL:** `scikit-learn`, `xgboost`, `lightgbm`, `catboost`, `optuna`
*   **Deep Learning:** `pytorch`, `pytorch_forecasting` (or `darts` / `neuralforecast`)
*   **Foundation Models:** `timesfm`, `chronos-forecasting`, `uni2ts` (install via pip/git as per their official repos)

### 6.2 Project Structure
```text
├── data/
│   ├── raw/                # Original CSVs
│   ├── processed/          # Feature-engineered parquet files
│   └── external/           # USD/TRY, TUIK data
├── src/
│   ├── preprocessing/      # Data loading, shifting, cyclic encoding
│   ├── models/
│   │   ├── classical_ml/   # XGB, LGBM, CatBoost scripts
│   │   ├── deep_learning/  # TFT, N-HiTS scripts
│   │   └── foundation/     # TimesFM, Chronos, Moirai scripts
│   ├── evaluation/         # Metrics, baseline comparison, ablation
│   └── utils/              # Helper functions, logging
├── notebooks/              # EDA and result visualization
├── configs/                # YAML files for hyperparameters
├── requirements.txt
└── main.py                 # Pipeline orchestrator
```

### 6.3 Strict Rules for the Agent
1.  **NO FUTURE LEAKAGE:** Double-check all `shift()` operations. If `t` is the prediction day, no feature can contain information from `t` or `t+1`.
2.  **Target Transformation:** Ensure the inverse transformation is applied before calculating final MAE/RMSE, otherwise the metrics will be incomparable.
3.  **Target Day Logic:** The evaluation script must strictly filter the test set to only evaluate on `is_target_day == True` for the primary metrics, while keeping the persistent baseline for the rest of the days in the final time-series output.
4.  **Reproducibility:** Set random seeds for all models (XGBoost, PyTorch, etc.) to ensure experiments are reproducible.
5.  **Logging:** Use a proper logger (e.g., `loguru` or standard `logging`) to track training times, hyperparameter trials, and metric results.

---
**Agent Execution Command:** 
Acknowledge these specifications. Begin by setting up the project structure and implementing the `src/preprocessing/` module, ensuring the strict no-leakage shifting and cyclic encoding logic is perfectly implemented. Generate the code for the data pipeline first.
```