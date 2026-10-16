const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

// Exercise the real worker with an in-memory transport: these tests never call Meta.
function setup(options = {}) {
    const phone = "+2348000000001"
    const tables = {
        whatsapp_campaigns: [{ id: "first", template_id: "template", audience_id: "audience", variable_defaults: { customer_name: "Name" }, created_by: "admin", status: "sending", auto_send: false }],
        whatsapp_templates: [{ id: "template", name: "greeting", language: "en", body: "Hello {{customer_name}}", variables: [{ name: "customer_name" }], status: "approved" }],
        whatsapp_audience_recipients: [{ id: "audience-row", consent: options.consent ?? true, audience_id: "audience" }],
        whatsapp_campaign_recipients: [{ id: "recipient-first", campaign_id: "first", audience_recipient_id: "audience-row", phone, fields: { Name: "Ada" }, contact_id: null, status: "queued" }],
        whatsapp_contacts: options.contact ? [{ id: "contact", phone, ...options.contact }] : [],
        whatsapp_messages: [],
    }
    const sends = []
    const upserts = []
    class Query {
        constructor(table) { this.table = table; this.filters = []; this.op = "select" }
        select(columns, settings) { this.settings = settings; this.returning = true; return this }
        eq(key, value) { this.filters.push(row => row[key] === value); return this }
        in(key, values) { this.filters.push(row => values.includes(row[key])); return this }
        update(value) { this.op = "update"; this.value = value; return this }
        insert(value) { this.op = "insert"; this.value = value; return this }
        upsert(value, settings) { this.op = "upsert"; this.value = value; this.upsertSettings = settings; return this }
        single() { this.one = true; return this }
        maybeSingle() { this.one = true; return this }
        then(resolve, reject) { return Promise.resolve().then(() => this.run()).then(resolve, reject) }
        run() {
            if (this.table === "whatsapp_audience_recipients" && options.audienceError) return { data: null, error: { message: "offline" } }
            const rows = tables[this.table]
            let selected = rows.filter(row => this.filters.every(filter => filter(row)))
            if (this.op === "update") selected.forEach(row => Object.assign(row, this.value))
            if (this.op === "insert") {
                if (this.table === "whatsapp_messages" && options.logError) return { error: { message: "log failed" } }
                rows.push({ ...this.value }); selected = [rows.at(-1)]
            }
            if (this.op === "upsert") {
                upserts.push({ value: this.value, settings: this.upsertSettings })
                const existing = rows.find(row => row.phone === this.value.phone)
                if (!existing) rows.push({ id: "new-contact", ...this.value })
                else if (!this.upsertSettings?.ignoreDuplicates) Object.assign(existing, this.value)
                selected = rows.filter(row => row.phone === this.value.phone)
            }
            return { data: this.one ? selected[0] ?? null : selected, error: null, count: selected.length }
        }
    }
    const admin = {
        from: table => new Query(table),
        rpc: async (_, { p_campaign_id, p_limit }) => {
            const rows = tables.whatsapp_campaign_recipients.filter(row => row.campaign_id === p_campaign_id && row.status === "queued").slice(0, p_limit)
            rows.forEach(row => { row.status = "processing" })
            return { data: rows, error: null }
        },
    }
    class WhatsAppQuotaExceededError extends Error {}
    const mocks = {
        "server-only": {},
        "@/lib/supabase/admin": { createAdminClient: () => admin },
        "@/lib/whatsapp-quota": { WhatsAppQuotaExceededError, getWhatsAppQuotaStatus: async () => ({ remaining: 100 }) },
        "@/lib/whatsapp-center": {
            normalizeWhatsAppPhone: value => value.startsWith("+") ? value : null,
            renderTemplate: (body, fields) => body.replace("{{customer_name}}", fields.customer_name),
            sendMetaTemplateMessage: async input => {
                sends.push(input)
                if (options.quotaFull) throw new WhatsAppQuotaExceededError()
                if (options.sendError) throw options.sendError
                return `message-${sends.length}`
            },
        },
    }
    const filename = path.resolve(__dirname, "../src/lib/whatsapp-campaign-worker.ts")
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    const module = { exports: {} }
    vm.runInNewContext(code, { module, exports: module.exports, Error, process: { env: {} }, require: id => mocks[id] }, { filename })
    return { tables, admin, sends, upserts, worker: module.exports.runWhatsAppCampaignBatch }
}

test("repeat-campaign regression: saved audience consent survives first send and permits the next campaign", async () => {
    const { tables, admin, sends, upserts, worker } = setup()
    const first = await worker(admin, "first", 5)
    assert.equal(first.accepted, 1)
    const contact = tables.whatsapp_contacts[0]
    assert.equal(contact.opted_in, true)
    assert.equal(contact.full_name, "Ada")
    assert.equal(contact.custom_fields.whatsapp_consent.audience_recipient_id, "audience-row")
    assert.equal(upserts[0].settings.ignoreDuplicates, true)
    tables.whatsapp_campaigns.push({ ...tables.whatsapp_campaigns[0], id: "second", status: "sending" })
    tables.whatsapp_campaign_recipients.push({ ...tables.whatsapp_campaign_recipients[0], id: "recipient-second", campaign_id: "second", status: "queued", external_message_id: null })
    const second = await worker(admin, "second", 5)
    assert.equal(second.accepted, 1)
    assert.equal(second.skipped, 0)
    assert.equal(sends.length, 2)
})
for (const source of ["manual", "import"]) {
    test(`existing ${source} opt-out is never overwritten by audience consent`, async () => {
        const { admin, sends, upserts, worker, tables } = setup({ contact: { source, opted_in: false, is_active: true } })
        const result = await worker(admin, "first")
        assert.equal(result.accepted, 0)
        assert.equal(result.skipped, 1)
        assert.equal(sends.length, 0)
        assert.equal(upserts.length, 0)
        assert.equal(tables.whatsapp_contacts[0].opted_in, false)
        assert.match(tables.whatsapp_campaigns[0].last_error, /No messages were sent/)
    })
}
test("inactive contact stays blocked", async () => {
    const { admin, sends, worker } = setup({ contact: { opted_in: true, is_active: false } })
    assert.equal((await worker(admin, "first")).skipped, 1)
    assert.equal(sends.length, 0)
})
test("no saved audience consent means no send and no contact creation", async () => {
    const { admin, sends, worker, tables } = setup({ consent: false })
    assert.equal((await worker(admin, "first")).skipped, 1)
    assert.equal(sends.length, 0)
    assert.equal(tables.whatsapp_contacts.length, 0)
})
test("missing consent row blocks sending", async () => {
    const { admin, sends, worker, tables } = setup()
    tables.whatsapp_audience_recipients.length = 0
    assert.equal((await worker(admin, "first")).skipped, 1)
    assert.equal(sends.length, 0)
})
test("consent lookup failure stops before reaching Meta", async () => {
    const { admin, sends, worker } = setup({ audienceError: true })
    await assert.rejects(worker(admin, "first"), /Could not verify/)
    assert.equal(sends.length, 0)
})
test("Meta rejection is counted as failed and cannot create consent", async () => {
    const { admin, worker, tables } = setup({ sendError: new Error("Rejected by Meta") })
    const result = await worker(admin, "first")
    assert.equal(result.failed, 1)
    assert.equal(result.accepted, 0)
    assert.equal(tables.whatsapp_contacts.length, 0)
})
test("unknown send outcome stays uncertain and is not retried", async () => {
    const error = new Error("Timed out"); error.name = "TimeoutError"
    const { admin, worker, tables } = setup({ sendError: error })
    assert.equal((await worker(admin, "first")).uncertain, 1)
    assert.equal(tables.whatsapp_campaign_recipients[0].status, "uncertain")
})
test("quota pause preserves queued recipients", async () => {
    const { admin, worker, tables } = setup({ quotaFull: true })
    const result = await worker(admin, "first")
    assert.equal(result.pausedForQuota, true)
    assert.equal(result.accepted, 0)
    assert.equal(result.claimed, 0)
    assert.equal(tables.whatsapp_campaign_recipients[0].status, "queued")
})
test("missing template value is skipped before sending", async () => {
    const { admin, worker, tables, sends } = setup()
    tables.whatsapp_campaign_recipients[0].fields.Name = ""
    assert.equal((await worker(admin, "first")).skipped, 1)
    assert.equal(sends.length, 0)
})
test("accepted message with failed logging keeps external ID for duplicate protection", async () => {
    const { admin, worker, tables } = setup({ logError: true })
    const result = await worker(admin, "first")
    assert.equal(result.accepted, 0)
    assert.equal(result.uncertain, 1)
    assert.equal(tables.whatsapp_campaign_recipients[0].external_message_id, "message-1")
    assert.equal(tables.whatsapp_campaign_recipients[0].status, "uncertain")
})

test("consent from a different audience cannot authorize this campaign", async () => {
    const { admin, worker, tables, sends } = setup()
    tables.whatsapp_audience_recipients[0].audience_id = "another-audience"
    assert.equal((await worker(admin, "first")).skipped, 1)
    assert.equal(sends.length, 0)
})
