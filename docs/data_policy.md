# Data policy

AeroTwin trains and evaluates its primary PM2.5 model on observed measurements. This file is the rule set for that pipeline.

Source dataset: [Pune Hourly Air Quality Reports](https://data.opencity.in/dataset/pune-hourly-air-quality-reports) (OpenCity, republishing CPCB files from airquality.cpcb.gov.in).

## Rules

1. Real observations are preferred.
2. Missing values are not replaced with invented observations.
3. Synthetic data must never be used to train the primary model.
4. Proxy variables must have documented formulas and assumptions.
5. Modeled scenarios must be clearly labelled as modeled scenarios.
6. Interpolated spatial values must be clearly labelled as interpolated.
7. SHAP results must not be described as causal emission attribution. The required wording is: "This represents the contribution of model features to the prediction and is not direct causal source apportionment."
8. External APIs used for a live forecast must be kept separate from the historical training table.

## What the first model is allowed to use

- Labelled CPCB PM2.5 from the OpenCity 15-minute station CSVs.
- Other labelled columns in those same files (PM10, gases, AT, RH, WS, WD, RF, SR, BP) only where the cells are actually populated.
- Calendar features derived from the published timestamp.
- Lag features of observed PM2.5, aligned on a regular hourly clock so a missing hour stays missing.

## What it is not allowed to use

- Random or hand-written PM2.5, weather, traffic, industrial activity, or dust.
- The OpenCity 2017-2023 wide matrices. Those files have hour columns and day rows, and they do not name PM2.5. Their cells are not relabelled as concentrations.
- Forward-filled or long-gap-interpolated PM2.5.
- Future observations when predicting PM2.5 at T+24h. Features must be known at or before the issue time T. The calendar of the target hour is allowed because it is known in advance. Weather and PM2.5 at T+24h are not.

## Resolution

The first model uses hourly values. Where the source file is 15-minute, hourly values are aggregates of the observed 15-minute samples (mean, sum, or circular mean, as documented in `docs/cleaning_decisions.md`). Hours with no samples stay missing. Fifteen-minute rows are not stacked next to the unlabelled hourly matrices.

## Proxies not yet defined

`traffic_activity_proxy`, `industrial_activity_proxy`, and `dust_activity_proxy` are not in model V1. They will be added only after a deterministic method is written down, and only as additional model versions (V2, V3) so the effect on error can be compared with V0 and V1.

## Labels

| Kind | How it must be named |
| --- | --- |
| Station PM2.5, gases, and meteorology copied from CPCB files | Observed |
| Hourly mean/sum of those observations | Observed, aggregated |
| XGBoost 24-hour forecast | Model prediction |
| Naive persistence forecast | Baseline prediction |
| SHAP values | Model-derived contribution |
| Any later intervention run | Modeled scenario |
