from app.services import reservation_query_service, reservation_service


def test_reservation_command_service_keeps_read_compatibility_exports():
    """Existing callers retain contracts while API reads use the focused service."""
    assert reservation_service.build_reservation_response is (
        reservation_query_service.build_reservation_response
    )
    assert reservation_service.get_reservation is reservation_query_service.get_reservation
    assert reservation_service.list_reservations is reservation_query_service.list_reservations
    assert reservation_service.list_upcoming_arrivals is (
        reservation_query_service.list_upcoming_arrivals
    )
