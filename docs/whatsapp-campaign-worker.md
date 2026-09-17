# WhatsApp campaign worker

New CSV campaigns are manual-only. Preparing a campaign never sends a message. An authorized admin can press **Send next 5 as test**; this uses the same server-side worker as automatic sending and requires confirmation each time.

Automatic batches are scheduled once per minute by Supabase Cron. The scheduled SQL function is a no-op until its two Vault secrets exist. Each run claims at most five recipients. Recipients are checked again for valid phone, required template values, active contact permission and RSS's rolling 250-recipient safety cap before Meta is called. When the cap is full, unsent recipients stay queued. A send with an unknown outcome is not retried automatically.

To arm automatic sending, an operator with deployment access must:

1. Set a new random secret of at least 32 characters as `CRON_SECRET` in the Vercel admin project's production environment. Never commit or paste it into a ticket or chat.
2. Set `CAMPAIGN_WORKER_ENABLED=true` in the same Vercel environment, then deploy.
3. Save the exact same secret in Supabase Vault under `rss_whatsapp_worker_secret` and save the production HTTPS URL ending in `/api/jobs/whatsapp-campaigns` under `rss_whatsapp_worker_url`.
4. Check `select public.whatsapp_campaign_scheduler_ready();` returns `true`, then test the protected endpoint and one controlled recipient before enabling automatic batches on a campaign.

The scheduler will never select a campaign unless an admin has explicitly enabled **Start automatic batches** for that campaign. Pausing automatic batches does not delete its saved audience or queued recipients.

The Campaign page shows accepted, failed, skipped and waiting counts, the last worker error, and masked phone numbers with reasons for recipients needing review. "Accepted by Meta" is not proof of delivery; a delivery-status webhook must be added for that.
