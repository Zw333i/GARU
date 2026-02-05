'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShareIcon, LinkIcon, CheckIcon, XIcon } from '@/components/icons'

interface ShareButtonProps {
  title?: string
  text?: string
  url?: string
  className?: string
}

export function ShareButton({
  title = 'GARU - NBA Knowledge Arena',
  text = 'Check out my result on GARU! 🏀',
  url,
  className = '',
}: ShareButtonProps) {
  const [showPopup, setShowPopup] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')

  const handleShare = async () => {
    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl })
        return
      } catch (error) {
        // User cancelled or share failed, fall back to popup
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error)
        }
      }
    }

    // Fall back to copy link
    setShowPopup(true)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setShowPopup(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(shareUrl)}`
    window.open(twitterUrl, '_blank', 'width=600,height=400')
    setShowPopup(false)
  }

  return (
    <div className="relative">
      <motion.button
        onClick={handleShare}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`flex items-center gap-2 px-4 py-2 glass rounded-lg hover:bg-white/10 transition-colors ${className}`}
      >
        <ShareIcon size={18} />
        <span className="hidden sm:inline">Share</span>
      </motion.button>

      <AnimatePresence>
        {showPopup && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPopup(false)}
              className="fixed inset-0 z-40"
            />

            {/* Popup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute right-0 mt-2 w-64 glass rounded-xl p-4 shadow-xl z-50"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Share</h4>
                <button
                  onClick={() => setShowPopup(false)}
                  className="text-muted hover:text-ghost-white"
                >
                  <XIcon size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {/* Copy Link */}
                <button
                  onClick={copyToClipboard}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {copied ? (
                    <CheckIcon size={18} className="text-electric-lime" />
                  ) : (
                    <LinkIcon size={18} />
                  )}
                  <span>{copied ? 'Copied!' : 'Copy link'}</span>
                </button>

                {/* Twitter/X */}
                <button
                  onClick={shareToTwitter}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Share on X</span>
                </button>
              </div>

              {/* Preview */}
              <div className="mt-4 p-3 bg-deep-void rounded-lg">
                <p className="text-sm text-muted line-clamp-2">{text}</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
