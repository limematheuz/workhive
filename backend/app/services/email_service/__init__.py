"""Transactional email helpers.

Public send_* functions are re-exported here so existing imports keep working:
`from app.services import email_service`.
"""

from app.core.config import settings
from app.services.email_service.access_emails import (
    send_account_request_notification,
    send_trial_approved_email,
    send_trial_expiring_email,
    send_trial_expiring_superadmin_email,
    send_trial_verification_email,
)
from app.services.email_service.company_collaboration_emails import (
    send_company_collaboration_decision_email,
    send_company_collaboration_invitation_email,
    send_client_portal_invitation_email,
    send_sponsored_partner_invitation_email,
)
from app.services.email_service.auth_emails import (
    send_email_change_verification_email,
    send_email_changed_notice,
    send_paid_company_activation_email,
    send_password_reset_email,
)
from app.services.email_service.billing_emails import send_invoice_email
from app.services.email_service.client_emails import send_client_email
from app.services.email_service.contact_emails import send_contact_email
from app.services.email_service.layout import (
    _BRAND,
    add_logo_to_message,
    base_layout,
    button,
    get_logo_header,
)
from app.services.email_service.privacy_emails import (
    send_erasure_request_received_email,
    send_erasure_request_resolved_email,
)
from app.services.email_service.worker_invitation_emails import send_worker_invitation_email
from app.services.email_service.transport import from_address, send_email

# Backward-compatible private aliases used by older tests and call sites.
_add_logo_to_message = add_logo_to_message
_base_layout = base_layout
_button = button
_from_address = from_address
_get_logo_header = get_logo_header
_send_email = send_email

__all__ = [
    "settings",
    "send_password_reset_email",
    "send_paid_company_activation_email",
    "send_email_change_verification_email",
    "send_email_changed_notice",
    "send_contact_email",
    "send_trial_verification_email",
    "send_account_request_notification",
    "send_trial_approved_email",
    "send_trial_expiring_email",
    "send_trial_expiring_superadmin_email",
    "send_company_collaboration_invitation_email",
    "send_client_portal_invitation_email",
    "send_sponsored_partner_invitation_email",
    "send_company_collaboration_decision_email",
    "send_worker_invitation_email",
    "send_erasure_request_received_email",
    "send_erasure_request_resolved_email",
    "send_invoice_email",
    "send_client_email",
    "_BRAND",
    "_add_logo_to_message",
    "_base_layout",
    "_button",
    "_from_address",
    "_get_logo_header",
    "_send_email",
    "add_logo_to_message",
    "base_layout",
    "button",
    "from_address",
    "get_logo_header",
    "send_email",
]
