'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function WelcomeTransition() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    const prev = prevPathname.current
    prevPathname.current = pathname

    // When navigating away from /welcome, show overlay then fade it out
    if (prev === '/welcome' && pathname !== '/welcome') {
      setVisible(true)
      setFading(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFading(true)
        })
      })
    }
  }, [pathname])

  const handleTransitionEnd = () => {
    if (fading) setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      onTransitionEnd={handleTransitionEnd}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, #1e130a 0%, #111110 55%, #0a0a09 100%)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.7s ease',
        pointerEvents: 'none',
      }}
    />
  )
}
