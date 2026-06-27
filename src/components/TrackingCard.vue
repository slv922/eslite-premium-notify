<template>
  <div :class="[
    'rounded-2xl p-5 shadow-md transition-all duration-500',
    isUrgent ? 'bg-red-500 text-white' : 'bg-white text-slate-800'
  ]">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <span :class="['font-mono text-xs font-bold px-2 py-1 rounded-lg',
          isUrgent ? 'bg-red-400 text-white' : 'bg-slate-100 text-slate-500']">
          {{ bookingCode }}
        </span>
        <span v-if="source === 'telegram'" :class="['text-xs', isUrgent ? 'text-red-200' : 'text-slate-300']">
          📱
        </span>
      </div>
      <button @click="$emit('stop')" :class="[
        'text-xs px-3 py-1 rounded-full font-medium transition',
        isUrgent ? 'bg-red-400 hover:bg-red-300 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
      ]">✕ 停止</button>
    </div>

    <!-- Position -->
    <div class="text-center py-3">
      <div v-if="isUrgent" class="text-sm font-bold mb-1 animate-pulse">🚨 快輪到了！</div>
      <div :class="['text-6xl font-black leading-none', isUrgent ? 'text-white' : 'text-blue-600']">
        {{ position !== null ? position : '—' }}
      </div>
      <div :class="['text-sm mt-2', isUrgent ? 'text-red-100' : 'text-slate-400']">組在前方等候</div>
    </div>

    <!-- Footer -->
    <div :class="['flex justify-between text-xs pt-3 mt-2 border-t',
      isUrgent ? 'border-red-400 text-red-200' : 'border-slate-100 text-slate-400']">
      <span>{{ lastCheckedAt ? formatTime(lastCheckedAt) : '等待查詢...' }}</span>
      <span v-if="countdown !== null">{{ countdown }}s 後更新</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  bookingCode: string
  position: number | null
  lastCheckedAt: string | null
  source: 'telegram' | 'web'
}>()

defineEmits<{ stop: [] }>()

const isUrgent = ref(false)
const countdown = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-TW', {
    timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function updateCountdown() {
  if (!props.lastCheckedAt) { countdown.value = null; return }
  const elapsed = Math.floor((Date.now() - new Date(props.lastCheckedAt).getTime()) / 1000)
  countdown.value = Math.max(0, 60 - elapsed)
}

watch(() => props.position, (val) => {
  isUrgent.value = val !== null && val <= 3
}, { immediate: true })

watch(() => props.lastCheckedAt, () => updateCountdown(), { immediate: true })

onMounted(() => { timer = setInterval(updateCountdown, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
