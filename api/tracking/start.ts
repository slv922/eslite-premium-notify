import type { VercelRequest, VercelResponse } from '@vercel/node'
import axios from 'axios'

const TABLECHECK = 'https://production-booking.tablecheck.com'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { bookingCode } = req.body
  if (!bookingCode || typeof bookingCode !== 'string') {
    return res.status(400).json({ error: 'bookingCode required' })
  }

  const code = bookingCode.toUpperCase()

  try {
    await axios.put(
      `${TABLECHECK}/v2/waitlist/position/${code}`,
      {},
      { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 8000 }
    )
    res.json({ ok: true })
  } catch (err: any) {
    if (err?.response?.status === 404) {
      return res.status(404).json({ error: '訂位代碼不存在或已過期' })
    }
    return res.status(502).json({ error: '無法連線查詢，請稍後再試' })
  }
}
