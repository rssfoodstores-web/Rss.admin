import { NextResponse } from "next/server"
import { getAdminAccessContext } from "@/lib/admin-auth"
import { getAdminActivitySnapshot } from "@/lib/admin-activity"

export const dynamic = "force-dynamic"

export async function GET() {
    const access = await getAdminAccessContext()
    const activity = await getAdminActivitySnapshot(access.supabase, access.allowedRouteKeys)

    return NextResponse.json(activity, {
        headers: { "Cache-Control": "no-store" },
    })
}
