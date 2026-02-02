'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { clsx } from 'clsx'
import Link from 'next/link'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  href?: string
  children: React.ReactNode
}

const variants = {
  primary: 'bg-electric-lime text-deep-void hover:bg-green-400',
  secondary: 'bg-surface text-ghost-white hover:bg-muted/30',
  outline: 'border border-electric-lime text-electric-lime hover:bg-electric-lime/10',
  ghost: 'text-muted hover:text-ghost-white hover:bg-surface/50',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  href,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const classes = clsx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all',
    'focus:outline-none focus:ring-2 focus:ring-electric-lime focus:ring-offset-2 focus:ring-offset-deep-void',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    className
  )

  const content = (
    <>
      {isLoading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    )
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {content}
    </motion.button>
  )
}
