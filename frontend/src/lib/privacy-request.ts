export function buildPrivacyResolutionPayload(
    decision: "complete" | "reject",
    resolutionNotes: string,
) {
    return {
        decision,
        resolution_notes: resolutionNotes.trim(),
    };
}
