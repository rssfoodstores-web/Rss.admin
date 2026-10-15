type CampaignTestProgress = {
    lastWorkerRunAt: string | null
    sentCount: number
    failedCount: number
    skippedCount: number
}

// A completed attempt can skip or fail every recipient without a successful send.
export function hasCompletedCampaignTest(campaign: CampaignTestProgress) {
    return Boolean(campaign.lastWorkerRunAt && campaign.sentCount + campaign.failedCount + campaign.skippedCount > 0)
}
