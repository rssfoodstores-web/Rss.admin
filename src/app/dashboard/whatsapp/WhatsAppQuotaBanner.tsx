"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Clock3, ShieldCheck } from "lucide-react"
import { getWhatsAppSendAllowance } from "./actions"
import type { WhatsAppQuotaStatus } from "@/lib/whatsapp-quota"

function countdown(iso: string | null, now: number) {
    if (!iso) return "Waiting for the next slot"
    const seconds = Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000))
    if (!Number.isFinite(seconds)) return "Waiting for the next slot"
    return `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`
}

export function WhatsAppQuotaBanner() {
    const [quota, setQuota] = useState<WhatsAppQuotaStatus | null>(null)
    const [error, setError] = useState(false)
    const [now, setNow] = useState(() => Date.now())
    const refresh = useCallback(async () => {
        try { setQuota(await getWhatsAppSendAllowance()); setError(false) }
        catch { setQuota(null); setError(true) }
    }, [])
    useEffect(() => {
        const initial = window.setTimeout(() => void refresh(), 0)
        const poll = window.setInterval(() => void refresh(), 15_000)
        const tick = window.setInterval(() => setNow(Date.now()), 1_000)
        return () => { window.clearTimeout(initial); window.clearInterval(poll); window.clearInterval(tick) }
    }, [refresh])

    return <div className="min-w-56 rounded-2xl bg-black/20 px-4 py-3 backdrop-blur" title="RSS reserves one safety slot per unique recipient in a rolling 24 hours. Failed or uncertain sends may still reserve a slot. Direct Meta or WhatChimp sends are not included.">
        {error || !quota ? <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" /><div><p className="text-xs text-white/75">RSS send allowance</p><p className="font-bold">{error ? "Cannot verify — sends blocked" : "Checking…"}</p></div></div> : <>
            <div className="flex items-center gap-2">{quota.remaining ? <ShieldCheck className="h-4 w-4 text-lime-300" /> : <Clock3 className="h-4 w-4 text-amber-200" />}<p className="text-xs font-bold text-white/80">RSS send allowance · 24 hours</p></div>
            <p className="mt-1 text-2xl font-black tabular-nums">{quota.remaining} <span className="text-sm font-medium text-white/80">of {quota.limit} people left</span></p>
            <p className="text-xs text-white/75">{quota.used} unique recipient slots reserved by RSS</p>
            {quota.remaining === 0 ? <p className="mt-1 text-xs font-bold tabular-nums text-amber-100">Next space in {countdown(quota.nextAvailableAt, now)}</p> : null}
        </>}
        <p className="mt-1 text-[11px] text-white/65">Outside Meta/WhatChimp sends are not included.</p>
    </div>
}
