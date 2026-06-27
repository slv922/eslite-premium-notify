import express from 'express'
import axios from 'axios'
import { Telegraf } from 'telegraf'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Tracker, WEB_CHAT_ID } from './bot/tracker.js'
import { setupBot } from './bot/setup.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000
const TABLECHECK = 'https://production-booking.tablecheck.com'

// Shared tracker instance used by both bot and SSE
let tracker: Tracker | null = null

app.use(express.json())

// ── TableCheck API proxy ──────────────────────────────────────────────────────
app.get('/api/v2/waitlist/status', async (req, res) => {
  try {
    const { shop_slug, service_mode } = req.query
    const response = await axios.get(
      `${TABLECHECK}/v2/waitlist/status?shop_slug=${shop_slug}&service_mode=${service_mode}`,
      { headers: { Accept: 'application/json' } }
    )
    res.json(response.data)
  } catch (error: any) {
    res.status(error?.response?.status || 500).json({ error: error.message })
  }
})

app.put('/api/v2/waitlist/position/:bookingCode', async (req, res) => {
  try {
    const { bookingCode } = req.params
    const response = await axios.put(
      `${TABLECHECK}/v2/waitlist/position/${bookingCode}`,
      req.body || {},
      { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }
    )
    res.json(response.data)
  } catch (error: any) {
    res.status(error?.response?.status || 500).json({ error: error.message })
  }
})

// ── Tracking state API ────────────────────────────────────────────────────────
app.get('/api/tracking/sessions', (_req, res) => {
  res.json(tracker ? tracker.getSessions() : [])
})

app.post('/api/tracking/start', async (req, res) => {
  const { bookingCode } = req.body
  if (!bookingCode || typeof bookingCode !== 'string') {
    return res.status(400).json({ error: 'bookingCode required' })
  }
  if (!tracker) return res.status(503).json({ error: 'tracker not ready' })
  await tracker.start(WEB_CHAT_ID, bookingCode.toUpperCase())
  res.json({ ok: true })
})

app.delete('/api/tracking/sessions/:bookingCode', (req, res) => {
  const bookingCode = req.params.bookingCode.toUpperCase()
  const stopped = tracker ? tracker.stopByKey(bookingCode) : false
  res.json({ stopped })
})

// SSE: push live updates to web clients
app.get('/api/tracking/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  // Send current state immediately on connect
  send('sessions', tracker ? tracker.getSessions() : [])

  const onUpdate = (data: unknown) => send('update', data)
  const onSessions = (data: unknown) => send('sessions', data)

  tracker?.on('update', onUpdate)
  tracker?.on('sessions', onSessions)

  req.on('close', () => {
    tracker?.off('update', onUpdate)
    tracker?.off('sessions', onSessions)
  })
})

// ── Vue static files ──────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'dist')))
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`)
})

// ── Telegram bot ──────────────────────────────────────────────────────────────
if (process.env.TELEGRAM_BOT_TOKEN) {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)
  tracker = new Tracker(bot)
  await setupBot(bot, tracker)
  bot.launch()
  console.log('🤖 Telegram bot started')
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
} else {
  console.warn('TELEGRAM_BOT_TOKEN not set, bot will not start')
}
