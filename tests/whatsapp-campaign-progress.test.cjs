const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")

function load(relative, mocks = {}, append = "") {
    const filename = path.resolve(__dirname, "..", relative)
    const source = fs.readFileSync(filename, "utf8") + append
    const code = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    const module = { exports: {} }
    vm.runInNewContext(code, {
        module, exports: module.exports,
        require: (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id),
    }, { filename })
    return module.exports
}
const progress = load("src/lib/whatsapp-campaign-progress.ts")
const campaign = {
    id: "campaign-test", name: "Greetings", status: "sending", autoSend: false,
    recipientCount: 193, sentCount: 0, failedCount: 0, skippedCount: 67,
    lastWorkerRunAt: "2026-10-15T10:00:00Z", updatedAt: "2026-10-15T10:00:00Z",
    lastError: null,
}
const controls = (tag) => ({ children, ...props }) => React.createElement(tag, props, children)
const { CampaignProgressCard } = load("src/app/dashboard/whatsapp/SecureCsvCampaignWorkspace.tsx", {
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/components/ui/badge": { Badge: controls("span") },
    "@/components/ui/button": { Button: ({ size, variant, ...props }) => React.createElement("button", props) },
    "@/components/ui/input": { Input: controls("input") },
    "@/lib/utils": { cn: (...args) => args.filter(Boolean).join(" ") },
    "@/lib/whatsapp-campaign-progress": progress,
    "./audience-actions": {}, "./actions": {},
}, "\nexport { CampaignProgressCard }\n")
function render(overrides = {}) {
    return renderToStaticMarkup(React.createElement(CampaignProgressCard, {
        campaign: { ...campaign, ...overrides }, quota: { remaining: 100 }, workerConfigured: true,
    }))
}

test("screenshot regression: 67 skipped and zero accepted unlock manual quantity", () => {
    const html = render()
    assert.match(html, /People to send next/)
    assert.match(html, /Send chosen number/)
    assert.doesNotMatch(html, /Send first 5 as test/)
    assert.match(html, /No messages have been accepted by Meta yet/)
    assert.match(html, /<button[^>]*disabled=""[^>]*>Automatically send the rest/)
})
test("failed-only test unlocks manual quantity", () => {
    assert.match(render({ skippedCount: 0, failedCount: 5 }), /Send chosen number/)
})
test("new campaign still requires its first test", () => {
    const html = render({ skippedCount: 0, lastWorkerRunAt: null })
    assert.match(html, /Send first 5 as test/)
    assert.doesNotMatch(html, /People to send next/)
})
test("worker timestamp alone does not complete a test", () => {
    assert.match(render({ skippedCount: 0 }), /Send first 5 as test/)
})
test("successful test offers manual and automatic choices", () => {
    const html = render({ sentCount: 5, skippedCount: 0 })
    assert.match(html, /Send chosen number/)
    assert.match(html, /<button(?![^>]*disabled)[^>]*>Automatically send the rest/)
})
test("automatic campaigns do not show first-test or manual controls", () => {
    const html = render({ autoSend: true })
    assert.doesNotMatch(html, /Send first 5 as test|Send chosen number/)
    assert.match(html, /Pause automatic batches/)
})

function server(overrides = {}) {
    const row = {
        id: campaign.id, status: "sending", audience_id: "audience", auto_send: false,
        last_worker_run_at: campaign.lastWorkerRunAt, sent_count: 0, failed_count: 0, skipped_count: 67,
        ...overrides,
    }
    const calls = []
    let selected = ""
    const query = {
        select(columns) { selected = columns; return this }, eq() { return this },
        async single() {
            const data = Object.fromEntries(selected.split(",").map(key => [key, row[key]]))
            return { data, error: null }
        },
    }
    const actions = load("src/app/dashboard/whatsapp/audience-actions.ts", {
        "next/cache": { revalidatePath: (value) => calls.push(["refresh", value]) },
        "@/lib/admin-auth": { requireAdminRouteAccess: async () => ({ primaryRole: "supa_admin", user: { id: "admin" } }) },
        "@/lib/supabase/admin": { createAdminClient: () => ({ from: () => query }) },
        "@/lib/whatsapp-campaign-progress": progress,
        "@/lib/whatsapp-quota": { getWhatsAppQuotaStatus: async () => ({ remaining: 100 }) },
        "@/lib/whatsapp-campaign-worker": {
            isCampaignSchedulerReady: async () => true,
            runWhatsAppCampaignBatch: async (_, id, count) => {
                calls.push(["send", id, count]); return { claimed: count, pausedForQuota: false, rateLimited: false }
            },
        },
    })
    return { actions, calls }
}
test("server allows chosen batches after skipped-only test and refreshes dashboard", async () => {
    const { actions, calls } = server()
    assert.equal((await actions.runManualCampaignBatch(campaign.id, 5)).success, true)
    assert.deepEqual(calls, [["send", campaign.id, 5], ["refresh", "/dashboard/whatsapp"]])
})
test("server rejects repeating first test after skipped-only results", async () => {
    const { actions, calls } = server()
    assert.match((await actions.runTestCampaignBatch(campaign.id)).error, /already run/)
    assert.deepEqual(calls, [])
})
test("server allows manual continuation after failed-only test", async () => {
    const { actions } = server({ skipped_count: 0, failed_count: 5 })
    assert.equal((await actions.runManualCampaignBatch(campaign.id, 3)).processed, 3)
})
test("server blocks continuation before a completed test", async () => {
    const { actions, calls } = server({ last_worker_run_at: null, skipped_count: 0 })
    assert.match((await actions.runManualCampaignBatch(campaign.id, 5)).error, /first 5-person test/)
    assert.deepEqual(calls, [])
})
test("server keeps automatic sending blocked without an accepted message", async () => {
    const { actions, calls } = server()
    assert.match((await actions.setCampaignAutoSend(campaign.id, true)).error, /first 5-person test/)
    assert.deepEqual(calls, [])
})
test("server preserves five-person per-request bound", async () => {
    const { actions, calls } = server()
    for (const count of [0, 6, 1.5, NaN]) assert.match((await actions.runManualCampaignBatch(campaign.id, count)).error, /between 1 and 5/)
    assert.deepEqual(calls, [])
})
