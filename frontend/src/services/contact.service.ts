import { apiFetch, assertApiResponseOk } from "@/lib/api";

export type ContactMessage = {
    name: string;
    email: string;
    subject: string;
    message: string;
    website?: string;
};

export const contactService = {
    send: async (message: ContactMessage): Promise<void> => {
        const response = await apiFetch("/api/v1/contact/", {
            method: "POST",
            body: JSON.stringify(message),
        });
        await assertApiResponseOk(response, "No se pudo enviar el mensaje");
    },
};
