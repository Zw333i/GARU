'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShareIcon, LinkIcon, QRCodeIcon, XIcon, CheckIcon } from '@/components/icons'

interface ChallengeModalProps {
  isOpen: boolean
  onClose: () => void
  gameMode: string
  score?: number
}

export function ChallengeModal({ isOpen, onClose, gameMode, score }: ChallengeModalProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  
  // Generate challenge link
  const challengeId = typeof window !== 'undefined' 
    ? btoa(`${gameMode}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    : ''
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const challengeUrl = `${baseUrl}/challenge/${challengeId}?game=${gameMode}${score ? `&target=${score}` : ''}`
  
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(challengeUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }
  
  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'GARU Challenge',
          text: score 
            ? `I scored ${score} points in ${gameMode}! Can you beat me?` 
            : `Challenge me in ${gameMode} on GARU!`,
          url: challengeUrl,
        })
      } catch (err) {
        console.error('Share failed:', err)
      }
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass rounded-2xl p-6 max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold flex items-center gap-2">
              <ShareIcon className="text-electric-lime" size={24} />
              Challenge a Friend
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface rounded-lg transition-colors"
            >
              <XIcon size={20} className="text-muted" />
            </button>
          </div>

          {/* Score Display */}
          {score !== undefined && (
            <div className="bg-surface rounded-xl p-4 mb-6 text-center">
              <p className="text-muted text-sm">Your Score</p>
              <p className="text-3xl font-display font-bold text-electric-lime">{score}</p>
              <p className="text-muted text-xs mt-1">Challenge your friends to beat it!</p>
            </div>
          )}

          {/* Challenge Link */}
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={challengeUrl}
                readOnly
                className="w-full px-4 py-3 pr-12 bg-gunmetal border border-surface rounded-xl text-ghost-white text-sm truncate"
              />
              <button
                onClick={copyLink}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-surface rounded-lg transition-colors"
              >
                {copied ? (
                  <CheckIcon size={18} className="text-electric-lime" />
                ) : (
                  <LinkIcon size={18} className="text-muted" />
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 py-3 bg-surface hover:bg-muted/30 text-ghost-white font-medium rounded-xl transition-colors"
              >
                <LinkIcon size={18} />
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              
              <button
                onClick={() => setShowQR(!showQR)}
                className="flex items-center justify-center gap-2 py-3 bg-surface hover:bg-muted/30 text-ghost-white font-medium rounded-xl transition-colors"
              >
                <QRCodeIcon size={18} />
                QR Code
              </button>
            </div>

            {/* QR Code Display */}
            {showQR && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex justify-center py-4"
              >
                <div className="bg-white p-4 rounded-xl">
                  {/* Simple QR placeholder - in production use a QR library */}
                  <div className="w-40 h-40 bg-gunmetal rounded-lg flex items-center justify-center">
                    <QRCodeIcon size={64} className="text-muted" />
                  </div>
                  <p className="text-center text-xs text-gunmetal mt-2">Scan to challenge</p>
                </div>
              </motion.div>
            )}

            {/* Native Share Button (if supported) */}
            {typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={shareNative}
                className="w-full py-3 bg-electric-lime text-deep-void font-bold rounded-xl hover:bg-green-400 transition-colors flex items-center justify-center gap-2"
              >
                <ShareIcon size={20} />
                Share Challenge
              </button>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 pt-4 border-t border-surface">
            <p className="text-muted text-xs text-center">
              When your friend opens the link, they&apos;ll play the same game and try to beat your score!
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Hook to generate QR code (placeholder - use qrcode library in production)
export function useQRCode(text: string): string {
  // In production, use a library like 'qrcode' to generate actual QR codes
  // For now, return a placeholder
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
}
