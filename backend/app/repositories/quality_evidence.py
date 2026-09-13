from sqlalchemy.orm import Session

from app.models.quality_evidence import QualityEvidence


def get_for_inspection(
    db: Session,
    *,
    company_id: int,
    inspection_id: int,
    evidence_id: int,
) -> QualityEvidence | None:
    return (
        db.query(QualityEvidence)
        .filter(
            QualityEvidence.company_id == company_id,
            QualityEvidence.inspection_id == inspection_id,
            QualityEvidence.id == evidence_id,
        )
        .one_or_none()
    )


def get_for_incident(
    db: Session,
    *,
    company_id: int,
    incident_id: int,
    evidence_id: int,
) -> QualityEvidence | None:
    return (
        db.query(QualityEvidence)
        .filter(
            QualityEvidence.company_id == company_id,
            QualityEvidence.incident_id == incident_id,
            QualityEvidence.id == evidence_id,
        )
        .one_or_none()
    )
