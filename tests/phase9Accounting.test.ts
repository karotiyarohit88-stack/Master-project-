import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoPostDailyContent, buildMultiPlatformAnalytics, buildVerifiedEarningsSummary, evaluatePayoutGuard } from '../src/utils/phase9Accounting.ts';

test('auto-post requires owner toggle, safety, daily content and verified non-demo HTTPS asset', () => {
  const base = { enabled: true, safetyEnabled: true, isDailyContent: true, videoUrl: 'https://cdn.publisher.example/video.mp4', videoAssetVerified: true };
  assert.equal(canAutoPostDailyContent(base), true);
  assert.equal(canAutoPostDailyContent({ ...base, enabled: false }), false);
  assert.equal(canAutoPostDailyContent({ ...base, safetyEnabled: false }), false);
  assert.equal(canAutoPostDailyContent({ ...base, videoAssetVerified: false }), false);
  assert.equal(canAutoPostDailyContent({ ...base, videoUrl: 'http://cdn.publisher.example/video.mp4' }), false);
  assert.equal(canAutoPostDailyContent({ ...base, videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' }), false);
});

test('platform analytics counts only published posts with publication timestamps', () => {
  const result = buildMultiPlatformAnalytics(
    [{ platform: 'youtube', status: 'published', publishedAt: '2026-11-16T09:00:00Z' }, { platform: 'instagram', status: 'waiting_approval' }],
    [{ platform: 'youtube_shorts' }, { platform: 'linkedin' }],
    [{ triggerSource: 'webhook' }, { triggerSource: 'manual', stepsExecuted: [{ toolId: 'n8n_webhook' }] }]
  );
  assert.equal(result.totals.publishedPosts, 1);
  assert.equal(result.platforms.youtube.tasks, 1);
  assert.equal(result.platforms.socialMedia.tasks, 1);
  assert.equal(result.totals.webhookActions, 2);
});

test('GST summary includes verified INR ledger entries only and splits interstate tax', () => {
  const result = buildVerifiedEarningsSummary([
    { id: 'a', source: 'YouTube', status: 'verified', taxableAmount: 1000, gstRate: 18, supplyType: 'intra_state', currency: 'INR' },
    { id: 'b', source: 'Web', status: 'verified', taxableAmount: 500, gstRate: 18, supplyType: 'inter_state', currency: 'INR' },
    { id: 'c', source: 'Pending', status: 'pending', taxableAmount: 9999, gstRate: 18, supplyType: 'intra_state', currency: 'INR' }
  ]);
  assert.equal(result.verifiedEntryCount, 2);
  assert.equal(result.taxableAmount, 1500);
  assert.equal(result.cgst, 90);
  assert.equal(result.sgst, 90);
  assert.equal(result.igst, 90);
});

test('payout stays blocked until both owner approval and native service verification', () => {
  assert.equal(evaluatePayoutGuard({ ownerApproved: false, accessibilityServiceVerified: false }).allowed, false);
  assert.equal(evaluatePayoutGuard({ ownerApproved: true, accessibilityServiceVerified: false }).allowed, false);
});
