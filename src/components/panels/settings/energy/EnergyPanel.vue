<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { panelIcons } from '@/constants/panel-icons';
import { useCreditsStore } from '@/stores/credits';
import { translateApiUserMessage } from '@/utils/translateApiMessage';
import PanelSection from '@/components/ui/PanelSection.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';

const creditsStore = useCreditsStore();
const { t, locale } = useI18n();

const activeTab = ref<'buy' | 'history' | 'usage'>('buy');

onMounted(async () => {
  await creditsStore.loadBalance();
  await creditsStore.loadPacks();
});

async function switchTab(tab: 'buy' | 'history' | 'usage') {
  activeTab.value = tab;
  if (tab === 'history' && creditsStore.transactions.length === 0) {
    await creditsStore.loadTransactions();
  }
  if (tab === 'usage' && creditsStore.usageLogs.length === 0) {
    await creditsStore.loadUsageLogs();
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale.value === 'es' ? 'es-ES' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEnergy(micro: number): string {
  const val = Math.floor(Math.abs(micro) / 1000);
  return val.toLocaleString();
}

function usageUnit(modelType: string): string {
  if (modelType === 'llm') return t('energyPanel.tokens');
  if (modelType === 'stt' || modelType === 'realtime') return t('energyPanel.min');
  return t('energyPanel.chars');
}

function transactionIcon(type: string): string {
  switch (type) {
    case 'purchase': return 'ph:lightning-fill';
    case 'usage': return 'ph:flame-duotone';
    case 'bonus': return 'ph:gift-duotone';
    case 'refund': return 'ph:arrow-counter-clockwise-duotone';
    default: return 'ph:circle-duotone';
  }
}

function transactionColor(type: string): string {
  switch (type) {
    case 'purchase': return 'var(--accent-primary)';
    case 'usage': return 'var(--accent-secondary)';
    case 'bonus': return 'var(--warning)';
    case 'refund': return 'var(--text-muted)';
    default: return 'var(--text-muted)';
  }
}

function modelTypeIcon(type: string): string {
  switch (type) {
    case 'llm': return 'ph:brain-duotone';
    case 'stt': return 'ph:microphone-duotone';
    case 'tts': return 'ph:speaker-high-duotone';
    case 'realtime': return 'ph:waveform-duotone';
    default: return 'ph:circle-duotone';
  }
}

const balancePercentage = computed(() => {
  if (!creditsStore.balance) return 0;
  const purchased = creditsStore.balance.lifetime_purchased;
  if (purchased === 0) return 100;
  return Math.min(100, Math.max(0, (creditsStore.balance.balance / purchased) * 100));
});

const energyLevel = computed(() => {
  const b = creditsStore.displayBalance;
  if (b <= 0) return 'depleted';
  if (b < 100) return 'low';
  if (b < 500) return 'medium';
  return 'high';
});

const creditErrorMessage = computed(() => {
  if (!creditsStore.error) return '';
  return translateApiUserMessage(creditsStore.error, t);
});

function packIcon(packId: string): string {
  switch (packId) {
    case 'starter': return 'ph:battery-medium-duotone';
    case 'standard': return 'ph:battery-high-duotone';
    case 'pro': return 'ph:battery-charging-duotone';
    default: return 'ph:lightning-duotone';
  }
}
</script>

<template>
  <div class="panel-inner">
    <div class="panel-header">
      <iconify-icon :icon="panelIcons.credits" class="panel-icon"></iconify-icon>
      <h2>{{ t('energyPanel.title') }}</h2>
      <PanelHeaderControls />
    </div>

    <div class="panel-body">
      <!-- Energy Meter -->
      <PanelSection>
        <div class="energy-meter" :class="energyLevel">
          <div class="meter-icon">
            <iconify-icon icon="ph:lightning-fill"></iconify-icon>
          </div>
          <div class="meter-content">
            <div class="meter-value">
              <span class="meter-amount">{{ creditsStore.displayBalance.toLocaleString() }}</span>
              <span class="meter-unit">{{ t('energyPanel.energyUnit') }}</span>
            </div>
            <div class="meter-bar">
              <div class="meter-bar-fill" :style="{ width: balancePercentage + '%' }"></div>
              <div class="meter-bar-glow" :style="{ width: balancePercentage + '%' }"></div>
            </div>
            <div class="meter-stats">
              <span class="meter-stat">
                <iconify-icon icon="ph:arrow-down-bold" class="stat-icon charged"></iconify-icon>
                {{ creditsStore.lifetimePurchased.toLocaleString() }} {{ t('energyPanel.charged') }}
              </span>
              <span class="meter-stat">
                <iconify-icon icon="ph:flame-bold" class="stat-icon used"></iconify-icon>
                {{ creditsStore.lifetimeUsed.toLocaleString() }} {{ t('energyPanel.used') }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="energyLevel === 'depleted'" class="depleted-warning">
          <iconify-icon icon="ph:warning-duotone"></iconify-icon>
          <span>{{ t('energyPanel.depletedWarning') }}</span>
        </div>
        <div v-else-if="energyLevel === 'low'" class="low-warning">
          <iconify-icon icon="ph:battery-warning-duotone"></iconify-icon>
          <span>{{ t('energyPanel.lowWarning') }}</span>
        </div>
      </PanelSection>

      <div v-if="creditErrorMessage" class="credit-error-banner" role="alert">
        <iconify-icon icon="ph:warning-circle-duotone"></iconify-icon>
        <span>{{ creditErrorMessage }}</span>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          class="tab"
          :class="{ active: activeTab === 'buy' }"
          @click="switchTab('buy')"
        >
          <iconify-icon icon="ph:lightning-fill" class="tab-icon"></iconify-icon>
          {{ t('energyPanel.recharge') }}
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'history' }"
          @click="switchTab('history')"
        >
          <iconify-icon icon="ph:clock-duotone" class="tab-icon"></iconify-icon>
          {{ t('energyPanel.history') }}
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'usage' }"
          @click="switchTab('usage')"
        >
          <iconify-icon icon="ph:chart-bar-duotone" class="tab-icon"></iconify-icon>
          {{ t('energyPanel.usage') }}
        </button>
      </div>

      <!-- Recharge Tab -->
      <PanelSection v-if="activeTab === 'buy'" :title="t('energyPanel.energyPacks')">
        <div class="packs-list">
          <button
            v-for="pack in creditsStore.packs"
            :key="pack.id"
            class="pack-card"
            :class="{ popular: pack.popular }"
            @click="creditsStore.purchaseCredits(pack.id)"
            :disabled="creditsStore.loading"
          >
            <div v-if="pack.popular" class="popular-badge">{{ t('energyPanel.bestValue') }}</div>
            <div class="pack-icon-wrap">
              <iconify-icon :icon="packIcon(pack.id)" class="pack-icon"></iconify-icon>
            </div>
            <div class="pack-details">
              <div class="pack-name">{{ pack.name }}</div>
              <div class="pack-energy">
                {{ pack.credits.toLocaleString() }}
                <span class="pack-energy-label">{{ t('energyPanel.energyUnit') }}</span>
              </div>
            </div>
            <div class="pack-pricing">
              <div class="pack-price">{{ pack.price_display }}</div>
            </div>
          </button>
        </div>
        <p class="energy-info">
          {{ t('energyPanel.energyInfo') }}
        </p>
      </PanelSection>

      <!-- History Tab -->
      <PanelSection v-if="activeTab === 'history'" :title="t('energyPanel.transactionHistory')">
        <div v-if="creditsStore.loading" class="loading-state">
          <iconify-icon icon="ph:spinner-gap-bold" class="spin"></iconify-icon>
          {{ t('energyPanel.loading') }}
        </div>
        <div v-else-if="creditsStore.transactions.length === 0" class="empty-state">
          <iconify-icon icon="ph:clock-duotone" class="empty-icon"></iconify-icon>
          <span>{{ t('energyPanel.noTransactions') }}</span>
        </div>
        <div v-else class="transactions-list">
          <div
            v-for="tx in creditsStore.transactions"
            :key="tx.id"
            class="transaction-item"
          >
            <div class="tx-icon" :style="{ color: transactionColor(tx.type) }">
              <iconify-icon :icon="transactionIcon(tx.type)"></iconify-icon>
            </div>
            <div class="tx-info">
              <span class="tx-description">{{ tx.description || tx.type }}</span>
              <span class="tx-date">{{ formatDate(tx.created_at) }}</span>
            </div>
            <div class="tx-amount" :class="{ positive: tx.amount > 0, negative: tx.amount < 0 }">
              {{ tx.amount > 0 ? '+' : '-' }}{{ formatEnergy(tx.amount) }}
            </div>
          </div>
        </div>
        <BaseButton
          v-if="creditsStore.transactions.length >= 50"
          variant="ghost"
          size="sm"
          block
          @click="creditsStore.loadTransactions(50, creditsStore.transactions.length)"
        >
          {{ t('energyPanel.loadMore') }}
        </BaseButton>
      </PanelSection>

      <!-- Usage Tab -->
      <PanelSection v-if="activeTab === 'usage'" :title="t('energyPanel.energyConsumption')">
        <div v-if="creditsStore.loading" class="loading-state">
          <iconify-icon icon="ph:spinner-gap-bold" class="spin"></iconify-icon>
          {{ t('energyPanel.loading') }}
        </div>
        <div v-else-if="creditsStore.usageLogs.length === 0" class="empty-state">
          <iconify-icon icon="ph:chart-bar-duotone" class="empty-icon"></iconify-icon>
          <span>{{ t('energyPanel.noUsage') }}</span>
        </div>
        <div v-else class="usage-list">
          <div
            v-for="log in creditsStore.usageLogs"
            :key="log.id"
            class="usage-item"
          >
            <div class="usage-icon">
              <iconify-icon :icon="modelTypeIcon(log.model_type)"></iconify-icon>
            </div>
            <div class="usage-info">
              <span class="usage-model">{{ log.model_id }}</span>
              <span class="usage-meta">
                {{ log.model_type.toUpperCase() }} &middot;
                {{ log.units_used.toFixed(2) }}
                {{ usageUnit(log.model_type) }}
              </span>
            </div>
            <div class="usage-cost">
              <span class="usage-energy">-{{ formatEnergy(log.credits_charged) }}</span>
              <span class="usage-date">{{ formatDate(log.created_at) }}</span>
            </div>
          </div>
        </div>
      </PanelSection>
    </div>
  </div>
</template>

<style scoped>
/* ========================================================================= */
/* Energy Meter                                                              */
/* ========================================================================= */

.energy-meter {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: var(--surface-1);
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  transition: border-color 0.3s ease;
}

.energy-meter.high { border-color: var(--accent-glow); }
.energy-meter.depleted { border-color: var(--error-glow); }

.meter-icon {
  font-size: 32px;
  color: var(--accent-primary);
  flex-shrink: 0;
  line-height: 1;
}

.energy-meter.depleted .meter-icon { color: var(--error); opacity: 0.5; }
.energy-meter.low .meter-icon { color: var(--warning); }

.meter-content {
  flex: 1;
  min-width: 0;
}

.meter-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 10px;
}

.meter-amount {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.energy-meter.depleted .meter-amount { color: var(--error); }

.meter-unit {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.meter-bar {
  position: relative;
  height: 6px;
  background: var(--surface-3);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.meter-bar-fill {
  position: absolute;
  inset: 0;
  width: 0%;
  background: linear-gradient(90deg, var(--accent-secondary), var(--accent-primary));
  border-radius: 3px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.energy-meter.depleted .meter-bar-fill { background: var(--error); }
.energy-meter.low .meter-bar-fill { background: linear-gradient(90deg, var(--error), var(--warning)); }

.meter-bar-glow {
  position: absolute;
  inset: -2px 0;
  width: 0%;
  background: linear-gradient(90deg, transparent, var(--accent-glow));
  border-radius: 3px;
  filter: blur(4px);
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.meter-stats {
  display: flex;
  gap: 16px;
}

.meter-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 500;
}

.stat-icon { font-size: 10px; }
.stat-icon.charged { color: var(--success); }
.stat-icon.used { color: var(--warning); }

/* Warnings */
.depleted-warning,
.low-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-top: 12px;
  border-radius: var(--radius-md);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
}

.depleted-warning {
  background: var(--error-glow);
  border: 1px solid var(--error-glow);
  color: var(--error);
}

.low-warning {
  background: var(--warning-glow);
  border: 1px solid var(--warning-glow);
  color: var(--warning);
}

.depleted-warning iconify-icon,
.low-warning iconify-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.credit-error-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 20px;
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--error);
  background: var(--error-glow);
  border-bottom: 1px solid var(--error-glow);
}

.credit-error-banner iconify-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

/* ========================================================================= */
/* Tabs                                                                      */
/* ========================================================================= */

.tabs {
  display: flex;
  gap: 2px;
  padding: 4px 20px;
  border-bottom: 1px solid var(--glass-border);
}

.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab:hover { color: var(--text-primary); }

.tab.active {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
}

.tab-icon { font-size: 14px; }

/* ========================================================================= */
/* Energy Packs                                                              */
/* ========================================================================= */

.packs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pack-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  text-align: left;
}

.pack-card:hover:not(:disabled) {
  background: var(--surface-2);
  border-color: var(--accent-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 20px var(--accent-glow);
}

.pack-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pack-card.popular {
  border-color: var(--accent-primary);
  background: var(--accent-glow);
}

.popular-badge {
  position: absolute;
  top: -8px;
  right: 12px;
  padding: 2px 8px;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  color: white;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 4px;
}

.pack-icon-wrap {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.pack-icon {
  font-size: 22px;
  color: var(--accent-primary);
}

.pack-details {
  flex: 1;
  min-width: 0;
}

.pack-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.pack-energy {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-primary);
  font-variant-numeric: tabular-nums;
}

.pack-energy-label {
  font-weight: 400;
  color: var(--text-muted);
}

.pack-pricing {
  flex-shrink: 0;
  text-align: right;
}

.pack-price {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.energy-info {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  margin-top: 14px;
  line-height: 1.5;
}

/* ========================================================================= */
/* Transactions                                                              */
/* ========================================================================= */

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  transition: background 0.15s ease;
}

.transaction-item:hover { background: var(--surface-1); }

.tx-icon { font-size: 18px; flex-shrink: 0; }

.tx-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.tx-description {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tx-date {
  font-size: 10px;
  color: var(--text-muted);
}

.tx-amount {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.tx-amount.positive { color: var(--accent-primary); }
.tx-amount.negative { color: var(--text-muted); }

/* ========================================================================= */
/* Usage                                                                     */
/* ========================================================================= */

.usage-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.usage-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  transition: background 0.15s ease;
}

.usage-item:hover { background: var(--surface-1); }

.usage-icon {
  font-size: 18px;
  color: var(--accent-primary);
  flex-shrink: 0;
}

.usage-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.usage-model {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.usage-meta {
  font-size: 10px;
  color: var(--text-muted);
}

.usage-cost {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.usage-energy {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.usage-date {
  font-size: 10px;
  color: var(--text-muted);
}

/* ========================================================================= */
/* Empty & Loading                                                           */
/* ========================================================================= */

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 20px;
  font-size: 12px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 28px;
  opacity: 0.4;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
