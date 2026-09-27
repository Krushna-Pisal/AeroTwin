"""Clean labelled 15-minute CPCB files into an hourly modeling table.

Wide 2017-2023 matrices are ignored. Missing PM2.5 is not filled in.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aq_common import (
    DOCS_DIR,
    HORIZON_HOURS,
    HOURLY_PATH,
    LAG_HOURS,
    MODEL_DATASET_PATH,
    PIPELINE_SUMMARY_PATH,
    RAW_DIR,
    SOURCE_DATASET_URL,
    canon_column,
    ensure_dirs,
    is_labelled_long_csv,
    write_json,
)

POLLUTANT_COLUMNS = [
    "pm25",
    "pm10",
    "no",
    "no2",
    "nox",
    "nh3",
    "so2",
    "co",
    "ozone",
    "benzene",
    "toluene",
    "xylene",
]
MEAN_COLUMNS = POLLUTANT_COLUMNS + [
    "temperature",
    "humidity",
    "wind_speed",
    "solar_radiation",
    "pressure",
    "vertical_wind_speed",
]
# Instrument-sentinel screens. Values outside these bounds become NaN.
# They are not replaced with a substitute number.
BOUNDS = {
    "pm25": (0, 5000),
    "pm10": (0, 5000),
    "no": (0, 5000),
    "no2": (0, 5000),
    "nox": (0, 5000),
    "nh3": (0, 5000),
    "so2": (0, 5000),
    "co": (0, 100),
    "ozone": (0, 5000),
    "benzene": (0, 5000),
    "toluene": (0, 5000),
    "xylene": (0, 5000),
    "temperature": (-20, 60),
    "humidity": (0, 100),
    "wind_speed": (0, 25),
    "wind_direction": (0, 360),
    "rainfall": (0, 500),
    "total_rainfall": (0, 5000),
    "solar_radiation": (0, 2000),
    "pressure": (0, 1200),
    "vertical_wind_speed": (-20, 20),
}


def load_labelled_files() -> tuple[pd.DataFrame, list[str], list[str]]:
    used, skipped = [], []
    frames = []
    for path in sorted(RAW_DIR.glob("*.csv")):
        if not is_labelled_long_csv(path):
            skipped.append(path.name)
            continue
        frame = pd.read_csv(path, encoding="utf-8", encoding_errors="replace", low_memory=False)
        rename = {}
        for column in frame.columns:
            canon = canon_column(str(column))
            if canon and canon not in rename.values():
                rename[column] = canon
        frame = frame.rename(columns=rename)
        if "timestamp" not in frame.columns or "pm25" not in frame.columns:
            skipped.append(path.name)
            continue
        keep = [c for c in frame.columns if c in rename.values()]
        frame = frame.loc[:, keep].copy()
        frame["source_file"] = path.name
        frames.append(frame)
        used.append(path.name)
    if not frames:
        raise SystemExit(f"No labelled PM2.5 CSVs in {RAW_DIR}")
    return pd.concat(frames, ignore_index=True), used, skipped


def apply_bounds(frame: pd.DataFrame) -> dict[str, int]:
    removed = {}
    for column, (low, high) in BOUNDS.items():
        if column not in frame.columns:
            continue
        series = frame[column]
        bad = series.notna() & ((series < low) | (series > high))
        removed[column] = int(bad.sum())
        if bad.any():
            frame.loc[bad, column] = np.nan
    return removed


def aggregate_station(group: pd.DataFrame) -> pd.DataFrame:
    group = group.sort_index()
    if group.index.has_duplicates:
        group = group[~group.index.duplicated(keep="first")]

    mean_cols = [c for c in MEAN_COLUMNS if c in group.columns]
    hourly = group[mean_cols].resample("h", label="left", closed="left").mean()

    if "rainfall" in group.columns:
        hourly["rainfall"] = group["rainfall"].resample("h", label="left", closed="left").sum(min_count=1)
    if "wind_direction" in group.columns:
        radians = np.deg2rad(group["wind_direction"])
        sin_mean = np.sin(radians).resample("h", label="left", closed="left").mean()
        cos_mean = np.cos(radians).resample("h", label="left", closed="left").mean()
        direction = (np.rad2deg(np.arctan2(sin_mean, cos_mean)) + 360) % 360
        hourly["wind_direction"] = direction.where(sin_mean.notna() & cos_mean.notna())
    if "total_rainfall" in group.columns:
        hourly["total_rainfall"] = (
            group["total_rainfall"].resample("h", label="left", closed="left").apply(_last_valid)
        )
    hourly["pm25_obs_count"] = group["pm25"].resample("h", label="left", closed="left").count()
    return hourly


def _last_valid(values: pd.Series):
    valid = values.dropna()
    if valid.empty:
        return np.nan
    return valid.iloc[-1]


def build_hourly(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    notes = {
        "rows_in": int(len(raw)),
        "timestamps_unparsed": 0,
        "exact_duplicate_rows_removed": 0,
        "conflicting_timestamp_rows_removed": 0,
    }
    frame = raw.copy()
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, errors="coerce")
    notes["timestamps_unparsed"] = int(frame["timestamp"].isna().sum())
    frame = frame.dropna(subset=["timestamp", "station_id"])
    site_mask = frame["station_id"].astype(str).str.startswith("site_")
    notes["non_site_rows_removed"] = int((~site_mask).sum())
    frame = frame.loc[site_mask].copy()

    for column in frame.columns:
        if column in {"station_id", "station_name", "timestamp", "source_file"}:
            continue
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    notes["bounds_set_to_nan"] = apply_bounds(frame)

    before = len(frame)
    frame = frame.drop_duplicates()
    notes["exact_duplicate_rows_removed"] = before - len(frame)

    frame = frame.sort_values(["station_id", "timestamp", "source_file"])
    key = ["station_id", "timestamp"]
    conflict = frame.duplicated(key, keep=False)
    notes["conflicting_timestamp_rows"] = int(conflict.sum())
    before = len(frame)
    frame = frame.drop_duplicates(key, keep="first")
    notes["conflicting_timestamp_rows_removed"] = before - len(frame)

    parts = []
    for station_id, group in frame.groupby("station_id", sort=True):
        names = group["station_name"].dropna()
        station_name = str(names.iloc[0]) if not names.empty else str(station_id)
        indexed = group.set_index("timestamp").sort_index()
        hourly = aggregate_station(indexed)
        hourly["station_id"] = station_id
        hourly["station_name"] = station_name
        parts.append(hourly.reset_index())

    hourly = pd.concat(parts, ignore_index=True)
    for column in (
        "pm25",
        "temperature",
        "humidity",
        "wind_speed",
        "wind_direction",
        "rainfall",
        "solar_radiation",
        "pressure",
    ):
        if column not in hourly.columns:
            hourly[column] = np.nan
    hourly["source_resolution"] = "15min_mean_to_hourly"
    hourly["data_origin"] = "observed_cpcb"
    hourly = hourly.sort_values(["station_id", "timestamp"]).reset_index(drop=True)
    notes["hourly_rows"] = int(len(hourly))
    notes["hourly_pm25_non_null"] = int(hourly["pm25"].notna().sum())
    return hourly, notes


def add_model_columns(hourly: pd.DataFrame) -> pd.DataFrame:
    pieces = []
    for _, group in hourly.groupby("station_id", sort=False):
        group = group.sort_values("timestamp").copy()
        # Index is already a regular hourly grid from resample, including empty hours.
        for lag in LAG_HOURS:
            group[f"pm25_lag_{lag}"] = group["pm25"].shift(lag)
        group["target_pm25_24h"] = group["pm25"].shift(-HORIZON_HOURS)
        group["target_timestamp"] = group["timestamp"] + pd.Timedelta(hours=HORIZON_HOURS)
        stamps = group["timestamp"]
        group["hour"] = stamps.dt.hour
        group["day_of_week"] = stamps.dt.dayofweek
        group["day_of_year"] = stamps.dt.dayofyear
        group["month"] = stamps.dt.month
        group["is_weekend"] = stamps.dt.dayofweek >= 5
        target = group["target_timestamp"]
        group["target_hour"] = target.dt.hour
        group["target_day_of_week"] = target.dt.dayofweek
        group["target_month"] = target.dt.month
        group["target_is_weekend"] = target.dt.dayofweek >= 5
        pieces.append(group)
    model = pd.concat(pieces, ignore_index=True)
    _assert_lag_alignment(model)
    return model


def _assert_lag_alignment(model: pd.DataFrame) -> None:
    station_id = model["station_id"].iloc[0]
    sample = model.loc[model["station_id"] == station_id].sort_values("timestamp")
    if len(sample) < 80:
        return
    lag = sample["pm25_lag_1"].to_numpy()[1:80]
    prev = sample["pm25"].to_numpy()[0:79]
    if not np.allclose(lag, prev, equal_nan=True):
        raise SystemExit("Lag alignment check failed for pm25_lag_1")
    ahead = sample["target_pm25_24h"].to_numpy()[:-24]
    future = sample["pm25"].to_numpy()[24:]
    if not np.allclose(ahead[:80], future[:80], equal_nan=True):
        raise SystemExit("Target alignment check failed for T+24")


def coverage(series: pd.Series) -> float:
    if len(series) == 0:
        return 0.0
    return float(series.notna().mean())


def write_cleaning_doc(used: list[str], skipped: list[str], notes: dict, hourly: pd.DataFrame) -> None:
    met_cols = [
        "temperature",
        "humidity",
        "wind_speed",
        "wind_direction",
        "rainfall",
        "solar_radiation",
        "pressure",
    ]
    lines = [
        "# Cleaning decisions",
        "",
        f"Source: {SOURCE_DATASET_URL}",
        "",
        "Input: labelled 15-minute CPCB CSVs in `data/raw/air_quality/`.",
        "Output: `data/processed/air_quality_hourly.parquet` and `data/processed/model_dataset.parquet`.",
        "",
        "## Files used",
        "",
    ]
    for name in used:
        lines.append(f"- `{name}`")
    lines.append("")
    lines.append("## Files skipped")
    lines.append("")
    lines.append("Skipped files do not have both a timestamp column and a PM2.5 column. Their cells are not converted into PM2.5.")
    lines.append("")
    for name in skipped:
        lines.append(f"- `{name}`")
    lines.append("")
    lines.append("## Decisions")
    lines.append("")
    lines.append("1. Timestamps are parsed with the offset published in the file (`+0000`). They are stored as timezone-aware UTC. They are not shifted to IST, because the file does not say the clock is IST.")
    lines.append("2. Rows are sorted by station and timestamp.")
    lines.append(f"3. Exact duplicate rows removed: {notes['exact_duplicate_rows_removed']}.")
    lines.append(f"4. Unparseable timestamps dropped: {notes['timestamps_unparsed']}.")
    lines.append("5. Numeric columns are coerced with `to_numeric`. Non-numeric tokens become NaN. Nothing is put in their place.")
    lines.append("6. Values outside the sentinel bounds below are set to NaN and counted. They are not replaced with a typical value. Wind speed above 25 m/s is treated as an implausible spike for these Pune stations.")
    lines.append(f"4b. Rows whose station id does not start with `site_` removed: {notes.get('non_site_rows_removed', 0)}. These were malformed file footers, not stations.")
    lines.append("7. PM2.5 is not forward-filled and not interpolated. A missing hour stays missing.")
    lines.append("8. When two rows share a station and timestamp but are not exact duplicates, the first after sorting by source file is kept. The extra rows are dropped, not averaged.")
    lines.append(f"   Conflicting key rows seen: {notes['conflicting_timestamp_rows']}. Extra rows removed: {notes['conflicting_timestamp_rows_removed']}.")
    lines.append("9. Each station is placed on a regular hourly grid from its first to its last timestamp. Hours inside that span with no 15-minute sample remain, with PM2.5 left as NaN, so lags cannot skip a gap and pretend it was the previous hour.")
    lines.append("10. Hourly bin: left-labelled, left-closed. Samples at 00:00, 00:15, 00:30, and 00:45 belong to the hour starting at 00:00.")
    lines.append("11. PM2.5, other pollutants, temperature, humidity, wind speed, solar radiation, pressure, and vertical wind speed use the hourly mean of the valid 15-minute samples. If a hour has no valid sample, the hourly value is NaN, not zero.")
    lines.append("12. Rainfall (RF) uses the hourly sum. A hour with no rainfall samples is NaN, not 0. A recorded 0 stays 0.")
    lines.append("13. Total rainfall (TOT-RF) uses the last valid 15-minute value in the hour. It is not summed, because the field is cumulative on many CPCB exports.")
    lines.append("14. Wind direction uses the circular mean: the direction of the mean sine and cosine. Arithmetic averaging of degrees is not used. A hour with no wind-direction samples is NaN.")
    lines.append("15. `pm25_obs_count` is how many valid 15-minute PM2.5 samples fell in that hour. It is kept for audit and is not a model feature in V1.")
    lines.append("16. Lag features are shifts on that hourly grid: `pm25_lag_k` is PM2.5 at T-k hours. `target_pm25_24h` is PM2.5 at T+24 hours. The target column is not a feature.")
    lines.append("17. Calendar fields `hour`, `day_of_week`, `day_of_year`, `month`, and `is_weekend` are taken from timestamp T in the published UTC offset. `target_hour`, `target_day_of_week`, `target_month`, and `target_is_weekend` are the calendar of T+24h, which is known when the forecast is issued.")
    lines.append("18. No traffic, industrial, or dust values are created.")
    lines.append("")
    lines.append("## Sentinel bounds set to NaN")
    lines.append("")
    lines.append("| column | lower | upper | cells set to NaN |")
    lines.append("| --- | --- | --- | --- |")
    for column, (low, high) in BOUNDS.items():
        count = notes["bounds_set_to_nan"].get(column, 0)
        lines.append(f"| {column} | {low} | {high} | {count} |")
    lines.append("")
    lines.append("Negative concentrations are inside this rule. The upper ends are there for instrument sentinels, not as a claim that every value below the cap is accurate.")
    lines.append("")
    lines.append("## Hourly result")
    lines.append("")
    lines.append(f"- Hourly rows (including hours with missing PM2.5): {notes['hourly_rows']}")
    lines.append(f"- Hours with observed PM2.5: {notes['hourly_pm25_non_null']}")
    valid_pct = 100.0 * notes["hourly_pm25_non_null"] / notes["hourly_rows"] if notes["hourly_rows"] else 0
    lines.append(f"- Share of hourly rows with PM2.5: {valid_pct:.2f}%")
    lines.append(f"- Timestamp range: {hourly['timestamp'].min()} to {hourly['timestamp'].max()}")
    lines.append("")
    lines.append("### Meteorology still missing after aggregation")
    lines.append("")
    lines.append("Coverage is the share of hourly rows with a non-missing value. Low coverage means the CPCB file did not report that field, not that a value was invented.")
    lines.append("")
    lines.append("| field | non-missing % |")
    lines.append("| --- | --- |")
    for column in met_cols:
        if column not in hourly.columns:
            lines.append(f"| {column} | column absent |")
        else:
            lines.append(f"| {column} | {100 * coverage(hourly[column]):.2f} |")
    lines.append("")
    lines.append("Coverage is not spread evenly. Most stations in this download do not report meteorology at all. The rates below are the share of hourly rows with a value.")
    lines.append("")
    for (_station_id, station_name), group in hourly.groupby(["station_id", "station_name"]):
        bits = [
            f"{column} {100 * coverage(group[column]):.1f}%"
            for column in met_cols
            if column in group.columns
        ]
        lines.append(f"- {station_name}: " + ", ".join(bits))
    lines.append("")
    lines.append("### PM2.5 by station (hourly observed values)")
    lines.append("")
    lines.append("| station | hourly rows | hours with PM2.5 | median ug/m3 | first PM2.5 | last PM2.5 |")
    lines.append("| --- | --- | --- | --- | --- | --- |")
    for (station_id, station_name), group in hourly.groupby(["station_id", "station_name"]):
        observed = group.loc[group["pm25"].notna(), "timestamp"]
        values = group["pm25"].dropna()
        median = "n/a" if values.empty else f"{float(values.median()):.2f}"
        first = "n/a" if observed.empty else str(observed.min())
        last = "n/a" if observed.empty else str(observed.max())
        lines.append(
            f"| {station_name} ({station_id}) | {len(group)} | {int(values.shape[0])} | {median} | {first} | {last} |"
        )
    lines.append("")
    lines.append("`source_resolution` is `15min_mean_to_hourly`. `data_origin` is `observed_cpcb`.")
    lines.append("")
    (DOCS_DIR / "cleaning_decisions.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    ensure_dirs()
    raw, used, skipped = load_labelled_files()
    print(f"labelled files: {len(used)}; skipped: {len(skipped)}; rows: {len(raw)}")
    hourly, notes = build_hourly(raw)
    model = add_model_columns(hourly)

    hourly.to_parquet(HOURLY_PATH, index=False)
    model.to_parquet(MODEL_DATASET_PATH, index=False)
    print(f"wrote {HOURLY_PATH}")
    print(f"wrote {MODEL_DATASET_PATH}")

    summary = {
        "source_dataset": SOURCE_DATASET_URL,
        "labelled_files_used": used,
        "files_skipped": skipped,
        "hourly_rows": notes["hourly_rows"],
        "hourly_pm25_non_null": notes["hourly_pm25_non_null"],
        "timestamp_min": str(hourly["timestamp"].min()),
        "timestamp_max": str(hourly["timestamp"].max()),
        "stations": [
            {"station_id": str(sid), "station_name": str(name)}
            for sid, name in hourly.groupby("station_id")["station_name"].first().items()
        ],
        "met_non_null_fraction": {
            column: coverage(hourly[column]) if column in hourly.columns else 0.0
            for column in [
                "temperature",
                "humidity",
                "wind_speed",
                "wind_direction",
                "rainfall",
                "solar_radiation",
                "pressure",
            ]
        },
        "bounds_set_to_nan": notes["bounds_set_to_nan"],
        "notes": (
            "Hourly PM2.5 is the mean of observed 15-minute samples. "
            "Missing hours are NaN. Wide 2017-2023 files were not used."
        ),
    }
    write_json(PIPELINE_SUMMARY_PATH, summary)
    write_cleaning_doc(used, skipped, notes, hourly)
    print(f"wrote {DOCS_DIR / 'cleaning_decisions.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
