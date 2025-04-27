import type { VercelRequest, VercelResponse } from '@vercel/node'
// @ts-ignore
import axios from 'axios'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { shop_slug, service_mode } = req.query
    const url = `https://production-booking.tablecheck.com/v2/waitlist/status?shop_slug=${shop_slug}&service_mode=${service_mode}`
    const response = await axios.get(url, { headers: { Accept: 'application/json' } })
    res.status(200).json(response.data)
  } catch (error: any) {
    res.status(error?.response?.status || 500).json({ error: error.message })
  }
}
