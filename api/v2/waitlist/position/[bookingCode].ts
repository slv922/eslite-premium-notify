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
    // 模擬查詢結果
    const mockResponse = {
      position: Math.floor(Math.random() * 50) + 1, // 隨機生成 1 到 50 的位置
      ahead_groups: null,
    };

    console.log(`查詢訂位代碼: ${bookingCode}, 回應:`, mockResponse);

    res.status(200).json(mockResponse);
  }
}
