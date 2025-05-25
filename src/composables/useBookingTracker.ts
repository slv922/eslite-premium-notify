import { ref } from 'vue'
import axios from 'axios'
import type { BookingStatus, TrackingOptions } from '../types'

export function useBookingTracker(options: TrackingOptions) {
  const trackingInterval = ref<number | null>(null)
  const currentBookingCode = ref<string | null>(null)

  const checkBookingStatus = async (bookingCode: string): Promise<BookingStatus> => {
    let lastError: any = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await axios.put(
          `/api/v2/waitlist/position/${bookingCode}`,
          {},
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            timeout: 5000
          }
        )
        console.log('Booking status response:', response.data)
        return {
          bookingCode,
          position: response.data.position,
          telegramStatus: await sendTelegramNotification(bookingCode, response.data.position)
        }
      } catch (error) {
        lastError = error
        // 若第一次失敗則重試一次
        if (attempt === 0) continue
      }
    }
    console.error('Error checking booking status:', lastError)
    throw new Error('無法取得訂位狀態')
  }

  const sendTelegramNotification = async (bookingCode: string, position: number | null): Promise<string> => {
    if (!import.meta.env.VITE_TELEGRAM_BOT_TOKEN || !import.meta.env.VITE_TELEGRAM_CHAT_ID) {
      return '未設定 Telegram 通知'
    }

    try {
      const message = position === null
        ? `訂位代碼 ${bookingCode} 尚未排到位`
        : `訂位代碼 ${bookingCode} 前方等待 ${position} 組`

      await axios.post(
        `https://api.telegram.org/bot${import.meta.env.VITE_TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: import.meta.env.VITE_TELEGRAM_CHAT_ID,
          text: message
        }
      )
      console.log('Telegram message sent:', message)

      return '通知發送成功'
    } catch (error) {
      console.error('Error sending Telegram notification:', error)
      return '通知發送失敗'
    }
  }

  const startTracking = async (bookingCode: string, interval: number = 60) => {
    currentBookingCode.value = bookingCode

    // 立即執行一次
    try {
      const status = await checkBookingStatus(bookingCode)
      options.onStatusUpdate(status)
    } catch (error) {
      options.onError(error as Error)
    }

    // 設定定時執行
    trackingInterval.value = window.setInterval(async () => {
      try {
        const status = await checkBookingStatus(bookingCode)
        options.onStatusUpdate(status)
      } catch (error) {
        options.onError(error as Error)
      }
    }, interval * 1000)
  }

  const stopTracking = () => {
    if (trackingInterval.value) {
      clearInterval(trackingInterval.value)
      trackingInterval.value = null
    }
    currentBookingCode.value = null
  }

  return {
    startTracking,
    stopTracking
  }
}

// 模擬查詢訂位資訊的 API
export async function checkBookingStatus(bookingCode: string): Promise<{ position: number; ahead_groups: null }> {
  // 模擬查詢結果
  const mockResponse = {
    position: Math.floor(Math.random() * 50) + 1, // 隨機生成 1 到 50 的位置
    ahead_groups: null,
  };

  console.log(`模擬查詢訂位代碼: ${bookingCode}, 回應:`, mockResponse);

  return new Promise((resolve) => {
    setTimeout(() => resolve(mockResponse), 1000); // 模擬 API 延遲 1 秒
  });
}
