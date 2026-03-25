# AGENTS.md - ADMIN DASHBOARD OPERATIONAL RULEBOOK
> **STATUS:** APPROVED
> **PROJECT:** RSS Foods Admin Dashboard (`rssa-admin`)
> **ARCHITECT:** Antigravity
> **TOOL PREFERENCE:** Supabase MCP > CLI

## 1.0 OPERATIONAL PROTOCOLS
**Strict adherence required.**

### 1.1 Scope & Relationship
*   **Purpose:** This is the internal back-office dashboard for RSS Foods.
*   **Shared Infrastructure:** This project shares the **SAME** Supabase Database and Storage as the main `rssa1` customer app.
*   **Data Integrity:** Actions taken here (Approvals, Rejections) directly affect the live customer storefront. Treat all DB operations with high caution.

### 1.2 Tool Use (Supabase MCP)
*   **Database Interactions:** You **MUST** use the `Supabase MCP Tool` for querying tables and running SQL.
*   **Schema:** The schema is defined in `../rssa1`, but this project uses a copy of `database.types.ts` related to `products` and `profiles`.

### 1.3 Development Environment
*   **Framework:** Next.js (App Router)
*   **Port:** `3001` (Use `npm run dev -- -p 3001`)
*   **UI Library:** Tailwind CSS + shadcn/ui primitives (copied from main app as needed).

---

## 2.0 VISUAL & UI GUIDELINES
*   **Contrast:** Use a distinct visual style (e.g., denser information density) compared to the customer app, but maintain brand colors.
*   **Feedback:** Always provide immediate feedback (Toasts) for admin actions (Approve/Reject).

---

## 3.0 TECH STACK CONSTRAINTS

| Layer | Technology | Version / Constraint |
| :--- | :--- | :--- |
| **Frontend** | Next.js | **App Router (Only)**. |
| **Styling** | Tailwind CSS | Utility-first. |
| **Backend** | Supabase | Shared project with `rssa1`. |
| **Auth** | Supabase Auth | Currently uses generic login; future upgrades will enforce `role = 'admin'`. |

---

## 4.0 THREE-TIER BOUNDARIES

### 🔴 TIER 1: NEVER (Instant Rejection)
1.  **NEVER** modify the shared Database Schema from this project without cross-referencing `rssa1`. Schema changes should ideally originate from the main project's migrations.
2.  **NEVER** hardcode admin credentials in the codebase.

### 🟡 TIER 2: ASK FIRST
1.  Adding new large dependencies.
2.  Implementing "Delete" operations that cascade (e.g., deleting a Merchant).

### 🟢 TIER 3: ALWAYS (Mandatory Patterns)
1.  **ALWAYS** use `revalidatePath` after data mutations to ensure the dashboard reflects the latest state.
2.  **ALWAYS** confirm destructive actions (Rejections/Deletions) with a prompt.
