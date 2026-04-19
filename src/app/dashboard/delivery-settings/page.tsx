import { createClient } from "@/lib/supabase/server"
import { koboToNaira } from "@/lib/money"
import { requireAdminRouteAccess } from "@/lib/admin-auth"
import { DeliverySettingsClient, type DeliverySettingsFormValues } from "./DeliverySettingsClient"

const DEFAULT_DELIVERY_SETTINGS = {
    baseFareKobo: 100_000,
    distanceRateKoboPerKm: 10_000,
    riderShareBps: 8_000,
    corporateDeliveryShareBps: 2_000,
    originLat: 6.5244,
    originLng: 3.3792,
    originState: "Lagos",
}

function safeNumber(value: unknown, fallback: number) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

function safeString(value: unknown, fallback: string) {
    const parsed = typeof value === "string" ? value.trim() : ""
    return parsed || fallback
}

export default async function DeliverySettingsPage() {
    await requireAdminRouteAccess("delivery_settings")

    const supabase = await createClient()
    const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "delivery_settings")
        .maybeSingle()

    const value =
        data?.value && typeof data.value === "object"
            ? data.value as Record<string, unknown>
            : {}

    const initialSettings: DeliverySettingsFormValues = {
        baseFareNaira: koboToNaira(safeNumber(value.base_fare_kobo, DEFAULT_DELIVERY_SETTINGS.baseFareKobo)),
        distanceRateNairaPerKm: koboToNaira(
            safeNumber(value.distance_rate_kobo_per_km, DEFAULT_DELIVERY_SETTINGS.distanceRateKoboPerKm)
        ),
        riderSharePercent: safeNumber(value.rider_share_bps, DEFAULT_DELIVERY_SETTINGS.riderShareBps) / 100,
        corporateDeliverySharePercent:
            safeNumber(value.corporate_delivery_share_bps, DEFAULT_DELIVERY_SETTINGS.corporateDeliveryShareBps) / 100,
        originLat: safeNumber(value.origin_lat, DEFAULT_DELIVERY_SETTINGS.originLat),
        originLng: safeNumber(value.origin_lng, DEFAULT_DELIVERY_SETTINGS.originLng),
        originState: safeString(value.origin_state, DEFAULT_DELIVERY_SETTINGS.originState),
    }

    return <DeliverySettingsClient initialSettings={initialSettings} />
}
