"""Audit legacy OpenCity matrices, list labelled PM2.5 resources, and profile meteorology.

Does not relabel unlabelled cells as PM2.5 and does not download new station files.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aq_common import DOCS_DIR, HOURLY_PATH, RAW_DIR, SOURCE_DATASET_URL, canon_column, ensure_dirs

CKAN = (
    "https://data.opencity.in/api/3/action/package_show"
    "?id=pune-hourly-air-quality-reports"
)
SQL_URL = "https://data.opencity.in/api/3/action/datastore_search_sql"
UA = "AeroTwin-audit/1.0"

MET_HEADERS = {
    "temperature": "AT (degC)",
    "humidity": "RH (%)",
    "wind_speed": "WS (m/s)",
    "wind_direction": "WD (deg)",
    "rainfall": "RF (mm)",
    "solar_radiation": "SR (W/mt2)",
    "pressure": "BP (mmHg)",
    "total_rainfall": "TOT-RF (mm)",
}


def fetch_json(url: str, payload: dict | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"User-Agent": UA}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def legacy_audit(path: Path) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    year = None
    month = None
    values: list[float] = []
    empty_cells = 0
    day_rows = 0
    years = []
    months = []
    sample_data = []
    quote_reprs = []
    for line in lines:
        if line.startswith("Year,"):
            year = line.split(",", 1)[1].strip()
            years.append(year)
            continue
        if re.match(r"^[A-Za-z]+-\d{4},", line):
            month = line.split(",", 1)[0]
            months.append(f"{month} (year header {year})")
            continue
        if line.strip() in {'"', '""'}:
            if len(quote_reprs) < 3:
                quote_reprs.append(repr(line))
            continue
        if not re.match(r"^\d", line):
            continue
        day_rows += 1
        parts = line.split(",")
        if len(sample_data) < 6:
            sample_data.append(line[:200])
        for cell in parts[1:]:
            cell = cell.strip()
            if cell == "":
                empty_cells += 1
                continue
            try:
                values.append(float(cell))
            except ValueError:
                empty_cells += 1
    arr = np.asarray(values, dtype=float) if values else np.asarray([], dtype=float)
    integer_share = None
    if arr.size:
        integer_share = float(np.mean(np.isclose(arr, np.round(arr))))
    return {
        "file_name": path.name,
        "bytes": path.stat().st_size,
        "line_count": len(lines),
        "n_columns_nominal": 25,
        "header_pattern": "Year,YYYY then Month-YYYY plus 24 hour columns, then day-number rows",
        "first_lines": lines[:12],
        "sample_data_lines": sample_data,
        "quote_reprs": quote_reprs,
        "years": years,
        "month_headers": len(months),
        "day_rows": day_rows,
        "numeric_cells": int(arr.size),
        "empty_hour_cells": empty_cells,
        "min": None if arr.size == 0 else float(arr.min()),
        "p50": None if arr.size == 0 else float(np.median(arr)),
        "p95": None if arr.size == 0 else float(np.quantile(arr, 0.95)),
        "max": None if arr.size == 0 else float(arr.max()),
        "integer_share": integer_share,
        "above_500": int(np.sum(arr > 500)) if arr.size else 0,
        "has_pm25_token": "pm2.5" in text.lower(),
        "has_unit_token": any(token in text.lower() for token in ("ug/m", "µg", "aqi", "ppm")),
    }


def profile_labelled_csv(path: Path) -> dict:
    frame = pd.read_csv(path, encoding="utf-8", encoding_errors="replace", low_memory=False)
    rename = {}
    for column in frame.columns:
        canon = canon_column(str(column))
        if canon and canon not in rename.values():
            rename[column] = canon
    frame = frame.rename(columns=rename)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, errors="coerce")
    frame["pm25"] = pd.to_numeric(frame["pm25"], errors="coerce")
    frame = frame[frame["station_id"].astype(str).str.startswith("site_")]
    test = frame["timestamp"] >= pd.Timestamp("2025-07-01", tz="UTC")
    return {
        "station_name": str(frame["station_name"].dropna().iloc[0]),
        "station_id": str(frame["station_id"].dropna().iloc[0]),
        "n_rows": int(len(frame)),
        "tmin": str(frame["timestamp"].min()),
        "tmax": str(frame["timestamp"].max()),
        "pm25_n": int(frame["pm25"].notna().sum()),
        "pm25_test_n": int(frame.loc[test, "pm25"].notna().sum()),
        "pm25_last": None
        if frame["pm25"].notna().sum() == 0
        else str(frame.loc[frame["pm25"].notna(), "timestamp"].max()),
    }


def local_met_tables() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    frames = []
    for path in sorted(RAW_DIR.glob("*15min.csv")):
        frame = pd.read_csv(path, encoding="utf-8", encoding_errors="replace", low_memory=False)
        rename = {}
        for column in frame.columns:
            canon = canon_column(str(column))
            if canon and canon not in rename.values():
                rename[column] = canon
        frame = frame.rename(columns=rename)
        keep = [c for c in frame.columns if c in rename.values() or c in ("station_id", "station_name", "timestamp")]
        frame = frame.loc[:, [c for c in keep if c in frame.columns]].copy()
        frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, errors="coerce")
        for column in frame.columns:
            if column in {"station_id", "station_name", "timestamp"}:
                continue
            frame[column] = pd.to_numeric(frame[column], errors="coerce")
        frame = frame[frame["station_id"].astype(str).str.startswith("site_")]
        frames.append(frame)
    raw = pd.concat(frames, ignore_index=True)
    rows = []
    for key in list(MET_HEADERS) + ["pm25"]:
        if key not in raw.columns:
            continue
        series = raw[key]
        valid = series.dropna()
        per_station = (
            raw.groupby("station_name")[key]
            .apply(lambda s: float(s.notna().mean()))
            .sort_values(ascending=False)
        )
        covered = [name for name, rate in per_station.items() if rate > 0]
        when = raw.loc[series.notna(), "timestamp"]
        rows.append(
            {
                "field": key,
                "header": "PM2.5" if key == "pm25" else MET_HEADERS[key],
                "n": int(valid.shape[0]),
                "missing_pct": float(series.isna().mean() * 100),
                "nunique": int(valid.nunique()) if not valid.empty else 0,
                "min": None if valid.empty else float(valid.min()),
                "p50": None if valid.empty else float(valid.median()),
                "max": None if valid.empty else float(valid.max()),
                "stations_with_any": len(covered),
                "station_list": covered,
                "tmin": None if when.empty else str(when.min()),
                "tmax": None if when.empty else str(when.max()),
            }
        )
    summary = pd.DataFrame(rows)
    by_station = []
    for (station_id, station_name), group in raw.groupby(["station_id", "station_name"]):
        item = {
            "station_id": station_id,
            "station_name": station_name,
            "rows": int(len(group)),
            "pm25_missing_pct": float(group["pm25"].isna().mean() * 100) if "pm25" in group else None,
            "tmin": str(group["timestamp"].min()),
            "tmax": str(group["timestamp"].max()),
            "pm25_last": None
            if group["pm25"].notna().sum() == 0
            else str(group.loc[group["pm25"].notna(), "timestamp"].max()),
        }
        for key in MET_HEADERS:
            if key in group:
                item[f"{key}_non_null_pct"] = float(group[key].notna().mean() * 100)
        by_station.append(item)
    hourly = pd.read_parquet(HOURLY_PATH, columns=["timestamp", "pm25"])
    hourly["timestamp"] = pd.to_datetime(hourly["timestamp"], utc=True)
    diurnal = (
        hourly.dropna(subset=["pm25"])
        .groupby(hourly["timestamp"].dt.hour)["pm25"]
        .median()
        .rename("median_pm25")
        .reset_index()
    )
    return summary, pd.DataFrame(by_station), diurnal


def fmt(value, digits: int = 2) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "n/a"
    return f"{value:.{digits}f}"


def write_legacy(audits: list[dict]) -> None:
    lines = [
        "# OpenCity legacy file audit (2017–2023 wide matrices)",
        "",
        f"Dataset: {SOURCE_DATASET_URL}",
        "",
        "These seven files were already on disk. This audit reads the files and the CKAN resource records. It does not relabel any cell as PM2.5.",
        "",
        "Dataset note published by OpenCity: “Hourly air quality reports from 2017 to 2023 for 10 stations in Pune.” Each resource description is only “Daily hourly data from 2017 to 2023.” The file names say “AQI Data”. None of those texts name PM2.5 or a unit.",
        "",
        "The CKAN datastore for these resources has the same shape as the CSV: one field taken from the first month header (for example `January-2017`) and twenty-four fields named `00:00:00` through `23:00:00`. There is no pollutant field and no unit field.",
        "",
        "## Shared structure",
        "",
        "Every file is a stack of blocks:",
        "",
        "1. `Year,YYYY`",
        "2. `Month-YYYY` followed by columns `00:00:00` … `23:00:00`",
        "3. Two lines whose entire content is a double-quote character",
        "4. Rows whose first cell is a day number and whose remaining cells are blank or a number",
        "",
        "The quote lines are where a parameter name and a unit would normally sit in a CPCB hourly export. In these files they are empty. The measured quantity is therefore not in the file.",
        "",
        "A timestamp can be rebuilt from the year header, the month header, the day number, and the hour column. That produces a time grid. It does not establish that the number is PM2.5 in µg/m³. This audit does not write that grid into the modeling table.",
        "",
        "## Summary",
        "",
        "| File | Station | Structure | Likely meaning | PM2.5 usable? | Reason |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    station_from_name = {
        "bhosari": "Bhosari, IITM",
        "hadapsar": "Hadapsar, IITM",
        "karve-road": "Karve Road, MPCB",
        "mhada-colony": "Mhada Colony, IITM",
        "mit-kothrud": "MIT-Kothrud, IITM",
        "revenue-colony": "Revenue Colony-Shivajinagar, IITM",
        "transport-nagar": "Transport Nagar-Nigdi, IITM",
    }
    for audit in audits:
        station = next(label for key, label in station_from_name.items() if audit["file_name"].startswith(key))
        lines.append(
            f"| `{audit['file_name']}` | {station} | Wide day-by-hour matrix, {audit['day_rows']} day rows, {audit['numeric_cells']} numeric cells | Integers capped at 500. Consistent with an AQI index. Not identified as PM2.5. | No | No pollutant name or unit. Values do not match the labelled PM2.5 series. |"
        )
    lines.append("")
    lines.append("Every numeric cell in these seven files is a whole number. The maximum in every file is 500, and no cell is above 500. The labelled 15-minute PM2.5 series from the same dataset is fractional and reaches about 995 µg/m³. A ceiling of 500 is how CPCB publishes the AQI index. It is not how PM2.5 concentrations behave. The file name says “AQI”, and the resource text never says PM2.5. The cells are therefore not converted into a PM2.5 training series.")
    lines.append("")
    for audit in audits:
        lines.append(f"## `{audit['file_name']}`")
        lines.append("")
        lines.append(f"- Bytes: {audit['bytes']}")
        lines.append(f"- Lines: {audit['line_count']}")
        lines.append(f"- Nominal columns: 1 label column + 24 hour columns")
        lines.append(f"- Year headers: {', '.join(audit['years'])}")
        lines.append(f"- Month-header rows: {audit['month_headers']}")
        lines.append(f"- Day-number rows: {audit['day_rows']}")
        lines.append(f"- Numeric cells: {audit['numeric_cells']}")
        lines.append(f"- Empty hour cells on day rows: {audit['empty_hour_cells']}")
        lines.append(f"- Min / median / p95 / max: {fmt(audit['min'])} / {fmt(audit['p50'])} / {fmt(audit['p95'])} / {fmt(audit['max'])}")
        lines.append(f"- Share of numeric cells that are whole numbers: {fmt(None if audit['integer_share'] is None else 100 * audit['integer_share'])}%")
        lines.append(f"- Cells above 500: {audit['above_500']}")
        lines.append(f"- Contains the text PM2.5: {audit['has_pm25_token']}")
        lines.append(f"- Contains a unit token: {audit['has_unit_token']}")
        lines.append(f"- Quote-only lines look like: {', '.join(audit['quote_reprs'])}")
        lines.append("")
        lines.append("First lines:")
        lines.append("")
        lines.append("```text")
        for line in audit["first_lines"]:
            lines.append(line[:220])
        lines.append("```")
        lines.append("")
        lines.append("Example day rows:")
        lines.append("")
        lines.append("```text")
        for line in audit["sample_data_lines"]:
            lines.append(line)
        lines.append("```")
        lines.append("")
        lines.append("Pollutant information: not present. PM2.5 information: not present. Date information: year header, month header, and a day number, with no full calendar date column. Hour information: column names `00:00:00`–`23:00:00`. Units: not present.")
        lines.append("")
        lines.append("Reconstruction into timestamped observations: the grid can be reshaped, but the number has no documented identity, so the reshaped series would not be a PM2.5 observation.")
        lines.append("")
    lines.append("## Decision")
    lines.append("")
    lines.append("Do not train on these seven files. A smaller labelled 15-minute record is the PM2.5 source. MIT-Kothrud exists in this set and still has no labelled PM2.5 series.")
    lines.append("")
    (DOCS_DIR / "opencity_legacy_data_audit.md").write_text("\n".join(lines), encoding="utf-8")


def write_inventory(records: list[dict]) -> None:
    lines = [
        "# OpenCity labelled PM2.5 inventory",
        "",
        f"Dataset: {SOURCE_DATASET_URL}",
        "",
        "Scope: every CSV resource in the Pune package. Counts for 15-minute files are computed from the CSV on disk (non-null PM2.5 after numeric parsing). This CKAN site does not expose `datastore_search_sql`. Wide 2017–2023 files are listed separately and are not PM2.5.",
        "",
        "The test window used here is timestamps at or after 2025-07-01, matching the current forecast test cut. That count is non-null PM2.5 rows in the 15-minute file, before hourly aggregation.",
        "",
        "## Labelled 15-minute resources",
        "",
        "| Station | Resource | Resolution | Rows | PM2.5 non-null | PM2.5 missing % | Start | End | PM2.5 rows from 2025-07-01 | Already local? |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    labelled = [row for row in records if row["resolution"] == "15min"]
    labelled.sort(key=lambda row: (-(row.get("pm25_test_n") or 0), row["station_name"] or ""))
    for row in labelled:
        n_rows = row["n_rows"] or 0
        pm = row["pm25_n"] or 0
        missing = 100.0 * (1 - pm / n_rows) if n_rows else None
        lines.append(
            f"| {row['station_name']} ({row['station_id']}) | {row['resource_name']} | 15-minute | {n_rows} | {pm} | {fmt(missing)} | {row['tmin']} | {row['tmax']} | {row['pm25_test_n']} | {row['local']} |"
        )
    lines.append("")
    lines.append("## Unlabelled 2017–2023 resources",
        )
    lines.append("")
    lines.append("These are not PM2.5 inventories. See `docs/opencity_legacy_data_audit.md` for the seven files that were opened. Alandi, Katraj Dairy, and Savitribai Phule wide files were not downloaded. A datastore sample of the same package shows that this resource type is an hour-column matrix with no PM2.5 field. They are not counted as labelled PM2.5.")
    lines.append("")
    lines.append("| Resource | Downloaded |")
    lines.append("| --- | --- |")
    for row in records:
        if row["resolution"] != "15min":
            lines.append(f"| {row['resource_name']} | {row['local']} |")
    lines.append("")
    in_saved_model = {"site_292", "site_5404", "site_5406", "site_5407", "site_5408", "site_5409"}
    usable = [row for row in labelled if (row.get("pm25_test_n") or 0) >= 1000 and (row.get("pm25_n") or 0) / max(row.get("n_rows") or 1, 1) >= 0.5]
    lines.append("## Stations that clear the coverage bar")
    lines.append("")
    lines.append("A station is listed here when PM2.5 is present on at least half of its rows and at least 1,000 non-null PM2.5 rows fall on or after 2025-07-01. Being listed is not a decision to retrain.")
    lines.append("")
    if not usable:
        lines.append("No station met that bar.")
    for row in usable:
        if row.get("station_id") in in_saved_model:
            status = "included in the saved six-station model"
        elif row["local"] == "yes":
            status = "CSV is on disk, not in the saved model"
        else:
            status = "not downloaded"
        lines.append(
            f"- {row['station_name']} ({row['station_id']}): {row['pm25_test_n']} PM2.5 rows from 2025-07-01, missing {fmt(100 * (1 - (row['pm25_n'] or 0) / row['n_rows']))}% overall. {status}."
        )
    lines.append("")
    lines.append("Dhankawadi is 2025-only. It can help the test window only if its PM2.5 count above is large enough; it cannot extend training back into 2024.")
    lines.append("")
    (DOCS_DIR / "opencity_pm25_inventory.md").write_text("\n".join(lines), encoding="utf-8")


def write_met(summary: pd.DataFrame, by_station: pd.DataFrame, diurnal: pd.DataFrame) -> None:
    lines = [
        "# Meteorology data audit",
        "",
        "Source: every labelled 15-minute CPCB file in `data/raw/air_quality/` at audit time. Statistics are raw rows after numeric parsing. Empty cells stay empty. Units are the header units. No unit was converted. The saved forecast model was fit on the original six stations only; extra stations here are inventory, not a retrained model.",
        "",
        "Headers in the CKAN datastore are `AT (degC)`, `RH (%)`, `WS (m/s)`, `WD (deg)`, `RF (mm)`, `TOT-RF (mm)`, `SR (W/mt2)`, `BP (mmHg)`.",
        "",
        "## Field summary",
        "",
        "| Field | Header unit | Non-null rows | Unique values | Min | Median | Max | Missing % | Stations with any value | First non-null | Last non-null |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for _, row in summary.iterrows():
        if row["field"] == "pm25":
            continue
        lines.append(
            f"| {row['field']} | {row['header']} | {row['n']} | {row['nunique']} | {fmt(row['min'])} | {fmt(row['p50'])} | {fmt(row['max'])} | {fmt(row['missing_pct'])} | {row['stations_with_any']} | {row['tmin']} | {row['tmax']} |"
        )
    lines.append("")
    lines.append("## Flags")
    lines.append("")
    for _, row in summary.iterrows():
        if row["field"] == "pm25":
            continue
        names = ", ".join(row["station_list"]) if row["station_list"] else "none"
        lines.append(
            f"- {row['field']}: {row['n']} non-null values, {row['nunique']} distinct, "
            f"missing {fmt(row['missing_pct'])}%, stations with any value: {names}."
        )
    lines.append("- A field with no variation, or with values outside a physically plausible band for its labelled unit, is not a model input. Pressure is labelled mmHg. A usable mmHg series would sit near 700–760, or near 950–1020 if the values were actually hPa. A median near 880 is neither, so pressure is not converted and not used.")
    lines.append("- Wind speed above 25 m/s was set to missing in the hourly modeling table for the original six stations and counted in `docs/cleaning_decisions.md`. Those spikes were not replaced.")
    lines.append("")
    lines.append("## By station (percent of 15-minute rows non-null)")
    lines.append("")
    lines.append("| Station | Rows | PM2.5 missing % | PM2.5 last timestamp | RH % | WS % | WD % | BP % | AT % | RF % |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for _, row in by_station.sort_values("station_name").iterrows():
        lines.append(
            f"| {row['station_name']} | {row['rows']} | {fmt(row['pm25_missing_pct'])} | {row['pm25_last']} | "
            f"{fmt(row.get('humidity_non_null_pct'))} | {fmt(row.get('wind_speed_non_null_pct'))} | "
            f"{fmt(row.get('wind_direction_non_null_pct'))} | {fmt(row.get('pressure_non_null_pct'))} | "
            f"{fmt(row.get('temperature_non_null_pct'))} | {fmt(row.get('rainfall_non_null_pct'))} |"
        )
    lines.append("")
    lines.append("## Clock of the published timestamp")
    lines.append("")
    lines.append("Timestamps were parsed with the `+0000` offset stored on the 15-minute files. They were not shifted to IST. The table below is the median of hourly observed PM2.5 by that published hour, across the six local stations.")
    lines.append("")
    lines.append("| Published hour | Median PM2.5 (µg/m³) |")
    lines.append("| --- | --- |")
    for _, row in diurnal.iterrows():
        lines.append(f"| {int(row['timestamp'])} | {fmt(row['median_pm25'])} |")
    lines.append("")
    lines.append("OpenCity and the file header do not state whether that clock is UTC or an IST clock written with a zero offset. The CAAQMS transmission protocol uses local civil time at the station. A third-party CPCB archive describes the 15-minute timestamp field as UTC. Those two statements disagree, and this file’s own offset does not settle it. No conversion is applied until a source note for this OpenCity export says which clock was used.")
    lines.append("")
    lines.append("Weather alignment, if an external series is added later, has to record both clocks explicitly. See `docs/weather_source_evaluation.md`.")
    lines.append("")
    (DOCS_DIR / "meteorology_data_audit.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    ensure_dirs()
    audits = [legacy_audit(path) for path in sorted(RAW_DIR.glob("*hourly_wide.csv"))]
    write_legacy(audits)
    print(f"legacy files audited: {len(audits)}")

    package = fetch_json(CKAN)
    local_names = {path.name for path in RAW_DIR.glob("*.csv")}
    records = []
    for resource in package["result"]["resources"]:
        if str(resource.get("format", "")).upper() != "CSV":
            continue
        name = resource["name"]
        resolution = "15min" if "15 minute" in name.lower() else "hourly_wide"
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:90]
        local = "yes" if f"{slug}__{resolution}.csv" in local_names else "no"
        row = {
            "resource_name": name,
            "resource_id": resource["id"],
            "resolution": resolution,
            "local": local,
            "station_name": None,
            "station_id": None,
            "n_rows": None,
            "tmin": None,
            "tmax": None,
            "pm25_n": None,
            "pm25_test_n": None,
        }
        if resolution == "15min" and local == "yes":
            path = RAW_DIR / f"{slug}__{resolution}.csv"
            print(f"profile {path.name}")
            row.update(profile_labelled_csv(path))
        records.append(row)
    (DOCS_DIR / "opencity_inventory.json").write_text(json.dumps(records, indent=2, default=str), encoding="utf-8")
    write_inventory(records)

    summary, by_station, diurnal = local_met_tables()
    write_met(summary, by_station, diurnal)
    print("wrote legacy, inventory, meteorology docs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
