import copy

import pytest

# A complete, cloud-friendly application; tests override individual answers.
BASE = {
    "app_name": "Order Portal",
    "app_id": "APP-001",
    "app_description": "Customer order entry",
    "app_manager": "Sam Lee",
    "geography": "EU",
    "business_criticality": "High",
    "rto": "Gold",
    "rpo": "Gold",
    "app_status": "In production",
    "app_roadmap": "No change planned",
    "cots_or_custom": "Inhouse built",
    "architecture": "Microservices",
    "coupling": "Loosely coupled",
    "app_state": "Stateless",
    "source_code": "Yes",
    "programming_language": "Java 17",
    "hardware_dependency": "No",
    "mainframe_dependency": "No",
    "operating_system": "Ubuntu 22.04",
    "database": "PostgreSQL 14",
    "app_server": "Nginx 1.24",
    "latency": "Standard",
    "real_time_decisioning": "No",
    "safety_critical_ot": "No",
}


@pytest.fixture
def answers():
    return copy.deepcopy(BASE)
