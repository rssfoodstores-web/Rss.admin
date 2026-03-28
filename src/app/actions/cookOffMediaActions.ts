"use server"

import { createClient } from "@/lib/supabase/server"
import cloudinary from "@/lib/cloudinary"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import type { AdminRouteKey } from "@/lib/admin-routes"

type CloudinaryResourceType = "image" | "video"
type AdminUploadTarget = "hero-slide" | "session-hero"
type EntryUploadTarget = "cooking-process" | "presentation"

function sanitizeFileName(fileName: string) {
    return fileName
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "asset"
}

function buildPublicId(prefix: string, fileName: string) {
    return `${prefix}-${Date.now()}-${sanitizeFileName(fileName)}`
}

function getUploadConfig() {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary media upload is not configured.")
    }

    return {
        apiKey,
        apiSecret,
        cloudName,
    }
}

async function requireAuthenticatedUser() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        throw new Error("Authentication required.")
    }

    return {
        supabase,
        user,
    }
}

async function requireAdminUser(permissionKey: AdminRouteKey) {
    return requireAdminRouteAccess(permissionKey)
}

function isAdminManagedCookOffAsset(publicId: string) {
    return publicId.startsWith("rssa1/marketing/hero/") || publicId.startsWith("rssa1/cook-off/sessions/")
}

function isUserManagedCookOffAsset(publicId: string, userId: string) {
    return publicId.startsWith(`rssa1/cook-off/entries/${userId}/`)
}

function signUpload(folder: string, publicId: string, apiSecret: string) {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = cloudinary.utils.api_sign_request(
        {
            folder,
            public_id: publicId,
            timestamp,
        },
        apiSecret
    )

    return {
        publicId,
        signature,
        timestamp,
    }
}

export async function createAdminCookOffUploadSignature(
    fileName: string,
    resourceType: CloudinaryResourceType,
    target: AdminUploadTarget
) {
    await requireAdminUser(target === "hero-slide" ? "hero_section" : "cook_off")
    const { apiKey, apiSecret, cloudName } = getUploadConfig()

    const folder =
        target === "hero-slide"
            ? "rssa1/marketing/hero"
            : "rssa1/cook-off/sessions"
    const prefix =
        target === "hero-slide"
            ? "hero-slide"
            : "cook-off-session"
    const { publicId, signature, timestamp } = signUpload(
        folder,
        buildPublicId(prefix, fileName),
        apiSecret
    )

    return {
        apiKey,
        cloudName,
        folder,
        publicId,
        resourceType,
        signature,
        timestamp,
    }
}

export async function createCookOffEntryUploadSignature(
    fileName: string,
    resourceType: CloudinaryResourceType,
    target: EntryUploadTarget
) {
    const { user } = await requireAuthenticatedUser()
    const { apiKey, apiSecret, cloudName } = getUploadConfig()

    const folder =
        target === "cooking-process"
            ? `rssa1/cook-off/entries/${user.id}/cooking-process`
            : `rssa1/cook-off/entries/${user.id}/presentation`
    const prefix =
        target === "cooking-process"
            ? "cook-process"
            : "cook-presentation"
    const { publicId, signature, timestamp } = signUpload(
        folder,
        buildPublicId(prefix, fileName),
        apiSecret
    )

    return {
        apiKey,
        cloudName,
        folder,
        publicId,
        resourceType,
        signature,
        timestamp,
    }
}

export async function deleteCookOffCloudinaryAsset(publicId: string, resourceType: CloudinaryResourceType) {
    if (!publicId) {
        return
    }

    await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: resourceType,
    })
}

export async function cleanupCookOffUploadedAsset(publicId: string, resourceType: CloudinaryResourceType) {
    if (!publicId) {
        return { success: true }
    }

    const { supabase, user } = await requireAuthenticatedUser()

    if (isUserManagedCookOffAsset(publicId, user.id)) {
        await deleteCookOffCloudinaryAsset(publicId, resourceType)
        return { success: true }
    }

    const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "sub_admin", "supa_admin"])
        .single()

    if (!roleRow || !isAdminManagedCookOffAsset(publicId)) {
        throw new Error("You are not allowed to delete this uploaded asset.")
    }

    await deleteCookOffCloudinaryAsset(publicId, resourceType)

    return { success: true }
}
