from inspect import iscoroutinefunction

from app.api import deps
from app.api.v1 import notifications
from app.services import notification_service


def test_notification_vertical_is_async_end_to_end():
    assert iscoroutinefunction(deps.get_authenticated_user_async)
    assert iscoroutinefunction(deps.get_current_user_async)
    assert iscoroutinefunction(notifications.read_notifications)
    assert iscoroutinefunction(notifications.mark_notification_read)
    assert iscoroutinefunction(notifications.mark_all_notifications_read)
    assert iscoroutinefunction(notification_service.list_notifications_async)
    assert iscoroutinefunction(notification_service.mark_read_async)
    assert iscoroutinefunction(notification_service.mark_all_read_async)
