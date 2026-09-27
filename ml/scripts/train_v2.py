"""V2 forecast experiments on the 10 stations with PM2.5 in the test window.

Alandi and Karve Road are documented and excluded. Weather is not borrowed
across stations and is not imputed in V2-A/B/C. Timestamps stay on the
published +0000 clock.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from xgboost import XGBRegressor

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aq_common import (
    DOCS_DIR,
    LAG_COLUMNS,
    MODEL_DIR,
    MODEL_FIG_DIR,
    PROCESSED_DIR,
    SHAP_DISCLAIMER,
    SOURCE_DATASET_URL,
    TARGET_CALENDAR,
    TIME_FEATURES,
    ensure_dirs,
    fmt_metric,
    regression_scores,
    write_json,
)
from clean_air_quality import add_model_columns, build_hourly, load_labelled_files

EXCLUDED = {
    "site_5405": "Alandi, Pune - IITM",
    "site_292": "Karve Road, Pune - MPCB",
}
MET = ["temperature", "humidity", "wind_speed", "wind_direction", "rainfall", "solar_radiation"]
LAGS = ["pm25_t", *LAG_COLUMNS]
CALENDAR = list(TIME_FEATURES) + list(TARGET_CALENDAR)
VAL_START = pd.Timestamp("2025-01-01", tz="UTC")
TEST_START = pd.Timestamp("2025-07-01", tz="UTC")
PARAMS = dict(
    n_estimators=400,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=5,
    reg_lambda=1.0,
    objective="reg:squarederror",
    random_state=42,
    n_jobs=-1,
    tree_method="hist",
)
# A station is a deterioration if its test MAE is more than this many ug/m3
# above persistence. December uses the same margin. Set before fitting.
STATION_MARGIN = 5.0
DECEMBER_MARGIN = 3.0


def excluded_notes(raw: pd.DataFrame) -> list[dict]:
    frame = raw.copy()
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, errors="coerce")
    frame["pm25"] = pd.to_numeric(frame["pm25"], errors="coerce")
    notes = []
    for station_id, label in EXCLUDED.items():
        group = frame.loc[frame["station_id"].astype(str) == station_id]
        observed = group.loc[group["pm25"].notna(), "timestamp"]
        notes.append(
            {
                "station_id": station_id,
                "station_name": label if group.empty else str(group["station_name"].dropna().iloc[0]),
                "rows": int(len(group)),
                "pm25_n": int(group["pm25"].notna().sum()) if len(group) else 0,
                "pm25_first": None if observed.empty else str(observed.min()),
                "pm25_last": None if observed.empty else str(observed.max()),
                "reason": "No PM2.5 observations on or after 2025-07-01, so the station cannot be scored on the test window.",
            }
        )
    return notes


def prepare() -> tuple[pd.DataFrame, list[dict], dict]:
    raw, used, skipped_files = load_labelled_files()
    excluded = excluded_notes(raw)
    keep = ~raw["station_id"].astype(str).isin(EXCLUDED)
    hourly, notes = build_hourly(raw.loc[keep].copy())
    model = add_model_columns(hourly)
    model["pm25_t"] = model["pm25"]
    model = model.dropna(subset=["pm25_t", "target_pm25_24h"]).copy()
    target = model["target_timestamp"]
    split = np.full(len(model), "unused", dtype=object)
    split[(target < VAL_START).to_numpy()] = "train"
    split[((target >= VAL_START) & (target < TEST_START)).to_numpy()] = "val"
    split[(target >= TEST_START).to_numpy()] = "test"
    model["split"] = split
    notes["files_read"] = used
    notes["wide_files_skipped"] = skipped_files
    notes["excluded_stations"] = excluded
    hourly_path = PROCESSED_DIR / "v2_hourly.parquet"
    hourly.to_parquet(hourly_path, index=False)
    notes["hourly_path"] = str(hourly_path)
    return model, excluded, notes


def coverage_table(hourly_rows: pd.DataFrame) -> list[dict]:
    rows = []
    for (station_id, station_name), group in hourly_rows.groupby(["station_id", "station_name"]):
        item = {
            "station_id": str(station_id),
            "station_name": str(station_name),
            "hourly_rows": int(len(group)),
            "pm25_non_null_pct": float(group["pm25"].notna().mean() * 100),
            "pm25_first": None if group["pm25"].notna().sum() == 0 else str(group.loc[group["pm25"].notna(), "timestamp"].min()),
            "pm25_last": None if group["pm25"].notna().sum() == 0 else str(group.loc[group["pm25"].notna(), "timestamp"].max()),
        }
        for column in MET:
            item[f"{column}_pct"] = float(group[column].notna().mean() * 100) if column in group else 0.0
        rows.append(item)
    return rows


def assign_coverage_from_hourly(notes: dict) -> list[dict]:
    hourly = pd.read_parquet(notes["hourly_path"])
    hourly["timestamp"] = pd.to_datetime(hourly["timestamp"], utc=True)
    return coverage_table(hourly)


def fit_predict(train: pd.DataFrame, others: list[pd.DataFrame], columns: list[str], station_columns: list[str] | None):
    model = XGBRegressor(**PARAMS)
    model.fit(_matrix(train, columns, station_columns), train["target_pm25_24h"].to_numpy(), verbose=False)
    predictions = [model.predict(_matrix(frame, columns, station_columns)) for frame in others]
    return model, predictions


def _matrix(frame: pd.DataFrame, columns: list[str], station_columns: list[str] | None) -> pd.DataFrame:
    base = frame[columns].astype(float).reset_index(drop=True)
    if not station_columns:
        return base
    dummies = pd.get_dummies(frame["station_id"].astype(str), prefix="station")
    dummies = dummies.reindex(columns=station_columns, fill_value=0).astype(float).reset_index(drop=True)
    return pd.concat([base, dummies], axis=1)


def summarize(name: str, frame: pd.DataFrame, pred: np.ndarray) -> dict:
    scores = regression_scores(frame["target_pm25_24h"], pred)
    scored = frame.copy()
    scored["pred"] = pred
    by_station = []
    for (station_id, station_name), group in scored.groupby(["station_id", "station_name"]):
        by_station.append(
            {"station_id": str(station_id), "station_name": str(station_name), **regression_scores(group["target_pm25_24h"], group["pred"])}
        )
    scored["year_month"] = scored["target_timestamp"].dt.strftime("%Y-%m")
    by_month = []
    for month, group in scored.groupby("year_month"):
        by_month.append({"month": str(month), **regression_scores(group["target_pm25_24h"], group["pred"])})
    return {"model": name, **scores, "by_station": by_station, "by_month": by_month}


def _circular_mean(degrees: pd.Series) -> float:
    radians = np.deg2rad(degrees.to_numpy(dtype=float))
    return float((np.rad2deg(np.arctan2(np.sin(radians).mean(), np.cos(radians).mean())) + 360) % 360)


def short_gap_and_train_median(frame: pd.DataFrame, hourly: pd.DataFrame) -> pd.DataFrame:
    """Past-only weather fill on the regular hourly grid.

    A missing hour is filled from the previous hour, for at most two hours.
    Remaining gaps use that station's own training-period median (circular mean
    for wind direction) only when the station has at least 100 training
    observations of that field. Stations with no weather stay missing.
    """
    weather = hourly[["station_id", "timestamp", *MET]].copy()
    weather["timestamp"] = pd.to_datetime(weather["timestamp"], utc=True)
    parts = []
    for _, group in weather.groupby("station_id", sort=False):
        group = group.sort_values("timestamp").copy()
        for column in MET:
            group[column] = group[column].ffill(limit=2)
        parts.append(group)
    weather = pd.concat(parts, ignore_index=True)
    filled = frame.drop(columns=[column for column in MET if column in frame.columns]).merge(
        weather, on=["station_id", "timestamp"], how="left"
    )
    train = filled.loc[filled["split"] == "train"]
    for station_id, group in train.groupby("station_id"):
        mask = filled["station_id"] == station_id
        for column in MET:
            observed = group[column].dropna()
            if len(observed) < 100:
                continue
            value = _circular_mean(observed) if column == "wind_direction" else float(observed.median())
            missing = mask & filled[column].isna()
            filled.loc[missing, column] = value
    return filled


def shap_table(model, test: pd.DataFrame, columns: list[str]) -> list[dict] | None:
    try:
        import shap

        sample = test.sample(n=min(1500, len(test)), random_state=42)
        matrix = _matrix(sample, columns, None)
        values = shap.TreeExplainer(model).shap_values(matrix)
        if isinstance(values, list):
            values = values[0]
        mean_abs = np.mean(np.abs(np.asarray(values)), axis=0)
        table = pd.DataFrame({"feature": list(matrix.columns), "mean_abs_shap": mean_abs})
        table = table.sort_values("mean_abs_shap", ascending=False)
        return table.to_dict(orient="records")
    except Exception as exc:  # noqa: BLE001
        print(f"SHAP failed: {exc}")
        return None


def promotion(results: dict) -> dict:
    persist = results["V0"]["test"]
    decision = {"production_forecast": "V0_persistence", "promoted_v2": None, "checks": {}}
    for name in ("V2-A", "V2-B", "V2-C", "V2-D", "V2-E"):
        if name not in results:
            continue
        block = results[name]["test"]
        by_name = {row["station_name"]: row for row in block["by_station"]}
        base = {row["station_name"]: row for row in persist["by_station"]}
        worse = []
        for station, row in by_name.items():
            gap = row["mae"] - base[station]["mae"]
            if gap > STATION_MARGIN:
                worse.append({"station": station, "mae_gap": gap})
        months = {row["month"]: row for row in block["by_month"]}
        base_months = {row["month"]: row for row in persist["by_month"]}
        ond_n = sum(months[m]["n"] for m in ("2025-10", "2025-11", "2025-12") if m in months)
        ond_mae = None
        ond_base = None
        if ond_n:
            ond_mae = sum(months[m]["mae"] * months[m]["n"] for m in ("2025-10", "2025-11", "2025-12") if m in months) / ond_n
            ond_base = sum(base_months[m]["mae"] * base_months[m]["n"] for m in ("2025-10", "2025-11", "2025-12") if m in base_months) / ond_n
        dec_gap = None
        if "2025-12" in months and "2025-12" in base_months:
            dec_gap = months["2025-12"]["mae"] - base_months["2025-12"]["mae"]
        checks = {
            "overall_mae_lower": bool(block["mae"] < persist["mae"]),
            "mae_gap_v0_minus_model": float(persist["mae"] - block["mae"]),
            "stations_worse_by_more_than_margin": worse,
            "ond_mae": ond_mae,
            "ond_persistence_mae": ond_base,
            "ond_improved": None if ond_mae is None else bool(ond_mae < ond_base),
            "december_mae_gap_model_minus_v0": dec_gap,
            "december_not_worse_by_margin": None if dec_gap is None else bool(dec_gap <= DECEMBER_MARGIN),
        }
        checks["viable"] = bool(
            checks["overall_mae_lower"]
            and not worse
            and checks["ond_improved"]
            and checks["december_not_worse_by_margin"]
        )
        decision["checks"][name] = checks
    viable = [
        name
        for name, checks in decision["checks"].items()
        if checks["viable"]
    ]
    if viable:
        decision["promoted_v2"] = min(viable, key=lambda name: results[name]["test"]["mae"])
        decision["production_forecast"] = decision["promoted_v2"]
    return decision


def save_plots(scored: pd.DataFrame) -> list[str]:
    MODEL_FIG_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    order = ["pred_v0", "pred_v2a", "pred_v2b", "pred_v2c"]
    labels = ["V0", "V2-A", "V2-B", "V2-C"]
    maes = [float(np.mean(np.abs(scored[col] - scored["actual_pm25"]))) for col in order]
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(labels, maes)
    ax.set_ylabel("Test MAE (ug/m3)")
    ax.set_title("V2 test MAE")
    fig.tight_layout()
    path = MODEL_FIG_DIR / "v2_test_mae.png"
    fig.savefig(path, dpi=120)
    plt.close(fig)
    written.append(str(path))

    fig, ax = plt.subplots(figsize=(8, 4.5))
    for col, label in zip(order, labels):
        err = (scored[col] - scored["actual_pm25"]).abs()
        monthly = err.groupby(scored["year_month"]).mean()
        ax.plot(monthly.index.astype(str), monthly.values, marker="o", label=label)
    ax.set_ylabel("MAE (ug/m3)")
    ax.set_title("Test MAE by target month")
    ax.tick_params(axis="x", rotation=30)
    ax.legend()
    fig.tight_layout()
    path = MODEL_FIG_DIR / "v2_monthly_mae.png"
    fig.savefig(path, dpi=120)
    plt.close(fig)
    written.append(str(path))
    return written


def winter_facts(scored: pd.DataFrame, pred_col: str) -> dict:
    winter = scored.loc[scored["year_month"].isin(["2025-10", "2025-11", "2025-12"])].copy()
    winter["abs_v0"] = (winter["pred_v0"] - winter["actual_pm25"]).abs()
    winter["abs_model"] = (winter[pred_col] - winter["actual_pm25"]).abs()
    winter["persist_error"] = winter["actual_pm25"] - winter["pm25_at_t"]
    winter["timestamp"] = winter["target_timestamp"]
    month_rows = []
    for month, group in winter.groupby("year_month"):
        month_rows.append(
            {
                "month": month,
                "n": int(len(group)),
                "mean_actual": float(group["actual_pm25"].mean()),
                "mean_pm25_at_t": float(group["pm25_at_t"].mean()),
                "mean_persist_error": float(group["persist_error"].mean()),
                "v0_mae": float(group["abs_v0"].mean()),
                "model_mae": float(group["abs_model"].mean()),
                "share_actual_above_90": float((group["actual_pm25"] > 90).mean()),
            }
        )
    december = winter.loc[winter["year_month"] == "2025-12"]
    by_hour = []
    if not december.empty:
        for hour, group in december.groupby(december["timestamp"].dt.hour):
            by_hour.append(
                {
                    "hour": int(hour),
                    "n": int(len(group)),
                    "v0_mae": float((group["pred_v0"] - group["actual_pm25"]).abs().mean()),
                    "model_mae": float((group[pred_col] - group["actual_pm25"]).abs().mean()),
                    "mean_actual": float(group["actual_pm25"].mean()),
                }
            )
    bins = []
    if not december.empty:
        december = december.copy()
        december["level"] = pd.cut(
            december["pm25_at_t"],
            bins=[-np.inf, 30, 60, 90, np.inf],
            labels=["pm25_t <= 30", "30 < pm25_t <= 60", "60 < pm25_t <= 90", "pm25_t > 90"],
        )
        for level, group in december.groupby("level", observed=False):
            bins.append(
                {
                    "level": str(level),
                    "n": int(len(group)),
                    "v0_mae": None if group.empty else float((group["pred_v0"] - group["actual_pm25"]).abs().mean()),
                    "model_mae": None if group.empty else float((group[pred_col] - group["actual_pm25"]).abs().mean()),
                    "mean_actual": None if group.empty else float(group["actual_pm25"].mean()),
                }
            )
    cols = ["timestamp", "station", "actual_pm25", "pm25_at_t", "pred_v0", pred_col, "temperature", "humidity", "wind_speed", "rainfall", "solar_radiation"]
    largest_v0 = winter.nlargest(12, "abs_v0")[cols]
    largest_model = winter.nlargest(12, "abs_model")[cols]
    return {
        "comparison_column": pred_col,
        "by_month": month_rows,
        "december_by_hour": by_hour,
        "december_by_level": bins,
        "largest_persistence_errors": largest_v0.to_dict(orient="records"),
        "largest_model_errors": largest_model.to_dict(orient="records"),
    }


def write_docs(payload: dict) -> None:
    results = payload["results"]
    decision = payload["decision"]
    lines = [
        "# V2 model evaluation",
        "",
        f"Source: {SOURCE_DATASET_URL}",
        "",
        "V2 uses hourly means of labelled 15-minute CPCB observations. Alandi and Karve Road are not in the fit. Wide 2017–2023 files are not in the fit. No traffic, industry, dust, or citizen observations are used.",
        "",
        "## Clock",
        "",
        "Timestamps stay on the published `+0000` offset. They were not shifted to IST. The diurnal shape is consistent with Indian civil time, but that remains an inference. Lags, weather, and the train/validation/test cuts all use this same clock.",
        "",
        "Train rows have target time before 2025-01-01. Validation targets run from 2025-01-01 up to, but not including, 2025-07-01. Test targets are on or after 2025-07-01. The earlier six-station score used issue time on or after 2025-07-01, so its MAE of 12.76 is not the V0 number in this table. V0 here is persistence on this 10-station test set.",
        "",
        "## Stations excluded from the fit",
        "",
    ]
    for row in payload["excluded"]:
        lines.append(
            f"- {row['station_name']} ({row['station_id']}): {row['pm25_n']} PM2.5 rows, last observation {row['pm25_last']}. {row['reason']}"
        )
    lines.append("")
    lines.append("## Coverage")
    lines.append("")
    lines.append(f"- Stations in the model: {payload['n_stations']}")
    lines.append(f"- Hourly rows, including hours with missing PM2.5: {payload['hourly_rows']}")
    lines.append(f"- Hours with observed PM2.5: {payload['hourly_pm25_non_null']}")
    lines.append(f"- Eligible rows (PM2.5 at T and at T+24h): train {payload['counts']['train']}, validation {payload['counts']['val']}, test {payload['counts']['test']}")
    lines.append(f"- Series: {payload['series_start']} to {payload['series_end']}")
    lines.append("")
    lines.append("| Station | Hourly rows | PM2.5 % | AT % | RH % | WS % | WD % | RF % | SR % | PM2.5 last |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for row in payload["coverage"]:
        lines.append(
            f"| {row['station_name']} | {row['hourly_rows']} | {fmt_metric(row['pm25_non_null_pct'])} | "
            f"{fmt_metric(row['temperature_pct'])} | {fmt_metric(row['humidity_pct'])} | {fmt_metric(row['wind_speed_pct'])} | "
            f"{fmt_metric(row['wind_direction_pct'])} | {fmt_metric(row['rainfall_pct'])} | {fmt_metric(row['solar_radiation_pct'])} | {row['pm25_last']} |"
        )
    lines.append("")
    lines.append(
        f"Rows with PM2.5 at T and T+24h that also have all six weather fields: "
        f"{payload['complete_weather_rows']} of {payload['eligible_rows']} "
        f"({fmt_metric(payload['complete_weather_pct'])}%). "
        "V2-A, V2-B, and V2-C do not drop the incomplete rows. XGBoost leaves a missing weather value missing."
    )
    lines.append("")
    lines.append("## Test metrics")
    lines.append("")
    lines.append("| Model | Features | n | MAE | RMSE | R² |")
    lines.append("| --- | --- | --- | --- | --- | --- |")
    descriptions = {
        "V0": "PM2.5(T+24h) = PM2.5(T)",
        "V2-A": "PM2.5 lags only",
        "V2-B": "lags + observed CPCB weather, missing left missing",
        "V2-C": "lags + weather + calendar",
        "V2-D": "lags + short-gap and train-only station median weather",
        "V2-E": "lags + weather + station id",
    }
    for name in ("V0", "V2-A", "V2-B", "V2-C", "V2-D", "V2-E"):
        if name not in results:
            continue
        block = results[name]["test"]
        lines.append(
            f"| {name} | {descriptions[name]} | {block['n']} | {fmt_metric(block['mae'])} | {fmt_metric(block['rmse'])} | {fmt_metric(block['r2'], 3)} |"
        )
    lines.append("")
    lines.append("Validation MAE, not used to pick hyperparameters:")
    lines.append("")
    lines.append("| Model | n | MAE | RMSE | R² |")
    lines.append("| --- | --- | --- | --- | --- |")
    for name in ("V0", "V2-A", "V2-B", "V2-C", "V2-D", "V2-E"):
        if name not in results:
            continue
        block = results[name]["val"]
        lines.append(f"| {name} | {block['n']} | {fmt_metric(block['mae'])} | {fmt_metric(block['rmse'])} | {fmt_metric(block['r2'], 3)} |")
    lines.append("")
    lines.append("## Station-wise test MAE")
    lines.append("")
    header_models = [n for n in ("V0", "V2-A", "V2-B", "V2-C") if n in results]
    lines.append("| Station | " + " | ".join(header_models) + " |")
    lines.append("| --- | " + " | ".join("---" for _ in header_models) + " |")
    stations = [row["station_name"] for row in results["V0"]["test"]["by_station"]]
    for station in stations:
        cells = [station]
        for name in header_models:
            match = next(row for row in results[name]["test"]["by_station"] if row["station_name"] == station)
            cells.append(fmt_metric(match["mae"]))
        lines.append("| " + " | ".join(cells) + " |")
    lines.append("")
    lines.append("Station-wise test scores for persistence and the lags-only model:")
    lines.append("")
    lines.append("| Station | n | V0 MAE | V0 RMSE | V0 R² | V2-A MAE | V2-A RMSE | V2-A R² |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for station in stations:
        base = next(row for row in results["V0"]["test"]["by_station"] if row["station_name"] == station)
        lags = next(row for row in results["V2-A"]["test"]["by_station"] if row["station_name"] == station)
        lines.append(
            f"| {station} | {base['n']} | {fmt_metric(base['mae'])} | {fmt_metric(base['rmse'])} | {fmt_metric(base['r2'], 3)} | "
            f"{fmt_metric(lags['mae'])} | {fmt_metric(lags['rmse'])} | {fmt_metric(lags['r2'], 3)} |"
        )
    lines.append("")
    lines.append("## October–December test scores")
    lines.append("")
    lines.append("| Month | Model | n | MAE | RMSE | R² |")
    lines.append("| --- | --- | --- | --- | --- | --- |")
    for month in ("2025-10", "2025-11", "2025-12"):
        for name in header_models:
            match = next((row for row in results[name]["test"]["by_month"] if row["month"] == month), None)
            if match is None:
                continue
            lines.append(
                f"| {month} | {name} | {match['n']} | {fmt_metric(match['mae'])} | {fmt_metric(match['rmse'])} | {fmt_metric(match['r2'], 3)} |"
            )
    lines.append("")
    lines.append("## Test MAE by target month")
    lines.append("")
    lines.append("| Month | " + " | ".join(header_models) + " |")
    lines.append("| --- | " + " | ".join("---" for _ in header_models) + " |")
    months = [row["month"] for row in results["V0"]["test"]["by_month"]]
    for month in months:
        cells = [month]
        for name in header_models:
            match = next(row for row in results[name]["test"]["by_month"] if row["month"] == month)
            cells.append(fmt_metric(match["mae"]))
        lines.append("| " + " | ".join(cells) + " |")
    lines.append("")
    lines.append("## Promotion")
    lines.append("")
    lines.append(
        f"A V2 candidate is viable only if its overall test MAE is lower than persistence, "
        f"no station is worse by more than {STATION_MARGIN:.0f} µg/m³, "
        f"October–December together improve, and December is not worse by more than {DECEMBER_MARGIN:.0f} µg/m³."
    )
    lines.append("")
    lines.append(f"Production forecast: `{decision['production_forecast']}`.")
    if decision["promoted_v2"] is None:
        lines.append("No V2 candidate met that bar. Persistence remains the production 24-hour forecast.")
    else:
        lines.append(f"Promoted candidate: `{decision['promoted_v2']}`.")
    lines.append("")
    for name, checks in decision["checks"].items():
        lines.append(
            f"- {name}: overall improvement {fmt_metric(checks['mae_gap_v0_minus_model'])} µg/m³, "
            f"Oct–Dec improved: {checks['ond_improved']}, "
            f"December gap (model − persistence): {fmt_metric(checks['december_mae_gap_model_minus_v0'])}, "
            f"stations worse by more than {STATION_MARGIN:.0f}: {len(checks['stations_worse_by_more_than_margin'])}, "
            f"viable: {checks['viable']}."
        )
    lines.append("")
    lines.append("## Plots")
    lines.append("")
    for path in payload["plots"]:
        lines.append(f"- `{path}`")
    lines.append("")
    (DOCS_DIR / "v2_model_evaluation.md").write_text("\n".join(lines), encoding="utf-8")

    a = results["V2-A"]["test"]
    b = results["V2-B"]["test"]
    wlines = [
        "# Weather feature impact",
        "",
        "Comparison of V2-A (PM2.5 lags only) and V2-B (lags plus observed CPCB weather) on the same test rows. Missing weather was not filled and was not copied from another station.",
        "",
        SHAP_DISCLAIMER,
        "",
        "| | MAE | RMSE | R² |",
        "| --- | --- | --- | --- |",
        f"| V2-A | {fmt_metric(a['mae'])} | {fmt_metric(a['rmse'])} | {fmt_metric(a['r2'], 3)} |",
        f"| V2-B | {fmt_metric(b['mae'])} | {fmt_metric(b['rmse'])} | {fmt_metric(b['r2'], 3)} |",
        f"| V2-A minus V2-B | {fmt_metric(a['mae'] - b['mae'])} | {fmt_metric(a['rmse'] - b['rmse'])} | {fmt_metric((a['r2'] or 0) - (b['r2'] or 0), 3)} |",
        "",
        "A positive MAE difference means V2-B has a lower error than V2-A.",
        "",
        "## Model-derived contribution on V2-B",
        "",
    ]
    if payload["shap"] is None:
        wlines.append("SHAP values were not produced. No substitute ranking is reported as SHAP.")
    else:
        wlines.append("TreeExplainer mean absolute SHAP on a sample of test rows, in µg/m³ of the 24-hour prediction. This is not source apportionment.")
        wlines.append("")
        wlines.append("| Feature | Mean abs SHAP |")
        wlines.append("| --- | --- |")
        for row in payload["shap"]:
            wlines.append(f"| {row['feature']} | {fmt_metric(float(row['mean_abs_shap']), 3)} |")
    wlines.append("")
    if "V2-D" in results:
        d = results["V2-D"]["test"]
        wlines.append("## V2-D imputation experiment")
        wlines.append("")
        wlines.append("V2-D fills weather only. PM2.5 is not filled. A gap of at most 2 hours is carried forward from the previous hour. Remaining gaps at a station use that station's own training-period median, and only if that station has at least 100 training weather observations. A station with no weather history stays missing. No value is taken from a different station.")
        wlines.append("")
        wlines.append(f"V2-D test MAE {fmt_metric(d['mae'])}, RMSE {fmt_metric(d['rmse'])}, R² {fmt_metric(d['r2'], 3)}.")
        wlines.append(f"V2-B test MAE {fmt_metric(b['mae'])}.")
        if d["mae"] < b["mae"]:
            wlines.append("V2-D has a lower test MAE than V2-B.")
        else:
            wlines.append("V2-D does not improve on V2-B. The imputation is not used.")
        wlines.append("")
    (DOCS_DIR / "weather_feature_impact.md").write_text("\n".join(wlines), encoding="utf-8")

    winter = payload["winter"]
    zlines = [
        "# Winter error analysis",
        "",
        f"Test rows whose target hour falls in October, November, or December 2025. The model column is `{winter['comparison_column']}`, the V2 candidate with the lowest overall test MAE among V2-A, V2-B, and V2-C.",
        "",
        "Figures below are computed from the test predictions. They are not a causal account of winter pollution.",
        "",
        "| Month | n | Mean actual | Mean PM2.5 at T | Mean (actual − PM2.5 at T) | V0 MAE | Model MAE | Share of hours with actual > 90 |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for row in winter["by_month"]:
        zlines.append(
            f"| {row['month']} | {row['n']} | {fmt_metric(row['mean_actual'])} | {fmt_metric(row['mean_pm25_at_t'])} | "
            f"{fmt_metric(row['mean_persist_error'])} | {fmt_metric(row['v0_mae'])} | {fmt_metric(row['model_mae'])} | {fmt_metric(100 * row['share_actual_above_90'])}% |"
        )
    zlines.append("")
    zlines.append("Mean (actual − PM2.5 at T) is the average bias of persistence. A positive value means the target hour was higher than the issue hour.")
    zlines.append("")
    zlines.append("## December by published hour")
    zlines.append("")
    zlines.append("| Hour | n | Mean actual | V0 MAE | Model MAE |")
    zlines.append("| --- | --- | --- | --- | --- |")
    for row in winter["december_by_hour"]:
        zlines.append(
            f"| {row['hour']} | {row['n']} | {fmt_metric(row['mean_actual'])} | {fmt_metric(row['v0_mae'])} | {fmt_metric(row['model_mae'])} |"
        )
    zlines.append("")
    zlines.append("## December by PM2.5 at the issue hour")
    zlines.append("")
    zlines.append("| Level at T | n | Mean actual at T+24h | V0 MAE | Model MAE |")
    zlines.append("| --- | --- | --- | --- | --- |")
    for row in winter["december_by_level"]:
        zlines.append(
            f"| {row['level']} | {row['n']} | {fmt_metric(row['mean_actual'])} | {fmt_metric(row['v0_mae'])} | {fmt_metric(row['model_mae'])} |"
        )
    zlines.append("")
    zlines.append("## Largest persistence errors in Oct–Dec")
    zlines.append("")
    zlines.append("| Target time | Station | Actual | PM2.5 at T | V0 | Model | AT | RH | WS | RF | SR |")
    zlines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for row in winter["largest_persistence_errors"]:
        zlines.append(_winter_row(row, winter["comparison_column"]))
    zlines.append("")
    zlines.append("## Largest model errors in Oct–Dec")
    zlines.append("")
    zlines.append("| Target time | Station | Actual | PM2.5 at T | V0 | Model | AT | RH | WS | RF | SR |")
    zlines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for row in winter["largest_model_errors"]:
        zlines.append(_winter_row(row, winter["comparison_column"]))
    zlines.append("")
    (DOCS_DIR / "winter_error_analysis.md").write_text("\n".join(zlines), encoding="utf-8")


def _winter_row(row: dict, pred_col: str) -> str:
    ts = row["timestamp"]
    if not isinstance(ts, str):
        ts = pd.Timestamp(ts).strftime("%Y-%m-%d %H:%M")
    return (
        f"| {ts} | {row['station']} | {fmt_metric(row['actual_pm25'])} | {fmt_metric(row['pm25_at_t'])} | "
        f"{fmt_metric(row['pred_v0'])} | {fmt_metric(row[pred_col])} | {fmt_metric(row.get('temperature'))} | "
        f"{fmt_metric(row.get('humidity'))} | {fmt_metric(row.get('wind_speed'))} | {fmt_metric(row.get('rainfall'))} | "
        f"{fmt_metric(row.get('solar_radiation'))} |"
    )


def main() -> int:
    ensure_dirs()
    print("building hourly table")
    frame, excluded, notes = prepare()
    coverage = assign_coverage_from_hourly(notes)
    counts = {name: int((frame["split"] == name).sum()) for name in ("train", "val", "test")}
    print("split", counts)
    train = frame.loc[frame["split"] == "train"]
    val = frame.loc[frame["split"] == "val"]
    test = frame.loc[frame["split"] == "test"]
    complete = frame.dropna(subset=MET)
    station_columns = [f"station_{value}" for value in sorted(train["station_id"].astype(str).unique())]

    print("fit V2-A")
    model_a, (pred_a_val, pred_a_test) = fit_predict(train, [val, test], LAGS, None)
    print("fit V2-B")
    model_b, (pred_b_val, pred_b_test) = fit_predict(train, [val, test], LAGS + MET, None)
    print("fit V2-C")
    model_c, (pred_c_val, pred_c_test) = fit_predict(train, [val, test], LAGS + MET + CALENDAR, None)
    print("fit V2-D")
    hourly = pd.read_parquet(notes["hourly_path"])
    filled = short_gap_and_train_median(frame, hourly)
    model_d, (pred_d_val, pred_d_test) = fit_predict(
        filled.loc[filled["split"] == "train"],
        [filled.loc[filled["split"] == "val"], filled.loc[filled["split"] == "test"]],
        LAGS + MET,
        None,
    )
    print("fit V2-E")
    model_e, (pred_e_val, pred_e_test) = fit_predict(train, [val, test], LAGS + MET, station_columns)

    results = {
        "V0": {
            "val": summarize("V0", val, val["pm25_t"].to_numpy()),
            "test": summarize("V0", test, test["pm25_t"].to_numpy()),
        },
        "V2-A": {"val": summarize("V2-A", val, pred_a_val), "test": summarize("V2-A", test, pred_a_test), "features": LAGS},
        "V2-B": {"val": summarize("V2-B", val, pred_b_val), "test": summarize("V2-B", test, pred_b_test), "features": LAGS + MET},
        "V2-C": {"val": summarize("V2-C", val, pred_c_val), "test": summarize("V2-C", test, pred_c_test), "features": LAGS + MET + CALENDAR},
        "V2-D": {"val": summarize("V2-D", val, pred_d_val), "test": summarize("V2-D", test, pred_d_test), "features": LAGS + MET},
        "V2-E": {"val": summarize("V2-E", val, pred_e_val), "test": summarize("V2-E", test, pred_e_test), "features": LAGS + MET + station_columns},
    }
    for name in ("V0", "V2-A", "V2-B", "V2-C"):
        print(name, "test MAE", round(results[name]["test"]["mae"], 3))

    decision = promotion(results)
    candidates = {name: results[name]["test"]["mae"] for name in ("V2-A", "V2-B", "V2-C")}
    best_name = min(candidates, key=candidates.get)
    best_model = {"V2-A": model_a, "V2-B": model_b, "V2-C": model_c}[best_name]
    best_features = results[best_name]["features"]
    print("lowest test MAE among A/B/C:", best_name, "promoted:", decision["promoted_v2"])

    shap_rows = shap_table(model_b, test, LAGS + MET)
    test_out = test.copy()
    test_out["pred_v0"] = test_out["pm25_t"]
    test_out["pred_v2a"] = pred_a_test
    test_out["pred_v2b"] = pred_b_test
    test_out["pred_v2c"] = pred_c_test
    test_out["pred_v2d"] = pred_d_test
    test_out["pred_v2e"] = pred_e_test
    test_out["year_month"] = test_out["target_timestamp"].dt.strftime("%Y-%m")
    pred_col = {"V2-A": "pred_v2a", "V2-B": "pred_v2b", "V2-C": "pred_v2c"}[best_name]
    export = pd.DataFrame(
        {
            "timestamp": test_out["target_timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "issue_timestamp": test_out["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "station": test_out["station_name"],
            "station_id": test_out["station_id"],
            "actual_pm25": test_out["target_pm25_24h"],
            "pm25_at_t": test_out["pm25_t"],
            "pred_v0": test_out["pred_v0"],
            "pred_v2a": test_out["pred_v2a"],
            "pred_v2b": test_out["pred_v2b"],
            "pred_v2c": test_out["pred_v2c"],
            "pred_v2d": test_out["pred_v2d"],
            "pred_v2e": test_out["pred_v2e"],
        }
    )
    pred_path = PROCESSED_DIR / "v2_predictions.csv"
    export.to_csv(pred_path, index=False)
    scored_for_plots = test_out.rename(
        columns={"target_pm25_24h": "actual_pm25", "station_name": "station", "pm25_t": "pm25_at_t"}
    )
    plots = save_plots(scored_for_plots)
    winter = winter_facts(
        scored_for_plots.assign(
            temperature=test_out["temperature"].to_numpy(),
            humidity=test_out["humidity"].to_numpy(),
            wind_speed=test_out["wind_speed"].to_numpy(),
            rainfall=test_out["rainfall"].to_numpy(),
            solar_radiation=test_out["solar_radiation"].to_numpy(),
        ),
        pred_col,
    )

    model_path = MODEL_DIR / "v2_model.pkl"
    joblib.dump(best_model, model_path)
    payload = {
        "trained_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source_dataset": SOURCE_DATASET_URL,
        "clock": "Published +0000 offset. Not shifted to IST.",
        "n_stations": int(frame["station_id"].nunique()),
        "hourly_rows": notes["hourly_rows"],
        "hourly_pm25_non_null": notes["hourly_pm25_non_null"],
        "eligible_rows": int(len(frame)),
        "complete_weather_rows": int(len(complete)),
        "complete_weather_pct": float(100 * len(complete) / len(frame)) if len(frame) else 0.0,
        "counts": counts,
        "series_start": str(frame["timestamp"].min()),
        "series_end": str(frame["timestamp"].max()),
        "excluded": excluded,
        "coverage": coverage,
        "results": results,
        "decision": decision,
        "saved_model": best_name,
        "saved_model_promoted": decision["promoted_v2"] == best_name,
        "saved_features": best_features,
        "shap": shap_rows,
        "shap_disclaimer": SHAP_DISCLAIMER,
        "plots": plots,
        "winter": winter,
        "predictions": str(pred_path),
        "hyperparameters": {key: (None if isinstance(value, float) and np.isnan(value) else value if isinstance(value, (int, float, str, bool)) or value is None else str(value)) for key, value in PARAMS.items()},
    }
    write_json(MODEL_DIR / "v2_metrics.json", payload)
    write_docs(payload)
    print("production", decision["production_forecast"])
    print("wrote", pred_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
