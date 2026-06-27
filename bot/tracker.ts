import axios from 'axios'
import { EventEmitter } from 'events'
import { Markup, type Telegraf } from 'telegraf'

const TABLECHECK_API = 'https://production-booking.tablecheck.com/v2/waitlist/position'
const POLL_INTERVAL_MS = 60 * 1000
const ALERT_THRESHOLD = 3
const WEB_CHAT_ID = 0

interface Session {
  bookingCode: string
  chatId: number        // who to notify on Telegram (0 = web only)
  timerId: NodeJS.Timeout
  lastPosition: number | null
  lastCheckedAt: Date | null
  isFirstCheck: boolean
}

export interface TrackingUpdate {
  bookingCode: string
  chatId: number
  position: number | null
  isUrgent: boolean
  updatedAt: string
}

export interface SessionInfo {
  bookingCode: string
  chatId: number
  lastPosition: number | null
  lastCheckedAt: string | null
}

export class Tracker extends EventEmitter {
  // Key: bookingCode — one session per code, shared across web and Telegram
  private sessions = new Map<string, Session>()

  constructor(private bot: Telegraf) {
    super()
  }

  async start(chatId: number, bookingCode: string) {
    const existing = this.sessions.get(bookingCode)

    if (existing) {
      // Upgrade web session to Telegram if Telegram user requests same code
      if (chatId !== WEB_CHAT_ID && existing.chatId === WEB_CHAT_ID) {
        existing.chatId = chatId
        this.emitSessions()
      }
      if (chatId !== WEB_CHAT_ID) {
        await this.bot.telegram.sendMessage(
          chatId,
          `ℹ️ *${bookingCode}* 已在追蹤中`,
          { parse_mode: 'Markdown' }
        )
      }
      return
    }

    if (chatId !== WEB_CHAT_ID) {
      await this.bot.telegram.sendMessage(
        chatId,
        `✅ 開始追蹤訂位代碼 *${bookingCode}*\n每 60 秒自動更新，候位 ≤${ALERT_THRESHOLD} 組時會提醒。`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            Markup.button.callback('🔄 立即查詢', `check:${bookingCode}`),
            Markup.button.callback('🛑 停止', `stop:${bookingCode}`),
          ]),
        }
      )
    }

    const session: Session = {
      bookingCode,
      chatId,
      timerId: setInterval(() => this.poll(bookingCode), POLL_INTERVAL_MS),
      lastPosition: null,
      lastCheckedAt: null,
      isFirstCheck: true,
    }
    this.sessions.set(bookingCode, session)
    this.emitSessions()

    await this.poll(bookingCode)
  }

  stop(chatId: number, bookingCode?: string): boolean {
    if (bookingCode) {
      return this.stopOne(bookingCode)
    }
    // Stop all sessions belonging to this chatId
    let stopped = false
    for (const [code, s] of this.sessions) {
      if (s.chatId === chatId) {
        this.stopOne(code)
        stopped = true
      }
    }
    return stopped
  }

  stopByKey(bookingCode: string): boolean {
    return this.stopOne(bookingCode)
  }

  private stopOne(bookingCode: string): boolean {
    const session = this.sessions.get(bookingCode)
    if (!session) return false
    clearInterval(session.timerId)
    this.sessions.delete(bookingCode)
    this.emitSessions()
    return true
  }

  getSession(bookingCode: string): Session | undefined {
    return this.sessions.get(bookingCode)
  }

  getSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(s => ({
      bookingCode: s.bookingCode,
      chatId: s.chatId,
      lastPosition: s.lastPosition,
      lastCheckedAt: s.lastCheckedAt?.toISOString() ?? null,
    }))
  }

  async pollNow(chatId: number, bookingCode: string) {
    const session = this.sessions.get(bookingCode)
    if (!session) return false
    session.isFirstCheck = true
    await this.poll(bookingCode)
    return true
  }

  private emitSessions() {
    this.emit('sessions', this.getSessions())
  }

  private async poll(bookingCode: string) {
    const session = this.sessions.get(bookingCode)
    if (!session) return

    let position: number | null = null
    try {
      const res = await axios.put(
        `${TABLECHECK_API}/${bookingCode}`,
        {},
        {
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      )
      position = res.data.position ?? null
    } catch (err: any) {
      const is404 = err?.response?.status === 404
      if (session.chatId !== WEB_CHAT_ID) {
        await this.bot.telegram.sendMessage(
          session.chatId,
          is404
            ? `❌ 訂位代碼 *${bookingCode}* 不存在或已過期，停止追蹤。`
            : `⚠️ 查詢失敗，60 秒後重試... (${bookingCode})`,
          { parse_mode: 'Markdown' }
        )
      }
      if (is404) this.stopOne(bookingCode)
      return
    }

    const isUrgent = position !== null && position <= ALERT_THRESHOLD
    const isFirstCheck = session.isFirstCheck

    session.lastPosition = position
    session.lastCheckedAt = new Date()
    session.isFirstCheck = false

    const update: TrackingUpdate = {
      bookingCode,
      chatId: session.chatId,
      position,
      isUrgent,
      updatedAt: session.lastCheckedAt.toISOString(),
    }
    this.emit('update', update)

    if (session.chatId !== WEB_CHAT_ID && (isFirstCheck || isUrgent)) {
      await this.sendTelegram(session.chatId, bookingCode, position, isUrgent)
    }
  }

  private async sendTelegram(
    chatId: number,
    bookingCode: string,
    position: number | null,
    isUrgent: boolean
  ) {
    const time = new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })
    const buttons = Markup.inlineKeyboard([
      Markup.button.callback('🔄 立即查詢', `check:${bookingCode}`),
      Markup.button.callback('🛑 停止', `stop:${bookingCode}`),
    ])

    if (position === null) {
      await this.bot.telegram.sendMessage(
        chatId,
        `📋 *候位狀態*\n代碼：\`${bookingCode}\`\n目前尚無候位資訊\n時間：${time}`,
        { parse_mode: 'Markdown', ...buttons }
      )
    } else if (isUrgent) {
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

export { WEB_CHAT_ID }
