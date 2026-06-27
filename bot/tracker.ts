import axios from 'axios'
import { Markup, type Telegraf } from 'telegraf'

const TABLECHECK_API = 'https://production-booking.tablecheck.com/v2/waitlist/position'
const POLL_INTERVAL_MS = 60 * 1000
const ALERT_THRESHOLD = 3

interface Session {
  bookingCode: string
  timerId: NodeJS.Timeout
  lastPosition: number | null
  isFirstCheck: boolean
}

export class Tracker {
  private sessions = new Map<number, Session>()

  constructor(private bot: Telegraf) {}

  async start(chatId: number, bookingCode: string) {
    this.stop(chatId)

    await this.bot.telegram.sendMessage(
      chatId,
      `✅ 開始追蹤訂位代碼 *${bookingCode}*\n每 60 秒自動更新一次，當候位 ≤${ALERT_THRESHOLD} 組時會持續提醒。`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('🔄 立即查詢', 'check_now'),
          Markup.button.callback('🛑 停止追蹤', 'stop_tracking'),
        ]),
      }
    )

    const session: Session = {
      bookingCode,
      timerId: setInterval(() => this.poll(chatId), POLL_INTERVAL_MS),
      lastPosition: null,
      isFirstCheck: true,
    }
    this.sessions.set(chatId, session)

    await this.poll(chatId)
  }

  stop(chatId: number): boolean {
    const session = this.sessions.get(chatId)
    if (!session) return false
    clearInterval(session.timerId)
    this.sessions.delete(chatId)
    return true
  }

  getSession(chatId: number): Session | undefined {
    return this.sessions.get(chatId)
  }

  async pollNow(chatId: number) {
    const session = this.sessions.get(chatId)
    if (!session) return false
    session.isFirstCheck = true // force send even if position unchanged
    await this.poll(chatId)
    return true
  }

  private async poll(chatId: number) {
    const session = this.sessions.get(chatId)
    if (!session) return

    let position: number | null = null
    try {
      const res = await axios.put(
        `${TABLECHECK_API}/${session.bookingCode}`,
        {},
        {
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      )
      position = res.data.position ?? null
    } catch {
      await this.bot.telegram.sendMessage(
        chatId,
        `⚠️ 查詢失敗，60 秒後重試... (代碼：${session.bookingCode})`
      )
      return
    }

    const isUrgent = position !== null && position <= ALERT_THRESHOLD
    const positionChanged = position !== session.lastPosition

    if (session.isFirstCheck || positionChanged || isUrgent) {
      await this.sendStatus(chatId, session.bookingCode, position, isUrgent)
    }

    session.lastPosition = position
    session.isFirstCheck = false
  }

  private async sendStatus(
    chatId: number,
    bookingCode: string,
    position: number | null,
    isUrgent: boolean
  ) {
    const time = new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })

    const buttons = Markup.inlineKeyboard([
      Markup.button.callback('🔄 立即查詢', 'check_now'),
      Markup.button.callback('🛑 停止追蹤', 'stop_tracking'),
    ])

    if (position === null) {
      await this.bot.telegram.sendMessage(
        chatId,
        `📋 *候位狀態*\n代碼：\`${bookingCode}\`\n目前尚無候位資訊\n時間：${time}`,
        { parse_mode: 'Markdown', ...buttons }
      )
      return
    }

    if (isUrgent) {
      await this.bot.telegram.sendMessage(
        chatId,
        `🚨 *快輪到了！*\n代碼：\`${bookingCode}\`\n前方還有 *${position}* 組\n時間：${time}\n\n請隨時準備入座！`,
        { parse_mode: 'Markdown', ...buttons }
      )
    } else {
      await this.bot.telegram.sendMessage(
        chatId,
        `📋 *候位更新*\n代碼：\`${bookingCode}\`\n前方還有 *${position}* 組\n時間：${time}`,
        { parse_mode: 'Markdown', ...buttons }
      )
    }
  }
}
