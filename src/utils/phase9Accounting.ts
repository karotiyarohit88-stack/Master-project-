export interface AutoPostCandidate {
  enabled: boolean;
  safetyEnabled: boolean;
  isDailyContent: boolean;
  videoUrl?: string;
  videoAssetVerified?: boolean;
}

export function canAutoPostDailyContent(candidate: AutoPostCandidate): boolean {
  if (!candidate.enabled || !candidate.safetyEnabled || !candidate.isDailyContent || candidate.videoAssetVerified !== true) return false;
  if (!candidate.videoUrl) return false;
  try {
    const url = new URL(candidate.videoUrl);
    return url.protocol === 'https:' && !['storage.googleapis.com', 'example.com', 'localhost'].includes(url.hostname);
  } catch {
    return false;
  }
}

type PlatformPost = { platform?: string; status?: string; publishedAt?: string };
type PlatformTask = { platform?: string; status?: string };
type PlatformExecution = { triggerSource?: string; status?: string; stepsExecuted?: Array<{ toolId?: string }> };

export function buildMultiPlatformAnalytics(posts: PlatformPost[], tasks: PlatformTask[], executions: PlatformExecution[]) {
  const platforms = {
    youtube: { publishedPosts: 0, tasks: 0, webhookActions: 0 },
    socialMedia: { publishedPosts: 0, tasks: 0, webhookActions: 0 },
    webhooks: { publishedPosts: 0, tasks: 0, webhookActions: 0 }
  };
  for (const post of posts) {
    if (post.status !== 'published' || !post.publishedAt) continue;
    const key = post.platform === 'youtube' ? 'youtube' : 'socialMedia';
    platforms[key].publishedPosts += 1;
  }
  for (const task of tasks) {
    const key = String(task.platform || '').includes('youtube') ? 'youtube' : 'socialMedia';
    platforms[key].tasks += 1;
  }
  for (const execution of executions) {
    if (execution.triggerSource === 'webhook' || execution.stepsExecuted?.some(step => step.toolId === 'n8n_webhook')) {
      platforms.webhooks.webhookActions += 1;
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    source: 'in-memory application records; no inferred platform metrics',
    totals: {
      publishedPosts: platforms.youtube.publishedPosts + platforms.socialMedia.publishedPosts,
      tasks: platforms.youtube.tasks + platforms.socialMedia.tasks,
      webhookActions: platforms.webhooks.webhookActions
    },
    platforms
  };
}

export interface VerifiedEarningEntry {
  id: string;
  source: string;
  status: 'verified' | 'pending' | 'rejected';
  taxableAmount: number;
  gstRate: number;
  supplyType: 'intra_state' | 'inter_state';
  currency: string;
}

export function buildVerifiedEarningsSummary(entries: VerifiedEarningEntry[]) {
  const verified = entries.filter(entry =>
    entry.status === 'verified' &&
    Number.isFinite(entry.taxableAmount) && entry.taxableAmount >= 0 &&
    Number.isFinite(entry.gstRate) && entry.gstRate >= 0 && entry.gstRate <= 100 &&
    (entry.supplyType === 'intra_state' || entry.supplyType === 'inter_state') &&
    entry.currency === 'INR'
  );
  const sources: Record<string, number> = {};
  let taxableAmount = 0, cgst = 0, sgst = 0, igst = 0;
  for (const entry of verified) {
    taxableAmount += entry.taxableAmount;
    sources[entry.source] = (sources[entry.source] || 0) + entry.taxableAmount;
    const tax = entry.taxableAmount * entry.gstRate / 100;
    if (entry.supplyType === 'inter_state') igst += tax;
    else { cgst += tax / 2; sgst += tax / 2; }
  }
  return {
    currency: 'INR',
    verifiedEntryCount: verified.length,
    totalBalance: taxableAmount + cgst + sgst + igst,
    taxableAmount, cgst, sgst, igst,
    totalGst: cgst + sgst + igst,
    sourceWiseEarnings: sources,
    dataStatus: verified.length ? 'verified_ledger_entries' : 'no_verified_ledger_entries'
  };
}

export function evaluatePayoutGuard(input: { ownerApproved: boolean; accessibilityServiceVerified: boolean }) {
  if (!input.ownerApproved) return { allowed: false, reason: 'Owner human approval is required for every payout request.' };
  if (!input.accessibilityServiceVerified) return { allowed: false, reason: 'Requires Native Android Service Verification. Payout execution is disabled.' };
  return { allowed: true, reason: 'Payout guard requirements satisfied.' };
}
