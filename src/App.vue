<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex flex-col items-center py-10 px-4">
    <div class="w-full max-w-sm space-y-4">

      <!-- Header -->
      <div class="text-center mb-2">
        <h1 class="text-2xl font-bold text-slate-800">誠品生活候位追蹤</h1>
        <p class="text-xs text-slate-400 mt-1">eslite spectrum 新店</p>
      </div>

      <!-- Add tracking input -->
      <div class="bg-white rounded-2xl p-4 shadow-md">
        <div class="flex gap-2">
          <input
            v-model="inputCode"
            type="text"
            placeholder="訂位代碼或網址，如 EEHWAS"
            class="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            @keyup.enter="addTracking"
          />
          <button
            @click="addTracking"
            :disabled="!inputCode.trim() || adding"
            class="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold px-4 rounded-xl transition text-sm"
          >
            {{ adding ? '...' : '追蹤' }}
          </button>
        </div>
        <p v-if="inputError" class="text-red-500 text-xs mt-1.5 pl-1">{{ inputError }}</p>
        <p class="text-xs text-slate-300 mt-2 pl-1">也可在 Telegram <a href="https://t.me/eslite_premium_bot" target="_blank" class="text-blue-400 hover:underline">@eslite_premium_bot</a> 傳送代碼</p>
      </div>

      <!-- No sessions -->
      <div v-if="sessions.length === 0" class="text-center text-slate-400 text-sm py-8">
        尚未追蹤任何訂位
      </div>

      <!-- Tracking cards -->
      <TrackingCard
        v-for="s in sessions"
        :key="s.sessionKey"
        :booking-code="s.bookingCode"
        :position="s.lastPosition"
        :last-checked-at="s.lastCheckedAt"
        :source="s.chatId === 0 ? 'web' : 'telegram'"
        @stop="stopSession(s.sessionKey)"
      />

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import TrackingCard from './components/TrackingCard.vue'

interface SessionInfo {
  sessionKey: string
  chatId: number
  bookingCode: string
  lastPosition: number | null
  lastCheckedAt: string | null
}

const sessions = ref<SessionInfo[]>([])
const inputCode = ref('')
const inputError = ref('')
const adding = ref(false)
let es: EventSource | null = null

function parseCode(input: string): string | null {
  const t = input.trim()
  if (t.startsWith('http')) {
    const m = t.match(/\/([A-Z0-9]{4,12})(?:[/?#]|$)/i)
    return m ? m[1].toUpperCase() : null
  }
  if (/^[A-Z0-9]{4,12}$/i.test(t)) return t.toUpperCase()
  return null
}

async function addTracking() {
  inputError.value = ''
  const code = parseCode(inputCode.value)
  if (!code) { inputError.value = '請輸入有效的訂位代碼（4–12位英數字）或完整網址'; return }

  const alreadyTracked = sessions.value.some(s => s.bookingCode === code)
  if (alreadyTracked) { inputError.value = `${code} 已在追蹤中`; return }

  adding.value = true
  try {
    await axios.post('/api/tracking/start', { bookingCode: code })
    inputCode.value = ''
  } catch {
    inputError.value = '新增失敗，請稍後再試'
  } finally {
    adding.value = false
  }
}

async function stopSession(sessionKey: string) {
  try {
    await axios.delete(`/api/tracking/sessions/${encodeURIComponent(sessionKey)}`)
  } catch { /* ignore */ }
}

onMounted(() => {
  es = new EventSource('/api/tracking/events')

  es.addEventListener('sessions', (e) => {
    sessions.value = JSON.parse(e.data)
  })

  es.addEventListener('update', (e) => {
    const u = JSON.parse(e.data)
    const idx = sessions.value.findIndex(s => s.sessionKey === u.sessionKey)
    const updated: SessionInfo = {
      sessionKey: u.sessionKey,
      chatId: u.chatId,
      bookingCode: u.bookingCode,
      lastPosition: u.position,
      lastCheckedAt: u.updatedAt,
    }
    if (idx >= 0) sessions.value[idx] = updated
    else sessions.value.push(updated)
  })
})

onUnmounted(() => es?.close())
</script>
