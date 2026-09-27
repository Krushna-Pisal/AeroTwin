# AeroTwin

Urban environmental digital twin for Pune PM2.5. The local pipeline trains on observed CPCB station data republished by [OpenCity](https://data.opencity.in/dataset/pune-hourly-air-quality-reports).

The 2017–2023 OpenCity “hourly” files are wide matrices without a PM2.5 column. They are downloaded for inspection and are not used to train the model. The first model uses hourly means of the labelled 15-minute station files.

Rules: `docs/data_policy.md`.

```text
python -m venv .venv
.venv\Scripts\python -m pip install -r backend\requirements.txt
.venv\Scripts\python ml\scripts\download_data.py --include-15min
.venv\Scripts\python ml\scripts\inspect_data.py
.venv\Scripts\python ml\scripts\clean_air_quality.py
.venv\Scripts\python ml\scripts\train_model.py
.venv\Scripts\python ml\scripts\backtest.py
```

The frontend is not part of this step.
