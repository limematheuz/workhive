from inspect import iscoroutinefunction

from app.api.v1 import task_items


def test_every_task_endpoint_is_async():
    endpoints = (
        task_items.read_task_items,
        task_items.read_task_item,
        task_items.create_task_item,
        task_items.update_task_item,
        task_items.update_task_checklist_item,
        task_items.start_task_work,
        task_items.finish_task_work,
        task_items.delete_task_item,
        task_items.accept_task_item,
        task_items.reject_task_item,
    )

    assert all(iscoroutinefunction(endpoint) for endpoint in endpoints)
