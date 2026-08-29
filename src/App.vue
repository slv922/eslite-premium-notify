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
        :key="s.bookingCode"
        :booking-code="s.bookingCode"
        :position="s.lastPosition"
        :last-checked-at="s.lastCheckedAt"
        :source="s.chatId === 0 ? 'web' : 'telegram'"
        @stop="stopSession(s.bookingCode)"
      />

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import TrackingCard from './components/TrackingCard.vue'

const STORAGE_KEY = 'eslite-sessions'
const POLL_INTERVAL = 60_000

interface SessionInfo {
  bookingCode: string
  chatId: number
  lastPosition: number | null
  lastCheckedAt: string | null
}

const sessions = ref<SessionInfo[]>([])
const inputCode = ref('')
const inputError = ref('')
const adding = ref(false)
const timers = new Map<string, ReturnType<typeof setInterval>>()

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    sessions.value = raw ? JSON.parse(raw) : []
  } catch {
    sessions.value = []
  }
}

function saveSessions() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.value)) } catch {}
}

function parseCode(input: string): string | null {
  const t = input.trim()
  if (t.startsWith('http')) {
    const m = t.match(/\/([A-Z0-9]{4,12})(?:[/?#]|$)/i)
    return m ? m[1].toUpperCase() : null
  }
  if (/^[A-Z0-9]{4,12}$/i.test(t)) return t.toUpperCase()
  return null
}

async function pollSession(code: string) {
  try {
    const res = await axios.put(`/api/v2/waitlist/position/${code}`, {}, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      timeout: 8000,
    })
    const idx = sessions.value.findIndex(s => s.bookingCode === code)
    if (idx >= 0) {
      sessions.value[idx].lastPosition = res.data.position ?? null
      sessions.value[idx].lastCheckedAt = new Date().toISOString()
      saveSessions()
    }
  } catch (err: any) {
    if (err?.response?.status === 404) removeSession(code)
  }
}

function startPolling(code: string) {
  if (timers.has(code)) return
  pollSession(code)
  timers.set(code, setInterval(() => pollSession(code), POLL_INTERVAL))
}

function removeSession(code: string) {
  const timer = timers.get(code)
  if (timer) { clearInterval(timer); timers.delete(code) }
  sessions.value = sessions.value.filter(s => s.bookingCode !== code)
  saveSessions()
}

async function addTracking() {
  inputError.value = ''
  const code = parseCode(inputCode.value)
  if (!code) { inputError.value = '請輸入有效的訂位代碼（4–12位英數字）或完整網址'; return }
  if (sessions.value.some(s => s.bookingCode === code)) { inputError.value = `${code} 已在追蹤中`; return }

  adding.value = true
  try {
    await axios.post('/api/tracking/start', { bookingCode: code })
    sessions.value.push({ bookingCode: code, chatId: 0, lastPosition: null, lastCheckedAt: null })
    saveSessions()
    startPolling(code)
    inputCode.value = ''
  } catch (err: any) {
    inputError.value = err?.response?.data?.error ?? '新增失敗，請稍後再試'
  } finally {
    adding.value = false
  }
}

async function stopSession(bookingCode: string) {
  try { await axios.delete(`/api/tracking/sessions/${bookingCode}`) } catch {}
  removeSession(bookingCode)
}

onMounted(() => {
  loadSessions()
  sessions.value.forEach(s => startPolling(s.bookingCode))
})

onUnmounted(() => {
  timers.forEach(t => clearInterval(t))
  timers.clear()
})
</script>
