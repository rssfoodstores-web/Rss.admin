"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { nairaToKobo } from "@/lib/money"
import { type AdminRouteKey, getPrimaryAdminRole } from "@/lib/admin-routes"
import { requireAdminRouteAccess } from "@/lib/admin-auth"

async function getActorContext(permissionKey: AdminRouteKey) {
    const access = await requireAdminRouteAccess(permissionKey)
    const actorRole = getPrimaryAdminRole(access.roleNames) ?? "admin"

    return {
        actorRole,
        supabase: access.supabase,
        user: access.user,
    }
}

async function writeAuditLog(
    supabase: Awaited<ReturnType<typeof createClient>>,
    {
        actorId,
        actorRole,
        action,
        entityType,
        entityId,
        metadata = {},
    }: {
        actorId: string
        actorRole: string
        action: string
        entityType: string
        entityId: string
        metadata?: Record<string, unknown>
    }
) {
    await supabase.from("audit_logs").insert({
        actor_id: actorId,
        actor_role: actorRole,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
    })
}

async function grantRole(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    role: "merchant" | "rider" | "agent"
) {
    const { error } = await supabase
        .from("user_roles")
        .upsert(
            {
                user_id: userId,
                role,
            },
            {
                onConflict: "user_id,role",
            }
        )

    if (error) {
        return { error: error.message }
    }

    return { success: true as const }
}

async function revokeRole(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    role: "merchant" | "rider" | "agent"
) {
    const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role)

    if (error) {
        return { error: error.message }
    }

    return { success: true as const }
}

async function getPlatformFinancialSettings() {
    const supabase = await createClient()
    const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "platform_financial_settings")
        .single()

    const settings = (data?.value ?? {}) as Record<string, number>

    return {
        agent_fee_bps: Number(settings.agent_fee_bps ?? 200),
        app_fee_bps: Number(settings.app_fee_bps ?? 1000),
        ops_fee_bps: Number(settings.ops_fee_bps ?? 200),
        insurance_default_kobo: Number(settings.insurance_default_kobo ?? 0),
        vat_bps: Number(settings.vat_bps ?? 750),
    }
}

export async function approveProductPricing(formData: FormData) {
    const actor = await getActorContext("approvals")
    const supabase = actor.supabase

    const productId = String(formData.get("product_id") ?? "")
    const approvedPriceNaira = Number(formData.get("approved_price_naira") ?? 0)
    const insuranceNaira = Number(formData.get("insurance_naira") ?? 0)

    if (!productId || approvedPriceNaira <= 0) {
        return { error: "Product ID and approved price are required." }
    }

    const [{ data: merchantInput }, { data: agentInput }, platform] = await Promise.all([
        supabase
            .from("product_price_inputs")
            .select("amount_kobo")
            .eq("product_id", productId)
            .eq("source", "merchant")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from("product_price_inputs")
            .select("amount_kobo")
            .eq("product_id", productId)
            .eq("source", "agent")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        getPlatformFinancialSettings(),
    ])

    if (!merchantInput) {
        return { error: "Merchant price input is required before approval." }
    }

    if (merchantInput.amount_kobo <= 0) {
        return { error: "Merchant base price must be greater than ₦0.00 before approval." }
    }

    const approvedPriceKobo = nairaToKobo(approvedPriceNaira)
    const insuranceKobo = nairaToKobo(insuranceNaira)

    await supabase
        .from("product_pricing_snapshots")
        .update({ is_active: false })
        .eq("product_id", productId)

    const { data: snapshot, error: snapshotError } = await supabase
        .from("product_pricing_snapshots")
        .insert({
            product_id: productId,
            merchant_reference_kobo: merchantInput.amount_kobo,
            agent_reference_kobo: agentInput?.amount_kobo ?? null,
            approved_price_kobo: approvedPriceKobo,
            agent_fee_bps: platform.agent_fee_bps,
            app_fee_bps: platform.app_fee_bps,
            ops_fee_bps: platform.ops_fee_bps,
            insurance_kobo: insuranceKobo,
            vat_bps: platform.vat_bps,
            approved_by: actor.user.id,
            approved_at: new Date().toISOString(),
            is_active: true,
        })
        .select("id")
        .single()

    if (snapshotError || !snapshot) {
        return { error: snapshotError?.message ?? "Unable to create pricing snapshot." }
    }

    await supabase.from("product_price_inputs").insert({
        product_id: productId,
        source: "admin",
        source_user_id: actor.user.id,
        amount_kobo: approvedPriceKobo,
        notes: "Admin approved final customer price",
    })

    const { error: productError } = await supabase
        .from("products")
        .update({
            price: approvedPriceKobo,
            active_pricing_id: snapshot.id,
            status: "approved",
            submitted_for_review_at: new Date().toISOString(),
        })
        .eq("id", productId)

    if (productError) {
        return { error: productError.message }
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "approve_product_pricing",
        entityType: "product",
        entityId: productId,
        metadata: {
            approved_price_kobo: approvedPriceKobo,
            insurance_kobo: insuranceKobo,
            snapshot_id: snapshot.id,
        },
    })

    revalidatePath("/dashboard/approvals")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function rejectProductPricing(formData: FormData) {
    const actor = await getActorContext("approvals")
    const supabase = actor.supabase

    const productId = String(formData.get("product_id") ?? "")

    if (!productId) {
        return { error: "Product ID is required." }
    }

    const { error } = await supabase
        .from("products")
        .update({
            status: "rejected",
            submitted_for_review_at: new Date().toISOString(),
        })
        .eq("id", productId)

    if (error) {
        return { error: error.message }
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "reject_product_pricing",
        entityType: "product",
        entityId: productId,
    })

    revalidatePath("/dashboard/approvals")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function approveRider(id: string) {
    const actor = await getActorContext("approvals")
    const supabase = actor.supabase

    const { error } = await supabase
        .from("rider_profiles")
        .update({ status: "approved" })
        .eq("id", id)

    if (error) {
        return { error: error.message }
    }

    const roleResult = await grantRole(supabase, id, "rider")

    if ("error" in roleResult) {
        return roleResult
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "approve_rider",
        entityType: "rider_profile",
        entityId: id,
    })

    revalidatePath("/dashboard/approvals")
    revalidatePath(`/dashboard/users/${id}`)
    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function rejectRider(id: string) {
    const actor = await getActorContext("approvals")
    const supabase = actor.supabase

    const { error } = await supabase
        .from("rider_profiles")
        .update({ status: "rejected" })
        .eq("id", id)

    if (error) {
        return { error: error.message }
    }

    const roleResult = await revokeRole(supabase, id, "rider")

    if ("error" in roleResult) {
        return roleResult
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "reject_rider",
        entityType: "rider_profile",
        entityId: id,
    })

    revalidatePath("/dashboard/approvals")
    revalidatePath(`/dashboard/users/${id}`)
    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function approveMerchant(id: string) {
    const actor = await getActorContext("approvals")
    const supabase = actor.supabase

    const { error } = await supabase
        .from("merchants")
        .update({
            status: "approved",
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)

    if (error) {
        return { error: error.message }
    }

    const roleResult = await grantRole(supabase, id, "merchant")

    if ("error" in roleResult) {
        return roleResult
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "approve_merchant",
        entityType: "merchant",
        entityId: id,
    })

    revalidatePath("/dashboard/approvals")
    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function rejectMerchant(id: string) {
    const actor = await getActorContext("approvals")
    const supabase = actor.supabase

    const { error } = await supabase
        .from("merchants")
        .update({
            status: "rejected",
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)

    if (error) {
        return { error: error.message }
    }

    const roleResult = await revokeRole(supabase, id, "merchant")

    if ("error" in roleResult) {
        return roleResult
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "reject_merchant",
        entityType: "merchant",
        entityId: id,
    })

    revalidatePath("/dashboard/approvals")
    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function approveAgent(id: string) {
    const actor = await getActorContext("approvals")
    const supabase = actor.supabase

    const { error } = await supabase
        .from("agent_profiles")
        .update({
            status: "approved",
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)

    if (error) {
        return { error: error.message }
    }

    const roleResult = await grantRole(supabase, id, "agent")

    if ("error" in roleResult) {
        return roleResult
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "approve_agent",
        entityType: "agent_profile",
        entityId: id,
    })

    revalidatePath("/dashboard/approvals")
    revalidatePath(`/dashboard/users/${id}`)
    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function rejectAgent(id: string) {
    const actor = await getActorContext("approvals")
    const supabase = actor.supabase

    const { error } = await supabase
        .from("agent_profiles")
        .update({
            status: "rejected",
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)

    if (error) {
        return { error: error.message }
    }

    const roleResult = await revokeRole(supabase, id, "agent")

    if ("error" in roleResult) {
        return roleResult
    }

    await writeAuditLog(supabase, {
        actorId: actor.user.id,
        actorRole: actor.actorRole,
        action: "reject_agent",
        entityType: "agent_profile",
        entityId: id,
    })

    revalidatePath("/dashboard/approvals")
    revalidatePath(`/dashboard/users/${id}`)
    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/audit-logs")
    return { success: true }
}

export async function approveProduct(id: string) {
    void id
    return {
        error: "Use the pricing approval workspace to set the final approved customer price before approving a product.",
    }
}

export async function rejectProduct(id: string) {
    const formData = new FormData()
    formData.set("product_id", id)
    return rejectProductPricing(formData)
}
