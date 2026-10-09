import { createDecipheriv, createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
const EXPECTED_KEY_HASH = "427cce42b0258ec1947cc985855c61d439bcc746b33debe5b474db5a17d18756"

function decryptCredential(value: string) {
    const secret = process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!secret) throw new Error("Credential decryption is not configured.")
    const [version, iv, tag, encrypted] = value.split(":")
    if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Stored credential format is invalid.")
    const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), Buffer.from(iv, "base64"))
    decipher.setAuthTag(Buffer.from(tag, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8")
}

export async function POST(request: Request) {
    const suppliedKey = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""
    const suppliedHash = createHash("sha256").update(suppliedKey).digest()
    const expectedHash = Buffer.from(EXPECTED_KEY_HASH, "hex")
    if (suppliedHash.length !== expectedHash.length || !timingSafeEqual(suppliedHash, expectedHash)) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    try {
        const admin = createAdminClient()
        const { data: connection, error: connectionError } = await admin.from("whatsapp_connections")
            .select("graph_api_version, is_active, meta_access_token_ciphertext, waba_id")
            .eq("id", "primary").single()
        if (connectionError || !connection?.is_active || !connection.meta_access_token_ciphertext || !connection.waba_id) {
            throw new Error("The active Meta connection is incomplete.")
        }
        const token = decryptCredential(connection.meta_access_token_ciphertext)
        const base = `https://graph.facebook.com/${connection.graph_api_version}/${encodeURIComponent(connection.waba_id)}/message_templates`
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        const listResponse = await fetch(`${base}?fields=id,name,language,category,status,rejected_reason&limit=250`, { headers, cache: "no-store" })
        const list = await listResponse.json() as { data?: Array<{ id?: string; name?: string; language?: string; category?: string; status?: string; rejected_reason?: string }> }
        if (!listResponse.ok) throw new Error(`Meta lookup failed with HTTP ${listResponse.status}.`)

        const existing = (list.data ?? []).find((item) => item.name === "rss_foods" && item.language === "en_US")
        if (existing) {
            const normalized = existing.status?.toUpperCase()
            const status = normalized === "APPROVED" ? "approved" : normalized === "PENDING" ? "pending" : normalized === "REJECTED" ? "rejected" : "draft"
            const { error } = await admin.from("whatsapp_templates").update({
                external_template_id: existing.id ?? null,
                rejection_reason: existing.rejected_reason ?? null,
                status,
                updated_at: new Date().toISOString(),
            }).eq("name", "rss_foods").eq("language", "en_US")
            if (error) throw new Error("Meta template was found but RSS could not sync its status.")
            return NextResponse.json({ action: "existing_template_synced", category: existing.category, name: "rss_foods", status })
        }

        const response = await fetch(base, {
            method: "POST",
            headers,
            cache: "no-store",
            body: JSON.stringify({
                name: "rss_foods",
                language: "en_US",
                category: "AUTHENTICATION",
                message_send_ttl_seconds: 60,
                components: [
                    { type: "BODY", add_security_recommendation: true },
                    { type: "FOOTER", code_expiration_minutes: 5 },
                    { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copy Code" }] },
                ],
            }),
        })
        const result = await response.json() as { id?: string; error?: { message?: string } }
        if (!response.ok) throw new Error(`Meta rejected the template submission (HTTP ${response.status}): ${result.error?.message ?? "no reason returned"}`)

        const { error: updateError } = await admin.from("whatsapp_templates").update({
            external_template_id: result.id ?? null,
            rejection_reason: null,
            status: "pending",
            updated_at: new Date().toISOString(),
        }).eq("name", "rss_foods").eq("language", "en_US")
        if (updateError) throw new Error("Meta accepted the template, but RSS could not save its pending status.")
        return NextResponse.json({ action: "submitted", name: "rss_foods", status: "pending" })
    } catch (error) {
        console.error("One-time OTP template submission failed:", error)
        return NextResponse.json({ error: error instanceof Error ? error.message : "OTP template submission failed." }, { status: 502 })
    }
}
