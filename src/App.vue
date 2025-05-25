<template>
  <div class="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
    <div class="relative py-3 sm:max-w-xl sm:mx-auto">
      <div class="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
        <div class="max-w-md mx-auto">
          <div class="divide-y divide-gray-200">
            <div class="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
              <h1 class="text-3xl font-bold text-center my-6 text-blue-600">餐廳訂位追蹤工具</h1>

              <!-- MOCK 模式提示訊息 -->
              <div v-if="isMockMode" class="mb-4 p-3 bg-blue-100 text-blue-800 rounded border border-blue-300 text-center">
                ⚠️ 您目前正在使用 MOCK 模式，資料為模擬結果。
              </div>

              <!-- 新增：顯示餐廳狀態 -->
              <div v-if="waitlistClosed === true" class="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded border border-yellow-300 text-center">
                餐廳目前不開放訂位
                <div class="mt-4">
                  <label for="intervalInput" class="block text-sm font-medium text-gray-700">通知間隔（秒）</label>
                  <input 
                    id="intervalInput"
                    type="number" 
                    v-model="notificationInterval" 
                    min="10" 
                    class="input w-32 mt-2" 
                    placeholder="輸入秒數"
                  >
                  <button 
                    @click="startNotification" 
                    class="btn btn-primary mt-4"
                  >
                    開始通知
                  </button>
                  <button 
                    v-if="isNotifying" 
                    @click="stopNotification" 
                    class="btn btn-secondary mt-2"
                  >
                    停止通知
                  </button>
                </div>
              </div>
              <div v-else-if="waitlistError" class="mb-4 p-3 bg-red-100 text-red-800 rounded border border-red-300 text-center">
                {{ waitlistError }}
              </div>

              <!-- 輸入表單 -->
              <BookingForm 
                @start-tracking="startTracking" 
                @stop-tracking="stopTracking" 
                :is-tracking="isTracking" 
                :waitlist-closed="waitlistClosed" 
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

// 新增：通知相關變數
const notificationInterval = ref<number>(30)
const isNotifying = ref<boolean>(false)
let notificationTimer: number | null = null

// 將 isMockMode 定義為 ref，使其成為響應式變数
const isMockMode = ref<boolean>(import.meta.env.VITE_API_ENV === 'mock');

onMounted(async () => {
  try {
    if (isMockMode.value) {
      // 使用環境變數中的模擬值
      const mockResponse = { waitlist_status: import.meta.env.VITE_MOCK_WAITLIST_STATUS || 'closed' };
      console.log('Mock Waitlist return:', mockResponse);
      waitlistClosed.value = mockResponse.waitlist_status === 'closed';
    } else {
      // 真實 API 請求
      console.log('Fetching real waitlist status...');
      const apiUrl = import.meta.env.VITE_API_ENV === 'mock'
      ? '/api/v2/waitlist/status' // 使用模擬 API
      : '/api/v2/waitlist/status?shop_slug=eslite-premium-xindian&service_mode=dining'; // 使用代理的真實 API
      const res = await axios.get(apiUrl, {
        headers: { Accept: 'application/json' },
      });
      console.log('Waitlist return:', res.data);
      waitlistClosed.value = res.data.waitlist_status === 'closed';
    }
  } catch (e) {
    waitlistError.value = '無法取得餐廳狀態，請稍後再試。';
    waitlistClosed.value = null;
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

// 新增：通知相關函式
const startNotification = () => {
  if (isNotifying.value) return
  isNotifying.value = true
  notificationTimer = window.setInterval(() => {
    console.log('通知：餐廳目前不開放訂位')
    // 在這裡可以加入發送通知的邏輯，例如 Telegram 通知
  }, notificationInterval.value * 1000)
}

const stopNotification = () => {
  if (!isNotifying.value) return
  isNotifying.value = false
  if (notificationTimer) {
    clearInterval(notificationTimer)
    notificationTimer = null
  }
}
</script>
