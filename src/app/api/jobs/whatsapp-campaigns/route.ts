import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { recordCampaignWorkerFailure, runWhatsAppCampaignBatch } from "@/lib/whatsapp-campaign-worker"

export const maxDuration = 120
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET
    if (process.env.CAMPAIGN_WORKER_ENABLED !== "true" || !secret || secret.length < 32 || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const admin = createAdminClient()
    let campaignId: string | null = null
    try {
        // A timed-out request might have reached Meta. Never automatically retry it.
        await admin.from("whatsapp_campaign_recipients")
            .update({ status: "uncertain", error_message: "Worker stopped before confirming this send. Check it before retrying." })
            .eq("status", "processing").lt("claimed_at", new Date(Date.now() - 15 * 60_000).toISOString())
        const { data, error } = await admin.from("whatsapp_campaigns").select("id")
            .eq("status", "sending").eq("auto_send", true).not("audience_id", "is", null).order("created_at").limit(1)
        if (error) throw new Error(error.message)
        campaignId = data?.[0]?.id ?? null
        if (!campaignId) return NextResponse.json({ processedCampaign: null, recipientsProcessed: 0 })
        const result = await runWhatsAppCampaignBatch(admin, campaignId, 5, "automatic")
        revalidatePath("/dashboard/whatsapp")
        return NextResponse.json({ processedCampaign: campaignId, recipientsProcessed: result.claimed, pausedForQuota: result.pausedForQuota })
    } catch (error) {
        if (campaignId) await recordCampaignWorkerFailure(admin, campaignId, error)
        return NextResponse.json({ error: "Campaign worker failed; details are visible in the campaign page." }, { status: 500 })
    }
}
