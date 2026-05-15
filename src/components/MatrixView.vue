<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useMatrix } from '../composables/useMatrix';
import CellDetailView from './CellDetailView.vue';

const { t } = useI18n();
const {
  mode, loading, xs, ys, themes, statements, dataCells, cellCounts,
  showDetail, cellDetailContext, navigate,
  loadMatrix, openCell, setMode,
} = useMatrix();
</script>

<template>
  <div class="matrix">
    <div v-if="!showDetail">
      <div class="matrix__header">
        <button class="btn btn--ghost btn--sm" @click="navigate('dashboard')">{{ t('matrix.back') }}</button>
        <h2 class="matrix__title">{{ t('matrix.title') }}</h2>
        <button class="btn btn--ghost btn--sm" :disabled="loading" @click="loadMatrix">{{ t('matrix.refresh') }}</button>
      </div>

      <div class="matrix__tabs" role="tablist">
        <button
          class="matrix__tab"
          :class="{ 'matrix__tab--active': mode === 'numerical' }"
          @click="setMode('numerical')"
        >{{ t('matrix.numerical') }}</button>
        <button
          class="matrix__tab"
          :class="{ 'matrix__tab--active': mode === 'categorical' }"
          @click="setMode('categorical')"
        >{{ t('matrix.categorical') }}</button>
      </div>

      <p v-if="loading" class="matrix__loading">{{ t('matrix.loading') }}</p>
      <p v-else-if="xs.length === 0 || ys.length === 0" class="matrix__empty">{{ t('matrix.empty') }}</p>

      <div v-else class="matrix__table-wrap">
        <table class="matrix__table">
          <thead>
            <tr>
              <th class="matrix__corner"></th>
              <th v-for="y in ys" :key="String(y)" class="matrix__th-y" :title="statements.get(String(y)) ?? `S${y}`">
                {{ statements.get(String(y)) ?? `S${y}` }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="x in xs" :key="String(x)">
              <th class="matrix__th-x" :title="themes.get(String(x)) ?? `T${x}`">
                {{ themes.get(String(x)) ?? `T${x}` }}
              </th>
              <td
                v-for="y in ys"
                :key="`${x},${y}`"
                class="matrix__cell"
                :class="{ 'matrix__cell--data': dataCells.has(`${x},${y}`) }"
                @click="dataCells.has(`${x},${y}`) && openCell(x, y)"
              >
                <span v-if="dataCells.has(`${x},${y}`)" class="matrix__cell-count">
                  {{ cellCounts.get(`${x},${y}`) ?? '...' }}
                </span>
                <span v-else class="matrix__cell-empty">--</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <CellDetailView
      v-if="showDetail"
      :x="cellDetailContext!.x"
      :y="cellDetailContext!.y"
      :decimals="cellDetailContext!.decimals"
      :is-categorical="cellDetailContext!.isCategorical"
      :themes="themes"
      :statements="statements"
      @back="cellDetailContext = null"
    />
  </div>
</template>
