import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export interface Session {
  chatId: number
  bookingCode: string
  lastPosition: number | null
  lastCheckedAt: string | null
  isFirstCheck: boolean
}

const SET_KEY = 'active_sessions'

function skey(chatId: number, code: string) {
  return `session:${chatId}:${code}`
}

export async function getSession(chatId: number, code: string): Promise<Session | null> {
  return redis.get<Session>(skey(chatId, code))
}

export async function saveSession(s: Session): Promise<void> {
  await redis.set(skey(s.chatId, s.bookingCode), s)
  await redis.sadd(SET_KEY, `${s.chatId}:${s.bookingCode}`)
}

export async function removeSession(chatId: number, code: string): Promise<void> {
  await redis.del(skey(chatId, code))
  await redis.srem(SET_KEY, `${chatId}:${code}`)
}

export async function getAllSessions(): Promise<Session[]> {
  const members = await redis.smembers(SET_KEY)
  if (!members.length) return []
  const results = await Promise.all(
    members.map(m => {
      const [chatId, code] = m.split(':')
      return redis.get<Session>(skey(Number(chatId), code))
    })
  )
  return results.filter(Boolean) as Session[]
}

export async function getSessionsByChat(chatId: number): Promise<Session[]> {
  const all = await getAllSessions()
  return all.filter(s => s.chatId === chatId)
}
