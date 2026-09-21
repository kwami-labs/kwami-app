import type { ComposerTranslation } from 'vue-i18n';

/**
 * Map common English API / fetch error text to user-facing i18n keys.
 * Unknown messages pass through unchanged (often English backend detail).
 */
export function translateApiUserMessage(raw: unknown, t: ComposerTranslation): string {
  const s = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
  if (!s) return t('apiErrors.generic');

  const balanceM = /^Failed to fetch balance: (\d+)$/.exec(s);
  if (balanceM) {
    return t('apiErrors.creditsBalanceFailed', { status: balanceM[1] });
  }
  const packsM = /^Failed to fetch packs: (\d+)$/.exec(s);
  if (packsM) {
    return t('apiErrors.creditsPacksFailed', { status: packsM[1] });
  }
  const txM = /^Failed to fetch transactions: (\d+)$/.exec(s);
  if (txM) {
    return t('apiErrors.creditsTransactionsFailed', { status: txM[1] });
  }
  const usageM = /^Failed to fetch usage logs: (\d+)$/.exec(s);
  if (usageM) {
    return t('apiErrors.creditsUsageFailed', { status: usageM[1] });
  }
  const purchaseM = /^Purchase failed: (\d+)$/.exec(s);
  if (purchaseM) {
    if (purchaseM[1] === '402') {
      return t('apiErrors.insufficientCredits');
    }
    return t('apiErrors.creditsPurchaseFailed', { status: purchaseM[1] });
  }

  if (/insufficient credit/i.test(s) || /\b402\b/.test(s)) {
    return t('apiErrors.insufficientCredits');
  }
  if (/\b401\b/i.test(s) || /unauthorized|not authenticated|invalid token/i.test(s)) {
    return t('apiErrors.unauthorized');
  }
  if (/\b403\b/i.test(s) || /forbidden/i.test(s)) {
    return t('apiErrors.forbidden');
  }
  if (/\b404\b/i.test(s) || /\bnot found\b/i.test(s)) {
    return t('apiErrors.notFound');
  }
  if (/\b429\b/i.test(s) || /rate limit|too many requests/i.test(s)) {
    return t('apiErrors.rateLimited');
  }
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(s)) {
    return t('apiErrors.network');
  }

  return s;
}
