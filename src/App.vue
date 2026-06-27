<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center p-4">
    <div class="w-full max-w-sm">

      <!-- Header -->
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-slate-800">誠品生活候位追蹤</h1>
        <p class="text-sm text-slate-400 mt-1">eslite spectrum 新店</p>
      </div>

      <!-- TRACKING STATE -->
      <template v-if="activeSession">
        <div :class="[
          'rounded-2xl p-6 shadow-lg transition-all duration-500',
          activeSession.isUrgent
            ? 'bg-red-500 text-white'
            : 'bg-white text-slate-800'
        ]">
          <!-- Top row: code + stop button -->
          <div class="flex items-center justify-between mb-4">
            <span :class="['font-mono text-sm font-semibold px-2 py-1 rounded-lg',
              activeSession.isUrgent ? 'bg-red-400 text-white' : 'bg-slate-100 text-slate-600']">
              {{ activeSession.bookingCode }}
            </span>
            <button @click="stopTracking" :class="[
              'text-xs px-3 py-1.5 rounded-full font-medium transition',
              activeSession.isUrgent
                ? 'bg-red-400 hover:bg-red-300 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            ]">
              停止追蹤
            </button>
          </div>

          <!-- Position number -->
          <div class="text-center my-6">
            <div v-if="activeSession.isUrgent" class="text-lg font-bold mb-2 animate-pulse">
              🚨 快輪到了！
            </div>
            <div :class="['text-7xl font-black', activeSession.isUrgent ? 'text-white' : 'text-blue-600']">
              {{ activeSession.position ?? '—' }}
            </div>
            <div :class="['text-base mt-2', activeSession.isUrgent ? 'text-red-100' : 'text-slate-400']">
              組在前方等候
            </div>
          </div>

          <!-- Footer: update time + countdown -->
          <div :class="['flex justify-between text-xs mt-4 pt-4',
            activeSession.isUrgent ? 'border-t border-red-400 text-red-100' : 'border-t border-slate-100 text-slate-400']">
            <span>更新 {{ activeSession.lastCheckedAt ? formatTime(activeSession.lastCheckedAt) : '—' }}</span>
            <span v-if="countdown !== null">{{ countdown }} 秒後更新</span>
          </div>

          <!-- Source badge -->
          <div class="text-center mt-3">
            <span :class="['text-xs', activeSession.isUrgent ? 'text-red-200' : 'text-slate-300']">
              📱 由 Telegram Bot 追蹤中
            </span>
          </div>
        </div>

        <!-- Hint to stop from Telegram too -->
        <p class="text-center text-xs text-slate-400 mt-3">
          也可在 Telegram 輸入 <code class="bg-slate-200 px-1 rounded">/stop</code> 停止追蹤
        </p>
      </template>

      <!-- IDLE STATE: input form -->
      <template v-else>
        <div class="bg-white rounded-2xl p-6 shadow-lg">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-600 mb-1.5">訂位代碼或網址</label>
              <input
                v-model="inputCode"
                type="text"
                placeholder="例如：EEHWAS"
                class="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                @keyup.enter="startLocalTracking"
              />
              <p v-if="inputError" class="text-red-500 text-xs mt-1">{{ inputError }}</p>
            </div>

            <button
              @click="startLocalTracking"
              :disabled="!inputCode.trim()"
              class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl transition text-sm"
            >
              開始追蹤
            </button>
          </div>

          <div class="mt-5 pt-4 border-t border-slate-100 text-center">
            <p class="text-xs text-slate-400">或在 Telegram 直接傳送訂位代碼</p>
            <a
              href="https://t.me/eslite_premium_bot"
              target="_blank"
              class="inline-flex items-center gap-1.5 mt-2 text-blue-500 text-xs hover:underline"
            >
              📱 @eslite_premium_bot
            </a>
          </div>
        </div>
      </template>

      <!-- Local tracking status (when started from web, bot not tracking) -->
      <div v-if="localSession && !activeSession" class="mt-4 bg-white rounded-2xl p-6 shadow-lg">
        <div class="flex items-center justify-between mb-4">
          <span class="font-mono text-sm font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
            {{ localSession.bookingCode }}
          </span>
          <button @click="stopLocalTracking"
            class="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition">
            停止追蹤
          </button>
        </div>
        <div class="text-center my-4">
          <div class="text-6xl font-black text-blue-600">{{ localSession.position ?? '—' }}</div>
          <div class="text-base text-slate-400 mt-2">組在前方等候</div>
        </div>
        <div class="flex justify-between text-xs text-slate-400 border-t border-slate-100 pt-3 mt-3">
          <span>更新 {{ localSession.lastUpdated ? formatTime(localSession.lastUpdated) : '—' }}</span>
          <span>網頁追蹤中</span>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

// ── SSE: bot session state ───────────────────────────────────────────────────
interface BotSession {
  chatId: number
  bookingCode: string
  lastPosition: number | null
  lastCheckedAt: string | null
  isUrgent?: boolean
}

const botSessions = ref<BotSession[]>([])
let es: EventSource | null = null

const activeSession = computed(() => {
  if (botSessions.value.length === 0) return null
  const s = botSessions.value[0]
  return {
    ...s,
    position: s.lastPosition,
    isUrgent: (s.lastPosition ?? Infinity) <= 3,
  }
})

// Countdown timer
const countdown = ref<number | null>(null)
let countdownTimer: ReturnType<typeof setInterval> | null = null

function startCountdown(lastCheckedAt: string | null) {
  if (countdownTimer) clearInterval(countdownTimer)
  if (!lastCheckedAt) return
  const update = () => {
    const elapsed = Math.floor((Date.now() - new Date(lastCheckedAt).getTime()) / 1000)
    countdown.value = Math.max(0, 60 - elapsed)
  }
  update()
  countdownTimer = setInterval(update, 1000)
}

// ── Local web tracking ───────────────────────────────────────────────────────
interface LocalSession {
  bookingCode: string
  position: number | null
  lastUpdated: string | null
}

const localSession = ref<LocalSession | null>(null)
let localTimer: ReturnType<typeof setInterval> | null = null

async function fetchPosition(code: string): Promise<number | null> {
  const res = await axios.put(`/api/v2/waitlist/position/${code}`, {}, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
  })
  return res.data.position ?? null
}

async function startLocalTracking() {
  const code = parseCode(inputCode.value.trim())
  if (!code) { inputError.value = '請輸入有效的訂位代碼（4–12位英數字）或完整網址'; return }
  inputError.value = ''
  localSession.value = { bookingCode: code, position: null, lastUpdated: null }

  const poll = async () => {
    try {
      const pos = await fetchPosition(code)
      if (localSession.value?.bookingCode === code) {
        localSession.value = { bookingCode: code, position: pos, lastUpdated: new Date().toISOString() }
      }
    } catch { /* ignore */ }
  }
  await poll()
  localTimer = setInterval(poll, 60000)
}

function stopLocalTracking() {
  if (localTimer) clearInterval(localTimer)
  localTimer = null
  localSession.value = null
}

async function stopTracking() {
  const session = activeSession.value
  if (!session) return
  try {
    await axios.delete(`/api/tracking/sessions/${session.chatId}`)
  } catch { /* ignore */ }
}

// ── Form state ───────────────────────────────────────────────────────────────
const inputCode = ref('')
const inputError = ref('')

function parseCode(input: string): string | null {
  if (input.startsWith('http')) {
    const m = input.match(/\/([A-Z0-9]{4,12})(?:[/?#]|$)/i)
    return m ? m[1].toUpperCase() : null
  }
  if (/^[A-Z0-9]{4,12}$/i.test(input)) return input.toUpperCase()
  return null
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  es = new EventSource('/api/tracking/events')

  es.addEventListener('sessions', (e) => {
    botSessions.value = JSON.parse(e.data)
    if (botSessions.value.length > 0) startCountdown(botSessions.value[0].lastCheckedAt)
  })

  es.addEventListener('update', (e) => {
    const update = JSON.parse(e.data)
    const idx = botSessions.value.findIndex(s => s.chatId === update.chatId)
    const updated: BotSession = {
      chatId: update.chatId,
      bookingCode: update.bookingCode,
      lastPosition: update.position,
      lastCheckedAt: update.updatedAt,
    }
    if (idx >= 0) botSessions.value[idx] = updated
    else botSessions.value.push(updated)
    startCountdown(update.updatedAt)
  })
})

onUnmounted(() => {
  es?.close()
  if (countdownTimer) clearInterval(countdownTimer)
  if (localTimer) clearInterval(localTimer)
})
</script>
