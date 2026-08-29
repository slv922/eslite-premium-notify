import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Telegraf, Markup } from 'telegraf'
import axios from 'axios'
import { redis, getAllSessions, saveSession, removeSession } from '../_lib/store.js'

const TABLECHECK = 'https://production-booking.tablecheck.com/v2/waitlist/position'
const ALERT_THRESHOLD = 3

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

function actionButtons(code: string) {
  return Markup.inlineKeyboard([
    Markup.button.callback('🔄 立即查詢', `check:${code}`),
    Markup.button.callback('🛑 停止', `stop:${code}`),
  ])
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const sessions = await getAllSessions()
  if (!sessions.length) return res.status(200).json({ ok: true, polled: 0 })

  await Promise.all(sessions.map(async session => {
    const { chatId, bookingCode: code } = session

    let position: number | null = null
    try {
      const r = await axios.put(`${TABLECHECK}/${code}`, {}, {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        timeout: 10000,
      })
      position = r.data.position ?? null
    } catch (err: any) {
      if (err?.response?.status === 404) {
        await removeSession(chatId, code)
        await bot.telegram.sendMessage(chatId,
          `❌ 訂位代碼 *${code}* 不存在或已過期，停止追蹤。`,
          { parse_mode: 'Markdown' }
        )
      }
      return
    }

    const isUrgent = position !== null && position <= ALERT_THRESHOLD
    const positionChanged = position !== session.lastPosition

    await saveSession({
      ...session,
      lastPosition: position,
      lastCheckedAt: new Date().toISOString(),
      isFirstCheck: false,
    })

    if (!positionChanged && !isUrgent) return

    const time = new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })
    const buttons = actionButtons(code)

    if (position === 0) {
      await bot.telegram.sendMessage(chatId,
        `🎉 *輪到您了！*\n代碼：\`${code}\`\n請前往入座！\n時間：${time}`,
        { parse_mode: 'Markdown', ...buttons }
      )
    } else if (isUrgent) {
      await bot.telegram.sendMessage(chatId,
        `🚨 *快輪到了！*\n代碼：\`${code}\`\n前方還有 *${position}* 組\n時間：${time}\n\n請隨時準備入座！`,
        { parse_mode: 'Markdown', ...buttons }
      )
    } else if (positionChanged) {
      await bot.telegram.sendMessage(chatId,
        `📋 *候位更新*\n代碼：\`${code}\`\n前方還有 *${position}* 組\n時間：${time}`,
        { parse_mode: 'Markdown', ...buttons }
      )
    }
  }))

  res.status(200).json({ ok: true, polled: sessions.length })
}
