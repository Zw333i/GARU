const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

const PREFETCH_TTL_MS = 10 * 60 * 1000

function now() {
  return Date.now()
}

function getPrefetchKey(playerId: number) {
  return `garu-lab-prefetch:${playerId}`
}

function wasRecentlyPrefetched(playerId: number): boolean {
  if (typeof window === 'undefined') return true

  const raw = sessionStorage.getItem(getPrefetchKey(playerId))
  if (!raw) return false

  const ts = Number(raw)
  if (!Number.isFinite(ts)) return false

  return (now() - ts) < PREFETCH_TTL_MS
}

function markPrefetched(playerId: number) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(getPrefetchKey(playerId), String(now()))
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: 'force-cache',
    })
  } finally {
    clearTimeout(timer)
  }
}

// Warm Lab chart endpoints so opening The Lab feels instant.
export async function prefetchLabForPlayer(playerId: number): Promise<void> {
  if (!playerId || wasRecentlyPrefetched(playerId)) return

  const endpoints = [
    `${API_URL}/api/stats/shot-zones/${playerId}`,
    `${API_URL}/api/stats/shot-distribution/${playerId}`,
  ]

  await Promise.allSettled(endpoints.map((url) => fetchWithTimeout(url, 7000)))
  markPrefetched(playerId)
}
