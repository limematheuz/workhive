import { NextResponse } from "next/server";

const INVITATION_TOKEN_COOKIE = "workhive_company_invitation_token";
const INVITATION_TOKEN_MAX_LENGTH = 128;
const invitationTokenCookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/accept-company-invitation",
    maxAge: 60 * 60,
};

export async function POST(request: Request) {
    const payload = await request.json().catch(() => null);
    const token = typeof payload?.token === "string" ? payload.token.trim() : "";
    if (!token || token.length > INVITATION_TOKEN_MAX_LENGTH) {
        return NextResponse.json({ detail: "Invalid invitation token" }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(INVITATION_TOKEN_COOKIE, token, invitationTokenCookie);
    return response;
}

export function DELETE() {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(INVITATION_TOKEN_COOKIE, "", {
        ...invitationTokenCookie,
        maxAge: 0,
    });
    return response;
}
