"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Download, FileSpreadsheet, Loader2, Send, Sparkles, Upload, Users } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
    loadCsvBuilderAudience,
    sendCsvCampaign,
    type CsvAudienceRow,
    type WhatsAppCampaignRecord,
    type WhatsAppTemplateRecord,
} from "./actions"

type AudienceRow = { consent: boolean; fields: Record<string, string>; phone: string }
type SavedAudience = { columns: string[]; createdAt: string; id: string; name: string; rows: AudienceRow[]; source: string }

const STORAGE_KEY = "rss-whatsapp-csv-audiences-v1"
const roles = ["customer", "rider", "merchant", "agent", "admin", "sub_admin", "supa_admin"]
const friendly: Record<string, string> = {
    address: "Address", email: "Email", full_name: "Customer name", opted_in: "WhatsApp consent",
    order_number: "Order number", order_status: "Order status", phone: "WhatsApp number",
    registration_method: "Registration method", roles: "Role", source: "Added from", state: "State",
}
const columnHelp: Record<string, string> = {
    address: "The customer's address saved on their RSS profile or contact record. This adds a CSV column; it does not filter people.",
    email: "The customer's saved email address, if available. Tick to include it in the CSV and template mapping.",
    full_name: "The customer's name from their RSS profile or WhatsApp contact. Useful for a personal greeting.",
    order_number: "The customer's most recent RSS order number, when one is available.",
    order_status: "The status of the customer's most recent RSS order, when one is available.",
    phone: "The WhatsApp number used to match and send to this person. Keep this selected so it appears in your CSV.",
    registration_method: "How the RSS account was created or confirmed, such as Google, phone or email. Manual contacts may have no method.",
    roles: "The person's RSS role or roles, such as customer, rider or merchant.",
    source: "Whether the person registered on RSS, was added on the Add User page, or was entered in the WhatsApp Contact Book.",
    state: "The state saved in the customer's RSS profile or contact record, if available.",
}

function label(value: string) {
    return friendly[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function csvEscape(value: string) {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function parseCsv(text: string) {
    const matrix: string[][] = []
    let row: string[] = []
    let cell = ""
    let quoted = false
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index]
        if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1 }
        else if (char === '"') quoted = !quoted
        else if (char === "," && !quoted) { row.push(cell.trim()); cell = "" }
        else if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && text[index + 1] === "\n") index += 1
            row.push(cell.trim()); cell = ""
            if (row.some(Boolean)) matrix.push(row)
            row = []
        } else cell += char
    }
    row.push(cell.trim())
    if (row.some(Boolean)) matrix.push(row)
    const headers = (matrix[0] ?? []).map((header, index) => header || `Column ${index + 1}`)
    return { headers, records: matrix.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))) }
}

function guessPhoneColumn(columns: string[]) {
    return columns.find((column) => /whats|phone|mobile|number/i.test(column)) ?? columns[0] ?? ""
}

function databaseFields(row: CsvAudienceRow): Record<string, string> {
    return {
        address: row.address,
        email: row.email,
        full_name: row.fullName,
        order_number: row.orderId ? `RSS-${row.orderId.slice(0, 8).toUpperCase()}` : "",
        order_status: row.orderStatus,
        phone: row.phone,
        registration_method: row.registrationMethod,
        roles: row.roles.join(", "),
        source: row.source === "rss" ? "Registered on RSS" : row.source === "admin" ? "Added on Add User page" : "Added in WhatsApp dashboard",
        state: row.state,
    }
}

function Step({ active, done, number, text }: { active: boolean; done: boolean; number: number; text: string }) {
    return <div className={cn("flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold", active ? "bg-[#128C7E] text-white" : done ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400 dark:bg-zinc-800")}><span>{done ? "✓" : number}</span><span>{text}</span></div>
}

function ExplainedSelect<T extends string>({ label: selectLabel, onChange, options, value }: {
    label: string
    onChange: (value: T) => void
    options: Array<{ description: string; label: string; value: T }>
    value: T
}) {
    const selected = options.find((option) => option.value === value) ?? options[0]
    return <label className="block space-y-2">
        <span className="font-bold">{selectLabel}</span>
        <details className="group/select relative">
            <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-xl border bg-background px-3 [&::-webkit-details-marker]:hidden">
                <span>{selected?.label}</span><span aria-hidden className="text-gray-500 transition group-open/select:rotate-180">⌄</span>
            </summary>
            <div className="absolute left-0 top-12 z-40 w-full min-w-72 rounded-xl border bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                {options.map((option) => <div className="group/option relative" key={option.value}>
                    <button
                        type="button"
                        title={option.description}
                        className={cn("w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none dark:hover:bg-emerald-950/30", option.value === value && "bg-emerald-50 font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200")}
                        onClick={(event) => {
                            onChange(option.value)
                            event.currentTarget.closest("details")?.removeAttribute("open")
                        }}
                    >{option.label}</button>
                    <span role="tooltip" className="pointer-events-none absolute left-4 top-full z-50 hidden w-[min(22rem,calc(100vw-4rem))] rounded-xl bg-zinc-950 p-3 text-xs font-normal leading-5 text-white shadow-xl group-hover/option:block group-focus-within/option:block">{option.description}</span>
                </div>)}
            </div>
        </details>
    </label>
}

function ColumnChoice({ checked, column, onChange }: { checked: boolean; column: string; onChange: (checked: boolean) => void }) {
    const description = columnHelp[column] ?? `Include the ${label(column)} column from the uploaded CSV. This does not filter people.`
    return <label className="group/column relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 focus-within:border-emerald-500 hover:border-emerald-300">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={`Include ${label(column)}`} />
        <span>{label(column)}</span>
        <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden w-[min(22rem,calc(100vw-4rem))] rounded-xl bg-zinc-950 p-3 text-xs font-normal leading-5 text-white shadow-xl group-hover/column:block group-focus-within/column:block">{description}</span>
    </label>
}

export function CsvCampaignWorkspace({ campaigns, mode, templates }: { campaigns: WhatsAppCampaignRecord[]; mode: "builder" | "campaign"; templates: WhatsAppTemplateRecord[] }) {
    const [isPending, startTransition] = useTransition()
    const [saved, setSaved] = useState<SavedAudience[]>([])
    const [source, setSource] = useState<"database" | "upload">("database")
    const [databaseRows, setDatabaseRows] = useState<CsvAudienceRow[]>([])
    const [uploadRows, setUploadRows] = useState<Record<string, string>[]>([])
    const [uploadColumns, setUploadColumns] = useState<string[]>([])
    const [uploadPhoneColumn, setUploadPhoneColumn] = useState("")
    const [uploadConsent, setUploadConsent] = useState(false)
    const [selectedRoles, setSelectedRoles] = useState<string[]>(["customer"])
    const [origin, setOrigin] = useState<"admin" | "all" | "dashboard" | "rss">("all")
    const [registration, setRegistration] = useState<"admin" | "all" | "email" | "google" | "phone">("all")
    const [requirements, setRequirements] = useState({ consent: false, email: false, name: true, order: false, phone: true })
    const [selectedColumns, setSelectedColumns] = useState(["full_name", "phone", "email", "roles", "order_number", "order_status"])
    const [searchQuery, setSearchQuery] = useState("")
    const [audienceName, setAudienceName] = useState("")
    const [campaignName, setCampaignName] = useState("")
    const approved = templates.filter((template) => template.status === "approved")
    const [templateId, setTemplateId] = useState(approved[0]?.id ?? "")
    const [audienceId, setAudienceId] = useState("")
    const [mapping, setMapping] = useState<Record<string, string>>({})

    useEffect(() => {
        const timer = window.setTimeout(() => {
            try { setSaved(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedAudience[]) } catch { setSaved([]) }
        }, 0)
        return () => window.clearTimeout(timer)
    }, [])

    const filteredDatabase = useMemo(() => databaseRows.filter((row) => {
        if (origin !== "all" && row.source !== origin) return false
        if (selectedRoles.length && !row.roles.some((role) => selectedRoles.includes(role))) return false
        if (registration !== "all" && row.registrationMethod !== registration) return false
        if (requirements.name && !row.fullName) return false
        if (requirements.phone && !row.phone) return false
        if (requirements.email && !row.email) return false
        if (requirements.order && !row.orderId) return false
        if (requirements.consent && !row.optedIn) return false
        return true
    }), [databaseRows, origin, registration, requirements, selectedRoles])

    const currentRows: AudienceRow[] = source === "database"
        ? filteredDatabase.map((row) => ({ consent: row.optedIn, fields: databaseFields(row), phone: row.phone }))
        : uploadRows.map((fields) => ({ consent: uploadConsent, fields, phone: fields[uploadPhoneColumn] ?? "" }))
    const searchedRows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return currentRows
        const digits = query.replace(/\D/g, "")
        return currentRows.filter((row) => {
            const searchableValues = source === "upload"
                ? Object.entries(row.fields).filter(([column]) => /name|email|phone|whats|mobile|number/i.test(column)).map(([, value]) => value)
                : [row.fields.full_name, row.fields.email]
            const textMatch = [...searchableValues, row.phone]
                .some((value) => value?.toLowerCase().includes(query))
            const phoneMatch = digits.length > 0 && row.phone.replace(/\D/g, "").includes(digits)
            return textMatch || phoneMatch
        })
    }, [currentRows, searchQuery, source])
    const availableColumns = source === "database" ? Object.keys(friendly).filter((key) => key !== "opted_in") : uploadColumns
    const selectedAudience = saved.find((audience) => audience.id === audienceId)
    const selectedTemplate = approved.find((template) => template.id === templateId)
    const readyCount = selectedAudience?.rows.filter((row) => row.consent && row.phone && (selectedTemplate?.variables ?? []).every((variable) => row.fields[mapping[variable.name]]?.trim())).length ?? 0

    function persist(next: SavedAudience[]) {
        setSaved(next)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }

    function loadDatabase() {
        startTransition(() => void loadCsvBuilderAudience().then((result) => {
            if (result.error) return toast.error(result.error)
            setDatabaseRows(result.rows ?? [])
            toast.success(`${(result.rows ?? []).length.toLocaleString()} records loaded safely.`)
        }).catch(() => toast.error("Unable to load database records.")))
    }

    async function readFile(file?: File) {
        if (!file) return
        const parsed = parseCsv(await file.text())
        if (!parsed.headers.length || !parsed.records.length) return toast.error("This file has no usable rows.")
        setUploadColumns(parsed.headers)
        setUploadRows(parsed.records)
        setUploadPhoneColumn(guessPhoneColumn(parsed.headers))
        setSelectedColumns(parsed.headers)
        setAudienceName(file.name.replace(/\.csv$/i, ""))
    }

    function saveAudience() {
        if (!audienceName.trim()) return toast.error("Give this audience a name.")
        if (!searchedRows.length) return toast.error("No people match these choices and search.")
        if (source === "upload" && !uploadPhoneColumn) return toast.error("Choose the WhatsApp number column.")
        const columns = selectedColumns.filter((column) => availableColumns.includes(column))
        const deduped = Array.from(new Map(searchedRows.filter((row) => row.phone).map((row) => [row.phone.replace(/\D/g, ""), { ...row, fields: Object.fromEntries(columns.map((column) => [column, row.fields[column] ?? ""])) }])).values())
        const audience: SavedAudience = { columns, createdAt: new Date().toISOString(), id: crypto.randomUUID(), name: audienceName.trim(), rows: deduped, source }
        persist([audience, ...saved].slice(0, 20))
        setAudienceId(audience.id)
        toast.success(`${deduped.length.toLocaleString()} people saved. It is ready for Campaigns.`)
    }

    function downloadAudience() {
        const columns = selectedColumns.filter((column) => availableColumns.includes(column))
        const content = [columns, ...searchedRows.map((row) => columns.map((column) => row.fields[column] ?? ""))].map((row) => row.map(csvEscape).join(",")).join("\n")
        const link = document.createElement("a")
        link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }))
        link.download = `${audienceName.trim() || "rss-audience"}.csv`
        link.click()
        URL.revokeObjectURL(link.href)
    }

    if (mode === "builder") return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2"><Step active number={1} done={false} text="Choose people" /><Step active={Boolean(currentRows.length)} number={2} done={false} text="Choose information" /><Step active={false} number={3} done={Boolean(currentRows.length)} text="Save audience" /></div>
            <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#128C7E]">CSV Builder</p>
                <h2 className="mt-2 text-3xl font-black">Who should receive the message?</h2>
                <p className="mt-2 text-sm text-gray-500">Choose people already in RSS, or bring your own list.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <button type="button" onClick={() => setSource("database")} className={cn("rounded-2xl border-2 p-5 text-left", source === "database" ? "border-[#128C7E] bg-emerald-50 dark:bg-emerald-950/20" : "border-gray-100 dark:border-zinc-800")}><Users className="h-7 w-7 text-[#128C7E]" /><strong className="mt-3 block text-lg">People already in RSS</strong><span className="text-sm text-gray-500">Customers, riders, merchants and dashboard contacts</span></button>
                    <button type="button" onClick={() => setSource("upload")} className={cn("rounded-2xl border-2 p-5 text-left", source === "upload" ? "border-[#128C7E] bg-emerald-50 dark:bg-emerald-950/20" : "border-gray-100 dark:border-zinc-800")}><Upload className="h-7 w-7 text-[#128C7E]" /><strong className="mt-3 block text-lg">Upload a CSV file</strong><span className="text-sm text-gray-500">We will help identify every column</span></button>
                </div>

                {source === "database" ? <div className="mt-7 space-y-6">
                    {!databaseRows.length ? <Button className="h-12 bg-[#128C7E]" disabled={isPending} onClick={loadDatabase}>{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Show me the people in RSS</Button> : null}
                    {databaseRows.length ? <>
                        <div><p className="font-bold">Choose their role</p><div className="mt-3 flex flex-wrap gap-2">{roles.map((role) => <button type="button" key={role} onClick={() => setSelectedRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role])} className={cn("rounded-full border px-4 py-2 text-sm capitalize", selectedRoles.includes(role) ? "border-[#128C7E] bg-[#128C7E] text-white" : "border-gray-200")}>{role.replace("_", " ")}</button>)}</div></div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <ExplainedSelect label="Where were they added?" value={origin} onChange={setOrigin} options={[
                                { value: "all", label: "Anywhere", description: "Shows everyone from RSS accounts, the Add User page and the WhatsApp Contact Book." },
                                { value: "rss", label: "Registered on RSS", description: "Shows people who created their own RSS account. Accounts created by an administrator are kept separate." },
                                { value: "admin", label: "Added on Add User page", description: "Shows accounts that an administrator created for someone from the dashboard Add User page." },
                                { value: "dashboard", label: "Added in WhatsApp dashboard", description: "Shows contacts entered manually in the WhatsApp Contact Book, even when they do not have an RSS account." },
                            ]} />
                            <ExplainedSelect label="How was their account created?" value={registration} onChange={setRegistration} options={[
                                { value: "all", label: "Any method", description: "Does not filter by account creation method. All matching account types are included." },
                                { value: "google", label: "Signed in with Google", description: "Shows people whose RSS account was created using the Sign in with Google button." },
                                { value: "phone", label: "Phone-confirmed account", description: "Shows people who created an account and confirmed their own phone number. This is not the same as WhatsApp consent." },
                                { value: "email", label: "Email-confirmed account", description: "Shows people who created an account and confirmed their own email address." },
                                { value: "admin", label: "Added on Add User page", description: "Shows accounts created by an administrator. They are not counted as self-confirmed phone or email accounts." },
                            ]} />
                        </div>
                        <details className="rounded-2xl bg-gray-50 p-4 dark:bg-zinc-800"><summary className="cursor-pointer font-bold">More choices</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries({ consent: "Only show people with WhatsApp consent", email: "Only show people with an email", name: "Only show people with a name", order: "Only show people with an order", phone: "Only show people with a phone number" }).map(([key, text]) => <label key={key} className="flex items-center gap-3"><input type="checkbox" checked={requirements[key as keyof typeof requirements]} onChange={(event) => setRequirements((current) => ({ ...current, [key]: event.target.checked }))} />{text}</label>)}</div><p className="mt-4 text-xs text-gray-500">You can include everyone while building the CSV. People without WhatsApp consent will still be left out when sending.</p></details>
                    </> : null}
                </div> : <div className="mt-7 space-y-5">
                    <label className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 p-10 text-center"><input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void readFile(event.target.files?.[0])} /><span><FileSpreadsheet className="mx-auto h-9 w-9 text-[#128C7E]" /><strong className="mt-3 block">Choose a CSV file</strong><small className="text-gray-500">Click here, then select the file</small></span></label>
                    {uploadRows.length ? <><label className="block space-y-2"><span className="font-bold">Which column has the WhatsApp numbers?</span><select className="h-11 w-full rounded-xl border bg-background px-3" value={uploadPhoneColumn} onChange={(event) => setUploadPhoneColumn(event.target.value)}>{uploadColumns.map((column) => <option key={column}>{column}</option>)}</select></label><label className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950"><input type="checkbox" checked={uploadConsent} onChange={(event) => setUploadConsent(event.target.checked)} /><span><strong>These people agreed to receive WhatsApp messages.</strong><br />Only tick this when you have their permission.</span></label></> : null}
                </div>}
            </section>

            {currentRows.length ? <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#128C7E]">Choose information</p><h2 className="mt-2 text-2xl font-black">{searchedRows.length.toLocaleString()} people found</h2><p className="text-sm text-gray-500">Tick the details to include in your CSV. These boxes do not change who is included.</p></div><Badge className="bg-emerald-100 text-emerald-700">{searchedRows.filter((row) => row.consent).length.toLocaleString()} allowed to message</Badge></div><label className="mt-6 block space-y-2"><span className="text-sm font-bold">Search these people</span><Input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Type a customer name, email or phone number" /><span className="text-xs text-gray-500">The table, downloaded CSV and saved audience will use these filtered results.</span></label><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{availableColumns.map((column) => <ColumnChoice key={column} column={column} checked={selectedColumns.includes(column)} onChange={(checked) => setSelectedColumns((current) => checked ? [...current, column] : current.filter((item) => item !== column))} />)}</div><div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><label className="space-y-2"><span className="text-sm font-bold">Audience name</span><Input value={audienceName} onChange={(event) => setAudienceName(event.target.value)} placeholder="Example: Ready orders" /></label><Button className="self-end" variant="outline" onClick={downloadAudience}><Download className="mr-2 h-4 w-4" />Download CSV</Button><Button className="self-end bg-[#128C7E]" onClick={saveAudience}>Save for campaigns</Button></div><div className="mt-6 overflow-x-auto rounded-xl border"><table className="w-full text-left text-xs"><thead className="bg-gray-50 dark:bg-zinc-800"><tr>{selectedColumns.slice(0, 5).map((column) => <th className="p-3" key={column}>{label(column)}</th>)}</tr></thead><tbody>{searchedRows.slice(0, 25).map((row, index) => <tr className="border-t" key={index}>{selectedColumns.slice(0, 5).map((column) => <td className="max-w-48 truncate p-3" key={column}>{row.fields[column] || "—"}</td>)}</tr>)}</tbody></table>{searchedRows.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">No one matches that search.</p> : null}{searchedRows.length > 25 ? <p className="border-t p-3 text-center text-xs text-gray-500">Showing the first 25 of {searchedRows.length.toLocaleString()} matching people.</p> : null}</div></section> : null}
        </div>
    )

    return <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#128C7E]">Simple campaign</p><h2 className="mt-2 text-3xl font-black">Choose, check, send</h2>
            <div className="mt-6 space-y-5"><label className="block space-y-2"><span className="font-bold">1. What should we call this campaign?</span><Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Ready orders — September" /></label><label className="block space-y-2"><span className="font-bold">2. Choose an approved message</span><select className="h-12 w-full rounded-xl border bg-background px-3" value={templateId} onChange={(event) => { setTemplateId(event.target.value); setMapping({}) }}><option value="">Choose a template</option>{approved.map((template) => <option value={template.id} key={template.id}>{template.displayName}</option>)}</select></label><label className="block space-y-2"><span className="font-bold">3. Choose a CSV audience</span><select className="h-12 w-full rounded-xl border bg-background px-3" value={audienceId} onChange={(event) => { setAudienceId(event.target.value); setMapping({}) }}><option value="">Choose an audience from CSV Builder</option>{saved.map((audience) => <option value={audience.id} key={audience.id}>{audience.name} · {audience.rows.length} people</option>)}</select>{!saved.length ? <small className="text-amber-600">Create and save an audience in CSV Builder first.</small> : null}</label>
                {selectedTemplate && selectedAudience ? <div className="rounded-2xl bg-gray-50 p-5 dark:bg-zinc-800"><p className="font-bold">4. Tell us where each detail comes from</p><div className="mt-4 space-y-3">{selectedTemplate.variables.map((variable) => <label className="grid items-center gap-2 sm:grid-cols-2" key={variable.name}><span>Where is <strong>{label(variable.name)}</strong>?</span><select className="h-11 rounded-xl border bg-background px-3" value={mapping[variable.name] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [variable.name]: event.target.value }))}><option value="">Choose a column</option>{selectedAudience.columns.map((column) => <option value={column} key={column}>{label(column)}</option>)}</select></label>)}</div></div> : null}
                {selectedAudience && selectedTemplate ? <div className="rounded-2xl border border-emerald-100 p-5"><div className="flex justify-between"><strong>5. Check before sending</strong><Badge className="bg-emerald-100 text-emerald-700">{readyCount.toLocaleString()} ready</Badge></div><p className="mt-3 whitespace-pre-wrap text-sm">{selectedTemplate.body.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, name: string) => selectedAudience.rows[0]?.fields[mapping[name]] || `[${label(name)}]`)}</p><p className="mt-3 text-xs text-gray-500">Preview uses the first person. Rows with missing information, invalid numbers or no consent will be left out.</p></div> : null}
                <Button disabled={isPending || !campaignName.trim() || !selectedAudience || !selectedTemplate || readyCount === 0} className="h-14 w-full bg-[#25D366] text-base font-black text-white hover:bg-[#20bd5a]" onClick={() => { if (!selectedAudience) return; if (!window.confirm(`Send this approved WhatsApp template to ${readyCount} people?`)) return; startTransition(() => void sendCsvCampaign({ name: campaignName, rows: selectedAudience.rows, templateId, variableColumns: mapping }).then((result) => result.error ? toast.error(result.error) : toast.success(`Campaign complete: ${result.sent ?? 0} sent, ${result.failed ?? 0} failed.`)).catch(() => toast.error("Campaign failed."))) }}>{isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}Send to {readyCount.toLocaleString()} people</Button>
            </div>
        </section>
        <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><h2 className="text-xl font-black">Campaign reports</h2><div className="mt-4 space-y-3">{campaigns.length ? campaigns.map((campaign) => <div key={campaign.id} className="rounded-2xl border p-4"><div className="flex justify-between gap-3"><div><p className="font-bold">{campaign.name}</p><p className="text-xs text-gray-500">{campaign.templateName ?? "Template"}</p></div><Badge>{campaign.status}</Badge></div><div className="mt-3 grid grid-cols-3 text-center text-xs"><div><strong className="block text-lg">{campaign.recipientCount}</strong>Recipients</div><div><strong className="block text-lg text-emerald-600">{campaign.sentCount}</strong>Sent</div><div><strong className="block text-lg text-red-600">{campaign.failedCount}</strong>Failed</div></div></div>) : <p className="py-8 text-center text-sm text-gray-500">No campaigns yet.</p>}</div></section>
    </div>
}
