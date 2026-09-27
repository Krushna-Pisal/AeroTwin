"""Inspect downloaded OpenCity/CPCB files and write docs/data_quality_report.md.

Wide 2017-2023 matrices have no PM2.5 column. They are described and then
excluded from every training statistic.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aq_common import (
    DOCS_DIR,
    METADATA_PATH,
    RAW_DIR,
    ROOT,
    SOURCE_DATASET_URL,
    canon_column,
    ensure_dirs,
    is_labelled_long_csv,
)

WEATHER_KEYS = (
    "temperature",
    "humidity",
    "wind_speed",
    "wind_direction",
    "rainfall",
    "solar_radiation",
    "pressure",
)


def read_labelled(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path, encoding="utf-8", encoding_errors="replace", low_memory=False)
    rename = {}
    for column in frame.columns:
        canon = canon_column(str(column))
        if canon and canon not in rename.values():
            rename[column] = canon
    frame = frame.rename(columns=rename)
    keep = [column for column in frame.columns if column in rename.values()]
    frame = frame.loc[:, keep].copy()
    if "timestamp" in frame.columns:
        frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, errors="coerce")
    for column in frame.columns:
        if column in {"station_id", "station_name", "timestamp"}:
            continue
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame["source_file"] = path.name
    return frame


def pct(mask_or_count, total: int) -> float:
    if total == 0:
        return 0.0
    count = int(mask_or_count) if not hasattr(mask_or_count, "sum") else int(mask_or_count.sum())
    return 100.0 * count / total


def series_stats(series: pd.Series) -> dict:
    valid = series.dropna()
    if valid.empty:
        return {"n": 0, "min": None, "p50": None, "mean": None, "p95": None, "max": None}
    return {
        "n": int(valid.shape[0]),
        "min": float(valid.min()),
        "p50": float(valid.median()),
        "mean": float(valid.mean()),
        "p95": float(valid.quantile(0.95)),
        "max": float(valid.max()),
    }


def fmt(value, digits: int = 2) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "n/a"
    return f"{value:.{digits}f}"


def inspect_wide(path: Path) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    header_like = [line for line in lines if "00:00:00" in line and "23:00:00" in line]
    year_lines = [line for line in lines if line.startswith("Year,")]
    sample = ""
    for line in lines:
        if line[:2].isdigit() and "," in line and any(ch.isdigit() for ch in line[3:]):
            sample = line[:180]
            break
    return {
        "file_name": path.name,
        "bytes": path.stat().st_size,
        "line_count": len(lines),
        "year_headers": year_lines[:8],
        "hour_header_rows": len(header_like),
        "has_pm25_label": "pm2.5" in text.lower(),
        "sample_data_line": sample,
    }


def markdown_labelled(frames: list[pd.DataFrame]) -> list[str]:
    lines: list[str] = []
    combined = pd.concat(frames, ignore_index=True)
    rows = int(len(combined))
    lines.append("## Labelled 15-minute files (observed CPCB)")
    lines.append("")
    lines.append("These files have a `Timestamp` column and a `PM2.5` column. Statistics below are computed from the raw files after numeric parsing. Missing cells stay missing.")
    lines.append("")
    lines.append(f"- Rows: {rows}")
    lines.append(f"- Columns kept: {', '.join(combined.columns)}")
    lines.append(f"- Stations: {combined['station_id'].nunique() if 'station_id' in combined else 'n/a'}")
    if "timestamp" in combined.columns:
        valid_ts = combined["timestamp"].dropna()
        lines.append(f"- Timestamp range (published offset, UTC): {valid_ts.min()} to {valid_ts.max()}")
        lines.append(f"- Unparseable timestamps: {int(combined['timestamp'].isna().sum())}")
    lines.append("")
    lines.append("### Dtypes")
    lines.append("")
    lines.append("| column | dtype | missing % |")
    lines.append("| --- | --- | --- |")
    for column in combined.columns:
        if column == "source_file":
            continue
        missing = pct(combined[column].isna(), rows)
        lines.append(f"| {column} | {combined[column].dtype} | {missing:.2f} |")
    lines.append("")

    if {"station_id", "timestamp"}.issubset(combined.columns):
        dup_rows = int(combined.duplicated().sum())
        dup_keys = int(combined.duplicated(["station_id", "timestamp"]).sum())
        lines.append(f"- Exact duplicate rows: {dup_rows}")
        lines.append(f"- Duplicate station_id + timestamp keys: {dup_keys}")
        lines.append("")

    if "pm25" in combined.columns:
        stats = series_stats(combined["pm25"])
        valid_pct = pct(combined["pm25"].notna(), rows)
        lines.append("### PM2.5 (raw 15-minute observations)")
        lines.append("")
        lines.append(f"- Valid observations: {stats['n']} ({valid_pct:.2f}% of rows)")
        lines.append(f"- Min / median / mean / p95 / max (ug/m3): {fmt(stats['min'])} / {fmt(stats['p50'])} / {fmt(stats['mean'])} / {fmt(stats['p95'])} / {fmt(stats['max'])}")
        lines.append("- These figures describe observed values only. They are not gap-filled.")
        lines.append("")
        lines.append("| station | rows | valid PM2.5 % | median PM2.5 | start | end |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        for (station_id, station_name), group in combined.groupby(["station_id", "station_name"], dropna=False):
            pm = group["pm25"]
            ts = group["timestamp"].dropna()
            start = str(ts.min()) if not ts.empty else "n/a"
            end = str(ts.max()) if not ts.empty else "n/a"
            med = pm.median()
            lines.append(
                f"| {station_name} ({station_id}) | {len(group)} | {pct(pm.notna(), len(group)):.2f} | {fmt(None if pd.isna(med) else float(med))} | {start} | {end} |"
            )
        lines.append("")

    lines.append("### Weather-field availability")
    lines.append("")
    lines.append("Meteorological fields are used only where the file actually contains values. An empty column is left empty.")
    lines.append("")
    lines.append("| field | CPCB header | non-missing % |")
    lines.append("| --- | --- | --- |")
    header_map = {
        "temperature": "AT",
        "humidity": "RH",
        "wind_speed": "WS",
        "wind_direction": "WD",
        "rainfall": "RF",
        "solar_radiation": "SR",
        "pressure": "BP",
    }
    for key in WEATHER_KEYS:
        if key not in combined.columns:
            lines.append(f"| {key} | {header_map[key]} | column absent |")
            continue
        lines.append(f"| {key} | {header_map[key]} | {pct(combined[key].notna(), rows):.2f} |")
    lines.append("")

    lines.append("### Valid PM2.5 by month")
    lines.append("")
    if "pm25" in combined.columns and "timestamp" in combined.columns:
        month = combined.dropna(subset=["timestamp"]).copy()
        month["year_month"] = month["timestamp"].dt.strftime("%Y-%m")
        counts = month.groupby("year_month")["pm25"].apply(lambda s: int(s.notna().sum()))
        lines.append("| month | valid PM2.5 rows |")
        lines.append("| --- | --- |")
        for period, count in counts.items():
            lines.append(f"| {period} | {count} |")
        lines.append("")
    return lines


def markdown_wide(reports: list[dict]) -> list[str]:
    lines = [
        "## 2017-2023 hourly resources (not used for training)",
        "",
        "These OpenCity files are wide matrices: a year header, a row of clock hours, then day-number rows. The pollutant name is not in the file. There is no `PM2.5` column and no station timestamp column.",
        "",
        "The numbers therefore cannot be treated as PM2.5 concentrations. They are not reshaped into a training series, not gap-filled, and not passed to the model. A 2017-2021 / 2022 / 2023 chronological split is not possible from these files.",
        "",
        "External descriptions of this export (CPCB hourly AQI matrices) indicate hour columns of an air-quality index, which is a different quantity from PM2.5 ug/m3. This pipeline does not relabel those cells as PM2.5.",
        "",
    ]
    for report in reports:
        lines.append(f"### {report['file_name']}")
        lines.append("")
        lines.append(f"- Bytes: {report['bytes']}")
        lines.append(f"- Lines: {report['line_count']}")
        lines.append(f"- Hour-header rows: {report['hour_header_rows']}")
        lines.append(f"- Contains a PM2.5 label: {report['has_pm25_label']}")
        if report["year_headers"]:
            lines.append(f"- Year headers: {', '.join(report['year_headers'][:6])}")
        if report["sample_data_line"]:
            lines.append(f"- Example data line (unlabelled): `{report['sample_data_line']}`")
        lines.append("")
    return lines


def main() -> int:
    ensure_dirs()
    csv_paths = sorted(path for path in RAW_DIR.glob("*.csv") if path.is_file())
    if not csv_paths:
        print(f"No CSVs in {RAW_DIR}. Run download_data.py first.")
        return 1

    labelled_frames = []
    wide_reports = []
    other = []
    for path in csv_paths:
        if is_labelled_long_csv(path):
            print(f"labelled {path.name}")
            labelled_frames.append(read_labelled(path))
        else:
            head = path.read_text(encoding="utf-8", errors="replace")[:20]
            if head.startswith("Year,"):
                print(f"wide     {path.name}")
                wide_reports.append(inspect_wide(path))
            else:
                other.append(path.name)
                print(f"unknown  {path.name}")

    meta_note = "download_metadata.json is not present yet."
    if METADATA_PATH.exists():
        meta_note = f"Download metadata: `{METADATA_PATH.relative_to(ROOT).as_posix()}`."

    lines = [
        "# Data quality report",
        "",
        f"Source dataset: {SOURCE_DATASET_URL}",
        "",
        "Primary target: PM2.5 from observed CPCB station files republished by OpenCity.",
        "",
        meta_note,
        "",
        "No synthetic PM2.5, weather, traffic, industrial, or dust values are created in this inspection.",
        "",
        "## Decision for the first model",
        "",
        "Use one temporal resolution. The labelled source is 15-minute. The modeling table is an hourly aggregation of those observations (see `docs/cleaning_decisions.md`). The 2017-2023 wide files are a different, unlabelled layout and are not mixed in.",
        "",
        "MIT-Kothrud is in the requested starting list, but OpenCity has no 15-minute MIT-Kothrud resource. Only its unlabelled 2017-2023 wide file exists, so MIT-Kothrud is not in the training table.",
        "",
    ]
    if labelled_frames:
        lines.extend(markdown_labelled(labelled_frames))
    else:
        lines.append("No labelled long-format CSV was found.")
        lines.append("")
    if wide_reports:
        lines.extend(markdown_wide(wide_reports))
    if other:
        lines.append("## Unrecognised files")
        lines.append("")
        for name in other:
            lines.append(f"- {name}")
        lines.append("")

    lines.append("## What this report does not claim")
    lines.append("")
    lines.append("- It does not claim the 2017-2023 cells are PM2.5.")
    lines.append("- It does not fill missing meteorology.")
    lines.append("- Timestamps are parsed with the offset stored in the file (`+0000`). They are not rewritten as IST.")
    lines.append("")

    out = DOCS_DIR / "data_quality_report.md"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
