import axios from 'axios'
import { EventEmitter } from 'events'
import { Markup, type Telegraf } from 'telegraf'

const TABLECHECK_API = 'https://production-booking.tablecheck.com/v2/waitlist/position'
const POLL_INTERVAL_MS = 60 * 1000
const ALERT_THRESHOLD = 3
const WEB_CHAT_ID = 0 // reserved for web-initiated sessions

interface Session {
  chatId: number
  bookingCode: string
  timerId: NodeJS.Timeout
  lastPosition: number | null
  lastCheckedAt: Date | null
  isFirstCheck: boolean
}

export interface TrackingUpdate {
  sessionKey: string
  chatId: number
  bookingCode: string
  position: number | null
  isUrgent: boolean
  updatedAt: string
}

export interface SessionInfo {
  sessionKey: string
  chatId: number
  bookingCode: string
  lastPosition: number | null
  lastCheckedAt: string | null
}

export class Tracker extends EventEmitter {
  private sessions = new Map<string, Session>()

  constructor(private bot: Telegraf) {
    super()
  }

  private key(chatId: number, bookingCode: string) {
    return `${chatId}:${bookingCode}`
  }

  async start(chatId: number, bookingCode: string) {
    const k = this.key(chatId, bookingCode)
    if (this.sessions.has(k)) {
      // Already tracking this code — just confirm
      if (chatId !== WEB_CHAT_ID) {
        await this.bot.telegram.sendMessage(
          chatId,
          `ℹ️ 已在追蹤 *${bookingCode}*`,
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
      chatId,
      bookingCode,
      timerId: setInterval(() => this.poll(k), POLL_INTERVAL_MS),
      lastPosition: null,
      lastCheckedAt: null,
      isFirstCheck: true,
    }
    this.sessions.set(k, session)
    this.emitSessions()

    await this.poll(k)
  }

  stop(chatId: number, bookingCode?: string): boolean {
    if (bookingCode) {
      return this.stopOne(this.key(chatId, bookingCode))
    }
    // Stop all sessions for this chatId
    let stopped = false
    for (const [k, s] of this.sessions) {
      if (s.chatId === chatId) {
        this.stopOne(k)
        stopped = true
      }
    }
    return stopped
  }

  stopByKey(sessionKey: string): boolean {
    return this.stopOne(sessionKey)
  }

  private stopOne(k: string): boolean {
    const session = this.sessions.get(k)
    if (!session) return false
    clearInterval(session.timerId)
    this.sessions.delete(k)
    this.emitSessions()
    return true
  }

  getSession(chatId: number, bookingCode: string): Session | undefined {
    return this.sessions.get(this.key(chatId, bookingCode))
  }

  getSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(s => ({
      sessionKey: this.key(s.chatId, s.bookingCode),
      chatId: s.chatId,
      bookingCode: s.bookingCode,
      lastPosition: s.lastPosition,
      lastCheckedAt: s.lastCheckedAt?.toISOString() ?? null,
    }))
  }

  async pollNow(chatId: number, bookingCode: string) {
    const k = this.key(chatId, bookingCode)
    const session = this.sessions.get(k)
    if (!session) return false
    session.isFirstCheck = true
    await this.poll(k)
    return true
  }

  private emitSessions() {
    this.emit('sessions', this.getSessions())
  }

  private async poll(k: string) {
    const session = this.sessions.get(k)
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
      if (session.chatId !== WEB_CHAT_ID) {
        await this.bot.telegram.sendMessage(
          session.chatId,
          `⚠️ 查詢失敗，60 秒後重試... (${session.bookingCode})`
        )
      }
      return
    }

    const isUrgent = position !== null && position <= ALERT_THRESHOLD
    const isFirstCheck = session.isFirstCheck

    session.lastPosition = position
    session.lastCheckedAt = new Date()
    session.isFirstCheck = false

    const update: TrackingUpdate = {
      sessionKey: k,
      chatId: session.chatId,
      bookingCode: session.bookingCode,
      position,
      isUrgent,
      updatedAt: session.lastCheckedAt.toISOString(),
    }
    this.emit('update', update)

    if (session.chatId !== WEB_CHAT_ID && (isFirstCheck || isUrgent)) {
      await this.sendTelegram(session.chatId, session.bookingCode, position, isUrgent)
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
