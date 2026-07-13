from inspect import iscoroutinefunction

from app.api.v1 import task_items


def test_task_read_endpoints_are_async():
    assert iscoroutinefunction(task_items.read_task_items)
    assert iscoroutinefunction(task_items.read_task_item)
