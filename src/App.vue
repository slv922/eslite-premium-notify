<template>
  <div class="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
    <div class="relative py-3 sm:max-w-xl sm:mx-auto">
      <div class="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
        <div class="max-w-md mx-auto">
          <div class="divide-y divide-gray-200">
            <div class="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
              <h1 class="text-3xl font-bold text-center my-6 text-blue-600">餐廳訂位追蹤工具</h1>
              
              <!-- 新增：顯示餐廳狀態 -->
              <div v-if="waitlistClosed === true" class="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded border border-yellow-300 text-center">
                餐廳目前不開放訂位
              </div>
              <div v-else-if="waitlistError" class="mb-4 p-3 bg-red-100 text-red-800 rounded border border-red-300 text-center">
                {{ waitlistError }}
              </div>

              <!-- 輸入表單 -->
              <BookingForm 
                @start-tracking="startTracking" 
                @stop-tracking="stopTracking"
                :is-tracking="isTracking"
              />

              <!-- 追蹤結果 -->
              <BookingStatus 
                v-if="bookingStatus"
                :status="bookingStatus"
                :last-updated="lastUpdated"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BookingForm from './components/BookingForm.vue'
import BookingStatus from './components/BookingStatus.vue'
import { useBookingTracker } from './composables/useBookingTracker'
import type { BookingStatus as BookingStatusType } from './types'
import axios from 'axios'

const isTracking = ref(false)
const bookingStatus = ref<BookingStatusType | null>(null)
const lastUpdated = ref<Date | null>(null)

// 新增：檢查 waitlist 狀態
const waitlistClosed = ref<boolean | null>(null)
const waitlistError = ref('')

onMounted(async () => {
  try {
    const res = await axios.get(
      '/api/v2/waitlist/status?shop_slug=eslite-premium-xindian&service_mode=dining',
      { headers: { Accept: 'application/json' } }
    )
    console.log('Waitlist return:', res.data)
    waitlistClosed.value = res.data.waitlist_status === 'closed'
  } catch (e) {
    waitlistError.value = '無法取得餐廳狀態，請稍後再試。'
    waitlistClosed.value = null
  }
})

const { startTracking: startTrackingService, stopTracking: stopTrackingService } = useBookingTracker({
  onStatusUpdate: (status) => {
    bookingStatus.value = status
    lastUpdated.value = new Date()
  },
  onError: (error) => {
    console.error('Tracking error:', error)
    // TODO: Add error handling UI
  }
})

const startTracking = async (code: string, interval: number) => {
  isTracking.value = true
  await startTrackingService(code, interval)
}

const stopTracking = () => {
  isTracking.value = false
  stopTrackingService()
}
</script>
