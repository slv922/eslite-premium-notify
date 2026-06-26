import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { bookingCode } = req.query;

  if (!bookingCode || typeof bookingCode !== 'string') {
    return res.status(400).json({ error: 'Invalid booking code' });
  }

  try {
    const url = `https://production-booking.tablecheck.com/v2/waitlist/position/${bookingCode}`;
    const response = await axios.put(url, req.body || {}, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
    res.status(200).json(response.data);
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const message = error?.response?.data?.error || error.message || 'Unknown error';
    console.error(`查詢訂位代碼 ${bookingCode} 失敗:`, message);
    res.status(status).json({ error: message });
  }
}
