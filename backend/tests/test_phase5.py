from fastapi.testclient import TestClient
from app.main import app
from app.services.citizen_service import clear_reports
import pytest

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_teardown():
    clear_reports()
    yield
    clear_reports()

def test_report_creation():
    payload = {
        "category": "TRAFFIC",
        "description": "Heavy traffic jam",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "timestamp": "2023-10-01T12:00:00Z"
    }
    response = client.post("/api/citizen-reports", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "report_id" in data
    assert data["category"] == "TRAFFIC"
    assert data["status"] == "CITIZEN_REPORTED"
    assert data["source"] == "citizen"

def test_report_validation_invalid_coordinates():
    # Invalid latitude
    payload = {
        "category": "TRAFFIC",
        "description": "Heavy traffic",
        "latitude": 91.0,  # Invalid
        "longitude": 73.8567,
        "timestamp": "2023-10-01T12:00:00Z"
    }
    response = client.post("/api/citizen-reports", json=payload)
    assert response.status_code == 422

    # Invalid longitude
    payload["latitude"] = 18.5204
    payload["longitude"] = 200.0  # Invalid
    response = client.post("/api/citizen-reports", json=payload)
    assert response.status_code == 422

def test_report_missing_description():
    payload = {
        "category": "TRAFFIC",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "timestamp": "2023-10-01T12:00:00Z"
    }
    response = client.post("/api/citizen-reports", json=payload)
    assert response.status_code == 422

def test_filtering():
    client.post("/api/citizen-reports", json={
        "category": "TRAFFIC",
        "description": "desc1",
        "latitude": 18.0,
        "longitude": 73.0,
        "timestamp": "2023-10-01T10:00:00Z"
    })
    client.post("/api/citizen-reports", json={
        "category": "DUST_CONSTRUCTION",
        "description": "desc2",
        "latitude": 18.0,
        "longitude": 73.0,
        "timestamp": "2023-10-02T10:00:00Z"
    })

    response = client.get("/api/citizen-reports?category=TRAFFIC")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["category"] == "TRAFFIC"

    response = client.get("/api/citizen-reports?start=2023-10-02T00:00:00Z")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["category"] == "DUST_CONSTRUCTION"

def test_clustering():
    # Cluster 1: Close in space and time
    client.post("/api/citizen-reports", json={
        "category": "TRAFFIC",
        "description": "desc1",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "timestamp": "2023-10-01T10:00:00Z"
    })
    client.post("/api/citizen-reports", json={
        "category": "TRAFFIC",
        "description": "desc2",
        "latitude": 18.5205,
        "longitude": 73.8568,
        "timestamp": "2023-10-01T11:00:00Z"
    })

    # Cluster 2: Far in space
    client.post("/api/citizen-reports", json={
        "category": "DUST_CONSTRUCTION",
        "description": "desc3",
        "latitude": 19.5204,
        "longitude": 74.8567,
        "timestamp": "2023-10-01T10:00:00Z"
    })

    response = client.get("/api/citizen-reports/clusters")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert any(len(c["reports"]) == 2 for c in data)
    assert any(len(c["reports"]) == 1 for c in data)
    assert data[0]["label"] == "Citizen-reported activity cluster"

def test_status_preservation():
    payload = {
        "category": "TRAFFIC",
        "description": "Heavy traffic jam",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "timestamp": "2023-10-01T12:00:00Z",
        "status": "APPROVED" # User attempts to override status
    }
    response = client.post("/api/citizen-reports", json=payload)
    # The API should either ignore it or throw an error. 
    # Since status isn't in CitizenReportCreate, it will be ignored by Pydantic.
    assert response.status_code == 201
    assert response.json()["status"] == "CITIZEN_REPORTED"
