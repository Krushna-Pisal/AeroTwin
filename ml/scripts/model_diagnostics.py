"""Controlled comparisons against persistence.

Models are fit only on the training period. Validation chooses which feature
set is the candidate. The test period is reported after that choice.
No traffic, industry, dust, or synthetic weather is added.
"""

from __future__ import annotations

import sys
from pathlib import Path

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
    MODEL_DATASET_PATH,
    MODEL_FIG_DIR,
    TIME_FEATURES,
    ensure_dirs,
    fmt_metric,
    regression_scores,
    write_json,
)
from train_model import assign_split

HORIZONS = (1, 6, 12, 24)
MET_USED = ["humidity", "wind_speed", "wind_direction"]
CLOCK = ["hour", "day_of_week", "is_weekend", "target_hour", "target_day_of_week", "target_is_weekend"]
SEASON = ["day_of_year", "month", "target_month"]
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


def load_base() -> pd.DataFrame:
    frame = pd.read_parquet(MODEL_DATASET_PATH)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    return frame.sort_values(["station_id", "timestamp"]).reset_index(drop=True)


def with_horizon(frame: pd.DataFrame, horizon: int) -> pd.DataFrame:
    pieces = []
    for _, group in frame.groupby("station_id", sort=False):
        group = group.sort_values("timestamp").copy()
        group["y"] = group["pm25"].shift(-horizon)
        target_ts = group["timestamp"] + pd.Timedelta(hours=horizon)
        group["target_timestamp"] = target_ts
        group["target_hour"] = target_ts.dt.hour
        group["target_day_of_week"] = target_ts.dt.dayofweek
        group["target_month"] = target_ts.dt.month
        group["target_is_weekend"] = target_ts.dt.dayofweek >= 5
        pieces.append(group)
    built = pd.concat(pieces, ignore_index=True)
    built = built.dropna(subset=["pm25", "y"]).copy()
    built, info = assign_split(built)
    info["horizon_hours"] = horizon
    return built, info


def matrix(frame: pd.DataFrame, columns: list[str], station_columns: list[str] | None) -> pd.DataFrame:
    base = frame[columns].astype(float).reset_index(drop=True)
    if not station_columns:
        return base
    dummies = pd.get_dummies(frame["station_id"].astype(str), prefix="station")
    dummies = dummies.reindex(columns=station_columns, fill_value=0).astype(float)
    dummies = dummies.reset_index(drop=True)
    return pd.concat([base, dummies], axis=1)


def fit_model(train: pd.DataFrame, columns: list[str], station_columns: list[str] | None) -> XGBRegressor:
    model = XGBRegressor(**PARAMS)
    model.fit(matrix(train, columns, station_columns), train["y"].to_numpy(), verbose=False)
    return model


def predict(model: XGBRegressor, frame: pd.DataFrame, columns: list[str], station_columns: list[str] | None) -> np.ndarray:
    return model.predict(matrix(frame, columns, station_columns))


def pack(name: str, y_true, y_pred, frame: pd.DataFrame) -> dict:
    scores = regression_scores(y_true, y_pred)
    scored = frame.copy()
    scored["pred"] = y_pred
    by_station = []
    for (station_id, station_name), group in scored.groupby(["station_id", "station_name"]):
        by_station.append(
            {
                "station_id": str(station_id),
                "station_name": str(station_name),
                **regression_scores(group["y"], group["pred"]),
            }
        )
    by_month = []
    scored["year_month"] = scored["timestamp"].dt.strftime("%Y-%m")
    for month, group in scored.groupby("year_month"):
        by_month.append({"month": str(month), **regression_scores(group["y"], group["pred"])})
    return {"model": name, **scores, "by_station": by_station, "by_month": by_month}


def feature_sets(station_columns: list[str]) -> list[tuple[str, list[str], list[str] | None]]:
    lags = ["pm25", *LAG_COLUMNS]
    calendar = list(TIME_FEATURES) + ["target_hour", "target_day_of_week", "target_month", "target_is_weekend"]
    return [
        ("B_lags", lags, None),
        ("C_lags_calendar", lags + calendar, None),
        ("C1_lags_clock", lags + CLOCK, None),
        ("C2_lags_season", lags + SEASON, None),
        ("D_lags_calendar_met", lags + calendar + MET_USED, None),
        ("E_current_v1", lags + calendar + MET_USED, station_columns),
    ]


def run_feature_grid(split: pd.DataFrame) -> list[dict]:
    train = split.loc[split["split"] == "train"]
    val = split.loc[split["split"] == "val"]
    test = split.loc[split["split"] == "test"]
    station_columns = [f"station_{value}" for value in sorted(train["station_id"].astype(str).unique())]
    results = []
    persistence_val = pack("A_persistence", val["y"], val["pm25"], val)
    persistence_test = pack("A_persistence", test["y"], test["pm25"], test)
    results.append({"model": "A_persistence", "features": ["pm25 at T"], "val": persistence_val, "test": persistence_test})
    for name, columns, stations in feature_sets(station_columns):
        print(f"fit {name}")
        model = fit_model(train, columns, stations)
        pred_val = predict(model, val, columns, stations)
        pred_test = predict(model, test, columns, stations)
        results.append(
            {
                "model": name,
                "features": columns + (stations or []),
                "val": pack(name, val["y"], pred_val, val),
                "test": pack(name, test["y"], pred_test, test),
            }
        )
    return results


def run_horizons(base: pd.DataFrame, feature_name: str, columns: list[str]) -> list[dict]:
    rows = []
    for horizon in HORIZONS:
        print(f"horizon {horizon}h")
        split, info = with_horizon(base, horizon)
        train = split.loc[split["split"] == "train"]
        test = split.loc[split["split"] == "test"]
        val = split.loc[split["split"] == "val"]
        model = fit_model(train, columns, None)
        pred_test = predict(model, test, columns, None)
        pred_val = predict(model, val, columns, None)
        y_test = test["y"].to_numpy()
        corr = float(np.corrcoef(test["pm25"], y_test)[0, 1])
        rows.append(
            {
                "horizon": horizon,
                "feature_set": feature_name,
                "n_test": int(len(test)),
                "corr_pm25_t_and_target": corr,
                "persistence_test": regression_scores(y_test, test["pm25"]),
                "model_test": regression_scores(y_test, pred_test),
                "persistence_val": regression_scores(val["y"], val["pm25"]),
                "model_val": regression_scores(val["y"], pred_val),
                "split_counts": info["counts"],
            }
        )
    return rows


def run_station_strategies(split: pd.DataFrame, columns: list[str]) -> dict:
    train = split.loc[split["split"] == "train"]
    val = split.loc[split["split"] == "val"]
    test = split.loc[split["split"] == "test"]
    station_columns = [f"station_{value}" for value in sorted(train["station_id"].astype(str).unique())]

    def both(stations):
        model = fit_model(train, columns, stations)
        return {
            "val": pack("tmp", val["y"], predict(model, val, columns, stations), val),
            "test": pack("tmp", test["y"], predict(model, test, columns, stations), test),
        }

    print("strategy global without station id")
    global_plain = both(None)
    print("strategy global with station id")
    global_id = both(station_columns)

    print("strategy per station")
    val_parts = []
    test_parts = []
    notes = []
    for station_id, train_g in train.groupby("station_id"):
        name = str(train_g["station_name"].iloc[0])
        val_g = val.loc[val["station_id"] == station_id]
        test_g = test.loc[test["station_id"] == station_id]
        if len(train_g) < 1500 or len(test_g) < 200:
            notes.append(f"{name}: skipped (train {len(train_g)}, test {len(test_g)}).")
            continue
        model = fit_model(train_g, columns, None)
        pred_val = predict(model, val_g, columns, None)
        pred_test = predict(model, test_g, columns, None)
        val_g = val_g.copy()
        test_g = test_g.copy()
        val_g["pred"] = pred_val
        test_g["pred"] = pred_test
        val_parts.append(val_g)
        test_parts.append(test_g)
        notes.append(f"{name}: trained on {len(train_g)} rows, tested on {len(test_g)}.")
    val_all = pd.concat(val_parts, ignore_index=True)
    test_all = pd.concat(test_parts, ignore_index=True)
    per_station = {
        "val": pack("per_station", val_all["y"], val_all["pred"], val_all),
        "test": pack("per_station", test_all["y"], test_all["pred"], test_all),
        "notes": notes,
    }
    return {
        "global_no_station_id": global_plain,
        "global_with_station_id": global_id,
        "per_station": per_station,
    }


def choose_feature_set(results: list[dict]) -> dict:
    """Pick the lowest validation MAE among B, C, C1, C2, D. Persistence is the bar, not a feature set."""
    candidates = [row for row in results if row["model"] != "A_persistence" and row["model"] != "E_current_v1"]
    return min(candidates, key=lambda row: row["val"]["mae"])


def save_plots(results: list[dict], horizons: list[dict], strategies: dict) -> list[str]:
    MODEL_FIG_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    labels = [row["model"] for row in results]
    maes = [row["test"]["mae"] for row in results]
    fig, ax = plt.subplots(figsize=(10, 4.5))
    ax.bar(labels, maes)
    ax.set_ylabel("Test MAE (ug/m3)")
    ax.set_title("24h test MAE")
    ax.tick_params(axis="x", rotation=30)
    fig.tight_layout()
    path = MODEL_FIG_DIR / "diagnostics_24h_mae.png"
    fig.savefig(path, dpi=120)
    plt.close(fig)
    written.append(str(path))

    fig, ax = plt.subplots(figsize=(7, 4))
    x = np.arange(len(horizons))
    width = 0.35
    ax.bar(x - width / 2, [row["persistence_test"]["mae"] for row in horizons], width, label="Persistence")
    ax.bar(x + width / 2, [row["model_test"]["mae"] for row in horizons], width, label="Chosen XGBoost")
    ax.set_xticks(x, [f"+{row['horizon']}h" for row in horizons])
    ax.set_ylabel("Test MAE (ug/m3)")
    ax.set_title("Persistence vs XGBoost by horizon")
    ax.legend()
    fig.tight_layout()
    path = MODEL_FIG_DIR / "diagnostics_horizon_mae.png"
    fig.savefig(path, dpi=120)
    plt.close(fig)
    written.append(str(path))

    names = ["global, no station id", "global + station id", "separate model per station"]
    keys = ["global_no_station_id", "global_with_station_id", "per_station"]
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(names, [strategies[key]["test"]["mae"] for key in keys])
    ax.set_ylabel("Test MAE (ug/m3)")
    ax.set_title("Station strategy, test MAE")
    ax.tick_params(axis="x", rotation=15)
    fig.tight_layout()
    path = MODEL_FIG_DIR / "diagnostics_station_strategy_mae.png"
    fig.savefig(path, dpi=120)
    plt.close(fig)
    written.append(str(path))
    return written


def metric_row(label: str, block: dict) -> str:
    return (
        f"| {label} | {block['n']} | {fmt_metric(block['mae'])} | "
        f"{fmt_metric(block['rmse'])} | {fmt_metric(block['r2'], 3)} |"
    )


def write_docs(results, horizons, strategies, chosen, plots) -> None:
    by_name = {row["model"]: row for row in results}
    persist = by_name["A_persistence"]["test"]
    lines = [
        "# Model diagnostics",
        "",
        "Question: why the saved V1 XGBoost (test MAE 15.28 µg/m³) lost to 24-hour persistence (test MAE 12.76 µg/m³).",
        "",
        "All fits use the same chronological cuts as the saved model: training labels end before 2025-01-01, validation labels end before 2025-07-01, test issues start at 2025-07-01. Rows need observed PM2.5 at T and at the target hour. Hyperparameters match the saved V1 fit and were not tuned on the test set.",
        "",
        "The candidate feature set is the one with the lowest validation MAE among B, C, C1, C2, and D. Test numbers are reported after that choice.",
        "",
        "## 24-hour results",
        "",
        "| Model | What it uses | Val MAE | Test MAE | Test RMSE | Test R² |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    descriptions = {
        "A_persistence": "PM2.5(T+24h) = PM2.5(T)",
        "B_lags": "XGBoost, PM2.5 now and lags only",
        "C_lags_calendar": "lags + full calendar",
        "C1_lags_clock": "lags + hour and weekday",
        "C2_lags_season": "lags + day-of-year and month",
        "D_lags_calendar_met": "lags + calendar + RH, WS, WD",
        "E_current_v1": "lags + calendar + RH, WS, WD + station id (the saved V1 recipe)",
    }
    for row in results:
        block = row["test"]
        lines.append(
            f"| {row['model']} | {descriptions[row['model']]} | {fmt_metric(row['val']['mae'])} | "
            f"{fmt_metric(block['mae'])} | {fmt_metric(block['rmse'])} | {fmt_metric(block['r2'], 3)} |"
        )
    lines.append("")
    lines.append(f"Validation choice: `{chosen['model']}` with validation MAE {fmt_metric(chosen['val']['mae'])}.")
    lines.append("")
    lines.append("## What helped and what hurt")
    lines.append("")
    b = by_name["B_lags"]
    c = by_name["C_lags_calendar"]
    c1 = by_name["C1_lags_clock"]
    c2 = by_name["C2_lags_season"]
    d = by_name["D_lags_calendar_met"]
    e = by_name["E_current_v1"]
    lines.append(
        f"- Persistence test MAE is {fmt_metric(persist['mae'])}. "
        f"Lags-only test MAE is {fmt_metric(b['test']['mae'])} "
        f"(validation {fmt_metric(b['val']['mae'])})."
    )
    lines.append(
        f"- Adding the full calendar moves test MAE from {fmt_metric(b['test']['mae'])} to {fmt_metric(c['test']['mae'])}."
    )
    lines.append(
        f"- Clock features alone (C1) test MAE {fmt_metric(c1['test']['mae'])}. "
        f"Seasonal features alone (C2) test MAE {fmt_metric(c2['test']['mae'])}."
    )
    lines.append(
        f"- Adding Karve Road humidity and wind (D) moves test MAE from {fmt_metric(c['test']['mae'])} to {fmt_metric(d['test']['mae'])}. "
        "Those fields are missing for every test row, because Karve Road has no PM2.5 in the test window."
    )
    lines.append(
        f"- The saved V1 recipe (E) test MAE is {fmt_metric(e['test']['mae'])}. "
        "That is the refit of lags, calendar, sparse weather, and station id."
    )
    lines.append("")
    lines.append("## Test MAE by station")
    lines.append("")
    station_names = [row["station_name"] for row in persist["by_station"]]
    header = "| Station | " + " | ".join(row["model"] for row in results) + " |"
    sep = "| --- | " + " | ".join("---" for _ in results) + " |"
    lines.append(header)
    lines.append(sep)
    for station_name in station_names:
        cells = [station_name]
        for row in results:
            match = next(item for item in row["test"]["by_station"] if item["station_name"] == station_name)
            cells.append(fmt_metric(match["mae"]))
        lines.append("| " + " | ".join(cells) + " |")
    lines.append("")
    lines.append("## Test MAE by month")
    lines.append("")
    months = [row["month"] for row in persist["by_month"]]
    lines.append(header.replace("Station", "Month"))
    lines.append(sep)
    for month in months:
        cells = [month]
        for row in results:
            match = next(item for item in row["test"]["by_month"] if item["month"] == month)
            cells.append(fmt_metric(match["mae"]))
        lines.append("| " + " | ".join(cells) + " |")
    lines.append("")
    lines.append("## Station strategies")
    lines.append("")
    lines.append(
        f"These three fits use the validation-chosen feature columns (`{chosen['model']}`), not the weather columns, so the comparison is about station structure."
    )
    lines.append("")
    lines.append("| Strategy | Val n | Val MAE | Test n | Test MAE | Test RMSE | Test R² |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- |")
    for label, key in (
        ("Global, no station id", "global_no_station_id"),
        ("Global + station id", "global_with_station_id"),
        ("Separate model per station", "per_station"),
    ):
        block = strategies[key]
        lines.append(
            f"| {label} | {block['val']['n']} | {fmt_metric(block['val']['mae'])} | {block['test']['n']} | "
            f"{fmt_metric(block['test']['mae'])} | {fmt_metric(block['test']['rmse'])} | {fmt_metric(block['test']['r2'], 3)} |"
        )
    lines.append("")
    lines.append("Per-station fit notes:")
    lines.append("")
    for note in strategies["per_station"]["notes"]:
        lines.append(f"- {note}")
    lines.append("")
    lines.append("### Per-station test MAE")
    lines.append("")
    lines.append("| Station | Global, no id | Global + id | Separate model | Persistence |")
    lines.append("| --- | --- | --- | --- | --- |")
    per_map = {row["station_name"]: row for row in strategies["per_station"]["test"]["by_station"]}
    glob_map = {row["station_name"]: row for row in strategies["global_no_station_id"]["test"]["by_station"]}
    id_map = {row["station_name"]: row for row in strategies["global_with_station_id"]["test"]["by_station"]}
    pers_map = {row["station_name"]: row for row in persist["by_station"]}
    for station_name in station_names:
        per_mae = fmt_metric(per_map[station_name]["mae"]) if station_name in per_map else "not fit"
        lines.append(
            f"| {station_name} | {fmt_metric(glob_map[station_name]['mae'])} | "
            f"{fmt_metric(id_map[station_name]['mae'])} | {per_mae} | {fmt_metric(pers_map[station_name]['mae'])} |"
        )
    lines.append("")
    lines.append("## Plots")
    lines.append("")
    for plot in plots:
        lines.append(f"- `{plot}`")
    lines.append("")
    (DOCS_DIR / "model_diagnostics.md").write_text("\n".join(lines), encoding="utf-8")

    hlines = [
        "# Forecast horizon analysis",
        "",
        f"Feature set: `{horizons[0]['feature_set']}`, chosen by 24-hour validation MAE among the lags/calendar/weather ablations. Persistence is recomputed at every horizon as PM2.5(T+h) = PM2.5(T).",
        "",
        "The product still needs a 24–48 hour forecast. This table only shows how error grows with the horizon. A shorter horizon is not a substitute for the 24-hour product target.",
        "",
        "| Horizon | Test rows | Corr(PM2.5 at T, PM2.5 at T+h) | Persistence MAE | XGBoost MAE | Persistence RMSE | XGBoost RMSE | Persistence R² | XGBoost R² |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for row in horizons:
        p = row["persistence_test"]
        m = row["model_test"]
        hlines.append(
            f"| +{row['horizon']}h | {row['n_test']} | {fmt_metric(row['corr_pm25_t_and_target'], 3)} | "
            f"{fmt_metric(p['mae'])} | {fmt_metric(m['mae'])} | {fmt_metric(p['rmse'])} | {fmt_metric(m['rmse'])} | "
            f"{fmt_metric(p['r2'], 3)} | {fmt_metric(m['r2'], 3)} |"
        )
    hlines.append("")
    hlines.append("Validation MAE, same feature set:")
    hlines.append("")
    hlines.append("| Horizon | Persistence MAE | XGBoost MAE |")
    hlines.append("| --- | --- | --- |")
    for row in horizons:
        hlines.append(
            f"| +{row['horizon']}h | {fmt_metric(row['persistence_val']['mae'])} | {fmt_metric(row['model_val']['mae'])} |"
        )
    hlines.append("")
    hlines.append("Split counts differ slightly by horizon because a row is kept only when the target hour exists, and training labels must end before the validation cut.")
    hlines.append("")
    (DOCS_DIR / "forecast_horizon_analysis.md").write_text("\n".join(hlines), encoding="utf-8")


def main() -> int:
    ensure_dirs()
    base = load_base()
    split_24, info = with_horizon(base, 24)
    print("24h split", info["counts"])
    results = run_feature_grid(split_24)
    chosen = choose_feature_set(results)
    print("chosen", chosen["model"], "val MAE", round(chosen["val"]["mae"], 3))
    chosen_columns = [c for c in chosen["features"] if not str(c).startswith("station_")]
    horizons = run_horizons(base, chosen["model"], chosen_columns)
    strategies = run_station_strategies(split_24, chosen_columns)
    plots = save_plots(results, horizons, strategies)
    payload = {
        "split_24": info,
        "results": results,
        "chosen_model": chosen["model"],
        "horizons": horizons,
        "strategies": {
            key: {k: v for k, v in value.items() if k != "notes"}
            | ({"notes": value["notes"]} if "notes" in value else {})
            for key, value in strategies.items()
        },
        "plots": plots,
    }
    write_json(MODEL_FIG_DIR.parent / "diagnostics_metrics.json", payload)
    write_docs(results, horizons, strategies, chosen, plots)
    print("wrote diagnostics docs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
