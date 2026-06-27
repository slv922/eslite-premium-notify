import express from 'express'
import axios from 'axios'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000
const TABLECHECK = 'https://production-booking.tablecheck.com'

app.use(express.json())

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

app.use(express.static(join(__dirname, 'dist')))

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
