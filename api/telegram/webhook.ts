import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Telegraf, Markup } from 'telegraf'
import axios from 'axios'
import {
  getSession, getSessionsByChat, saveSession, removeSession, getAllSessions, type Session
} from '../_lib/store.js'

const TABLECHECK = 'https://production-booking.tablecheck.com/v2/waitlist/position'
const ALERT_THRESHOLD = 3

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

function parseCode(input: string): string | null {
  const t = input.trim()
  if (t.startsWith('http')) {
    const m = t.match(/\/([A-Z0-9]{4,12})(?:[/?#]|$)/i)
    return m ? m[1].toUpperCase() : null
  }
  if (/^[A-Z0-9]{4,12}$/i.test(t)) return t.toUpperCase()
  return null
}

async function validateAndPoll(code: string): Promise<{ ok: boolean; position?: number | null }> {
  try {
    const res = await axios.put(`${TABLECHECK}/${code}`, {}, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      timeout: 8000,
    })
    return { ok: true, position: res.data.position ?? null }
  } catch (err: any) {
    return { ok: err?.response?.status !== 404 }
  }
}

function actionButtons(code: string) {
  return Markup.inlineKeyboard([
    Markup.button.callback('🔄 立即查詢', `check:${code}`),
    Markup.button.callback('🛑 停止', `stop:${code}`),
  ])
}

async function startTracking(chatId: number, code: string, ctx: any) {
  const existing = await getSession(chatId, code)
  if (existing) {
    return ctx.reply(`ℹ️ *${code}* 已在追蹤中`, { parse_mode: 'Markdown' })
  }
  const result = await validateAndPoll(code)
  if (!result.ok) {
    return ctx.reply(`❌ 訂位代碼 *${code}* 不存在或已過期`, { parse_mode: 'Markdown' })
  }
  const session: Session = {
    chatId,
    bookingCode: code,
    lastPosition: result.position ?? null,
    lastCheckedAt: new Date().toISOString(),
    isFirstCheck: false,
  }
  await saveSession(session)

  const pos = session.lastPosition
  const time = new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })
  const posText = pos === null ? '目前尚無候位資訊' : `前方還有 *${pos}* 組`
  await ctx.reply(
    `✅ 開始追蹤 *${code}*\n${posText}\n時間：${time}\n\n每 60 秒自動更新，候位 ≤${ALERT_THRESHOLD} 組時提醒。`,
    { parse_mode: 'Markdown', ...actionButtons(code) }
  )
}

bot.start(ctx => ctx.reply(
  '👋 歡迎使用候位追蹤機器人！\n\n' +
  '傳送 *訂位代碼*（如 EEHWAS）即可開始追蹤。\n\n' +
  '/track <代碼> — 開始追蹤\n' +
  '/stop <代碼> — 停止指定代碼\n' +
  '/stop — 停止所有追蹤\n' +
  '/list — 查看追蹤中的代碼',
  { parse_mode: 'Markdown' }
))

bot.command('track', async ctx => {
  const input = ctx.message.text.replace(/^\/track\S*\s*/, '').trim()
  if (!input) return ctx.reply('請輸入訂位代碼，例如：/track EEHWAS')
  const code = parseCode(input)
  if (!code) return ctx.reply('無法識別訂位代碼，請確認格式。')
  await startTracking(ctx.chat.id, code, ctx)
})

bot.command('stop', async ctx => {
  const input = ctx.message.text.replace(/^\/stop\S*\s*/, '').trim()
  if (input) {
    const code = parseCode(input)
    if (!code) return ctx.reply('無法識別訂位代碼。')
    const existing = await getSession(ctx.chat.id, code)
    if (!existing) return ctx.reply(`找不到追蹤中的代碼 ${code}`)
    await removeSession(ctx.chat.id, code)
    ctx.reply(`🛑 已停止追蹤 ${code}`)
  } else {
    const mine = await getSessionsByChat(ctx.chat.id)
    if (!mine.length) return ctx.reply('目前沒有追蹤中的訂位。')
    await Promise.all(mine.map(s => removeSession(s.chatId, s.bookingCode)))
    ctx.reply('🛑 已停止所有追蹤。')
  }
})

bot.command('list', async ctx => {
  const mine = await getSessionsByChat(ctx.chat.id)
  if (!mine.length) return ctx.reply('目前沒有追蹤中的訂位。')
  const list = mine.map(s =>
    `• \`${s.bookingCode}\` — ${s.lastPosition !== null ? `前方 ${s.lastPosition} 組` : '查詢中'}`
  ).join('\n')
  ctx.reply(`📋 *追蹤中的訂位*\n${list}`, { parse_mode: 'Markdown' })
})

bot.action(/^check:(.+)$/, async ctx => {
  const code = ctx.match[1]
  await ctx.answerCbQuery('查詢中...')
  const session = await getSession(ctx.chat!.id, code)
  if (!session) return
  const result = await validateAndPoll(code)
  if (!result.ok) {
    await removeSession(ctx.chat!.id, code)
    return ctx.reply(`❌ 訂位代碼 *${code}* 已過期，停止追蹤。`, { parse_mode: 'Markdown' })
  }
  const pos = result.position ?? null
  await saveSession({ ...session, lastPosition: pos, lastCheckedAt: new Date().toISOString() })
  const time = new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })
  const isUrgent = pos !== null && pos <= ALERT_THRESHOLD
  const posText = pos === null ? '目前尚無候位資訊' : `前方還有 *${pos}* 組`
  ctx.reply(
    `${isUrgent ? '🚨 *快輪到了！*' : '📋 *候位狀態*'}\n代碼：\`${code}\`\n${posText}\n時間：${time}`,
    { parse_mode: 'Markdown', ...actionButtons(code) }
  )
})

bot.action(/^stop:(.+)$/, async ctx => {
  const code = ctx.match[1]
  await ctx.answerCbQuery('已停止追蹤')
  await removeSession(ctx.chat!.id, code)
  ctx.reply(`🛑 已停止追蹤 ${code}`)
})

bot.on('text', async ctx => {
  const text = ctx.message.text
  if (text.startsWith('/')) return
  const code = parseCode(text)
  if (!code) return ctx.reply('無法識別訂位代碼，請輸入代碼（如 EEHWAS）或完整訂位連結。')
  await startTracking(ctx.chat.id, code, ctx)
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    await bot.handleUpdate(req.body)
  } catch (err) {
    console.error('Webhook error:', err)
  }
  res.status(200).end()
}
