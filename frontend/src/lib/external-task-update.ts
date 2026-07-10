export function buildExternalTaskOperationalUpdate<TStatus extends string>(values: {
    description: string;
    scheduledStartAt: string | null;
    status: TStatus;
    dateDone: string | null;
}) {
    return {
        description: values.description || null,
        scheduled_start_at: values.scheduledStartAt,
        status: values.status,
        date_done: values.dateDone,
    };
}
