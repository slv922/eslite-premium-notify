<template>
  <div class="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
    <h2 class="text-lg font-semibold mb-4">追蹤狀態</h2>
    
    <div class="space-y-2">
      <p class="flex justify-between">
        <span class="text-gray-600">訂位代碼:</span>
        <span class="font-medium">{{ status.bookingCode }}</span>
      </p>
      
      <p class="flex justify-between">
        <span class="text-gray-600">等待組數:</span>
        <span class="font-medium" :class="waitingStatusClass">
          {{ waitingStatusText }}
        </span>
      </p>
      
      <p class="flex justify-between text-sm text-gray-500">
        <span>最後更新:</span>
        <span>{{ formattedLastUpdate }}</span>
      </p>

      <div v-if="status.telegramStatus" class="mt-4 text-sm" :class="telegramStatusClass">
        {{ status.telegramStatus }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BookingStatus } from '../types'

const props = defineProps<{
  status: BookingStatus
  lastUpdated: Date | null
}>()

const waitingStatusText = computed(() => {
  if (props.status.position === null) {
    return '尚未排到位'
  }
  return `前方等待 ${props.status.position} 組`
})

const waitingStatusClass = computed(() => {
  if (props.status.position === null) {
    return 'text-gray-600'
  }
  return props.status.position > 10 ? 'text-red-500' : 'text-green-500'
})

const formattedLastUpdate = computed(() => {
  if (!props.lastUpdated) return '更新中...'
  return props.lastUpdated.toLocaleTimeString('zh-TW')
})

const telegramStatusClass = computed(() => {
  return props.status.telegramStatus?.includes('成功')
    ? 'text-green-600'
    : 'text-red-600'
})
</script>
