"""Shared paths and column rules for the real CPCB/OpenCity pipeline."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw" / "air_quality"
PROCESSED_DIR = ROOT / "data" / "processed"
DOCS_DIR = ROOT / "docs"
FIG_DIR = DOCS_DIR / "figures"
MODEL_DIR = ROOT / "ml" / "models"
MODEL_FIG_DIR = MODEL_DIR / "figures"

HOURLY_PATH = PROCESSED_DIR / "air_quality_hourly.parquet"
MODEL_DATASET_PATH = PROCESSED_DIR / "model_dataset.parquet"
PIPELINE_SUMMARY_PATH = PROCESSED_DIR / "pipeline_summary.json"
METADATA_PATH = RAW_DIR / "download_metadata.json"
METRICS_PATH = MODEL_DIR / "model_metrics.json"
FEATURE_META_PATH = MODEL_DIR / "feature_metadata.json"
MODEL_PATH = MODEL_DIR / "pm25_xgb_24h.pkl"
BACKTEST_PATH = PROCESSED_DIR / "backtest_predictions.csv"

SOURCE_DATASET_URL = "https://data.opencity.in/dataset/pune-hourly-air-quality-reports"
# Frozen in docs/timestamp_semantics.md. Do not shift these timestamps to IST.
CLOCK_TREATMENT = "published_+0000"
SOURCE_PAGE_NOTE = (
    "OpenCity republishes CPCB station files from airquality.cpcb.gov.in."
)

SHAP_DISCLAIMER = (
    "This represents the contribution of model features to the prediction "
    "and is not direct causal source apportionment."
)

# Issued at time T, predict PM2.5 at T+24h.
HORIZON_HOURS = 24
LEAKAGE_BUFFER_HOURS = 24

LAG_HOURS = (1, 2, 3, 6, 12, 24, 48, 72)
LAG_COLUMNS = [f"pm25_lag_{h}" for h in LAG_HOURS]

TIME_FEATURES = ["hour", "day_of_week", "day_of_year", "month", "is_weekend"]
# Calendar of the target hour is known when the forecast is issued.
TARGET_CALENDAR = [
    "target_hour",
    "target_day_of_week",
    "target_month",
    "target_is_weekend",
]
MET_FEATURES = [
    "temperature",
    "humidity",
    "wind_speed",
    "wind_direction",
    "rainfall",
    "solar_radiation",
    "pressure",
]
# A meteorology column enters V1 only when at least this share of training
# rows has a real observation. Below that it stays in the dataset as missing
# data and is not used as a model input.
MET_MIN_TRAIN_COVERAGE = 0.20

# Fixed calendar cuts, used only when the labelled series actually covers them.
# The 2017-2023 OpenCity files are not labelled PM2.5, so they cannot support
# a 2017-2021 / 2022 / 2023 split.
DEFAULT_VAL_START = "2025-01-01T00:00:00Z"
DEFAULT_TEST_START = "2025-07-01T00:00:00Z"


def ensure_dirs() -> None:
    for path in (RAW_DIR, PROCESSED_DIR, DOCS_DIR, FIG_DIR, MODEL_DIR, MODEL_FIG_DIR):
        path.mkdir(parents=True, exist_ok=True)


def canon_column(name: str) -> str | None:
    """Map a CPCB header onto a stable name. Unknown columns are dropped."""
    n = name.replace("\ufeff", "").strip().lower()
    n = n.replace("µ", "u").replace("μ", "u")
    if n.startswith("station id"):
        return "station_id"
    if n.startswith("station name"):
        return "station_name"
    if n.startswith("timestamp"):
        return "timestamp"
    if n.startswith("pm2.5"):
        return "pm25"
    if n.startswith("pm10"):
        return "pm10"
    if n.startswith("no2"):
        return "no2"
    if n.startswith("nox"):
        return "nox"
    if n == "no" or n.startswith("no ") or n.startswith("no("):
        return "no"
    if n.startswith("nh3"):
        return "nh3"
    if n.startswith("so2"):
        return "so2"
    if n == "co" or n.startswith("co ") or n.startswith("co("):
        return "co"
    if n.startswith("ozone"):
        return "ozone"
    if n.startswith("benzene") and "eth" not in n.split("(")[0]:
        return "benzene"
    if n.startswith("toluene"):
        return "toluene"
    if n.startswith("xylene"):
        return "xylene"
    if n == "at" or n.startswith("at ") or n.startswith("at("):
        return "temperature"
    if n == "rh" or n.startswith("rh ") or n.startswith("rh("):
        return "humidity"
    if n == "ws" or n.startswith("ws ") or n.startswith("ws("):
        return "wind_speed"
    if n == "wd" or n.startswith("wd ") or n.startswith("wd("):
        return "wind_direction"
    if n.startswith("tot-rf") or n.startswith("tot_rf"):
        return "total_rainfall"
    if n == "rf" or n.startswith("rf ") or n.startswith("rf("):
        return "rainfall"
    if n == "sr" or n.startswith("sr ") or n.startswith("sr("):
        return "solar_radiation"
    if n == "bp" or n.startswith("bp ") or n.startswith("bp("):
        return "pressure"
    if n.startswith("vws"):
        return "vertical_wind_speed"
    return None


def is_labelled_long_csv(path: Path) -> bool:
    """True only when the header carries a timestamp and a PM2.5 field."""
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        header = handle.readline().lower()
    return "timestamp" in header and "pm2.5" in header


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=_json_default), encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _json_default(value):
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if np.isnan(value):
            return None
        return float(value)
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    raise TypeError(f"Not JSON serializable: {type(value)!r}")


def regression_scores(y_true, y_pred) -> dict:
    y = np.asarray(y_true, dtype=float)
    p = np.asarray(y_pred, dtype=float)
    err = p - y
    ss_res = float(np.sum(err**2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r2 = None if ss_tot == 0 else 1.0 - ss_res / ss_tot
    return {
        "n": int(y.size),
        "mae": float(np.mean(np.abs(err))),
        "rmse": float(np.sqrt(np.mean(err**2))),
        "r2": None if r2 is None else float(r2),
    }


def fmt_metric(value, digits: int = 2) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "n/a"
    return f"{value:.{digits}f}"
