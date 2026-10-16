# WhatsApp campaign worker

New CSV campaigns are manual-only. Preparing a campaign never sends a message. An authorized admin first presses **Send first 5 as test**; this sends real messages to at most five recipients and requires confirmation. Manual follow-up choices unlock after a completed test processes at least one recipient, including failed or skipped recipients. A skipped-only test must never return to the first-test button. Automatic sending additionally requires at least one message accepted by Meta. When no messages are accepted, the page directs admins to review send problems before continuing. The admin can then choose a number to process next (up to 250, sent in server-side batches of five), enable automatic batches if the scheduler is configured, or cancel all unsent recipients. A browser-initiated manual run stops if the page closes; already completed batches stay recorded.

Automatic batches are scheduled once per minute by Supabase Cron. The scheduled SQL function is a no-op until its two Vault secrets exist. Each run claims at most five recipients. Recipients are checked again for valid phone, required template values, active contact permission and RSS's rolling 250-recipient safety cap before Meta is called. When the cap is full, automatic sending switches off, unsent recipients stay queued, and an admin must explicitly continue after a slot opens. A send with an unknown outcome is not retried automatically.

To arm automatic sending, an operator with deployment access must:

1. Set a new random secret of at least 32 characters as `CRON_SECRET` in the Vercel admin project's production environment. Never commit or paste it into a ticket or chat.
2. Set `CAMPAIGN_WORKER_ENABLED=true` in the same Vercel environment, then deploy.
3. Save the exact same secret in Supabase Vault under `rss_whatsapp_worker_secret` and save the production HTTPS URL ending in `/api/jobs/whatsapp-campaigns` under `rss_whatsapp_worker_url`.
4. Check `select public.whatsapp_campaign_scheduler_ready();` returns `true`, then test the protected endpoint and one controlled recipient before enabling automatic batches on a campaign.

The scheduler will never select a campaign unless an admin has explicitly enabled **Start automatic batches** for that campaign. Pausing automatic batches does not delete its saved audience or queued recipients.

The Campaign page shows accepted, failed, skipped and waiting counts, the last worker error, and masked phone numbers with reasons for recipients needing review. "Accepted by Meta" is not proof of delivery; a delivery-status webhook must be added for that.

Imported contacts retain the saved audience's affirmative consent and its audience/recipient IDs when a successful first send creates their contact-book entry. Provider acceptance alone is never treated as consent. Existing contacts with permission off or inactive status remain blocked. The worker independently verifies the saved recipient consent before every batch. Manual results report accepted, failed, skipped and uncertain counts separately; a skipped-only batch produces a warning and loads the recorded problems.

The repeat-campaign regression runs the real worker twice against the same saved audience with a mocked transport. It must preserve consent after the first send and reach the transport again on the second campaign. Additional tests cover opt-outs, inactive contacts, unavailable consent evidence, Meta rejections, ambiguous responses, quota pauses and failed message logging. All regression tests run before every production build.
