'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BasketballLoader } from '@/components/ui/BasketballLoader'

interface Player {
  id: number
  name: string
  team: string
  position: string
  ppg: number
  rpg?: number
  apg?: number
}

interface ShotDistributionChartProps {
  selectedPlayer?: Player | null
  refreshKey?: number
}

interface ZoneData {
  zone: string
  pct: number
  efficiency: number
  made: number
  attempts: number
  color: string
}

const ZONE_COLORS: Record<string, string> = {
  'Restricted Area': '#22C55E',
  'Paint (Non-RA)': '#10B981',
  'Mid-Range': '#EAB308',
  'Corner 3': '#3B82F6',
  'Above Break 3': '#8B5CF6',
}

export function ShotDistributionChart({ selectedPlayer, refreshKey = 0 }: ShotDistributionChartProps) {
  const [zones, setZones] = useState<ZoneData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [usingRealData, setUsingRealData] = useState(false)
  const [seasonUsed, setSeasonUsed] = useState<string | null>(null)
  const [usedFallbackSeason, setUsedFallbackSeason] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedPlayer) {
      setZones([])
      setErrorMessage(null)
      return
    }

    let aborted = false
    const fetchDistribution = async () => {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '')
        const forceRefresh = refreshKey > 0
        const buildUrl = (refresh: boolean) => {
          const params = new URLSearchParams()
          if (refresh) params.set('refresh', 'true')
          if (refresh) params.set('t', String(Date.now()))
          const query = params.toString()
          return `${API_URL}/api/stats/shot-distribution/${selectedPlayer.id}${query ? `?${query}` : ''}`
        }

        let res = await fetch(buildUrl(forceRefresh), {
          cache: forceRefresh ? 'no-store' : 'force-cache',
        })

        // If no data was returned from cache path, force one live refresh before showing empty state.
        if (res.ok) {
          const firstData = await res.clone().json()
          const firstHasData = Array.isArray(firstData?.zones) && firstData.zones.some((z: ZoneData) => z.attempts > 0)
          if (!firstHasData && !forceRefresh) {
            res = await fetch(buildUrl(true), { cache: 'no-store' })
          }
        }

        if (res.ok) {
          const data = await res.json()
          if (aborted) return
          setUsingRealData(data.using_real_data)
          setSeasonUsed(data.season_used || null)
          setUsedFallbackSeason(!!data.season_fallback_used)
          const hasData = data.zones.some((z: ZoneData) => z.attempts > 0)
          if (hasData && data.using_real_data) {
            const zonesWithColors = data.zones.map((z: Omit<ZoneData, 'color'>) => ({
              ...z,
              color: ZONE_COLORS[z.zone] || '#6B7280',
            }))
            setZones(zonesWithColors)
          } else {
            setZones([])
            setUsingRealData(false)
            setErrorMessage("Error 69: Can't fetch real shot distribution data for this player.")
          }
        } else {
          if (!aborted) {
            setZones([])
            setSeasonUsed(null)
            setUsedFallbackSeason(false)
            setErrorMessage("Error 69: Can't fetch real shot distribution data right now.")
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        // Suppress network errors when backend is offline — show empty state silently
        if (!(err instanceof TypeError)) console.error('Failed to fetch shot distribution:', err)
        if (!aborted) {
          setZones([])
          setSeasonUsed(null)
          setUsedFallbackSeason(false)
          setErrorMessage("Error 69: Can't fetch real shot distribution data right now.")
        }
      } finally {
        if (!aborted) setIsLoading(false)
      }
    }

    fetchDistribution()
    return () => { aborted = true }
  }, [selectedPlayer?.id, refreshKey])

  if (!selectedPlayer) {
    return (
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-electric-lime">
            <rect x="3" y="12" width="4" height="9" />
            <rect x="10" y="8" width="4" height="13" />
            <rect x="17" y="4" width="4" height="17" />
          </svg>
          Shot Distribution
        </h3>
        <div className="h-40 flex items-center justify-center text-muted text-sm">
          Select a player to view shot distribution
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-electric-lime">
            <rect x="3" y="12" width="4" height="9" />
            <rect x="10" y="8" width="4" height="13" />
            <rect x="17" y="4" width="4" height="17" />
          </svg>
          Shot Distribution
        </h3>
        <div className="h-40 flex items-center justify-center">
          <BasketballLoader size="sm" text="Loading chart..." />
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6"
    >
      <h3 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-electric-lime">
          <rect x="3" y="12" width="4" height="9" />
          <rect x="10" y="8" width="4" height="13" />
          <rect x="17" y="4" width="4" height="17" />
        </svg>
        Shot Distribution
        <span className="text-muted font-normal text-sm ml-2">
          - {selectedPlayer.name}
        </span>
        {usingRealData && (
          <span className="ml-auto text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            LIVE DATA
          </span>
        )}
      </h3>

      {zones.length === 0 && (
        <div className="h-40 flex items-center justify-center text-muted text-sm flex-col gap-2">
          <p className="text-red-300 font-semibold">Error 69</p>
          <p>Can&apos;t fetch real shot distribution data for {selectedPlayer.name}</p>
          <p className="text-xs text-muted/60">Real data only mode is enabled (no synthetic data shown)</p>
        </div>
      )}

      {usedFallbackSeason && seasonUsed && zones.length > 0 && (
        <p className="text-xs text-muted mb-3">Showing latest available season: {seasonUsed}</p>
      )}

      <div className="space-y-4">
        {zones.map((zone, index) => (
          <motion.div
            key={zone.zone}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{zone.zone}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted">{zone.pct.toFixed(1)}% of shots</span>
                <span 
                  className={`font-bold ${zone.efficiency > 50 ? 'text-green-400' : zone.efficiency > 40 ? 'text-yellow-400' : 'text-red-400'}`}
                >
                  {zone.efficiency.toFixed(1)}% FG
                </span>
              </div>
            </div>
            <div className="h-6 bg-gunmetal rounded-lg overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${zone.pct}%` }}
                transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                className="h-full rounded-lg flex items-center justify-end pr-2"
                style={{ backgroundColor: zone.color }}
              >
                {zone.pct > 15 && (
                  <span className="text-xs font-bold text-white drop-shadow">
                    {zone.pct.toFixed(0)}%
                  </span>
                )}
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary Stats */}
      {zones.length > 0 && (
        <div className="mt-6 pt-4 border-t border-surface">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-gunmetal rounded-lg p-3">
              <p className="text-muted text-xs">Most Common Zone</p>
              <p className="font-bold text-sm" style={{ color: zones[0]?.color }}>
                {zones.reduce((max, z) => z.pct > max.pct ? z : max).zone}
              </p>
            </div>
            <div className="bg-gunmetal rounded-lg p-3">
              <p className="text-muted text-xs">Best Efficiency</p>
              <p className="font-bold text-sm text-green-400">
                {zones.reduce((max, z) => z.efficiency > max.efficiency ? z : max).zone}
              </p>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMessage}
        </div>
      )}
    </motion.div>
  )
}
