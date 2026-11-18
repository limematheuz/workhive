from app.repositories.work_order_execution import has_open_work


def accepts_execution_costs(db,order):
    # A one-off order exhausts its schedule as soon as its execution is generated.
    # Its current job still needs materials and supplier costs until execution closes.
    return order.status in {"active","paused"} or (order.status=="completed" and has_open_work(db,order.company_id,order.id))
