from fastapi import HTTPException, status

from app.schemas.location_workspace import LocationCatalogSuggestionResponse, LocationProfileInput
from app.services.location_cleaning_catalog import TEMPLATES, catalog_site_types, generate_spaces

SITE_TYPES = catalog_site_types()
SITE_TYPES_BY_ID = {site_type["id"]: site_type for site_type in SITE_TYPES}


def get_catalog():
    return {"site_types": SITE_TYPES, "space_library": list(TEMPLATES.values())}


def validate_profile(profile: LocationProfileInput) -> None:
    if profile.site_type not in SITE_TYPES_BY_ID:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Unsupported location site type",
        )
    for key, value in profile.attributes.items():
        if not key or len(key) > 80 or not isinstance(value, (str, int, float, bool)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Location profile attributes must be scalar values",
            )
        if isinstance(value, (int, float)) and not isinstance(value, bool) and value < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Location profile numeric attributes cannot be negative",
            )



def suggest_spaces(site_type: str, attributes: dict[str, object]) -> LocationCatalogSuggestionResponse:
    if site_type not in SITE_TYPES_BY_ID:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unsupported location site type")
    return LocationCatalogSuggestionResponse(spaces=generate_spaces(site_type, attributes))
