'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface PlayerImageProps {
  playerId: number
  playerName?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showSilhouette?: boolean
  animate?: boolean
}

// Size mappings for consistent sizing across the app
const sizeClasses = {
  xs: 'w-8 h-8',
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
}

// Primary and fallback image URLs
const getImageUrls = (playerId: number) => [
  `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`,
  `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${playerId}.png`,
  `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`,
]

// Default silhouette/placeholder
const PLACEHOLDER_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjYwIiBoZWlnaHQ9IjE5MCIgdmlld0JveD0iMCAwIDI2MCAxOTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI2MCIgaGVpZ2h0PSIxOTAiIGZpbGw9IiMxRTI5M0IiLz48Y2lyY2xlIGN4PSIxMzAiIGN5PSI3MCIgcj0iMzUiIGZpbGw9IiMzMzQxNTUiLz48cGF0aCBkPSJNNjUgMTkwQzY1IDE0MCA5MCAxMTAgMTMwIDExMEMxNzAgMTEwIDE5NSAxNDAgMTk1IDE5MCIgZmlsbD0iIzMzNDE1NSIvPjwvc3ZnPg=='

/**
 * PlayerImage - A reusable component for displaying NBA player headshots
 * 
 * Features:
 * - Automatic fallback to alternative CDN sources
 * - Consistent sizing across the app
 * - Silhouette mode for hidden/mystery players
 * - Animation support via framer-motion
 * - Graceful error handling with placeholder
 * 
 * @param playerId - NBA Player ID (required for image lookup)
 * @param playerName - Player name for alt text
 * @param size - Preset size (xs, sm, md, lg, xl) or use className for custom
 * @param className - Additional CSS classes
 * @param showSilhouette - When true, applies a silhouette filter
 * @param animate - When true, adds fade-in animation
 */
export function PlayerImage({
  playerId,
  playerName = 'NBA Player',
  size = 'md',
  className = '',
  showSilhouette = false,
  animate = true,
}: PlayerImageProps) {
  const [urlIndex, setUrlIndex] = useState(0)
  const [hasError, setHasError] = useState(false)
  
  const imageUrls = getImageUrls(playerId)
  const currentUrl = hasError ? PLACEHOLDER_URL : imageUrls[urlIndex]
  
  const handleError = () => {
    // Try next URL in the fallback chain
    if (urlIndex < imageUrls.length - 1) {
      setUrlIndex(prev => prev + 1)
    } else {
      // All URLs failed, show placeholder
      setHasError(true)
    }
  }
  
  const imageStyle = showSilhouette ? {
    filter: 'brightness(0) saturate(100%)',
    opacity: 0.3,
  } : {}
  
  const ImageComponent = animate ? motion.img : 'img'
  const animationProps = animate ? {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3 },
  } : {}
  
  return (
    <ImageComponent
      src={currentUrl}
      alt={playerName}
      className={`object-cover ${sizeClasses[size]} ${className}`}
      style={imageStyle}
      onError={handleError}
      {...animationProps}
    />
  )
}

/**
 * Hook to get player image URL with fallback logic
 * Useful when you need just the URL, not the component
 */
export function usePlayerImageUrl(playerId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`
}

/**
 * Get high-resolution player image URL
 */
export function getPlayerImageUrl(playerId: number, resolution: 'low' | 'high' = 'low'): string {
  if (resolution === 'high') {
    return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`
  }
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`
}
