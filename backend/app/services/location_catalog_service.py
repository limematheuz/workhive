from fastapi import HTTPException, status

from app.schemas.location_workspace import (
    LocationCatalogSpaceSuggestion,
    LocationCatalogSuggestionResponse,
    LocationProfileInput,
    LocationSpaceTaskTemplateInput,
)


def _task(title: str, category: str = "cleaning", minutes: int = 5):
    return LocationSpaceTaskTemplateInput(
        title=title,
        category=category,
        estimated_minutes=minutes,
    )


SPACE_TASKS: dict[str, list[LocationSpaceTaskTemplateInput]] = {
    "bathroom": [
        _task("Limpiar WC"),
        _task("Limpiar lavabo"),
        _task("Limpiar espejo"),
        _task("Fregar suelo"),
        _task("Reponer papel higiénico", "restocking", 2),
        _task("Reponer jabón de manos", "restocking", 2),
    ],
    "office": [
        _task("Limpiar superficies"),
        _task("Vaciar papelera", "restocking", 2),
        _task("Aspirar suelo"),
        _task("Fregar suelo"),
    ],
    "meeting_room": [
        _task("Limpiar mesa y sillas"),
        _task("Vaciar papelera", "restocking", 2),
        _task("Aspirar suelo"),
    ],
    "kitchen": [
        _task("Limpiar encimera"),
        _task("Limpiar fregadero"),
        _task("Vaciar papelera", "restocking", 2),
        _task("Aspirar suelo"),
        _task("Fregar suelo"),
    ],
    "reception": [
        _task("Limpiar mostrador"),
        _task("Limpiar cristales"),
        _task("Aspirar suelo"),
    ],
    "bedroom": [
        _task("Limpiar superficies"),
        _task("Aspirar suelo"),
        _task("Revisar ropa de cama", "restocking", 4),
    ],
    "common_area": [
        _task("Limpiar superficies"),
        _task("Aspirar suelo"),
        _task("Fregar suelo"),
    ],
}


COMMON_ATTRIBUTES = [
    {"id": "surface_m2", "label": "Superficie aproximada (m²)", "kind": "number"},
    {"id": "has_exterior", "label": "Tiene zonas exteriores", "kind": "boolean"},
]


SITE_TYPES = [
    {
        "id": "office",
        "label": "Oficina",
        "description": "Oficinas, despachos y centros de negocio.",
        "attributes": [
            {"id": "floor_count", "label": "Plantas", "kind": "number"},
            {"id": "office_count", "label": "Despachos", "kind": "number"},
            {"id": "meeting_room_count", "label": "Salas de reuniones", "kind": "number"},
            {"id": "bathroom_count", "label": "Baños", "kind": "number"},
            {"id": "has_kitchen", "label": "Tiene cocina", "kind": "boolean"},
            {"id": "has_reception", "label": "Tiene recepción", "kind": "boolean"},
            *COMMON_ATTRIBUTES,
        ],
    },
    {
        "id": "hotel",
        "label": "Hotel",
        "description": "Hoteles, hostales y alojamientos turísticos.",
        "attributes": [
            {"id": "floor_count", "label": "Plantas", "kind": "number"},
            {"id": "room_count", "label": "Habitaciones", "kind": "number"},
            {"id": "bathroom_count", "label": "Baños comunes", "kind": "number"},
            {"id": "has_reception", "label": "Tiene recepción", "kind": "boolean"},
            {"id": "has_kitchen", "label": "Tiene cocina", "kind": "boolean"},
            {"id": "has_common_areas", "label": "Tiene zonas comunes", "kind": "boolean"},
            *COMMON_ATTRIBUTES,
        ],
    },
    {
        "id": "tourist_apartment",
        "label": "Apartamento turístico",
        "description": "Apartamentos y alojamientos de uso turístico.",
        "attributes": [
            {"id": "bedroom_count", "label": "Habitaciones", "kind": "number"},
            {"id": "bathroom_count", "label": "Baños", "kind": "number"},
            {"id": "has_kitchen", "label": "Tiene cocina", "kind": "boolean"},
            {"id": "has_living_room", "label": "Tiene salón", "kind": "boolean"},
            {"id": "bed_count", "label": "Camas", "kind": "number"},
            *COMMON_ATTRIBUTES,
        ],
    },
    {"id": "private_home", "label": "Vivienda particular", "description": "Casas y pisos de uso residencial.", "attributes": COMMON_ATTRIBUTES},
    {"id": "house", "label": "Casa / chalet", "description": "Viviendas unifamiliares e independientes.", "attributes": COMMON_ATTRIBUTES},
    {"id": "community", "label": "Comunidad de vecinos", "description": "Comunidades residenciales y zonas comunes.", "attributes": COMMON_ATTRIBUTES},
    {"id": "commercial", "label": "Local comercial", "description": "Tiendas, comercios y locales minoristas.", "attributes": COMMON_ATTRIBUTES},
    {"id": "restaurant", "label": "Restaurante", "description": "Restaurantes y servicios de restauración.", "attributes": COMMON_ATTRIBUTES},
    {"id": "cafe", "label": "Bar / cafetería", "description": "Bares, cafeterías y establecimientos afines.", "attributes": COMMON_ATTRIBUTES},
    {"id": "clinic", "label": "Clínica / centro sanitario", "description": "Clínicas y centros sanitarios.", "attributes": COMMON_ATTRIBUTES},
    {"id": "dental_clinic", "label": "Clínica dental", "description": "Clínicas y consultas dentales.", "attributes": COMMON_ATTRIBUTES},
    {"id": "school", "label": "Colegio", "description": "Colegios, institutos y centros educativos.", "attributes": COMMON_ATTRIBUTES},
    {"id": "nursery", "label": "Guardería", "description": "Guarderías y centros de educación infantil.", "attributes": COMMON_ATTRIBUTES},
    {"id": "gym", "label": "Gimnasio", "description": "Gimnasios y centros deportivos.", "attributes": COMMON_ATTRIBUTES},
    {"id": "industrial", "label": "Nave industrial", "description": "Naves, fábricas y plantas industriales.", "attributes": COMMON_ATTRIBUTES},
    {"id": "warehouse", "label": "Almacén", "description": "Almacenes y centros logísticos.", "attributes": COMMON_ATTRIBUTES},
    {"id": "parking", "label": "Parking", "description": "Aparcamientos y garajes.", "attributes": COMMON_ATTRIBUTES},
    {"id": "public_building", "label": "Edificio público", "description": "Edificios y dependencias públicas.", "attributes": COMMON_ATTRIBUTES},
    {"id": "construction", "label": "Obra / reforma", "description": "Obras en construcción o reforma.", "attributes": COMMON_ATTRIBUTES},
    {"id": "other", "label": "Otro", "description": "Ubicación no incluida en las categorías anteriores.", "attributes": COMMON_ATTRIBUTES},
]

SITE_TYPES_BY_ID = {site_type["id"]: site_type for site_type in SITE_TYPES}


def get_catalog() -> dict[str, list[dict]]:
    return {"site_types": SITE_TYPES}


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


def _count(attributes: dict[str, object], key: str) -> int:
    value = attributes.get(key, 0)
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


def _enabled(attributes: dict[str, object], key: str) -> bool:
    return attributes.get(key) is True


def _spaces_for_count(name: str, space_type: str, count: int):
    return [
        LocationCatalogSpaceSuggestion(
            name=f"{name} {index}",
            space_type=space_type,
            tasks=SPACE_TASKS.get(space_type, []),
        )
        for index in range(1, min(count, 100) + 1)
    ]


def suggest_spaces(
    site_type: str,
    attributes: dict[str, object],
) -> LocationCatalogSuggestionResponse:
    if site_type not in SITE_TYPES_BY_ID:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unsupported location site type")

    spaces: list[LocationCatalogSpaceSuggestion] = []
    if site_type == "office":
        spaces.extend(_spaces_for_count("Despacho", "office", _count(attributes, "office_count")))
        spaces.extend(_spaces_for_count("Sala de reuniones", "meeting_room", _count(attributes, "meeting_room_count")))
        spaces.extend(_spaces_for_count("Baño", "bathroom", _count(attributes, "bathroom_count")))
        if _enabled(attributes, "has_kitchen"):
            spaces.append(LocationCatalogSpaceSuggestion(name="Cocina", space_type="kitchen", tasks=SPACE_TASKS["kitchen"]))
        if _enabled(attributes, "has_reception"):
            spaces.append(LocationCatalogSpaceSuggestion(name="Recepción", space_type="reception", tasks=SPACE_TASKS["reception"]))
    elif site_type == "hotel":
        spaces.extend(_spaces_for_count("Habitación", "bedroom", _count(attributes, "room_count")))
        spaces.extend(_spaces_for_count("Baño común", "bathroom", _count(attributes, "bathroom_count")))
        if _enabled(attributes, "has_reception"):
            spaces.append(LocationCatalogSpaceSuggestion(name="Recepción", space_type="reception", tasks=SPACE_TASKS["reception"]))
        if _enabled(attributes, "has_common_areas"):
            spaces.append(LocationCatalogSpaceSuggestion(name="Zona común", space_type="common_area", tasks=SPACE_TASKS["common_area"]))
    elif site_type == "tourist_apartment":
        spaces.extend(_spaces_for_count("Habitación", "bedroom", _count(attributes, "bedroom_count")))
        spaces.extend(_spaces_for_count("Baño", "bathroom", _count(attributes, "bathroom_count")))
        if _enabled(attributes, "has_kitchen"):
            spaces.append(LocationCatalogSpaceSuggestion(name="Cocina", space_type="kitchen", tasks=SPACE_TASKS["kitchen"]))
        if _enabled(attributes, "has_living_room"):
            spaces.append(LocationCatalogSpaceSuggestion(name="Salón", space_type="common_area", tasks=SPACE_TASKS["common_area"]))
    return LocationCatalogSuggestionResponse(spaces=spaces[:200])
