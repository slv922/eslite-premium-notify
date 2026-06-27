import type { Telegraf } from 'telegraf'
import { Tracker } from './tracker.js'

function parseBookingCode(input: string): string | null {
  const text = input.trim()
  if (text.startsWith('http')) {
    const match = text.match(/\/([A-Z0-9]{4,12})(?:[/?#]|$)/i)
    return match ? match[1].toUpperCase() : null
  }
  if (/^[A-Z0-9]{4,12}$/i.test(text)) return text.toUpperCase()
  return null
}

export async function setupBot(bot: Telegraf, tracker: Tracker) {
  await bot.telegram.setMyCommands([
    { command: 'track', description: '開始追蹤訂位代碼，例如 /track EEHWAS' },
    { command: 'list',  description: '查看目前追蹤中的所有代碼' },
    { command: 'stop',  description: '停止追蹤，可指定代碼或全部停止' },
  ])

  bot.start(ctx =>
    ctx.reply(
      '👋 歡迎使用候位追蹤機器人！\n\n' +
      '傳送 *訂位代碼*（如 EEHWAS）即可開始追蹤，可同時追蹤多組。\n\n' +
      '指令：\n' +
      '/track <代碼> — 開始追蹤\n' +
      '/stop <代碼> — 停止指定代碼\n' +
      '/stop — 停止所有追蹤\n' +
      '/list — 查看追蹤中的代碼',
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
    const input = ctx.message.text.replace('/stop', '').trim()
    if (input) {
      const code = parseBookingCode(input)
      if (!code) return ctx.reply('無法識別訂位代碼。')
      const stopped = tracker.stop(ctx.chat.id, code)
      ctx.reply(stopped ? `🛑 已停止追蹤 ${code}` : `找不到追蹤中的代碼 ${code}`)
    } else {
      const stopped = tracker.stop(ctx.chat.id)
      ctx.reply(stopped ? '🛑 已停止所有追蹤。' : '目前沒有追蹤中的訂位。')
    }
  })

  bot.command('list', ctx => {
    const sessions = tracker.getSessions().filter(s => s.chatId === ctx.chat.id)
    if (sessions.length === 0) return ctx.reply('目前沒有追蹤中的訂位。')
    const list = sessions.map(s =>
      `• \`${s.bookingCode}\` — ${s.lastPosition !== null ? `前方 ${s.lastPosition} 組` : '查詢中'}`
    ).join('\n')
    ctx.reply(`📋 *追蹤中的訂位*\n${list}`, { parse_mode: 'Markdown' })
  })

  // Dynamic button callbacks: check:<CODE> / stop:<CODE>
  bot.action(/^check:(.+)$/, async ctx => {
    const code = ctx.match[1]
    await ctx.answerCbQuery('查詢中...')
    await tracker.pollNow(ctx.chat!.id, code)
  })

  bot.action(/^stop:(.+)$/, async ctx => {
    const code = ctx.match[1]
    await ctx.answerCbQuery('已停止追蹤')
    const stopped = tracker.stop(ctx.chat!.id, code)
    ctx.reply(stopped ? `🛑 已停止追蹤 ${code}` : `找不到追蹤中的代碼 ${code}`)
  })

  bot.on('text', async ctx => {
    const text = ctx.message.text
    if (text.startsWith('/')) return
    const code = parseBookingCode(text)
    if (code) {
      await tracker.start(ctx.chat.id, code)
    } else {
      ctx.reply('無法識別訂位代碼，請輸入代碼（如 EEHWAS）或完整訂位連結。')
    }
  })
}
