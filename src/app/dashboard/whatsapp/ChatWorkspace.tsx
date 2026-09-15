"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck, Clock3, Loader2, LockKeyhole, Search, Send, UserCheck, Users } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
    assignWhatsAppConversation,
    sendQuickWhatsAppMessage,
    sendSingleWhatsAppTemplate,
    type WhatsAppCenterPageData,
} from "./actions"

const DAY_MS = 24 * 60 * 60 * 1000

function shortTime(value: string) {
    return new Intl.DateTimeFormat("en-NG", { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" }).format(new Date(value))
}

export function ChatWorkspace({ data }: { data: WhatsAppCenterPageData }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [query, setQuery] = useState("")
    const [selectedId, setSelectedId] = useState(data.contacts[0]?.id ?? "")
    const [message, setMessage] = useState("")
    const [templateId, setTemplateId] = useState(data.templates.find((item) => item.status === "approved")?.id ?? "")
    const [values, setValues] = useState<Record<string, string>>({})
    const [now] = useState(() => Date.now())

    const messagesByContact = new Map<string, typeof data.messages>()
    for (const item of [...data.messages].reverse()) messagesByContact.set(item.contactId, [...(messagesByContact.get(item.contactId) ?? []), item])
    const assignmentByContact = new Map(data.conversationAssignments.map((item) => [item.contactId, item]))
    const filteredContacts = data.contacts.filter((contact) => `${contact.fullName} ${contact.phone} ${contact.email ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    const selected = data.contacts.find((contact) => contact.id === selectedId) ?? filteredContacts[0]
    const thread = selected ? messagesByContact.get(selected.id) ?? [] : []
    const lastInbound = [...thread].reverse().find((item) => item.direction === "inbound")
    const windowOpen = Boolean(lastInbound && now - new Date(lastInbound.createdAt).getTime() < DAY_MS)
    const assignment = selected ? assignmentByContact.get(selected.id) : undefined
    const approvedTemplates = data.templates.filter((item) => item.status === "approved")
    const selectedTemplate = approvedTemplates.find((item) => item.id === templateId)

    function run(action: () => Promise<{ error?: string }>, success: string, clear?: () => void) {
        startTransition(() => void (async () => {
            const result = await action()
            if (result.error) return toast.error(result.error)
            clear?.()
            toast.success(success)
            router.refresh()
        })())
    }

    if (!selected) return <div className="rounded-[2rem] border border-dashed p-12 text-center text-gray-500">Add or sync a customer before starting a chat.</div>

    return <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid min-h-[680px] xl:grid-cols-[320px_minmax(420px,1fr)_270px]">
            <aside className="border-b border-gray-200 xl:border-b-0 xl:border-r dark:border-zinc-800">
                <div className="border-b p-4 dark:border-zinc-800">
                    <h2 className="text-xl font-black">Customer chats</h2>
                    <p className="mt-1 text-xs text-gray-500">Campaign replies and direct conversations</p>
                    <div className="relative mt-4"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or number" /></div>
                </div>
                <div className="max-h-[590px] overflow-y-auto">
                    {filteredContacts.map((contact) => {
                        const contactMessages = messagesByContact.get(contact.id) ?? []
                        const latest = contactMessages.at(-1)
                        const owner = assignmentByContact.get(contact.id)
                        return <button key={contact.id} type="button" onClick={() => { setSelectedId(contact.id); setValues({}) }} className={cn("w-full border-b p-4 text-left transition hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800", selected.id === contact.id && "bg-emerald-50 dark:bg-emerald-950/20")}>
                            <div className="flex items-center justify-between gap-2"><p className="truncate font-bold">{contact.fullName}</p>{latest?.direction === "inbound" ? <span className="h-2.5 w-2.5 rounded-full bg-[#25D366]" /> : null}</div>
                            <p className="mt-1 truncate text-xs text-gray-500">{latest?.body ?? contact.phone}</p>
                            <p className="mt-2 text-[11px] font-semibold text-emerald-700">{owner?.assignedToName ? `With ${owner.assignedToName}` : "Unassigned"}</p>
                        </button>
                    })}
                </div>
            </aside>

            <main className="flex min-h-[680px] flex-col bg-[#efeae2] dark:bg-zinc-950">
                <header className="flex items-center justify-between border-b bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div><p className="font-black">{selected.fullName}</p><p className="text-xs text-gray-500">{selected.phone}</p></div>
                    <Badge className={windowOpen ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}>{windowOpen ? "Free chat open" : "Template required"}</Badge>
                </header>
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                    {thread.length ? thread.map((item) => <div key={item.id} className={cn("flex", item.direction === "outbound" ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[82%] rounded-2xl px-4 py-2.5 shadow-sm", item.direction === "outbound" ? "rounded-br-sm bg-[#d9fdd3] text-gray-900" : "rounded-bl-sm bg-white text-gray-900")}>
                            <p className="whitespace-pre-wrap text-sm">{item.body}</p><div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500"><span>{shortTime(item.createdAt)}</span>{item.direction === "outbound" ? <CheckCheck className={cn("h-3.5 w-3.5", item.status === "read" && "text-sky-500")} /> : null}</div>
                        </div>
                    </div>) : <div className="flex h-full items-center justify-center text-center text-sm text-gray-500"><div><p className="font-bold">No messages yet</p><p className="mt-1">Start safely with an approved template.</p></div></div>}
                </div>

                <div className="border-t bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    {windowOpen ? <div className="flex items-end gap-3"><Textarea className="min-h-12 resize-none rounded-2xl" rows={2} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type a message" /><Button size="icon" className="h-12 w-12 shrink-0 rounded-full bg-[#25D366]" disabled={isPending || !message.trim()} onClick={() => run(() => sendQuickWhatsAppMessage({ contactId: selected.id, message }), "Message sent.", () => setMessage(""))}>{isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</Button></div> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                        <div className="flex gap-3"><LockKeyhole className="h-5 w-5 shrink-0 text-amber-700" /><div><p className="font-bold text-amber-950 dark:text-amber-100">Send a template to open this chat</p><p className="mt-1 text-xs text-amber-800 dark:text-amber-200">When the customer replies, RSS can chat normally for 24 hours.</p></div></div>
                        <select className="mt-4 h-11 w-full rounded-xl border bg-white px-3 text-sm dark:bg-zinc-900" value={templateId} onChange={(event) => { setTemplateId(event.target.value); setValues({}) }}>{approvedTemplates.map((template) => <option key={template.id} value={template.id}>{template.displayName}</option>)}</select>
                        {selectedTemplate?.variables.map((variable) => <label key={variable.name} className="mt-3 block"><span className="text-xs font-bold capitalize">{variable.name.replace(/_/g, " ")}</span><Input className="mt-1 bg-white dark:bg-zinc-900" value={values[variable.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [variable.name]: event.target.value }))} placeholder={`Type ${variable.name.replace(/_/g, " ")}`} /></label>)}
                        <Button className="mt-4 w-full bg-[#128C7E]" disabled={isPending || !templateId} onClick={() => run(() => sendSingleWhatsAppTemplate({ contactId: selected.id, templateId, values }), "Template sent. We will show the reply in this chat.")}>{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send template</Button>
                    </div>}
                </div>
            </main>

            <aside className="border-t p-5 xl:border-l xl:border-t-0 dark:border-zinc-800">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-black text-emerald-700">{selected.fullName.slice(0, 1).toUpperCase()}</div>
                <h3 className="mt-4 text-lg font-black">{selected.fullName}</h3><p className="text-sm text-gray-500">{selected.phone}</p><p className="text-sm text-gray-500">{selected.email ?? "No email"}</p>
                <div className="mt-6 rounded-2xl bg-gray-50 p-4 dark:bg-zinc-800"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-600" /><p className="text-xs font-bold uppercase">24-hour status</p></div><p className="mt-2 text-sm">{windowOpen ? "Customer replied recently. Normal chat is available." : "Closed. Begin with an approved template."}</p></div>
                <div className="mt-6"><div className="flex items-center gap-2"><Users className="h-4 w-4" /><p className="font-bold">Who is helping?</p></div><p className="mt-1 text-xs text-gray-500">Assigning prevents two admins answering at once.</p>
                    <select className="mt-3 h-11 w-full rounded-xl border bg-white px-3 text-sm dark:bg-zinc-900" value={assignment?.assignedTo ?? ""} disabled={isPending} onChange={(event) => run(() => assignWhatsAppConversation({ assigneeId: event.target.value || null, contactId: selected.id }), "Conversation assignment updated.")}><option value="">Nobody — available</option>{data.team.filter((member) => member.accessLevel !== "none").map((member) => <option key={member.userId} value={member.userId}>{member.fullName}{member.userId === data.currentUserId ? " (you)" : ""}</option>)}</select>
                    <Button variant="outline" className="mt-3 w-full" disabled={isPending || assignment?.assignedTo === data.currentUserId} onClick={() => run(() => assignWhatsAppConversation({ assigneeId: data.currentUserId, contactId: selected.id }), "This customer is now assigned to you.")}><UserCheck className="mr-2 h-4 w-4" />Assign to me</Button>
                </div>
            </aside>
        </div>
    </div>
}
