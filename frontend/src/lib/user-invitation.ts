export type WorkerInvitationInput = {
    email: string;
    full_name?: string;
    role_id: number;
};

export function buildWorkerInvitationPayload(input: WorkerInvitationInput): WorkerInvitationInput {
    return {
        ...input,
        email: input.email.trim().toLowerCase(),
        full_name: input.full_name?.trim() || undefined,
    };
}

export function buildInvitationAcceptancePayload(
    token: string,
    code: string,
    password: string,
) {
    return {
        token,
        code,
        password,
        accept_terms: true,
        accept_privacy: true,
        marketing_consent: false,
    };
}
