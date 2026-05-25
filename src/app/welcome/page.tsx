'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const FlowrLogo = () => (
  <svg width="36" height="36" viewBox="0 0 39 39" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M29.9302 39H9.06977L8.9525 38.9993C4.03648 38.937 0.063001 34.9635 0.000708576 30.0475L0 29.9302V9.06977C0 4.06067 4.06067 1.38779e-07 9.06977 0H29.9302C34.9393 0 39 4.06067 39 9.06977V29.9302C39 34.9002 35.0026 38.9365 30.0475 38.9993L29.9302 39ZM24.1066 15.9808L23.7628 23.7174C23.7628 26.3798 22.6382 28.9779 20.5522 31.064L14.9561 36.2791H29.9302C33.4366 36.2791 36.2791 33.4366 36.2791 29.9302V9.06977C36.2791 8.08478 36.0548 7.15218 35.6544 6.32027L35.5436 6.35738C33.2742 7.11717 30.99 7.88195 28.8924 8.89124C25.9704 10.2972 24.2398 13.0277 24.1066 15.9808ZM16.3045 18.0338L16.7254 13.687C17.0538 10.2965 19.4868 7.35444 23.0273 6.06642L32.4536 3.24217C31.6802 2.90682 30.8269 2.72093 29.9302 2.72093H9.06977C5.5634 2.72093 2.72093 5.5634 2.72093 9.06977V27.2509L8.39919 26.1046C12.7272 25.2308 15.9235 21.9676 16.3045 18.0338Z" fill="#E09952" />
  </svg>
)

const CONFETTI = [
  { color: '#E09952', x: -120, y: -80,  size: 6, delay: 0 },
  { color: '#6c63ff', x:  130, y: -60,  size: 5, delay: 0.05 },
  { color: '#52d4e0', x: -80,  y:  110, size: 7, delay: 0.1 },
  { color: '#ff6b6b', x:  100, y:  90,  size: 5, delay: 0.08 },
  { color: '#E09952', x:  60,  y: -130, size: 4, delay: 0.15 },
  { color: '#6c63ff', x: -140, y:  40,  size: 6, delay: 0.03 },
  { color: '#52d4e0', x:  150, y: -30,  size: 4, delay: 0.12 },
  { color: '#ff6b6b', x: -50,  y: -140, size: 5, delay: 0.07 },
  { color: '#E09952', x:  80,  y:  140, size: 6, delay: 0.18 },
  { color: '#6c63ff', x: -160, y: -50,  size: 4, delay: 0.02 },
  { color: '#52d4e0', x:  40,  y: -110, size: 7, delay: 0.14 },
  { color: '#ff6b6b', x: -100, y:  130, size: 5, delay: 0.09 },
]

export default function WelcomePage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const seen = document.cookie.split(';').some(c => c.trim().startsWith('welcome_seen=1'))
    if (seen) {
      router.replace('/app')
      return
    }
    document.cookie = 'welcome_seen=1; Max-Age=31536000; Path=/; SameSite=Lax'
    setChecked(true)
  }, [router])

  function handleEnter() {
    if (exiting) return
    setExiting(true)
    setTimeout(() => router.push('/app'), 400)
  }

  if (!checked) return null

  return (
    <>
      <style>{`
        @keyframes confetti-fly {
          0%   { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.5); }
        }
        @keyframes glow-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes content-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .welcome-exiting {
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .welcome-enter-btn:hover { opacity: 0.85; transition: opacity 0.15s; }
      `}</style>

      <div
        className={exiting ? 'welcome-exiting' : ''}
        style={{
          position: 'fixed', inset: 0,
          background: '#0d0d0c',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Confetti */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {CONFETTI.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: p.size, height: p.size,
                borderRadius: '50%',
                background: p.color,
                ['--tx' as any]: `${p.x}px`,
                ['--ty' as any]: `${p.y}px`,
                animation: `confetti-fly 1.2s ${p.delay}s ease-out both`,
              }}
            />
          ))}
        </div>

        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(224,153,82,0.22) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'glow-in 0.8s 0.2s ease both',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          animation: 'content-up 0.6s 0.3s ease both',
          position: 'relative', zIndex: 1,
          textAlign: 'center', padding: '0 24px',
        }}>
          <FlowrLogo />

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px',
            border: '1px solid rgba(224,153,82,0.3)',
            borderRadius: 20,
            background: 'rgba(224,153,82,0.08)',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            color: '#E09952',
            textTransform: 'uppercase',
          }}>
            ✦ Private Beta
          </div>

          <h1 style={{
            fontSize: 40, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.05,
            color: '#eeeee8',
            fontFamily: 'var(--font-display, Georgia, serif)',
            margin: 0,
          }}>
            Welcome to Flowr.
          </h1>

          <p style={{
            fontSize: 14, lineHeight: 1.6,
            color: 'rgba(233,233,226,0.55)',
            maxWidth: 280, margin: 0,
          }}>
            You were personally invited.<br />
            You&apos;re one of the first people here.
          </p>

          <button
            className="welcome-enter-btn"
            onClick={handleEnter}
            style={{
              marginTop: 8,
              padding: '10px 28px',
              background: '#E09952',
              color: '#0d0d0c',
              border: 'none',
              borderRadius: 8,
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Enter →
          </button>
        </div>
      </div>
    </>
  )
}
