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
        baseFareNaira: koboToNaira(Number(value.base_fare_kobo ?? DEFAULT_DELIVERY_SETTINGS.baseFareKobo)),
        distanceRateNairaPerKm: koboToNaira(
            Number(value.distance_rate_kobo_per_km ?? DEFAULT_DELIVERY_SETTINGS.distanceRateKoboPerKm)
        ),
        riderSharePercent: Number(value.rider_share_bps ?? DEFAULT_DELIVERY_SETTINGS.riderShareBps) / 100,
        corporateDeliverySharePercent:
            Number(value.corporate_delivery_share_bps ?? DEFAULT_DELIVERY_SETTINGS.corporateDeliveryShareBps) / 100,
        originLat: Number(value.origin_lat ?? DEFAULT_DELIVERY_SETTINGS.originLat),
        originLng: Number(value.origin_lng ?? DEFAULT_DELIVERY_SETTINGS.originLng),
        originState: String(value.origin_state ?? DEFAULT_DELIVERY_SETTINGS.originState),
    }

    return <DeliverySettingsClient initialSettings={initialSettings} />
}
