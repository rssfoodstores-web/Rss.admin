"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Plus, RefreshCw, ShieldCheck, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { saveWhatsAppTemplate, submitWhatsAppTemplate, syncWhatsAppTemplateStatuses, type WhatsAppTemplateRecord } from "./actions"

type Category = "authentication" | "marketing" | "utility"

const purposes: Array<{ color: string; description: string; disabled?: boolean; examples: string; label: string; value: Category }> = [
    { value: "utility", label: "Order or service update", description: "Use only for something the customer already did or requested.", examples: "Order ready, delivery update, payment receipt or appointment reminder.", color: "border-blue-500 bg-blue-50 dark:bg-blue-950/20" },
    { value: "marketing", label: "Promotion or general greeting", description: "Use when encouraging, welcoming or inviting someone to take action.", examples: "Welcome messages, offers, discounts, announcements or 'we are happy to have you'.", color: "border-violet-500 bg-violet-50 dark:bg-violet-950/20" },
    { value: "authentication", label: "Login or security code", description: "Use only to verify identity with a one-time code. Dedicated OTP setup is not available in this builder yet.", examples: "Login code, account verification code or password recovery code.", color: "border-amber-500 bg-amber-50 dark:bg-amber-950/20", disabled: true },
]

const variables = [
    ["customer_name", "Customer name", "Ada"], ["order_number", "Order number", "RSS-1045"],
    ["amount", "Amount", "₦12,500"], ["order_status", "Order status", "ready"],
    ["delivery_date", "Delivery date", "Tuesday"], ["location", "Location", "Lekki"],
] as const

function slug(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

function suggestedCategory(body: string): Category | null {
    const text = body.toLowerCase()
    if (/otp|one[- ]time|verification code|login code|security code|password/.test(text)) return "authentication"
    if (/order|delivery|payment|receipt|refund|appointment|booking|tracking|account update/.test(text)) return "utility"
    if (/welcome|happy to have|offer|sale|discount|promotion|shop|buy|deal|announcement/.test(text)) return "marketing"
    return null
}

function formatElapsed(value: string | null, now: number) {
    if (!value) return { hours: 0, label: "Waiting for submission time" }
    const totalSeconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000))
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const clock = [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":")
    return { hours: totalSeconds / 3600, label: days ? `${days}d ${clock}` : clock }
}

function statusCopy(status: WhatsAppTemplateRecord["status"]) {
    if (status === "approved") return "Approved by Meta and ready for campaigns."
    if (status === "rejected") return "Meta found a problem. Read the reason below before creating a corrected template."
    if (status === "paused") return "Meta paused this template. Do not use it until its status changes."
    if (status === "pending") return "Meta is reviewing the wording and selected purpose. You cannot send it yet."
    return "Saved only in RSS. Submit it when the wording and purpose are correct."
}

export function TemplateWorkspace({ canSync, templates }: { canSync: boolean; templates: WhatsAppTemplateRecord[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [isSyncing, setIsSyncing] = useState(false)
    const [now, setNow] = useState(() => Date.now())
    const [form, setForm] = useState({ body: "", category: "utility" as Category, displayName: "", language: "en_US", name: "" })
    const [customVariable, setCustomVariable] = useState("")
    const [expandedTemplateIds, setExpandedTemplateIds] = useState<string[]>([])
    const suggestion = suggestedCategory(form.body)
    const mismatch = suggestion && suggestion !== form.category
    const preview = useMemo(() => form.body.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, name: string) => variables.find(([key]) => key === name)?.[2] ?? `Sample ${name.replace(/_/g, " ")}`), [form.body])

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(timer)
    }, [])

    function act(action: () => Promise<{ error?: string; success?: true }>, success: string) {
        startTransition(() => void action().then((result) => {
            if (result.error) return toast.error(result.error)
            toast.success(success)
            router.refresh()
        }).catch(() => toast.error("Something went wrong.")))
    }

    function addVariable(name: string) {
        setForm((current) => ({ ...current, body: `${current.body}${current.body && !current.body.endsWith(" ") ? " " : ""}{{${name}}}` }))
    }

    function addCustomVariable() {
        const name = customVariable.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^[^a-z]+/, "").replace(/_+$/g, "")
        if (!name) return toast.error("Start the variable name with a letter, for example product_name.")
        addVariable(name)
        setCustomVariable("")
        toast.success(`${name.replace(/_/g, " ")} added to the message.`)
    }

    async function checkWithMeta() {
        setIsSyncing(true)
        try {
            const result = await syncWhatsAppTemplateStatuses()
            if (result.error) return toast.error(result.error)
            toast.success("Latest statuses received from Meta.")
            router.refresh()
        } catch {
            toast.error("Could not check Meta right now.")
        } finally {
            setIsSyncing(false)
        }
    }

    return <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#128C7E]">Easy template builder</p>
            <h2 className="mt-2 text-3xl font-black">What kind of message is this?</h2>
            <p className="mt-2 text-sm text-gray-500">Choose the reason first. Meta checks whether the message matches this choice.</p>
            <div className="mt-6 space-y-3">{purposes.map((purpose) => <button type="button" disabled={purpose.disabled} key={purpose.value} onClick={() => setForm((current) => ({ ...current, category: purpose.value }))} className={cn("w-full rounded-2xl border-2 p-4 text-left transition", form.category === purpose.value ? purpose.color : "border-gray-100 hover:border-gray-300 dark:border-zinc-800", purpose.disabled && "cursor-not-allowed opacity-60")}><div className="flex items-center justify-between gap-3"><strong>{purpose.label}</strong>{purpose.disabled ? <Badge variant="outline">Dedicated setup required</Badge> : form.category === purpose.value ? <CheckCircle2 className="h-5 w-5 text-[#128C7E]" /> : null}</div><p className="mt-1 text-sm text-gray-600 dark:text-zinc-300">{purpose.description}</p><p className="mt-1 text-xs text-gray-500">Examples: {purpose.examples}</p></button>)}</div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="space-y-2"><span className="text-sm font-bold">Friendly name</span><Input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value, name: slug(event.target.value) }))} placeholder="Example: Order ready" /></label><label className="space-y-2"><span className="text-sm font-bold">Language</span><select className="h-10 w-full rounded-md border bg-background px-3" value={form.language} onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}><option value="en_US">English (US)</option><option value="en_GB">English (UK)</option></select></label></div>
            <label className="mt-4 block space-y-2"><span className="text-sm font-bold">Write the message</span><Textarea className="min-h-40 text-base" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} placeholder="Example: Hi, your order is ready." /></label>
            <div className="mt-4"><p className="text-sm font-bold">Add personal information</p><p className="text-xs text-gray-500">Click a common choice, or write your own. We add the brackets for you.</p><div className="mt-3 flex flex-wrap gap-2">{variables.map(([name, variableLabel]) => <Button type="button" size="sm" variant="outline" key={name} onClick={() => addVariable(name)}><Plus className="mr-1 h-3 w-3" />{variableLabel}</Button>)}</div><div className="mt-3 flex gap-2"><Input value={customVariable} onChange={(event) => setCustomVariable(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomVariable() } }} placeholder="Other information, e.g. product name" /><Button type="button" variant="outline" disabled={!customVariable.trim()} onClick={addCustomVariable}><Plus className="mr-1 h-4 w-4" />Add variable</Button></div><p className="mt-2 text-xs text-gray-500">Use a short description. Spaces automatically become underscores.</p></div>

            {mismatch ? <div className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertTriangle className="h-5 w-5 shrink-0" /><div><strong>This purpose does not match the message.</strong><p className="mt-1">{suggestion === "authentication" ? "This looks like an OTP or security message. Authentication needs a dedicated setup, so this builder will not save it as Utility or Marketing." : <>This looks like <strong>{purposes.find((purpose) => purpose.value === suggestion)?.label}</strong>. Select that purpose before saving so Meta does not reject or reclassify it.</>}</p></div></div> : suggestion ? <div className="mt-5 flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900"><ShieldCheck className="h-5 w-5 shrink-0" /><span>The wording matches <strong>{purposes.find((purpose) => purpose.value === suggestion)?.label}</strong>.</span></div> : <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><strong>Please check the purpose carefully.</strong> We could not confidently recognize this message type.</div>}

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Customer preview</p><p className="mt-2 whitespace-pre-wrap text-sm">{preview || "Your finished message will appear here."}</p></div>
            <details className="mt-4 rounded-xl bg-gray-50 p-3 text-sm dark:bg-zinc-800"><summary className="cursor-pointer font-bold">Advanced details</summary><label className="mt-3 block space-y-2"><span>Meta template name</span><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: slug(event.target.value) }))} /></label></details>
            <Button disabled={isPending || !form.displayName.trim() || !form.body.trim() || Boolean(mismatch)} className="mt-5 h-12 w-full bg-[#128C7E]" onClick={() => act(() => saveWhatsAppTemplate(form), "Template saved as a draft. Review it, then submit it to Meta.")}><Sparkles className="mr-2 h-4 w-4" />Save as draft</Button>
        </section>

        <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Your templates</h2><p className="text-sm text-gray-500">Every status explains what it means and what to do next.</p></div><Button variant="outline" aria-busy={isSyncing} disabled={isSyncing || isPending || !canSync} onClick={() => void checkWithMeta()}>{isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}<span aria-live="polite">{isSyncing ? "Checking Meta…" : "Check with Meta"}</span></Button></div>
            <div className="mt-5 space-y-4">{templates.length ? templates.map((template) => {
                const elapsed = formatElapsed(template.submittedAt, now)
                const noProblem = !template.rejectionReason || template.rejectionReason.toUpperCase() === "NONE"
                const progress = template.status === "pending" ? Math.min(95, Math.max(4, (elapsed.hours / 24) * 100)) : template.status === "approved" ? 100 : 0
                const isDraft = template.status === "draft"
                const expanded = expandedTemplateIds.includes(template.id)
                return <article key={template.id} className="group/template rounded-2xl border border-gray-100 p-5 transition hover:border-emerald-200 hover:shadow-sm dark:border-zinc-800"><button type="button" aria-expanded={expanded} onClick={() => setExpandedTemplateIds((current) => current.includes(template.id) ? current.filter((id) => id !== template.id) : [...current, template.id])} className="flex w-full items-start justify-between gap-4 text-left"><div><p className="text-lg font-black">{template.displayName}</p><p className="mt-1 font-mono text-xs text-gray-400">{template.name}</p><p className="mt-2 text-xs font-semibold text-[#128C7E]">{expanded ? "Click to hide details" : "Hover or click to see details"}</p></div><Badge className={cn("capitalize", template.status === "approved" && "bg-emerald-100 text-emerald-700", template.status === "pending" && "bg-amber-100 text-amber-700", template.status === "rejected" && "bg-red-100 text-red-700")}>{template.status}</Badge></button>{template.status === "pending" ? <div className="mt-4"><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1 font-bold text-amber-700"><Clock3 className="h-4 w-4" />Under Meta review</span><span>{elapsed.label} pending</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-gray-500">The bar compares the wait with Meta’s usual 24-hour review window. It is an estimate, not a deadline.{elapsed.hours >= 24 ? " This is taking longer than usual—check with Meta again and then inspect WhatsApp Manager." : ""}</p></div> : null}<div className={cn("mt-3", !expanded && "hidden group-hover/template:block group-focus-within/template:block")}><div className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-zinc-800"><strong className="capitalize">{purposes.find((purpose) => purpose.value === template.category)?.label ?? template.category}</strong><p className="mt-1 text-xs text-gray-500">{statusCopy(template.status)}</p></div><p className="mt-3 text-sm text-gray-700 dark:text-zinc-200">{template.body}</p><div className="mt-3 flex flex-wrap gap-2">{template.variables.map((variable) => <Badge variant="outline" key={variable.name}>{variable.name.replace(/_/g, " ")}</Badge>)}{!template.variables.length ? <span className="text-xs text-gray-400">No personal information</span> : null}</div><div className={cn("mt-4 flex gap-2 rounded-xl p-3 text-xs", isDraft ? "bg-blue-50 text-blue-800" : noProblem ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>{isDraft ? <Sparkles className="h-4 w-4 shrink-0" /> : noProblem ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}<span><strong>{isDraft ? "Not submitted to Meta yet" : noProblem ? "No problem reported by Meta" : "Meta reported a problem"}</strong><br />{isDraft ? "This is still an RSS draft. Check its purpose and preview before submitting." : noProblem ? template.status === "approved" ? "Meta approved this template and reported no problem." : "Meta returned no rejection reason. Pending only means the review is not finished." : template.rejectionReason}</span></div>{template.status === "draft" ? <Button size="sm" className="mt-4" disabled={isPending || !canSync} onClick={() => act(() => submitWhatsAppTemplate(template.id), "Template submitted to Meta for review.")}>Submit to Meta</Button> : null}</div></article>
            }) : <p className="py-10 text-center text-sm text-gray-500">No templates yet.</p>}</div>
        </section>
    </div>
}
