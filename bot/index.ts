import { Telegraf } from 'telegraf'
import dotenv from 'dotenv'
import { setupBot } from './setup.js'

dotenv.config()

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!BOT_TOKEN) {
  console.error('缺少 TELEGRAM_BOT_TOKEN，請建立 bot/.env 並設定該變數')
  process.exit(1)
}

const bot = new Telegraf(BOT_TOKEN)
setupBot(bot)

bot.launch()
console.log('🤖 Bot 已啟動，等待訊息中...')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
