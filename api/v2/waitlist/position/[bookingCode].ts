import type { VercelRequest, VercelResponse } from '@vercel/node'
import axios from 'axios'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { bookingCode } = req.query
  try {
    const url = `https://production-booking.tablecheck.com/v2/waitlist/position/${bookingCode}`
    const response = await axios.put(url, req.body || {}, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 5000
    })
    res.status(200).json(response.data)
  } catch (error: any) {
    res.status(error?.response?.status || 500).json({ error: error.message })
  }
}
