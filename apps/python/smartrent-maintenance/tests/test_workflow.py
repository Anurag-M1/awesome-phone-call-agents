"""Tests for SmartRent Maintenance Coordinator workflow."""

import asyncio
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import pytest
from app.config import CalleConfig
from app.calle_client import CalleService
from app.models import (
    CallStatus,
    CreateRequestPayload,
    IssueType,
    MaintenanceRequest,
    Urgency,
    WorkflowState,
)
from app.workflows import MaintenanceWorkflow


@pytest.fixture
def dry_run_service():
    """Create a CALL-E service in dry-run mode."""
    config = CalleConfig(dry_run=True)
    return CalleService(config)


@pytest.fixture
def workflow(dry_run_service):
    """Create a workflow with dry-run service."""
    return MaintenanceWorkflow(dry_run_service)


@pytest.fixture
def sample_request():
    """Create a sample maintenance request."""
    return MaintenanceRequest(
        tenant_name="John Smith",
        tenant_phone="+15551234567",
        unit_number="4B",
        property_name="SmartRent Demo Property",
        initial_description="Kitchen sink is leaking",
    )


# ─── Unit Tests ──────────────────────────────────────────────────────────────

class TestCalleService:
    """Test CALL-E service wrapper."""

    def test_dry_run_mode(self, dry_run_service):
        assert dry_run_service.is_dry_run is True

    def test_tenant_intake_dry_run(self, dry_run_service):
        result = dry_run_service.call_tenant_intake(
            phone="+15551234567",
            tenant_name="John Smith",
            unit_number="4B",
            property_name="Test Property",
            initial_description="Sink leak",
        )
        assert result.status == CallStatus.COMPLETED
        assert result.task_completed is True
        assert result.structured_result is not None
        assert result.structured_result["issue_type"] == "plumbing"
        assert result.structured_result["urgency"] == "urgent"
        assert len(result.transcript) > 0
        assert len(result.evidence) > 0

    def test_vendor_dispatch_dry_run(self, dry_run_service):
        result = dry_run_service.call_vendor_dispatch(
            vendor_phone="+15550100001",
            vendor_name="Mike's Plumbing",
            issue_type="plumbing",
            urgency="urgent",
            location="kitchen",
            property_name="Test Property",
            unit_number="4B",
        )
        assert result.status == CallStatus.COMPLETED
        assert result.structured_result["available"] == "yes"
        assert result.structured_result["eta"] is not None
        assert result.structured_result["cost_estimate"] is not None

    def test_tenant_confirm_dry_run(self, dry_run_service):
        result = dry_run_service.call_tenant_confirm(
            phone="+15551234567",
            tenant_name="John Smith",
            vendor_name="Mike's Plumbing",
            eta="within 2 hours",
            cost_estimate="$150-250",
            unit_number="4B",
        )
        assert result.status == CallStatus.COMPLETED
        assert result.structured_result["confirmed"] == "yes"


class TestWorkflow:
    """Test the multi-call workflow orchestrator."""

    @pytest.mark.asyncio
    async def test_tenant_intake_step(self, workflow, sample_request):
        result = await workflow.step_tenant_intake(sample_request)
        assert result.state == WorkflowState.TENANT_CALLED
        assert result.issue_type == IssueType.PLUMBING
        assert result.urgency == Urgency.URGENT
        assert result.location_in_unit is not None
        assert len(result.calls) == 1
        assert len(result.timeline) > 0

    @pytest.mark.asyncio
    async def test_vendor_dispatch_step(self, workflow, sample_request):
        # First do tenant intake
        sample_request = await workflow.step_tenant_intake(sample_request)
        assert sample_request.state == WorkflowState.TENANT_CALLED

        # Then dispatch vendor
        result = await workflow.step_vendor_dispatch(sample_request)
        assert result.state == WorkflowState.VENDOR_FOUND
        assert result.assigned_vendor is not None
        assert result.vendor_eta is not None
        assert result.vendor_cost_estimate is not None
        assert len(result.calls) == 2

    @pytest.mark.asyncio
    async def test_tenant_confirm_step(self, workflow, sample_request):
        # Run first two steps
        sample_request = await workflow.step_tenant_intake(sample_request)
        sample_request = await workflow.step_vendor_dispatch(sample_request)
        assert sample_request.state == WorkflowState.VENDOR_FOUND

        # Confirm
        result = await workflow.step_tenant_confirm(sample_request)
        assert result.state == WorkflowState.COMPLETED
        assert result.tenant_confirmed is True
        assert len(result.calls) == 3

    @pytest.mark.asyncio
    async def test_full_workflow(self, workflow, sample_request):
        result = await workflow.run_full_workflow(sample_request)
        assert result.state == WorkflowState.COMPLETED
        assert result.tenant_confirmed is True
        assert result.issue_type == IssueType.PLUMBING
        assert result.urgency == Urgency.URGENT
        assert result.assigned_vendor is not None
        assert result.vendor_eta is not None
        assert len(result.calls) == 3
        assert len(result.timeline) >= 6  # At least 6 events

    @pytest.mark.asyncio
    async def test_vendor_matching(self, workflow):
        # Plumbing issue should match plumbing vendors
        vendors = workflow.get_vendors_for_issue("plumbing")
        assert len(vendors) >= 1
        assert any("plumbing" in v.specialties for v in vendors)

        # Electrical issue
        vendors = workflow.get_vendors_for_issue("electrical")
        assert len(vendors) >= 1


class TestModels:
    """Test data models."""

    def test_create_request(self):
        req = MaintenanceRequest(
            tenant_name="Jane Doe",
            tenant_phone="+15559876543",
            unit_number="10A",
        )
        assert req.id.startswith("MR-")
        assert req.state == WorkflowState.CREATED
        assert req.calls == []
        assert req.timeline == []

    def test_timeline_events(self, sample_request):
        sample_request.add_timeline_event("test_event", "Test details")
        assert len(sample_request.timeline) == 1
        assert sample_request.timeline[0]["event"] == "test_event"
        assert sample_request.timeline[0]["details"] == "Test details"

    def test_create_payload(self):
        payload = CreateRequestPayload(
            tenant_name="John",
            tenant_phone="+15551234567",
            unit_number="4B",
        )
        assert payload.property_name == "SmartRent Demo Property"
