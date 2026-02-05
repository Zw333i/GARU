'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SearchIcon, BasketballIcon } from '@/components/icons'
import { api } from '@/lib/api'

interface Player {
  id: number
  name: string
  team: string
  position?: string
  pts?: number
}

interface PlayerSearchProps {
  onSelect?: (player: Player) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function PlayerSearch({
  onSelect,
  placeholder = 'Search players...',
  className = '',
  autoFocus = false,
}: PlayerSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setShowResults(false)
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await api.searchPlayers(query)
        setResults(response.players.slice(0, 8))
        setShowResults(true)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        setShowResults(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleSelect = (player: Player) => {
    setQuery(player.name)
    setShowResults(false)
    setSelectedIndex(-1)
    onSelect?.(player)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <SearchIcon
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-4 py-3 bg-gunmetal border border-surface rounded-xl text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime/50 focus:ring-1 focus:ring-electric-lime/30 transition-all"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <BasketballIcon size={18} className="text-electric-lime" />
            </motion.div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showResults && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 glass rounded-xl overflow-hidden shadow-xl"
          >
            {results.map((player, index) => (
              <motion.button
                key={player.id}
                onClick={() => handleSelect(player)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-electric-lime/20 text-electric-lime'
                    : 'hover:bg-white/5'
                }`}
              >
                <div>
                  <p className="font-medium">{player.name}</p>
                  <p className="text-sm text-muted">
                    {player.team} • {player.position}
                  </p>
                </div>
                {player.pts && (
                  <span className="text-sm text-muted">{player.pts} PPG</span>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
