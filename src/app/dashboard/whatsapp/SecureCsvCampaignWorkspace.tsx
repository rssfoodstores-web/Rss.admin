"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, FileSpreadsheet, Loader2, Search, Send, Upload, Users } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
    getCampaignReadiness, listSavedAudiences, previewDatabaseAudience, previewSavedAudience,
    queueAudienceCampaign, resumeAudienceCampaign, saveDatabaseAudience, type AudienceFilters, type AudiencePreviewRow,
    type AudienceSummary,
} from "./audience-actions"
import type { WhatsAppCampaignRecord, WhatsAppTemplateRecord } from "./actions"

const roles = ["customer", "rider", "merchant", "agent", "admin", "sub_admin", "supa_admin"]
const labels: Record<string, string> = {
    address: "Address", email: "Email", full_name: "Customer name", order_number: "Order number",
    order_status: "Order status", phone: "WhatsApp number", registration_method: "Registration method",
    roles: "Role", source: "Added from", state: "State",
}
const descriptions: Record<string, string> = {
    address: "Saved delivery address, if available.",
    email: "The email saved on this customer's account.",
    full_name: "The customer's name for a personal greeting.",
    order_number: "The customer's latest RSS order number.",
    order_status: "Status of the customer's latest RSS order.",
    phone: "Their normalized WhatsApp number. Keep this in the downloaded CSV.",
    registration_method: "Google, phone, email or admin-created account.",
    roles: "Customer, rider, merchant or another RSS role.",
    source: "RSS registration, Add User page or WhatsApp Contact Book.",
    state: "The state saved on the customer profile.",
}
const databaseColumns = Object.keys(labels)
const defaultFilters: AudienceFilters = {
    origin: "all", registration: "all", roles: ["customer"],
    requirements: { consent: false, email: false, name: true, order: false, phone: true }, search: "",
}
type Preview = { consentCount: number; rows: AudiencePreviewRow[]; total: number }

function ColumnChoice({ checked, column, onChange }: { checked: boolean; column: string; onChange: (checked: boolean) => void }) {
    return <label className="group/field relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:border-emerald-300 focus-within:border-emerald-500">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{labels[column] ?? column}</span>
        <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden w-[min(20rem,calc(100vw-3rem))] rounded-xl bg-zinc-950 p-3 text-xs leading-5 text-white shadow-xl group-hover/field:block group-focus-within/field:block">{descriptions[column] ?? "Include this uploaded CSV field in the saved audience and template mapping. It does not filter people."}</span>
    </label>
}

function PreviewTable({ columns, preview }: { columns: string[]; preview: Preview }) {
    const shown = columns.slice(0, 6)
    return <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-zinc-800"><tr>{shown.map((column) => <th key={column} className="whitespace-nowrap p-3">{labels[column] ?? column}</th>)}<th className="p-3">Consent</th></tr></thead>
            <tbody>{preview.rows.map((row) => <tr key={row.rowKey} className="border-t dark:border-zinc-800">{shown.map((column) => <td key={column} className="max-w-52 truncate p-3">{row.fields[column] || "—"}</td>)}<td className="p-3">{row.consent ? "Yes" : "No"}</td></tr>)}</tbody>
        </table>
        {!preview.rows.length ? <p className="p-7 text-center text-sm text-gray-500">No customers match these choices.</p> : null}
    </div>
}

function csvHeaders(sample: string) {
    const headers: string[] = []
    let value = "", quoted = false
    for (let i = 0; i < sample.length; i += 1) {
        const char = sample[i]
        if (char === '"' && quoted && sample[i + 1] === '"') { value += '"'; i += 1 }
        else if (char === '"') quoted = !quoted
        else if (char === "," && !quoted) { headers.push(value.trim().replace(/^\uFEFF/, "")); value = "" }
        else if ((char === "\n" || char === "\r") && !quoted) break
        else value += char
    }
    headers.push(value.trim())
    return headers.filter(Boolean)
}

export function SecureCsvCampaignWorkspace({ campaigns, mode, templates, workerConfigured }: {
    campaigns: WhatsAppCampaignRecord[]; mode: "builder" | "campaign"; templates: WhatsAppTemplateRecord[]; workerConfigured: boolean
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [filters, setFilters] = useState<AudienceFilters>(defaultFilters)
    const [source, setSource] = useState<"database" | "upload">("database")
    const [page, setPage] = useState(0)
    const [preview, setPreview] = useState<Preview>({ rows: [], total: 0, consentCount: 0 })
    const [loading, setLoading] = useState(false)
    const [columns, setColumns] = useState(["full_name", "phone", "email", "roles"])
    const [audienceName, setAudienceName] = useState("")
    const [audiences, setAudiences] = useState<AudienceSummary[]>([])
    const [savedId, setSavedId] = useState("")
    const [legacyCount, setLegacyCount] = useState(0)
    const [file, setFile] = useState<File | null>(null)
    const [uploadHeaders, setUploadHeaders] = useState<string[]>([])
    const [uploadPhone, setUploadPhone] = useState("")
    const [uploadConsent, setUploadConsent] = useState(false)
    const [campaignName, setCampaignName] = useState("")
    const [audienceId, setAudienceId] = useState("")
    const [templateId, setTemplateId] = useState("")
    const [mapping, setMapping] = useState<Record<string, string>>({})
    const [ready, setReady] = useState<number | null>(null)
    const [sample, setSample] = useState<AudiencePreviewRow | null>(null)
    const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
    const selectedAudience = audiences.find((item) => item.id === audienceId)
    const selectedTemplate = templates.find((item) => item.id === templateId && item.status === "approved")

    useEffect(() => {
        let active = true
        const timer = window.setTimeout(() => {
            try {
                const prior = JSON.parse(localStorage.getItem("rss-whatsapp-csv-audiences-v1") ?? "[]")
                if (active && Array.isArray(prior)) setLegacyCount(prior.length)
            } catch { /* An invalid old cache cannot be migrated. */ }
        }, 0)
        void listSavedAudiences().then((result) => {
            if (active && result.audiences) setAudiences(result.audiences)
            if (active && result.error) toast.error(result.error)
        })
        return () => { active = false; window.clearTimeout(timer) }
    }, [])

    useEffect(() => {
        if (mode !== "builder" || source !== "database") return
        let active = true
        const timer = window.setTimeout(() => {
            void previewDatabaseAudience(filters, page).then((result) => {
                if (!active) return
                setLoading(false)
                if (result.error) return toast.error(result.error)
                setPreview({ rows: result.rows ?? [], total: result.total ?? 0, consentCount: result.consentCount ?? 0 })
            })
        }, 350)
        return () => { active = false; window.clearTimeout(timer) }
    }, [filters, page, source, mode])

    useEffect(() => {
        if (mode !== "campaign" || !selectedAudience || !selectedTemplate) return
        let active = true
        void previewSavedAudience(selectedAudience.id, 0).then((result) => {
            if (active) setSample(result.rows?.[0] ?? null)
        })
        void getCampaignReadiness({ audienceId: selectedAudience.id, templateId: selectedTemplate.id, mapping }).then((result) => {
            if (active) setReady(result.ready ?? 0)
        })
        return () => { active = false }
    }, [mode, selectedAudience, selectedTemplate, mapping])

    useEffect(() => {
        if (mode !== "campaign" || !campaigns.some((item) => item.status === "sending")) return
        const timer = window.setInterval(() => router.refresh(), 15_000)
        return () => window.clearInterval(timer)
    }, [campaigns, mode, router])

    function changeFilters(update: Partial<AudienceFilters>) {
        setPage(0)
        setLoading(true)
        setFilters((current) => ({ ...current, ...update }))
    }
    function changeColumns(column: string, checked: boolean) {
        setColumns((current) => checked ? [...current, column] : current.filter((item) => item !== column))
    }
    function save() {
        startTransition(() => void saveDatabaseAudience({ columns, filters, name: audienceName }).then((result) => {
            if (result.error) return toast.error(result.error)
            if (result.audience) {
                setAudiences((current) => [result.audience!, ...current])
                setSavedId(result.audience.id)
                toast.success(`Saved ${result.audience.rowCount} unique numbers in Supabase.`)
            }
        }).catch(() => toast.error("Could not save this audience.")))
    }
    async function chooseFile(nextFile?: File) {
        if (!nextFile) return
        if (nextFile.size > 10_000_000) return toast.error("Choose a CSV smaller than 10 MB.")
        const headers = csvHeaders(await nextFile.slice(0, 8192).text())
        if (!headers.length) return toast.error("The CSV needs a heading row.")
        setFile(nextFile)
        setUploadHeaders(headers)
        setUploadPhone(headers.find((header) => /whats|phone|mobile/i.test(header)) ?? headers[0])
        setColumns(headers)
        setAudienceName(nextFile.name.replace(/\.csv$/i, ""))
    }
    async function upload() {
        if (!file || !audienceName.trim() || !uploadPhone || !columns.length) return toast.error("Choose a file, phone column and audience name.")
        const form = new FormData()
        form.set("file", file); form.set("name", audienceName); form.set("phoneColumn", uploadPhone)
        form.set("columns", JSON.stringify(columns)); form.set("consent", String(uploadConsent))
        setLoading(true)
        try {
            const response = await fetch("/api/whatsapp/audiences/upload", { method: "POST", body: form })
            const result = await response.json()
            if (!response.ok) return toast.error(result.error ?? "Upload failed.")
            setSavedId(result.audienceId)
            const list = await listSavedAudiences()
            if (list.audiences) setAudiences(list.audiences)
            toast.success(`Imported ${result.count} unique WhatsApp numbers into Supabase.`)
        } catch {
            toast.error("Upload failed. Try again.")
        } finally { setLoading(false) }
    }
    async function migrateLegacy() {
        let remaining: unknown[]
        try {
            remaining = JSON.parse(localStorage.getItem("rss-whatsapp-csv-audiences-v1") ?? "[]")
            if (!Array.isArray(remaining)) throw new Error("Invalid old audience cache.")
        } catch { return toast.error("The old audience cache cannot be read.") }
        setLoading(true)
        try {
            while (remaining.length) {
                const response = await fetch("/api/whatsapp/audiences/migrate", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(remaining[0]),
                })
                const result = await response.json()
                if (!response.ok) throw new Error(result.error ?? "Could not migrate an old audience.")
                remaining = remaining.slice(1)
                localStorage.setItem("rss-whatsapp-csv-audiences-v1", JSON.stringify(remaining))
                setLegacyCount(remaining.length)
            }
            localStorage.removeItem("rss-whatsapp-csv-audiences-v1")
            const list = await listSavedAudiences()
            if (list.audiences) setAudiences(list.audiences)
            toast.success("Old browser audiences moved to Supabase. Local copies removed.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Migration stopped. Remaining browser audiences were preserved.")
        } finally { setLoading(false) }
    }
    function queue() {
        if (!selectedAudience || !selectedTemplate || !ready) return
        if (!window.confirm(`Queue this approved template for ${ready.toLocaleString()} consented people? Sending happens in the background.`)) return
        startTransition(() => void queueAudienceCampaign({
            audienceId: selectedAudience.id, templateId: selectedTemplate.id, name: campaignName,
            mapping, requestKey,
        }).then((result) => {
            if (result.error) return toast.error(result.error)
            toast.success("Campaign queued. Watch progress below.")
            setRequestKey(crypto.randomUUID())
            router.refresh()
        }).catch(() => toast.error("Could not queue campaign.")))
    }

    if (mode === "builder") return <div className="space-y-6">
        {legacyCount > 0 ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><p className="font-bold">{legacyCount} older audience{legacyCount === 1 ? "" : "s"} saved in this browser</p><p className="mt-1 text-sm">Move them to Supabase so the team can use them. Each old local copy is removed only after it is saved successfully.</p><Button variant="outline" className="mt-3" disabled={loading} onClick={() => void migrateLegacy()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Move old audiences securely</Button></div> : null}
        <section className="rounded-[2rem] border bg-white p-6 dark:bg-zinc-900">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#128C7E]">CSV Builder</p>
            <h2 className="mt-2 text-3xl font-black">Who should receive the message?</h2>
            <p className="mt-2 text-sm text-gray-500">The database does the filtering. Only 50 preview rows come to this page at once.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button type="button" onClick={() => { setSource("database"); setColumns(["full_name", "phone", "email", "roles"]) }} className={cn("rounded-2xl border-2 p-5 text-left", source === "database" ? "border-[#128C7E] bg-emerald-50" : "border-gray-100 dark:border-zinc-800")}><Users className="h-6 w-6 text-[#128C7E]" /><strong className="mt-2 block">People already in RSS</strong></button>
                <button type="button" onClick={() => setSource("upload")} className={cn("rounded-2xl border-2 p-5 text-left", source === "upload" ? "border-[#128C7E] bg-emerald-50" : "border-gray-100 dark:border-zinc-800")}><Upload className="h-6 w-6 text-[#128C7E]" /><strong className="mt-2 block">Upload a CSV file</strong></button>
            </div>
            {source === "database" ? <div className="mt-7 space-y-5">
                <div><p className="font-bold">Choose their role</p><p className="text-xs text-gray-500">Leave all roles unticked to include every role.</p><div className="mt-3 flex flex-wrap gap-2">{roles.map((role) => <button type="button" key={role} aria-pressed={filters.roles.includes(role)} onClick={() => changeFilters({ roles: filters.roles.includes(role) ? filters.roles.filter((item) => item !== role) : [...filters.roles, role] })} className={cn("rounded-full border px-4 py-2 text-sm capitalize", filters.roles.includes(role) ? "border-[#128C7E] bg-[#128C7E] text-white" : "border-gray-200")}>{role.replace("_", " ")}</button>)}</div></div>
                <div className="grid gap-4 md:grid-cols-2"><label className="space-y-2"><span className="font-bold">Where were they added?</span><select className="h-11 w-full rounded-xl border bg-background px-3" value={filters.origin} onChange={(event) => changeFilters({ origin: event.target.value as AudienceFilters["origin"] })}><option value="all">Anywhere</option><option value="rss">Registered on RSS</option><option value="admin">Added on Add User page</option><option value="dashboard">Added in WhatsApp dashboard</option></select></label><label className="space-y-2"><span className="font-bold">How was their account created?</span><select className="h-11 w-full rounded-xl border bg-background px-3" value={filters.registration} onChange={(event) => changeFilters({ registration: event.target.value as AudienceFilters["registration"] })}><option value="all">Any method</option><option value="google">Signed in with Google</option><option value="phone">Phone-confirmed account</option><option value="email">Email-confirmed account</option><option value="admin">Added on Add User page</option></select></label></div>
                <details className="rounded-2xl bg-gray-50 p-4 dark:bg-zinc-800"><summary className="cursor-pointer font-bold">More choices</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries({ consent: "Has WhatsApp consent", email: "Has email", name: "Has name", order: "Has an order", phone: "Has a valid phone number" }).map(([key, text]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.requirements[key as keyof AudienceFilters["requirements"]]} onChange={(event) => changeFilters({ requirements: { ...filters.requirements, [key]: event.target.checked } })} />{text}</label>)}</div></details>
                <label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input type="search" className="pl-9" placeholder="Search name, email or phone" value={filters.search} onChange={(event) => changeFilters({ search: event.target.value })} /></label>
            </div> : <div className="mt-7 space-y-4"><label className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center"><input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0])} /><span><FileSpreadsheet className="mx-auto h-8 w-8 text-[#128C7E]" /><strong className="mt-2 block">{file?.name ?? "Choose a CSV file"}</strong><small>Only headings are inspected in the browser; rows are imported on the server.</small></span></label>{file ? <><label className="block space-y-2"><span className="font-bold">Which heading contains WhatsApp numbers?</span><select className="h-11 w-full rounded-xl border bg-background px-3" value={uploadPhone} onChange={(event) => setUploadPhone(event.target.value)}>{uploadHeaders.map((header) => <option key={header} value={header}>{header}</option>)}</select></label><label className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"><input type="checkbox" checked={uploadConsent} onChange={(event) => setUploadConsent(event.target.checked)} /><span>I have these people’s permission to receive WhatsApp messages. Unticked rows remain in the audience but cannot be sent a campaign.</span></label></> : null}</div>}
        </section>
        {(source === "database" || file) ? <section className="rounded-[2rem] border bg-white p-6 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#128C7E]">Live audience preview</p><h2 className="mt-1 text-2xl font-black">{source === "database" ? preview.total.toLocaleString() : "Uploaded CSV"} people found</h2><p className="text-sm text-gray-500">Tick details to save as CSV columns. These choices do not change who matches.</p></div>{source === "database" ? <Badge className="bg-emerald-100 text-emerald-700">{preview.consentCount.toLocaleString()} consented</Badge> : null}</div>
            {loading ? <p className="mt-4 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Updating preview…</p> : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(source === "database" ? databaseColumns : uploadHeaders).map((column) => <ColumnChoice key={column} column={column} checked={columns.includes(column)} onChange={(checked) => changeColumns(column, checked)} />)}</div>
            {source === "database" ? <><div className="mt-5"><PreviewTable columns={columns} preview={preview} /></div><div className="mt-3 flex items-center justify-between text-sm"><span>Page {page + 1} of {Math.max(1, Math.ceil(preview.total / 50))} · up to 50 shown</span><div className="flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button variant="outline" disabled={(page + 1) * 50 >= preview.total} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div></> : <p className="mt-4 text-sm text-gray-500">Save the file to see a paged preview. No full contact list is stored in your browser.</p>}
            <div className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-60 flex-1 space-y-2"><span className="text-sm font-bold">Audience name</span><Input value={audienceName} onChange={(event) => setAudienceName(event.target.value)} placeholder="Example: Lagos riders" /></label><Button className="bg-[#128C7E]" disabled={isPending || loading || !audienceName.trim() || !columns.length || (source === "database" && !preview.total)} onClick={source === "database" ? save : () => void upload()}>{isPending || loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save for campaigns</Button></div>
        </section> : null}
        {savedId ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="font-bold text-emerald-950">Saved in Supabase and ready for Campaigns</p><p className="mt-1 text-sm text-emerald-800">All authorized RSS campaign admins can use this audience.</p><Button variant="outline" className="mt-3" onClick={() => { window.location.href = `/api/whatsapp/audiences/${savedId}/download` }}><Download className="mr-2 h-4 w-4" />Download saved CSV</Button></section> : null}
    </div>

    return <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[2rem] border bg-white p-6 dark:bg-zinc-900">
            <p className="text-xs font-bold uppercase tracking-wide text-[#128C7E]">Campaign</p><h2 className="mt-2 text-3xl font-black">Choose, check, queue</h2><p className="mt-2 text-sm text-gray-500">Only audience and template IDs go from this page to the server. Recipient rows stay in Supabase.</p>
            {!workerConfigured ? <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Background worker setup is incomplete. Sending is disabled until the server’s CRON_SECRET is configured.</div> : null}
            <div className="mt-6 space-y-5"><label className="block space-y-2"><span className="font-bold">1. Campaign name</span><Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Ready orders — September" /></label><label className="block space-y-2"><span className="font-bold">2. Approved message</span><select className="h-12 w-full rounded-xl border bg-background px-3" value={templateId} onChange={(event) => { setTemplateId(event.target.value); setMapping({}); setReady(null) }}><option value="">Choose template</option>{templates.filter((item) => item.status === "approved").map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label className="block space-y-2"><span className="font-bold">3. Saved audience</span><select className="h-12 w-full rounded-xl border bg-background px-3" value={audienceId} onChange={(event) => { setAudienceId(event.target.value); setMapping({}); setReady(null) }}><option value="">Choose audience</option>{audiences.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.rowCount} unique numbers</option>)}</select>{!audiences.length ? <small className="text-amber-600">Save an audience in CSV Builder first.</small> : null}</label>
                {selectedTemplate && selectedAudience ? <><div className="rounded-2xl bg-gray-50 p-5 dark:bg-zinc-800"><p className="font-bold">4. Match personal details</p><div className="mt-3 space-y-3">{selectedTemplate.variables.map((variable) => <label className="grid items-center gap-2 sm:grid-cols-2" key={variable.name}><span>{labels[variable.name] ?? variable.name.replace(/_/g, " ")}</span><select className="h-11 rounded-xl border bg-background px-3" value={mapping[variable.name] ?? ""} onChange={(event) => { setReady(null); setMapping((current) => ({ ...current, [variable.name]: event.target.value })) }}><option value="">Choose a CSV column</option>{selectedAudience.columns.map((column) => <option key={column} value={column}>{labels[column] ?? column}</option>)}</select></label>)}</div></div><div className="rounded-xl border border-emerald-100 p-4"><div className="flex justify-between"><strong>5. Review</strong><Badge className="bg-emerald-100 text-emerald-700">{ready ?? "…"} ready</Badge></div><p className="mt-3 whitespace-pre-wrap text-sm">{selectedTemplate.body.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, variable: string) => sample?.fields[mapping[variable]] || `[${variable.replace(/_/g, " ")}]`)}</p><p className="mt-3 text-xs text-gray-500">Snapshot: {selectedAudience.rowCount} unique numbers; {selectedAudience.consentCount} consented. The server checks missing values and consent before sending. The preview shows only one sample.</p></div></> : null}
                <Button className="h-12 w-full bg-[#25D366] font-bold text-white hover:bg-[#20bd5a]" disabled={isPending || !workerConfigured || !campaignName.trim() || !selectedAudience || !selectedTemplate || !ready} onClick={queue}>{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Queue for {ready ?? 0} people</Button>
            </div>
        </section>
        <section className="rounded-[2rem] border bg-white p-6 dark:bg-zinc-900"><h2 className="text-xl font-black">Campaign progress</h2><p className="mt-1 text-sm text-gray-500">Updates automatically every 15 seconds while a campaign is sending.</p><div className="mt-5 space-y-3">{campaigns.length ? campaigns.map((campaign) => <div key={campaign.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><div><p className="font-bold">{campaign.name}</p><p className="text-xs text-gray-500">{campaign.templateName ?? "Template"}</p></div><Badge>{campaign.status}</Badge></div><div className="mt-4 h-2 rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${campaign.recipientCount ? Math.min(100, (campaign.sentCount + campaign.failedCount + campaign.skippedCount) / campaign.recipientCount * 100) : 0}%` }} /></div><p className="mt-2 text-xs text-gray-500">{campaign.sentCount} sent · {campaign.failedCount} failed · {campaign.skippedCount} skipped / needs review · {Math.max(0, campaign.recipientCount - campaign.sentCount - campaign.failedCount - campaign.skippedCount)} remaining</p>{campaign.status === "failed" && campaign.recipientCount > campaign.sentCount + campaign.failedCount + campaign.skippedCount ? <Button variant="outline" size="sm" className="mt-3" disabled={isPending || !workerConfigured} onClick={() => startTransition(() => void resumeAudienceCampaign(campaign.id).then((result) => result.error ? toast.error(result.error) : (toast.success("Remaining recipients queued again."), router.refresh())))}>Resume remaining</Button> : null}</div>) : <p className="py-8 text-sm text-gray-500">No campaigns yet.</p>}</div></section>
    </div>
}
