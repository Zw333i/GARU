/**
 * Keyboard Controls Hook for Games
 * Adds keyboard navigation (Enter for next, number keys for selection, etc.)
 */

'use client'

import { useEffect, useCallback } from 'react'

interface KeyboardOptions {
  onEnter?: () => void
  onSpace?: () => void
  onEscape?: () => void
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onArrowUp?: () => void
  onArrowDown?: () => void
  onNumber?: (num: number) => void
  enabled?: boolean
}

export function useKeyboardControls(options: KeyboardOptions) {
  const {
    onEnter,
    onSpace,
    onEscape,
    onArrowLeft,
    onArrowRight,
    onArrowUp,
    onArrowDown,
    onNumber,
    enabled = true,
  } = options

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Don't trigger if typing in an input
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      // Allow Enter in input fields only if it's specifically for submit
      if (event.key === 'Enter' && onEnter) {
        event.preventDefault()
        onEnter()
      }
      return
    }

    switch (event.key) {
      case 'Enter':
        event.preventDefault()
        onEnter?.()
        break
      case ' ':
        event.preventDefault()
        onSpace?.()
        break
      case 'Escape':
        onEscape?.()
        break
      case 'ArrowLeft':
        event.preventDefault()
        onArrowLeft?.()
        break
      case 'ArrowRight':
        event.preventDefault()
        onArrowRight?.()
        break
      case 'ArrowUp':
        event.preventDefault()
        onArrowUp?.()
        break
      case 'ArrowDown':
        event.preventDefault()
        onArrowDown?.()
        break
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        onNumber?.(parseInt(event.key))
        break
    }
  }, [enabled, onEnter, onSpace, onEscape, onArrowLeft, onArrowRight, onArrowUp, onArrowDown, onNumber])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Simple hook for just Enter key functionality
 */
export function useEnterKey(callback: () => void, enabled: boolean = true) {
  useKeyboardControls({
    onEnter: callback,
    enabled,
  })
}
