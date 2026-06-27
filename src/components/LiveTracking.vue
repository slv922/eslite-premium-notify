<template>
  <div v-if="sessions.length > 0" class="mt-6 space-y-3">
    <h2 class="text-lg font-semibold text-gray-700">Telegram 即時追蹤</h2>
    <div
      v-for="s in sessions"
      :key="s.chatId"
      :class="[
        'rounded-xl border p-4 transition-all',
        s.isUrgent
          ? 'border-red-400 bg-red-50'
          : 'border-blue-200 bg-blue-50'
      ]"
    >
      <div class="flex items-center justify-between">
        <span class="font-mono font-bold text-blue-700">{{ s.bookingCode }}</span>
        <span v-if="s.isUrgent" class="text-red-600 font-semibold animate-pulse">🚨 快輪到了！</span>
      </div>
      <div class="mt-2 text-2xl font-bold" :class="s.isUrgent ? 'text-red-600' : 'text-gray-800'">
        前方還有 <span>{{ s.lastPosition ?? '—' }}</span> 組
      </div>
      <div class="mt-1 text-xs text-gray-400">
        更新時間：{{ s.lastCheckedAt ? formatTime(s.lastCheckedAt) : '等待第一次查詢...' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Session {
  chatId: number
  bookingCode: string
  lastPosition: number | null
  lastCheckedAt: string | null
  isUrgent?: boolean
}

const sessions = ref<Session[]>([])
let es: EventSource | null = null

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })
}

onMounted(() => {
  es = new EventSource('/api/tracking/events')

  es.addEventListener('sessions', (e) => {
    sessions.value = JSON.parse(e.data)
  })

  es.addEventListener('update', (e) => {
    const update = JSON.parse(e.data)
    const idx = sessions.value.findIndex(s => s.chatId === update.chatId)
    const updated = {
      chatId: update.chatId,
      bookingCode: update.bookingCode,
      lastPosition: update.position,
      lastCheckedAt: update.updatedAt,
      isUrgent: update.isUrgent,
    }
    if (idx >= 0) {
      sessions.value[idx] = updated
    } else {
      sessions.value.push(updated)
    }
  })
})

onUnmounted(() => {
  es?.close()
})
</script>
