"""Multi-call workflow orchestrator for SmartRent Maintenance Coordinator.

Manages the 3-step maintenance request lifecycle:
1. Tenant Intake Call — gather issue details
2. Vendor Dispatch Call — find available vendor
3. Tenant Confirmation Call — confirm vendor visit
"""

from __future__ import annotations

import logging
from typing import Optional

from app.calle_client import CalleService
from app.models import (
    CallStatus,
    IssueType,
    MaintenanceRequest,
    Urgency,
    Vendor,
    WorkflowState,
)

logger = logging.getLogger(__name__)


# ─── Default Vendor Roster ────────────────────────────────────────────────────

DEFAULT_VENDORS = [
    Vendor(
        id="v-plumb1",
        name="Mike's Plumbing",
        phone="+15550100001",
        specialties=["plumbing"],
    ),
    Vendor(
        id="v-elec1",
        name="Spark Electric Co.",
        phone="+15550100002",
        specialties=["electrical"],
    ),
    Vendor(
        id="v-hvac1",
        name="CoolBreeze HVAC",
        phone="+15550100003",
        specialties=["hvac"],
    ),
    Vendor(
        id="v-gen1",
        name="FixIt Pro Services",
        phone="+15550100004",
        specialties=["appliance", "structural", "pest", "other"],
    ),
    Vendor(
        id="v-gen2",
        name="AllCraft Maintenance",
        phone="+15550100005",
        specialties=["plumbing", "electrical", "hvac", "appliance", "structural"],
    ),
]


class MaintenanceWorkflow:
    """Orchestrates the 3-call maintenance request workflow."""

    def __init__(self, calle_service: CalleService, vendors: Optional[list[Vendor]] = None):
        self.calle = calle_service
        self.vendors = vendors or DEFAULT_VENDORS

    def get_vendors_for_issue(self, issue_type: str) -> list[Vendor]:
        """Find vendors that handle a specific issue type."""
        matching = [v for v in self.vendors if issue_type in v.specialties]
        if not matching:
            # Fall back to general vendors
            matching = [v for v in self.vendors if "other" in v.specialties]
        return matching

    # ─── Step 1: Tenant Intake ────────────────────────────────────────────

    async def step_tenant_intake(self, request: MaintenanceRequest) -> MaintenanceRequest:
        """Step 1: Call tenant to gather detailed issue information."""
        request.state = WorkflowState.TENANT_CALLING
        request.add_timeline_event("tenant_call_started", "Calling tenant to gather issue details")

        try:
            call_record = self.calle.call_tenant_intake(
                phone=request.tenant_phone,
                tenant_name=request.tenant_name,
                unit_number=request.unit_number,
                property_name=request.property_name,
                initial_description=request.initial_description,
            )

            request.calls.append(call_record)

            if call_record.status == CallStatus.COMPLETED and call_record.task_completed:
                result = call_record.structured_result or {}

                # Extract structured data
                issue_type_str = result.get("issue_type", "other")
                try:
                    request.issue_type = IssueType(issue_type_str)
                except ValueError:
                    request.issue_type = IssueType.OTHER

                urgency_str = result.get("urgency", "routine")
                try:
                    request.urgency = Urgency(urgency_str)
                except ValueError:
                    request.urgency = Urgency.ROUTINE

                request.location_in_unit = result.get("location_in_unit", "")
                request.access_instructions = result.get("access_instructions", "")
                request.additional_details = result.get("additional_details", "")

                request.state = WorkflowState.TENANT_CALLED
                request.add_timeline_event(
                    "tenant_call_completed",
                    f"Issue: {request.issue_type.value} ({request.urgency.value}) — "
                    f"{request.location_in_unit}"
                )

                logger.info(f"[{request.id}] Tenant intake complete: {request.issue_type.value}")
            else:
                request.state = WorkflowState.FAILED
                request.add_timeline_event(
                    "tenant_call_failed",
                    call_record.error or "Tenant call did not complete successfully"
                )

        except Exception as e:
            logger.error(f"[{request.id}] Tenant intake error: {e}")
            request.state = WorkflowState.FAILED
            request.add_timeline_event("tenant_call_error", str(e))

        return request

    # ─── Step 2: Vendor Dispatch ──────────────────────────────────────────

    async def step_vendor_dispatch(self, request: MaintenanceRequest) -> MaintenanceRequest:
        """Step 2: Call vendors to find one that's available."""
        if request.state != WorkflowState.TENANT_CALLED:
            logger.warning(f"[{request.id}] Cannot dispatch vendor — wrong state: {request.state}")
            return request

        request.state = WorkflowState.VENDOR_SEARCHING
        request.add_timeline_event("vendor_search_started", f"Searching for {request.issue_type.value} vendor")

        candidates = self.get_vendors_for_issue(request.issue_type.value)

        if not candidates:
            request.state = WorkflowState.FAILED
            request.add_timeline_event("no_vendors_found", f"No vendors available for {request.issue_type.value}")
            return request

        for vendor in candidates:
            request.add_timeline_event("vendor_call_started", f"Calling {vendor.name}")

            try:
                call_record = self.calle.call_vendor_dispatch(
                    vendor_phone=vendor.phone,
                    vendor_name=vendor.name,
                    issue_type=request.issue_type.value,
                    urgency=request.urgency.value,
                    location=request.location_in_unit or "unit",
                    property_name=request.property_name,
                    unit_number=request.unit_number,
                    additional_details=request.additional_details or "",
                )

                request.calls.append(call_record)

                if call_record.status == CallStatus.COMPLETED and call_record.task_completed:
                    result = call_record.structured_result or {}

                    if result.get("available") == "yes":
                        request.assigned_vendor = vendor
                        request.vendor_eta = result.get("eta", "TBD")
                        request.vendor_cost_estimate = result.get("cost_estimate", "TBD")
                        request.state = WorkflowState.VENDOR_FOUND

                        request.add_timeline_event(
                            "vendor_found",
                            f"{vendor.name} available — ETA: {request.vendor_eta}, "
                            f"Cost: {request.vendor_cost_estimate}"
                        )
                        logger.info(f"[{request.id}] Vendor found: {vendor.name}")
                        break
                    else:
                        request.add_timeline_event(
                            "vendor_unavailable",
                            f"{vendor.name} is not available"
                        )
                else:
                    request.add_timeline_event(
                        "vendor_call_failed",
                        f"Call to {vendor.name} did not complete successfully"
                    )

            except Exception as e:
                logger.error(f"[{request.id}] Vendor call error for {vendor.name}: {e}")
                request.add_timeline_event("vendor_call_error", f"{vendor.name}: {e}")

        if request.state != WorkflowState.VENDOR_FOUND:
            request.state = WorkflowState.FAILED
            request.add_timeline_event("all_vendors_unavailable", "No vendor available for this job")

        return request

    # ─── Step 3: Tenant Confirmation ──────────────────────────────────────

    async def step_tenant_confirm(self, request: MaintenanceRequest) -> MaintenanceRequest:
        """Step 3: Call tenant back to confirm the vendor visit."""
        if request.state != WorkflowState.VENDOR_FOUND:
            logger.warning(f"[{request.id}] Cannot confirm — wrong state: {request.state}")
            return request

        request.state = WorkflowState.TENANT_CONFIRMING
        request.add_timeline_event(
            "confirmation_call_started",
            f"Calling tenant to confirm {request.assigned_vendor.name}"
        )

        try:
            call_record = self.calle.call_tenant_confirm(
                phone=request.tenant_phone,
                tenant_name=request.tenant_name,
                vendor_name=request.assigned_vendor.name,
                eta=request.vendor_eta,
                cost_estimate=request.vendor_cost_estimate,
                unit_number=request.unit_number,
            )

            request.calls.append(call_record)

            if call_record.status == CallStatus.COMPLETED and call_record.task_completed:
                result = call_record.structured_result or {}

                if result.get("confirmed") == "yes":
                    request.tenant_confirmed = True
                    request.state = WorkflowState.COMPLETED
                    request.add_timeline_event(
                        "tenant_confirmed",
                        f"Tenant confirmed vendor visit. {request.assigned_vendor.name} "
                        f"arriving {request.vendor_eta}."
                    )
                    logger.info(f"[{request.id}] Workflow completed — vendor confirmed!")
                elif result.get("confirmed") == "reschedule":
                    request.tenant_confirmed = False
                    request.state = WorkflowState.TENANT_CALLED  # Reset to find new time
                    preferred = result.get("preferred_time", "TBD")
                    request.add_timeline_event(
                        "tenant_reschedule",
                        f"Tenant wants to reschedule. Preferred: {preferred}"
                    )
                else:
                    request.tenant_confirmed = False
                    request.state = WorkflowState.FAILED
                    request.add_timeline_event("tenant_declined", "Tenant declined the vendor visit")
            else:
                request.state = WorkflowState.FAILED
                request.add_timeline_event(
                    "confirmation_call_failed",
                    "Confirmation call did not complete successfully"
                )

        except Exception as e:
            logger.error(f"[{request.id}] Confirmation call error: {e}")
            request.state = WorkflowState.FAILED
            request.add_timeline_event("confirmation_call_error", str(e))

        return request

    # ─── Full Workflow ────────────────────────────────────────────────────

    async def run_full_workflow(self, request: MaintenanceRequest) -> MaintenanceRequest:
        """Run the complete 3-step workflow sequentially."""
        logger.info(f"[{request.id}] Starting full maintenance workflow")
        request.add_timeline_event("workflow_started", "Full maintenance workflow initiated")

        # Step 1
        request = await self.step_tenant_intake(request)
        if request.state == WorkflowState.FAILED:
            return request

        # Step 2
        request = await self.step_vendor_dispatch(request)
        if request.state == WorkflowState.FAILED:
            return request

        # Step 3
        request = await self.step_tenant_confirm(request)

        return request
