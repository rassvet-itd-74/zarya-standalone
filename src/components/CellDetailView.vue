<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useCellDetail } from '../composables/useCellDetail';

const props = defineProps<{
  x:             bigint;
  y:             bigint;
  decimals:      number;
  isCategorical: boolean;
  themes:        Map<string, string>;
  statements:    Map<string, string>;
}>();
const emit = defineEmits<{ back: [] }>();

const { t } = useI18n();
const {
  organLabel, numAgg, catAgg, history, sampleLength, histOffset,
  loadingMore, errorKey, errorMsg,
  shortAddr, formatTimestamp, loadMore, openPropose,
  themeName, stmtName,
} = useCellDetail(props);
</script>

<template>
  <div class="cell-detail">
    <div class="cell-detail__header">
      <button class="btn btn--ghost btn--sm" @click="emit('back')">{{ t('matrix.back') }}</button>
      <h3 class="cell-detail__title">{{ themeName() }} x {{ stmtName() }}</h3>
      <button class="btn btn--sm btn--outline" @click="openPropose">{{ t('matrix.propose') }}</button>
    </div>

    <p v-if="errorKey || errorMsg" class="cell-detail__error">{{ errorKey ? t(errorKey) : errorMsg }}</p>

    <div v-else>
      <p class="cell-detail__organ">
        <span class="cell-detail__organ-label">{{ t('matrix.organ') }}</span>
        <code class="cell-detail__organ-code">{{ organLabel || '...' }}</code>
      </p>

      <!-- Numerical aggregation -->
      <div v-if="!isCategorical && numAgg" class="cell-detail__agg">
        <p class="cell-detail__agg-stat">{{ t('matrix.mean') }}: <strong>{{ numAgg.mean.toFixed(decimals > 0 ? decimals : 2) }}</strong></p>
        <p class="cell-detail__agg-stat">{{ t('matrix.stdev') }}: <strong>+/-{{ numAgg.stdev.toFixed(decimals > 0 ? decimals : 2) }}</strong></p>
        <p class="cell-detail__agg-muted">{{ t('matrix.basedOn').replace('{n}', String(numAgg.count)) }}</p>
      </div>

      <!-- Categorical aggregation -->
      <div v-if="isCategorical && catAgg" class="cell-detail__agg">
        <p class="cell-detail__agg-stat">{{ t('matrix.mode') }}: <strong>{{ catAgg.mode }}</strong></p>
        <div class="cell-detail__bars">
          <div v-for="item in catAgg.distribution" :key="item.key" class="cell-detail__bar-row">
            <span class="cell-detail__bar-label" :title="item.key">{{ item.key }}</span>
            <div class="cell-detail__bar-track">
              <div class="cell-detail__bar-fill" :style="{ width: item.pct + '%' }"></div>
            </div>
            <span class="cell-detail__bar-pct">{{ item.pct }}%</span>
          </div>
        </div>
        <p class="cell-detail__agg-muted">{{ t('matrix.basedOn').replace('{n}', String(catAgg.count)) }}</p>
      </div>

      <!-- History table -->
      <table v-if="history.length > 0" class="cell-detail__history-table">
        <thead>
          <tr>
            <th>{{ t('matrix.historyTime') }}</th>
            <th>{{ t('matrix.historyAuthor') }}</th>
            <th>{{ t('matrix.historyValue') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in history" :key="i" class="cell-detail__history-row">
            <td class="cell-detail__history-ts">{{ formatTimestamp(row.ts) }}</td>
            <td class="cell-detail__history-author"><code>{{ shortAddr(row.author) }}</code></td>
            <td class="cell-detail__history-val">{{ row.value }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="sampleLength === 0n" class="cell-detail__empty">{{ t('matrix.noHistory') }}</p>

      <button
        v-if="histOffset < sampleLength"
        class="btn btn--ghost btn--sm"
        :disabled="loadingMore"
        @click="loadMore"
      >{{ t('matrix.loadMore') }}</button>
    </div>
  </div>
</template>
