"""Extend the isolated E2E fixture with a sponsored property manager (no customer data)."""

from datetime import datetime, timedelta, timezone

from scripts.seed_e2e import E2E_PASSWORD, require_isolated_database, seed
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.company_collaboration import CompanyCollaboration
from app.models.location import Location
from app.models.location_zone import LocationZone
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.role import Role
from app.models.sponsored_partner_invitation import SponsoredPartnerInvitation
from app.models.user import User
from app.services.company_collaboration_invitation_tokens import hash_invitation_secret


E2E_SPONSORED_INVITATION_TOKEN = "e2e-sponsored-partner-acceptance-token-2026"
E2E_SPONSORED_INVITATION_CODE = "E2EACCEPT01"


def seed_portal() -> None:
    require_isolated_database()
    seed()
    with SessionLocal() as db:
        host = db.query(Company).filter(Company.email == "admin@e2e.example").one()
        host.subscription_plan = "top"
        admin = db.query(User).filter(User.email == "admin@e2e.example").one()
        location = db.query(Location).filter(Location.name == "E2E Apartment").one()
        db.add(LocationZone(location_id=location.id, name="E2E Kitchen Zone", zone_type="kitchen"))
        partner = Company(name="E2E Property Manager", tax_id="E2E-PORTAL", email="company@portal.e2e.example",
                          address="Test street", phone="600000000", subscription_plan="none", subscription_status="inactive",
                          operating_model="property_manager", onboarding_completed=True)
        role = Role(name="partner_portal", description="Sponsored portal E2E fixture")
        db.add_all([partner, role])
        db.flush()
        user = User(email="portal@e2e.example", full_name="E2E Portal User", company_id=partner.id,
                    role_id=role.id, hashed_password=get_password_hash(E2E_PASSWORD), is_active=True)
        collaboration = CompanyCollaboration(initiator_company_id=host.id, partner_company_id=partner.id,
                                             role_type="property_manager", status="accepted")
        db.add_all([user, collaboration])
        db.flush()
        db.add(PartnerPortalGrant(host_company_id=host.id, partner_company_id=partner.id,
                                 collaboration_id=collaboration.id, user_id=user.id, status="active",
                                 granted_by_user_id=admin.id))
        db.add(SponsoredPartnerInvitation(
            host_company_id=host.id,
            invited_by_user_id=admin.id,
            email="new-manager@portal.e2e.example",
            company_name="E2E Sponsored Acceptance",
            token_hash=hash_invitation_secret(E2E_SPONSORED_INVITATION_TOKEN),
            verification_code_hash=hash_invitation_secret(E2E_SPONSORED_INVITATION_CODE),
            status="pending",
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        ))
        db.commit()


if __name__ == "__main__":
    seed_portal()
