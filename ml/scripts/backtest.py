"""Write test-period predictions from the saved V1 model.

This script does not retrain. It applies the same chronological split as
train_model.py.
"""

from __future__ import annotations

import sys
from pathlib import Path

import joblib
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aq_common import BACKTEST_PATH, FEATURE_META_PATH, MODEL_PATH, ensure_dirs
from train_model import TARGET, assign_split, design_matrix, eligible, load_model_frame


def main() -> int:
    ensure_dirs()
    if not MODEL_PATH.exists() or not FEATURE_META_PATH.exists():
        raise SystemExit("Train the model first so pm25_xgb_24h.pkl and feature_metadata.json exist.")

    import json

    meta = json.loads(FEATURE_META_PATH.read_text(encoding="utf-8"))
    model = joblib.load(MODEL_PATH)
    frame = eligible(load_model_frame())
    frame, _info = assign_split(frame)
    test = frame.loc[frame["split"] == "test"].copy()
    matrix = design_matrix(test, meta["base_features"], meta["station_columns"])
    # Column order must match the fitted model.
    matrix = matrix.reindex(columns=meta["features"])
    test["predicted_pm25"] = model.predict(matrix)
    test["naive_baseline_pm25"] = test["pm25"]

    out = pd.DataFrame(
        {
            "timestamp": test["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "station": test["station_name"],
            "station_id": test["station_id"],
            "actual_pm25": test[TARGET],
            "predicted_pm25": test["predicted_pm25"],
            "naive_baseline_pm25": test["naive_baseline_pm25"],
        }
    )
    out.to_csv(BACKTEST_PATH, index=False)
    print(f"wrote {BACKTEST_PATH} ({len(out)} test rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
