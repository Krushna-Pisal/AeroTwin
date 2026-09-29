"""Citizen reports and spatial contributions service for AeroTwin / Aeris.

Stores citizen-submitted civic issues and spatial crowd-sourced data,
along with municipal review workflows, department assignments, and audit logs.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

# ── Demo Data ─────────────────────────────────────────────────────────────

INITIAL_REPORTS: list[dict[str, Any]] = [
    {
        "id": "CIV-2026-1001",
        "title": "Uncollected Solid Waste near Market",
        "category": "Garbage Point",
        "severity": "High",
        "status": "In Progress",
        "description": "Large garbage heap overflowing into the main street near Swargate bus stand. Odor and health hazard.",
        "latitude": 18.5018,
        "longitude": 73.8584,
        "location_name": "Swargate Bus Stand, Pune",
        "ward": "Swargate / Kasba Peth",
        "citizen_name": "Rahul Sharma",
        "citizen_contact": "rahul.s@example.com",
        "photo_url": "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=600&q=80",
        "reported_date": "2026-09-27T10:15:00Z",
        "assigned_department": "Solid Waste Management",
        "official_remarks": "Sanitation crew deployed for clearance.",
        "resolution_evidence": None,
        "timeline": [
            {"status": "Submitted", "timestamp": "2026-09-27T10:15:00Z", "note": "Report filed by citizen."},
            {"status": "Under Review", "timestamp": "2026-09-27T11:30:00Z", "note": "Reviewed by Municipal Command Center."},
            {"status": "Assigned", "timestamp": "2026-09-27T14:00:00Z", "note": "Assigned to Solid Waste Management Ward 4."},
            {"status": "In Progress", "timestamp": "2026-09-28T09:00:00Z", "note": "Truck #MH-12-AQ-4412 dispatched."},
        ],
    },
    {
        "id": "CIV-2026-1002",
        "title": "Severe Pothole on University Road",
        "category": "Road Damage",
        "severity": "Critical",
        "status": "Assigned",
        "description": "Deep 1.5m wide crater near SPPU main gate causing traffic bottlenecks and dust emissions.",
        "latitude": 18.5471,
        "longitude": 73.8269,
        "location_name": "Ganeshkhind Road near SPPU Gate",
        "ward": "Aundh - Shivajinagar",
        "citizen_name": "Priya Kulkarni",
        "citizen_contact": "priya.k@example.com",
        "photo_url": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80",
        "reported_date": "2026-09-28T08:45:00Z",
        "assigned_department": "Roads & Infrastructure",
        "official_remarks": "Cold mix asphalt patching scheduled overnight.",
        "resolution_evidence": None,
        "timeline": [
            {"status": "Submitted", "timestamp": "2026-09-28T08:45:00Z", "note": "Report filed by citizen."},
            {"status": "Under Review", "timestamp": "2026-09-28T09:15:00Z", "note": "Verified high traffic impact."},
            {"status": "Assigned", "timestamp": "2026-09-28T10:00:00Z", "note": "Assigned to PWD Road Maintenance Cell."},
        ],
    },
    {
        "id": "CIV-2026-1003",
        "title": "Industrial Biomass Burning",
        "category": "Air Pollution",
        "severity": "Critical",
        "status": "Submitted",
        "description": "Dense black smoke emerging from open waste burning site near Hadapsar Industrial Area.",
        "latitude": 18.5018,
        "longitude": 73.9275,
        "location_name": "Hadapsar Industrial Estate",
        "ward": "Hadapsar / Mundhwa",
        "citizen_name": "Amit Deshmukh",
        "citizen_contact": "amit.d@example.com",
        "photo_url": "https://images.unsplash.com/photo-1569163139599-0f4517e36f31?auto=format&fit=crop&w=600&q=80",
        "reported_date": "2026-09-28T18:20:00Z",
        "assigned_department": "Environmental Cell",
        "official_remarks": None,
        "resolution_evidence": None,
        "timeline": [
            {"status": "Submitted", "timestamp": "2026-09-28T18:20:00Z", "note": "Report filed by citizen."},
        ],
    },
    {
        "id": "CIV-2026-1004",
        "title": "Non-functional Streetlights on Nagar Road",
        "category": "Street Light",
        "severity": "Medium",
        "status": "Resolved",
        "description": "5 consecutive streetlight poles dark between Viman Nagar junction and Kharadi bypass.",
        "latitude": 18.5679,
        "longitude": 73.9143,
        "location_name": "Viman Nagar Junction, Pune",
        "ward": "Viman Nagar / Nagar Road",
        "citizen_name": "Siddharth Joshi",
        "citizen_contact": "sid.j@example.com",
        "photo_url": "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80",
        "reported_date": "2026-09-25T20:10:00Z",
        "assigned_department": "Electrical & Streetlighting",
        "official_remarks": "Feeder pillar circuit breaker replaced and LED luminaires verified operational.",
        "resolution_evidence": "https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&w=600&q=80",
        "timeline": [
            {"status": "Submitted", "timestamp": "2026-09-25T20:10:00Z", "note": "Report filed by citizen."},
            {"status": "Under Review", "timestamp": "2026-09-25T21:00:00Z", "note": "Forwarded to Electrical division."},
            {"status": "Assigned", "timestamp": "2026-09-26T08:30:00Z", "note": "Technician assigned."},
            {"status": "In Progress", "timestamp": "2026-09-26T11:00:00Z", "note": "Replacing faulty junction box."},
            {"status": "Resolved", "timestamp": "2026-09-26T15:45:00Z", "note": "All 5 lights restored and verified."},
        ],
    },
]

INITIAL_SPATIAL_CONTRIBUTIONS: list[dict[str, Any]] = [
    {
        "id": "SPC-2026-2001",
        "title": "Unmapped Construction Dust Control Buffer Zone",
        "contribution_type": "Public Facility",
        "category": "Dust Control Zone",
        "geometry_type": "Polygon",
        "latitude": 18.5308,
        "longitude": 73.8475,
        "coordinates": [
            [73.8465, 18.5300],
            [73.8485, 18.5300],
            [73.8485, 18.5315],
            [73.8465, 18.5315],
            [73.8465, 18.5300],
        ],
        "description": "Newly set up water misting cannons around Metro construction site on JM Road.",
        "source": "Personally Observed",
        "status": "VERIFIED",
        "submitted_by": "Citizen Scientist Group Pune",
        "submitted_date": "2026-09-26T14:30:00Z",
        "verified_date": "2026-09-27T09:00:00Z",
        "rejection_reason": None,
        "reviewer_remarks": "Confirmed with Pune Metro PWD environmental compliance unit.",
    },
    {
        "id": "SPC-2026-2002",
        "title": "New Pedestrian Walkway & Green Belt",
        "contribution_type": "Missing Road",
        "category": "Green Infrastructure",
        "geometry_type": "LineString",
        "latitude": 18.5580,
        "longitude": 73.8070,
        "coordinates": [
            [73.8050, 18.5570],
            [73.8070, 18.5580],
            [73.8090, 18.5590],
        ],
        "description": "Dedicated non-motorized transport lane constructed along Pashan Lake perimeter.",
        "source": "Community Source",
        "status": "Pending Verification",
        "submitted_by": "Dr. Ananya Patil",
        "submitted_date": "2026-09-28T12:10:00Z",
        "verified_date": None,
        "rejection_reason": None,
        "reviewer_remarks": None,
    },
    {
        "id": "SPC-2026-2003",
        "title": "Unregistered Diesel Generator Set",
        "contribution_type": "Other",
        "category": "Point Emissions Source",
        "geometry_type": "Point",
        "latitude": 18.6058,
        "longitude": 73.7500,
        "coordinates": [73.7500, 18.6058],
        "description": "Heavy 500kVA backup generator operating without acoustic enclosure or chimney stack height compliance.",
        "source": "Personally Observed",
        "status": "Rejected",
        "submitted_by": "Resident Association Hinjewadi",
        "submitted_date": "2026-09-24T16:00:00Z",
        "verified_date": "2026-09-25T11:20:00Z",
        "rejection_reason": "Site inspection showed temporary permit issued under MPCB Emergency Backup Regulations #2026/89.",
        "reviewer_remarks": "Permit valid through Oct 15, 2026.",
    },
]

DEPARTMENTS = [
    {"id": "dept_01", "name": "Solid Waste Management", "head": "Er. S. V. Kulkarni", "active_complaints": 12, "sla_hours": 24},
    {"id": "dept_02", "name": "Roads & Infrastructure", "head": "Er. M. K. Patil", "active_complaints": 18, "sla_hours": 48},
    {"id": "dept_03", "name": "Environmental Cell", "head": "Dr. R. N. Mehta", "active_complaints": 7, "sla_hours": 12},
    {"id": "dept_04", "name": "Electrical & Streetlighting", "head": "Er. A. P. Shinde", "active_complaints": 5, "sla_hours": 24},
    {"id": "dept_05", "name": "Water Supply & Sewerage", "head": "Er. G. B. Pawar", "active_complaints": 14, "sla_hours": 36},
    {"id": "dept_06", "name": "Public Health & Sanitation", "head": "Dr. S. T. More", "active_complaints": 9, "sla_hours": 12},
]

AUDIT_LOGS = [
    {"id": "log_101", "actor": "Municipal Admin", "action": "UPDATE_STATUS", "target": "CIV-2026-1001", "details": "Changed status to In Progress (Assigned: Solid Waste Management)", "timestamp": "2026-09-28T09:00:00Z"},
    {"id": "log_102", "actor": "Municipal Officer", "action": "VERIFY_SPATIAL", "target": "SPC-2026-2001", "details": "Approved spatial contribution: Construction Dust Control Buffer Zone", "timestamp": "2026-09-27T09:00:00Z"},
    {"id": "log_103", "actor": "System", "action": "CRITICAL_ALERT", "target": "CIV-2026-1003", "details": "High severity air pollution report flagged in Hadapsar Ward", "timestamp": "2026-09-28T18:20:00Z"},
    {"id": "log_104", "actor": "Municipal Officer", "action": "REJECT_SPATIAL", "target": "SPC-2026-2003", "details": "Rejected spatial contribution: Temporary generator permit active", "timestamp": "2026-09-25T11:20:00Z"},
]

# ── Service State ─────────────────────────────────────────────────────────

_reports: list[dict[str, Any]] = list(INITIAL_REPORTS)
_spatial_contributions: list[dict[str, Any]] = list(INITIAL_SPATIAL_CONTRIBUTIONS)
_audit_logs: list[dict[str, Any]] = list(AUDIT_LOGS)

# ── Reports Methods ───────────────────────────────────────────────────────

def get_reports(category: str | None = None, status: str | None = None, severity: str | None = None) -> list[dict[str, Any]]:
    result = _reports
    if category:
        result = [r for r in result if r["category"].lower() == category.lower()]
    if status:
        result = [r for r in result if r["status"].lower() == status.lower()]
    if severity:
        result = [r for r in result if r["severity"].lower() == severity.lower()]
    return result

def create_report(payload: dict[str, Any]) -> dict[str, Any]:
    new_id = f"CIV-2026-{1000 + len(_reports) + 1}"
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    report = {
        "id": new_id,
        "title": payload.get("title") or f"{payload.get('category', 'Civic')} Issue",
        "category": payload.get("category", "Other"),
        "severity": payload.get("severity", "Medium"),
        "status": "Submitted",
        "description": payload.get("description", ""),
        "latitude": float(payload.get("latitude", 18.5204)),
        "longitude": float(payload.get("longitude", 73.8567)),
        "location_name": payload.get("location_name", "Pune, Maharashtra"),
        "ward": payload.get("ward", "Central Ward"),
        "citizen_name": payload.get("citizen_name", "Citizen"),
        "citizen_contact": payload.get("citizen_contact", "citizen@aerotwin.org"),
        "photo_url": payload.get("photo_url") or "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=600&q=80",
        "reported_date": now_str,
        "assigned_department": None,
        "official_remarks": None,
        "resolution_evidence": None,
        "timeline": [
            {"status": "Submitted", "timestamp": now_str, "note": "Report filed by citizen via Citizen Portal."},
        ],
    }
    _reports.insert(0, report)
    _audit_logs.insert(0, {
        "id": f"log_{uuid.uuid4().hex[:6]}",
        "actor": "Citizen",
        "action": "SUBMIT_REPORT",
        "target": new_id,
        "details": f"Created new complaint: {report['title']} ({report['category']})",
        "timestamp": now_str,
    })
    return report

def update_report(report_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    for rep in _reports:
        if rep["id"] == report_id:
            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            if "status" in updates and updates["status"] != rep["status"]:
                new_status = updates["status"]
                rep["status"] = new_status
                rep["timeline"].append({
                    "status": new_status,
                    "timestamp": now_str,
                    "note": updates.get("official_remarks") or f"Status updated to {new_status}.",
                })
            if "assigned_department" in updates:
                rep["assigned_department"] = updates["assigned_department"]
            if "official_remarks" in updates:
                rep["official_remarks"] = updates["official_remarks"]
            if "resolution_evidence" in updates:
                rep["resolution_evidence"] = updates["resolution_evidence"]
            
            _audit_logs.insert(0, {
                "id": f"log_{uuid.uuid4().hex[:6]}",
                "actor": "Municipal Corporation",
                "action": "UPDATE_REPORT",
                "target": report_id,
                "details": f"Updated report: status={rep['status']}, dept={rep['assigned_department']}",
                "timestamp": now_str,
            })
            return rep
    return None

# ── Spatial Contributions Methods ─────────────────────────────────────────

def get_spatial_contributions(status: str | None = None) -> list[dict[str, Any]]:
    if status:
        return [s for s in _spatial_contributions if s["status"].lower() == status.lower()]
    return _spatial_contributions

def create_spatial_contribution(payload: dict[str, Any]) -> dict[str, Any]:
    new_id = f"SPC-2026-{2000 + len(_spatial_contributions) + 1}"
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    contribution = {
        "id": new_id,
        "title": payload.get("title") or f"{payload.get('contribution_type', 'Spatial')} Item",
        "contribution_type": payload.get("contribution_type", "Other"),
        "category": payload.get("category", "General"),
        "geometry_type": payload.get("geometry_type", "Point"),
        "latitude": float(payload.get("latitude", 18.5204)),
        "longitude": float(payload.get("longitude", 73.8567)),
        "coordinates": payload.get("coordinates") or [float(payload.get("longitude", 73.8567)), float(payload.get("latitude", 18.5204))],
        "description": payload.get("description", ""),
        "source": payload.get("source", "Personally Observed"),
        "status": "Pending Verification",
        "submitted_by": payload.get("submitted_by", "Citizen Scientist"),
        "submitted_date": now_str,
        "verified_date": None,
        "rejection_reason": None,
        "reviewer_remarks": None,
    }
    _spatial_contributions.insert(0, contribution)
    _audit_logs.insert(0, {
        "id": f"log_{uuid.uuid4().hex[:6]}",
        "actor": "Citizen",
        "action": "SUBMIT_SPATIAL",
        "target": new_id,
        "details": f"Submitted spatial contribution: {contribution['title']}",
        "timestamp": now_str,
    })
    return contribution

def review_spatial_contribution(contrib_id: str, action: str, remarks: str | None = None, rejection_reason: str | None = None) -> dict[str, Any] | None:
    for item in _spatial_contributions:
        if item["id"] == contrib_id:
            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            if action.lower() == "approve":
                item["status"] = "VERIFIED"
                item["verified_date"] = now_str
                item["reviewer_remarks"] = remarks or "Approved by Municipal GIS Review Board."
            elif action.lower() == "reject":
                item["status"] = "Rejected"
                item["verified_date"] = now_str
                item["rejection_reason"] = rejection_reason or remarks or "Does not meet accuracy criteria."
                item["reviewer_remarks"] = remarks
            elif action.lower() == "request_info":
                item["status"] = "Pending Verification"
                item["reviewer_remarks"] = remarks or "Additional verification evidence requested."

            _audit_logs.insert(0, {
                "id": f"log_{uuid.uuid4().hex[:6]}",
                "actor": "Municipal Corporation",
                "action": f"REVIEW_SPATIAL_{action.upper()}",
                "target": contrib_id,
                "details": f"Spatial review action {action}: {item['status']}",
                "timestamp": now_str,
            })
            return item
    return None

def get_departments() -> list[dict[str, Any]]:
    return DEPARTMENTS

def get_audit_logs() -> list[dict[str, Any]]:
    return _audit_logs
