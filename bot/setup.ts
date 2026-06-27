import type { Telegraf } from 'telegraf'
import { Tracker } from './tracker.js'

function parseBookingCode(input: string): string | null {
  const text = input.trim()
  if (text.startsWith('http')) {
    const match = text.match(/\/([A-Z0-9]{4,12})(?:[/?#]|$)/i)
    return match ? match[1].toUpperCase() : null
  }
  if (/^[A-Z0-9]{4,12}$/i.test(text)) {
    return text.toUpperCase()
  }
  return null
}

export function setupBot(bot: Telegraf, tracker: Tracker): Tracker {

  bot.start(ctx =>
    ctx.reply(
      '👋 歡迎使用候位追蹤機器人！\n\n' +
      '請直接傳送 *訂位代碼*（如 EEHWAS）或 *訂位連結*，即可開始追蹤。\n\n' +
      '指令：\n' +
      '/track <代碼> — 開始追蹤\n' +
      '/stop — 停止追蹤\n' +
      '/status — 立即查詢目前狀態',
      { parse_mode: 'Markdown' }
    )
  )

  bot.command('track', async ctx => {
    const input = ctx.message.text.replace('/track', '').trim()
    if (!input) return ctx.reply('請輸入訂位代碼，例如：/track EEHWAS')
    const code = parseBookingCode(input)
    if (!code) return ctx.reply('無法識別訂位代碼，請確認格式是否正確。')
    await tracker.start(ctx.chat.id, code)
  })

  bot.command('stop', ctx => {
    const stopped = tracker.stop(ctx.chat.id)
    ctx.reply(stopped ? '🛑 已停止追蹤。' : '目前沒有追蹤中的訂位。')
  })

  bot.command('status', async ctx => {
    const session = tracker.getSession(ctx.chat.id)
    if (!session) return ctx.reply('目前沒有追蹤中的訂位，請先傳送訂位代碼。')
    await tracker.pollNow(ctx.chat.id)
  })

  bot.action('check_now', async ctx => {
    await ctx.answerCbQuery('查詢中...')
    const session = tracker.getSession(ctx.chat!.id)
    if (!session) return ctx.reply('目前沒有追蹤中的訂位，請先傳送訂位代碼。')
    await tracker.pollNow(ctx.chat!.id)
  })

  bot.action('stop_tracking', async ctx => {
    await ctx.answerCbQuery('已停止追蹤')
    const stopped = tracker.stop(ctx.chat!.id)
    ctx.reply(stopped ? '🛑 已停止追蹤。\n\n想重新追蹤請再傳訂位代碼。' : '目前沒有追蹤中的訂位。')
  })

  bot.on('text', async ctx => {
    const text = ctx.message.text
    if (text.startsWith('/')) return
    const code = parseBookingCode(text)
    if (code) {
      await tracker.start(ctx.chat.id, code)
    } else {
      ctx.reply('無法識別訂位代碼，請直接輸入代碼（如 EEHWAS）或完整訂位連結。')
    }
  })

  return tracker
}
