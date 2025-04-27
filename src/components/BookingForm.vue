<template>
  <div class="space-y-4">
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700">
        訂位網址或代碼
      </label>
      <input 
        v-model="bookingCode"
        type="text"
        class="input w-full"
        placeholder="請輸入訂位網址或代碼 (例如: EKHZG6)"
        :disabled="isTracking"
      >
    </div>

    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700">
        查詢間隔（秒）
      </label>
      <input 
        v-model="interval"
        type="number"
        min="30"
        class="input w-32"
        :disabled="isTracking"
      >
    </div>

    <div class="flex space-x-4">
      <button 
        v-if="!isTracking"
        @click="startTracking"
        class="btn btn-primary"
        :disabled="!isValid"
      >
        開始追蹤
      </button>
      <button 
        v-else
        @click="stopTracking"
        class="btn btn-secondary"
      >
        停止追蹤
      </button>
    </div>

    <div v-if="error" class="text-red-500 text-sm mt-2">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  isTracking: boolean
}>()

const emit = defineEmits<{
  (e: 'startTracking', code: string, interval: number): void
  (e: 'stopTracking'): void
}>()

const bookingCode = ref('')
const interval = ref(60)
const error = ref('')

const validateBookingCode = (code: string): boolean => {
  // 檢查是否為純訂位代碼（6位英數字）
  if (/^[A-Z0-9]{6}$/i.test(code)) {
    return true
  }
  // 檢查是否為完整 TableCheck URL
  const urlPattern = /^https:\/\/www\.tablecheck\.com\/[\w-]+\/waitlist\/[A-Z0-9]{6}$/i
  return urlPattern.test(code)
}

const isValid = computed(() => {
  const code = bookingCode.value.trim()
  return validateBookingCode(code) && interval.value >= 30
})

watch([() => bookingCode.value, () => interval.value], () => {
  error.value = ''
  const code = bookingCode.value.trim()
  if (!validateBookingCode(code) && code.length > 0) {
    error.value = '請輸入有效的訂位代碼（6位英數字）或完整網址\n範例：EKHZG6 或 https://www.tablecheck.com/zh-TW/waitlist/EKHZG6'
  } else if (interval.value < 30) {
    error.value = '查詢間隔請勿低於 30 秒'
  }
})

const extractBookingCode = (input: string): string => {
  // 嘗試從網址中擷取訂位代碼
  const urlPattern = /tablecheck\.com\/[\w-]+\/waitlist\/([A-Z0-9]{6})/i
  const urlMatch = input.match(urlPattern)
  if (urlMatch) return urlMatch[1]
  // 否則直接回傳英數字代碼
  const codeMatch = input.match(/[A-Z0-9]{6}/i)
  return codeMatch ? codeMatch[0] : input
}

const startTracking = () => {
  error.value = ''
  if (!isValid.value) {
    if (!validateBookingCode(bookingCode.value.trim())) {
      error.value = '請輸入有效的訂位代碼（5-6位英數字）或完整網址\n範例：EKHZG6 或 https://www.tablecheck.com/zh-TW/waitlist/EKHZG6'
    } else if (interval.value < 30) {
      error.value = '查詢間隔請勿低於 30 秒'
    }
    return
  }
  const code = extractBookingCode(bookingCode.value.trim())
  emit('startTracking', code, interval.value)
}

const stopTracking = () => {
  emit('stopTracking')
}
</script>
