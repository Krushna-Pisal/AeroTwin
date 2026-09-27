"""Train V0 persistence and V1 XGBoost on the observed hourly table.

The split is chronological. V1 is fit only on the training period.
Meteorology columns enter the model only when training coverage is high enough
that the column is an observed field rather than an empty placeholder.
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

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aq_common import (
    DEFAULT_TEST_START,
    DEFAULT_VAL_START,
    DOCS_DIR,
    FEATURE_META_PATH,
    HORIZON_HOURS,
    LAG_COLUMNS,
    LEAKAGE_BUFFER_HOURS,
    MET_FEATURES,
    MET_MIN_TRAIN_COVERAGE,
    METRICS_PATH,
    MODEL_DATASET_PATH,
    MODEL_FIG_DIR,
    MODEL_PATH,
    PIPELINE_SUMMARY_PATH,
    SHAP_DISCLAIMER,
    TARGET_CALENDAR,
    TIME_FEATURES,
    ensure_dirs,
    fmt_metric,
    read_json,
    regression_scores,
    write_json,
)

TARGET = "target_pm25_24h"


def load_model_frame() -> pd.DataFrame:
    if not MODEL_DATASET_PATH.exists():
        raise SystemExit("Missing model dataset. Run clean_air_quality.py first.")
    frame = pd.read_parquet(MODEL_DATASET_PATH)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    frame["target_timestamp"] = pd.to_datetime(frame["target_timestamp"], utc=True)
    return frame


def eligible(frame: pd.DataFrame) -> pd.DataFrame:
    """Rows that have an observed PM2.5 at T and an observed PM2.5 at T+24h."""
    return frame.dropna(subset=["pm25", TARGET]).copy()


def assign_split(frame: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Chronological split with a 24-hour buffer so labels do not cross the cut."""
    stamps = frame["timestamp"]
    tmin, tmax = stamps.min(), stamps.max()
    val_start = pd.Timestamp(DEFAULT_VAL_START)
    test_start = pd.Timestamp(DEFAULT_TEST_START)
    covers_calendar = tmin < val_start and tmax >= test_start + pd.Timedelta(days=14)
    if covers_calendar:
        rule = "calendar"
    else:
        rule = "quantile_time"
        ordered = np.sort(stamps.unique())
        val_start = pd.Timestamp(ordered[int(len(ordered) * 0.70)])
        test_start = pd.Timestamp(ordered[int(len(ordered) * 0.85)])
        if val_start.tzinfo is None:
            val_start = val_start.tz_localize("UTC")
        if test_start.tzinfo is None:
            test_start = test_start.tz_localize("UTC")

    target_ts = frame["target_timestamp"]
    split = np.full(len(frame), "buffer", dtype=object)
    train_mask = target_ts < val_start
    val_mask = (stamps >= val_start) & (target_ts < test_start)
    test_mask = stamps >= test_start
    # Issue times in the 24h before each cut have targets on the far side of the cut.
    split[train_mask.to_numpy()] = "train"
    split[val_mask.to_numpy()] = "val"
    split[test_mask.to_numpy()] = "test"
    # A test row whose own timestamp is before test_start should not happen; guard it.
    split[(stamps < test_start).to_numpy() & (split == "test")] = "buffer"
    frame = frame.copy()
    frame["split"] = split
    info = {
        "rule": rule,
        "val_start": str(val_start),
        "test_start": str(test_start),
        "series_start": str(tmin),
        "series_end": str(tmax),
        "horizon_hours": HORIZON_HOURS,
        "leakage_buffer_hours": LEAKAGE_BUFFER_HOURS,
        "buffer_note": (
            f"Training labels end before {val_start}. "
            f"Validation labels end before {test_start}. "
            "Issue times whose target would fall across a cut stay in 'buffer' "
            "(about 24 hours on each side of a cut)."
        ),
        "counts": {name: int((frame["split"] == name).sum()) for name in ("train", "val", "test", "buffer")},
    }
    if info["counts"]["train"] < 500 or info["counts"]["test"] < 200:
        raise SystemExit(f"Split is too small to evaluate honestly: {info['counts']}")
    return frame, info


def met_columns_for_training(train: pd.DataFrame) -> tuple[list[str], dict, dict]:
    """Keep an observed meteorology column when it actually varies.

    Global coverage can look low because most stations in this extract do not
    report AT/RH/WS/WD/RF/SR/BP. A column is still used when at least one
    station reports it on 20% or more of training hours and the values are
    not a single constant. Pressure is dropped when its median is not in a
    plausible ambient range for the labelled unit.
    """
    kept: list[str] = []
    excluded: dict[str, str] = {}
    used_notes: dict[str, str] = {}
    for column in MET_FEATURES:
        if column not in train.columns:
            excluded[column] = "column absent from the processed table"
            continue
        series = train[column]
        fraction = float(series.notna().mean())
        valid = series.dropna()
        n_unique = int(valid.nunique()) if not valid.empty else 0
        if valid.empty or n_unique <= 1:
            excluded[column] = (
                f"no usable variation (non-null fraction {fraction:.4f}, "
                f"distinct values {n_unique}). Not imputed."
            )
            continue
        if column == "pressure":
            median = float(valid.median())
            plausible_mmhg = 680 <= median <= 780
            plausible_hpa = 940 <= median <= 1050
            if not (plausible_mmhg or plausible_hpa):
                excluded[column] = (
                    f"median of non-null values is {median:.1f}. The file labels BP as mmHg, "
                    "but that median is outside a plausible ambient band for mmHg (about 680-780) "
                    "and for hPa (about 940-1050). Values were not unit-converted and were not used."
                )
                continue
        by_station = train.groupby("station_id")[column].apply(lambda s: float(s.notna().mean()))
        best_station = float(by_station.max()) if len(by_station) else 0.0
        best_id = str(by_station.idxmax()) if len(by_station) else ""
        if best_station < MET_MIN_TRAIN_COVERAGE:
            excluded[column] = (
                f"best station non-null fraction is {best_station:.4f} "
                f"(overall {fraction:.4f}), below {MET_MIN_TRAIN_COVERAGE:.2f}. Not imputed."
            )
            continue
        kept.append(column)
        used_notes[column] = (
            f"on training rows, non-null fraction {fraction:.4f}; "
            f"best station {best_id} fraction {best_station:.4f}. "
            "Missing station-hours stay missing."
        )
    if "total_rainfall" in train.columns:
        total = train["total_rainfall"].dropna()
        if total.empty or int(total.nunique()) <= 1:
            excluded["total_rainfall"] = (
                "TOT-RF does not vary (the only populated station is constant). "
                "It was not used as rainfall."
            )
    return kept, excluded, used_notes


def design_matrix(frame: pd.DataFrame, feature_columns: list[str], station_columns: list[str]) -> pd.DataFrame:
    base = frame[feature_columns].copy()
    dummies = pd.get_dummies(frame["station_id"].astype(str), prefix="station")
    dummies = dummies.reindex(columns=station_columns, fill_value=0)
    matrix = pd.concat([base.reset_index(drop=True), dummies.reset_index(drop=True)], axis=1)
    return matrix.astype(float)


def station_table(frame: pd.DataFrame, pred_col: str) -> list[dict]:
    rows = []
    for (station_id, station_name), group in frame.groupby(["station_id", "station_name"]):
        scores = regression_scores(group[TARGET], group[pred_col])
        rows.append(
            {
                "station_id": str(station_id),
                "station_name": str(station_name),
                **scores,
            }
        )
    return rows


def save_plots(test: pd.DataFrame, shap_table: pd.DataFrame | None) -> list[str]:
    MODEL_FIG_DIR.mkdir(parents=True, exist_ok=True)
    written = []

    fig, ax = plt.subplots(figsize=(7, 7))
    ax.scatter(test[TARGET], test["pred_v1"], s=6, alpha=0.25, label="V1 XGBoost")
    lo = float(min(test[TARGET].min(), test["pred_v1"].min()))
    hi = float(max(test[TARGET].max(), test["pred_v1"].max()))
    ax.plot([lo, hi], [lo, hi], color="black", linewidth=1, label="1:1 line")
    ax.set_xlabel("Observed PM2.5 at T+24h (ug/m3)")
    ax.set_ylabel("Predicted PM2.5 (ug/m3)")
    ax.set_title("Test period: observed vs V1 prediction")
    ax.legend()
    fig.tight_layout()
    scatter_path = MODEL_FIG_DIR / "test_actual_vs_predicted_scatter.png"
    fig.savefig(scatter_path, dpi=120)
    plt.close(fig)
    written.append(str(scatter_path))

    daily = test.copy()
    daily["day"] = daily["timestamp"].dt.floor("D")
    grouped = (
        daily.groupby(["station_name", "day"], as_index=False)[[TARGET, "pred_v0", "pred_v1"]]
        .mean()
    )
    stations = list(grouped["station_name"].unique())
    fig, axes = plt.subplots(len(stations), 1, figsize=(11, 2.4 * len(stations)), sharex=False)
    if len(stations) == 1:
        axes = [axes]
    for ax, station in zip(axes, stations):
        part = grouped.loc[grouped["station_name"] == station]
        ax.plot(part["day"], part[TARGET], label="Observed daily mean", linewidth=1.2)
        ax.plot(part["day"], part["pred_v0"], label="V0 daily mean", linewidth=1, alpha=0.8)
        ax.plot(part["day"], part["pred_v1"], label="V1 daily mean", linewidth=1, alpha=0.8)
        ax.set_ylabel("ug/m3")
        ax.set_title(station)
        ax.legend(loc="upper right", fontsize=8)
    fig.suptitle("Test period daily means of hourly 24h-ahead predictions (plot aggregation)", y=1.01)
    fig.tight_layout()
    daily_path = MODEL_FIG_DIR / "test_daily_mean_actual_vs_predicted.png"
    fig.savefig(daily_path, dpi=120, bbox_inches="tight")
    plt.close(fig)
    written.append(str(daily_path))

    if shap_table is not None and not shap_table.empty:
        top = shap_table.head(15).iloc[::-1]
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.barh(top["feature"], top["mean_abs_shap"])
        ax.set_xlabel("Mean |SHAP| (ug/m3 of the 24h prediction)")
        ax.set_title("Model-derived contribution\nNot causal source apportionment")
        fig.tight_layout()
        shap_path = MODEL_FIG_DIR / "shap_mean_abs.png"
        fig.savefig(shap_path, dpi=120)
        plt.close(fig)
        written.append(str(shap_path))
    return written


def compute_shap(model, matrix: pd.DataFrame) -> pd.DataFrame | None:
    try:
        import shap

        sample = matrix.sample(n=min(1500, len(matrix)), random_state=42)
        explainer = shap.TreeExplainer(model)
        values = explainer.shap_values(sample)
        if isinstance(values, list):
            values = values[0]
        values = np.asarray(values)
        mean_abs = np.mean(np.abs(values), axis=0)
        table = pd.DataFrame({"feature": list(sample.columns), "mean_abs_shap": mean_abs})
        return table.sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)
    except Exception as exc:  # noqa: BLE001 - report the failure, do not invent importances
        print(f"SHAP failed: {exc}")
        return None


def write_evaluation(metrics: dict, shap_table: pd.DataFrame | None) -> None:
    v0 = metrics["v0_naive_persistence_24h"]["test"]
    v1 = metrics["v1_xgboost_24h"]["test"]
    improved = v1["mae"] < v0["mae"]
    if improved:
        comparison = (
            f"On the test period, V1 MAE is {fmt_metric(v1['mae'])} ug/m3 and "
            f"V0 MAE is {fmt_metric(v0['mae'])} ug/m3. V1 has a lower MAE than persistence."
        )
    else:
        comparison = (
            f"On the test period, V1 MAE is {fmt_metric(v1['mae'])} ug/m3 and "
            f"V0 MAE is {fmt_metric(v0['mae'])} ug/m3. V1 does not beat persistence on MAE."
        )
    split = metrics["split"]
    lines = [
        "# Model evaluation",
        "",
        "Target: observed PM2.5 at T+24 hours, in ug/m3.",
        "",
        "V0 predicts that value with the observed PM2.5 at the issue time T (persistence).",
        "V1 is one global XGBoost model for all stations in the processed table. It is not a separate model per station.",
        "",
        SHAP_DISCLAIMER,
        "",
        "## Split",
        "",
        f"- Rule: `{split['rule']}`",
        f"- Labelled series: {split['series_start']} to {split['series_end']}",
        f"- Validation issues start: {split['val_start']}",
        f"- Test issues start: {split['test_start']}",
        f"- Rows: train {split['counts']['train']}, validation {split['counts']['val']}, test {split['counts']['test']}, buffer {split['counts']['buffer']}",
        "",
        split["buffer_note"],
        "",
        "The 2017-2021 / 2022 / 2023 split was not used. The OpenCity files for those years do not contain a PM2.5 column, so there is no observed target to train on. The cuts above are inside the labelled 2024-2025 series.",
        "",
        "Rows are assigned by time, not at random. Training labels (`target_timestamp`) end before the validation cut. Validation labels end before the test cut.",
        "",
        "## Features actually used in V1",
        "",
    ]
    for feature in metrics["v1_xgboost_24h"]["features"]:
        lines.append(f"- `{feature}`")
    lines.append("")
    lines.append("## Features present in the table but not used")
    lines.append("")
    dropped = metrics["v1_xgboost_24h"]["features_excluded"]
    if not dropped:
        lines.append("- None.")
    for name, reason in dropped.items():
        lines.append(f"- `{name}`: {reason}")
    lines.append("")
    lines.append("Station identity is one-hot encoded from `station_id` (columns starting with `station_`).")
    lines.append("")
    lines.append("No traffic, industrial, or dust proxy is in this model. V2 and V3 were not trained.")
    lines.append("")
    lines.append("## Test metrics")
    lines.append("")
    lines.append("| model | n | MAE | RMSE | R2 |")
    lines.append("| --- | --- | --- | --- | --- |")
    for label, block in (("V0 persistence", v0), ("V1 XGBoost", v1)):
        lines.append(
            f"| {label} | {block['n']} | {fmt_metric(block['mae'])} | {fmt_metric(block['rmse'])} | {fmt_metric(block['r2'], 3)} |"
        )
    lines.append("")
    lines.append(comparison)
    lines.append("")
    lines.append("Validation metrics (not used to pick the model; hyperparameters were fixed before looking at test):")
    lines.append("")
    v0v = metrics["v0_naive_persistence_24h"]["val"]
    v1v = metrics["v1_xgboost_24h"]["val"]
    lines.append("| model | n | MAE | RMSE | R2 |")
    lines.append("| --- | --- | --- | --- | --- |")
    lines.append(
        f"| V0 persistence | {v0v['n']} | {fmt_metric(v0v['mae'])} | {fmt_metric(v0v['rmse'])} | {fmt_metric(v0v['r2'], 3)} |"
    )
    lines.append(
        f"| V1 XGBoost | {v1v['n']} | {fmt_metric(v1v['mae'])} | {fmt_metric(v1v['rmse'])} | {fmt_metric(v1v['r2'], 3)} |"
    )
    lines.append("")
    lines.append("## Test metrics by station")
    lines.append("")
    lines.append("| station | n | V0 MAE | V1 MAE | V0 RMSE | V1 RMSE | V0 R2 | V1 R2 |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
    v0_by = {row["station_id"]: row for row in metrics["v0_naive_persistence_24h"]["test_by_station"]}
    for row in metrics["v1_xgboost_24h"]["test_by_station"]:
        base = v0_by[row["station_id"]]
        lines.append(
            f"| {row['station_name']} | {row['n']} | {fmt_metric(base['mae'])} | {fmt_metric(row['mae'])} | "
            f"{fmt_metric(base['rmse'])} | {fmt_metric(row['rmse'])} | {fmt_metric(base['r2'], 3)} | {fmt_metric(row['r2'], 3)} |"
        )
    lines.append("")
    missing_test = metrics.get("stations_without_test_rows") or []
    if missing_test:
        lines.append("Stations with labelled history but no scored test rows:")
        lines.append("")
        for item in missing_test:
            lines.append(f"- {item}")
        lines.append("")
    lines.append("Where R2 is largely negative, that station's test PM2.5 varies little compared with the size of the errors. MAE is the comparison between V0 and V1.")
    lines.append("")
    lines.append("## SHAP")
    lines.append("")
    lines.append(SHAP_DISCLAIMER)
    lines.append("")
    if shap_table is None:
        lines.append("SHAP values were not produced. See the training log. No substitute importance is reported as SHAP.")
    else:
        lines.append(f"TreeExplainer on a random sample of {metrics['shap']['sample_size']} test rows. Values are mean absolute SHAP in ug/m3 of the predicted concentration.")
        lines.append("")
        lines.append("| feature | mean abs SHAP |")
        lines.append("| --- | --- |")
        for _, row in shap_table.head(15).iterrows():
            lines.append(f"| {row['feature']} | {fmt_metric(float(row['mean_abs_shap']), 3)} |")
    lines.append("")
    lines.append("## Plots")
    lines.append("")
    for path in metrics["plots"]:
        lines.append(f"- `{path}`")
    lines.append("")
    lines.append("The daily-mean figure averages hourly predictions and hourly observations inside each UTC day so the series is readable. It is not a separately trained daily model.")
    lines.append("")
    lines.append("## Data-quality limits that affect this score")
    lines.append("")
    for item in metrics["caveats"]:
        lines.append(f"- {item}")
    lines.append("")
    (DOCS_DIR / "model_evaluation.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    ensure_dirs()
    frame = eligible(load_model_frame())
    frame, split_info = assign_split(frame)
    train = frame.loc[frame["split"] == "train"]
    val = frame.loc[frame["split"] == "val"]
    test = frame.loc[frame["split"] == "test"]

    met_kept, met_dropped, met_notes = met_columns_for_training(train)
    base_features = ["pm25", *LAG_COLUMNS, *TIME_FEATURES, *TARGET_CALENDAR, *met_kept]
    missing = [c for c in base_features if c not in frame.columns]
    if missing:
        raise SystemExit(f"Model dataset is missing columns: {missing}")

    station_columns = [f"station_{value}" for value in sorted(train["station_id"].astype(str).unique())]
    x_train = design_matrix(train, base_features, station_columns)
    x_val = design_matrix(val, base_features, station_columns)
    x_test = design_matrix(test, base_features, station_columns)
    y_train = train[TARGET].to_numpy()
    y_val = val[TARGET].to_numpy()
    y_test = test[TARGET].to_numpy()

    from xgboost import XGBRegressor

    model = XGBRegressor(
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
    if TARGET in x_train.columns:
        raise SystemExit("Refusing to train: the target column is in the feature matrix.")
    print(f"fitting V1 on {len(train)} rows, {x_train.shape[1]} features")
    model.fit(x_train, y_train, verbose=False)

    def predict(matrix: pd.DataFrame) -> np.ndarray:
        return model.predict(matrix)

    scored = frame.loc[frame["split"].isin(["val", "test"])].copy()
    scored["pred_v0"] = scored["pm25"]
    pred_map_index = scored.index
    x_scored = design_matrix(scored, base_features, station_columns)
    scored["pred_v1"] = predict(x_scored)
    val_scored = scored.loc[scored["split"] == "val"]
    test_scored = scored.loc[scored["split"] == "test"]

    v0_val = regression_scores(val_scored[TARGET], val_scored["pred_v0"])
    v0_test = regression_scores(test_scored[TARGET], test_scored["pred_v0"])
    v1_val = regression_scores(val_scored[TARGET], val_scored["pred_v1"])
    v1_test = regression_scores(test_scored[TARGET], test_scored["pred_v1"])
    print(
        "test MAE V0",
        round(v0_test["mae"], 3),
        "V1",
        round(v1_test["mae"], 3),
    )

    shap_table = compute_shap(model, x_test)
    plots = save_plots(test_scored, shap_table)
    if shap_table is not None:
        shap_table.to_csv(MODEL_FIG_DIR / "shap_mean_abs.csv", index=False)

    caveats = [
        "Training data are hourly means of labelled 15-minute CPCB observations from 2024 onward, not the 2017-2023 wide matrices.",
        "Timestamps follow the +0000 offset in the source files and were not converted to IST.",
        "Missing PM2.5 was not imputed. Rows without PM2.5 at T or at T+24h are excluded from scoring.",
    ]
    if not met_kept:
        caveats.append(
            "No meteorological column was both varying and well enough observed to use. "
            "Weather was not filled in from another source."
        )
    else:
        caveats.append(
            "Meteorological inputs are observed CPCB fields, not an external weather product: "
            + ", ".join(met_kept)
            + ". Other stations in this extract leave those fields empty."
        )
        for name, note in met_notes.items():
            caveats.append(f"{name}: {note}")
    if PIPELINE_SUMMARY_PATH.exists():
        summary = read_json(PIPELINE_SUMMARY_PATH)
        for name, fraction in summary.get("met_non_null_fraction", {}).items():
            if fraction < MET_MIN_TRAIN_COVERAGE:
                caveats.append(
                    f"{name} non-null fraction on the full hourly table (including hours with no PM2.5) is {fraction:.4f}."
                )
    in_test = set(test_scored["station_name"].astype(str).unique())
    missing_test_rows = []
    last_eligible = frame.groupby("station_name")["timestamp"].max()
    for name, last_ts in last_eligible.items():
        if str(name) not in in_test:
            missing_test_rows.append(
                f"{name}: last hour with both PM2.5(T) and PM2.5(T+24h) is {last_ts}. No test rows."
            )
    if missing_test_rows:
        caveats.append(
            "Humidity, wind speed, and wind direction in this extract are reported at Karve Road only. "
            "If Karve Road has no test rows, those weather inputs are missing for every test prediction."
        )

    feature_list = list(x_train.columns)
    trained_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    feature_meta = {
        "model_version": "V1",
        "model_path": str(MODEL_PATH),
        "trained_at": trained_at,
        "target": "pm25 at T+24h",
        "target_column": TARGET,
        "issue_time_pm25_column": "pm25",
        "features": feature_list,
        "base_features": base_features,
        "station_columns": station_columns,
        "features_excluded": met_dropped,
        "meteorology_notes": met_notes,
        "met_min_train_coverage": MET_MIN_TRAIN_COVERAGE,
        "hyperparameters": model.get_params(),
        "split": split_info,
        "shap_disclaimer": SHAP_DISCLAIMER,
        "naive_baseline": "PM2.5(T+24h) predicted as PM2.5(T). No fitted parameters.",
        "not_included": [
            "traffic_activity_proxy",
            "industrial_activity_proxy",
            "dust_activity_proxy",
            "synthetic observations",
            "2017-2023 wide-matrix cells",
        ],
    }
    # get_params may contain non-json values; stringify leftovers in write_json via default only for numpy.
    def _param(value):
        if value is None:
            return None
        if isinstance(value, float) and np.isnan(value):
            return None
        if isinstance(value, (int, float, str, bool)):
            return value
        return str(value)

    feature_meta["hyperparameters"] = {key: _param(value) for key, value in model.get_params().items()}

    metrics = {
        "trained_at": trained_at,
        "split": split_info,
        "v0_naive_persistence_24h": {
            "definition": "prediction = observed PM2.5 at issue time T",
            "val": v0_val,
            "test": v0_test,
            "test_by_station": station_table(test_scored, "pred_v0"),
        },
        "v1_xgboost_24h": {
            "val": v1_val,
            "test": v1_test,
            "test_by_station": station_table(test_scored, "pred_v1"),
            "features": feature_list,
            "features_excluded": met_dropped,
            "meteorology_notes": met_notes,
        },
        "v1_beats_v0_on_test_mae": bool(v1_test["mae"] < v0_test["mae"]),
        "mae_improvement_v0_minus_v1": float(v0_test["mae"] - v1_test["mae"]),
        "shap": {
            "computed": shap_table is not None,
            "sample_size": 0 if shap_table is None else int(min(1500, len(x_test))),
            "disclaimer": SHAP_DISCLAIMER,
            "top_features": []
            if shap_table is None
            else shap_table.head(15).to_dict(orient="records"),
        },
        "plots": plots,
        "caveats": caveats,
        "rows_scored_index_note": int(len(pred_map_index)),
        "stations_without_test_rows": missing_test_rows,
    }
    # Silence unused variable if any
    del y_val, y_test

    joblib.dump(model, MODEL_PATH)
    write_json(FEATURE_META_PATH, feature_meta)
    write_json(METRICS_PATH, metrics)
    write_evaluation(metrics, shap_table)
    print(f"wrote {MODEL_PATH}")
    print(f"wrote {DOCS_DIR / 'model_evaluation.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
