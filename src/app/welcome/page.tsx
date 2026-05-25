'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const FlowrLogo = () => (
  <svg width="52" height="52" viewBox="0 0 39 39" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M29.9302 39H9.06977L8.9525 38.9993C4.03648 38.937 0.063001 34.9635 0.000708576 30.0475L0 29.9302V9.06977C0 4.06067 4.06067 1.38779e-07 9.06977 0H29.9302C34.9393 0 39 4.06067 39 9.06977V29.9302C39 34.9002 35.0026 38.9365 30.0475 38.9993L29.9302 39ZM24.1066 15.9808L23.7628 23.7174C23.7628 26.3798 22.6382 28.9779 20.5522 31.064L14.9561 36.2791H29.9302C33.4366 36.2791 36.2791 33.4366 36.2791 29.9302V9.06977C36.2791 8.08478 36.0548 7.15218 35.6544 6.32027L35.5436 6.35738C33.2742 7.11717 30.99 7.88195 28.8924 8.89124C25.9704 10.2972 24.2398 13.0277 24.1066 15.9808ZM16.3045 18.0338L16.7254 13.687C17.0538 10.2965 19.4868 7.35444 23.0273 6.06642L32.4536 3.24217C31.6802 2.90682 30.8269 2.72093 29.9302 2.72093H9.06977C5.5634 2.72093 2.72093 5.5634 2.72093 9.06977V27.2509L8.39919 26.1046C12.7272 25.2308 15.9235 21.9676 16.3045 18.0338Z" fill="#d67a3c" />
  </svg>
)

const CONFETTI = [
  { color: '#d67a3c', x: -180, y: -120, size: 7,  rot: 30,  delay: 0 },
  { color: '#a78bfa', x:  200, y: -90,  size: 5,  rot: -20, delay: 0.04 },
  { color: '#34d399', x: -110, y:  160, size: 8,  rot: 45,  delay: 0.08 },
  { color: '#fb7185', x:  150, y:  130, size: 5,  rot: -35, delay: 0.06 },
  { color: '#d67a3c', x:  90,  y: -180, size: 6,  rot: 15,  delay: 0.12 },
  { color: '#a78bfa', x: -200, y:  60,  size: 7,  rot: -50, delay: 0.02 },
  { color: '#34d399', x:  220, y: -40,  size: 4,  rot: 70,  delay: 0.10 },
  { color: '#fb7185', x: -70,  y: -200, size: 6,  rot: -15, delay: 0.05 },
  { color: '#d67a3c', x:  110, y:  200, size: 7,  rot: 55,  delay: 0.14 },
  { color: '#a78bfa', x: -230, y: -70,  size: 5,  rot: -40, delay: 0.01 },
  { color: '#34d399', x:  60,  y: -160, size: 8,  rot: 25,  delay: 0.11 },
  { color: '#fb7185', x: -150, y:  190, size: 5,  rot: -60, delay: 0.07 },
  { color: '#d67a3c', x:  170, y: -150, size: 4,  rot: 80,  delay: 0.16 },
  { color: '#a78bfa', x: -90,  y:  80,  size: 6,  rot: -25, delay: 0.09 },
  { color: '#34d399', x:  240, y:  70,  size: 5,  rot: 35,  delay: 0.13 },
  { color: '#fb7185', x: -170, y: -160, size: 7,  rot: -45, delay: 0.03 },
]

export default function WelcomePage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const preview = new URLSearchParams(location.search).has('welcome-preview')
    if (!preview) {
      const seen = document.cookie.split(';').some(c => c.trim().startsWith('welcome_seen=1'))
      if (seen) {
        router.replace('/app')
        return
      }
      const secure = location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `welcome_seen=1; Max-Age=31536000; Path=/; SameSite=Lax${secure}`
    }
    setChecked(true)
  }, [router])

  function handleEnter() {
    if (exiting) return
    setExiting(true)
    setTimeout(() => router.push('/app'), 500)
  }

  if (!checked) return null

  return (
    <>
      <style>{`
        @keyframes confetti-fly {
          0%   { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.3); }
        }
        @keyframes content-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes line-in {
          from { opacity: 0; transform: scaleX(0); }
          to   { opacity: 1; transform: scaleX(1); }
        }
        @keyframes bg-drift {
          0%   { background-position: 50% 60%; }
          33%  { background-position: 52% 55%; }
          66%  { background-position: 48% 63%; }
          100% { background-position: 50% 60%; }
        }
        .welcome-bg {
          background: radial-gradient(ellipse 80% 60% at 50% 40%, #1e130a 0%, #111110 55%, #0a0a09 100%);
          background-size: 200% 200%;
          animation: bg-drift 8s ease-in-out infinite;
        }
        .welcome-exiting {
          opacity: 0;
          transition: opacity 0.5s ease;
        }
        .welcome-enter-btn {
          transition: opacity 0.15s ease;
        }
        .welcome-enter-btn:hover { opacity: 0.8; }
        .welcome-enter-btn:active { opacity: 0.65; }
      `}</style>

      <div
        className={`welcome-bg${exiting ? ' welcome-exiting' : ''}`}
        style={{
          position: 'fixed', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Confetti burst */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0 }}>
          {CONFETTI.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: p.size, height: p.size,
                borderRadius: p.size > 6 ? 2 : '50%',
                background: p.color,
                ['--tx' as any]: `${p.x}px`,
                ['--ty' as any]: `${p.y}px`,
                ['--rot' as any]: `${p.rot}deg`,
                animation: `confetti-fly 1.4s ${p.delay}s cubic-bezier(0.25,0.46,0.45,0.94) both`,
              }}
            />
          ))}
        </div>

        {/* Subtle vignette edges */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 0,
          animation: 'content-up 0.7s 0.25s cubic-bezier(0.25,0.46,0.45,0.94) both',
          position: 'relative', zIndex: 2,
          textAlign: 'center', padding: '0 32px',
          maxWidth: 520,
        }}>

          {/* Logo */}
          <div style={{ marginBottom: 28 }}>
            <FlowrLogo />
          </div>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px 3px 8px',
            border: '1px solid rgba(214,122,60,0.25)',
            borderRadius: 24,
            background: 'rgba(214,122,60,0.07)',
            fontSize: 9.5, fontWeight: 600, letterSpacing: '0.11em',
            color: 'rgba(214,122,60,0.9)',
            textTransform: 'uppercase',
            marginBottom: 24,
            fontFamily: 'var(--font-sans)',
          }}>
            <span style={{ fontSize: 8 }}>✦</span> Private Beta
          </div>

          {/* Headline — Literata serif */}
          <h1 style={{
            fontSize: 52,
            fontWeight: 400,
            letterSpacing: '-0.025em',
            lineHeight: 1.08,
            color: '#eeeee4',
            fontFamily: 'var(--font-display)',
            margin: '0 0 20px',
          }}>
            Welcome to Flowr.
          </h1>

          {/* Divider line */}
          <div style={{
            width: 32, height: 1,
            background: 'rgba(214,122,60,0.4)',
            marginBottom: 20,
            animation: 'line-in 0.5s 0.7s ease both',
            transformOrigin: 'center',
          }} />

          {/* Subtext */}
          <p style={{
            fontSize: 15,
            lineHeight: 1.65,
            color: 'rgba(238,238,228,0.45)',
            margin: '0 0 36px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 400,
            letterSpacing: '0.01em',
          }}>
            You were personally invited.<br />
            You&apos;re one of the first people here.
          </p>

          {/* CTA */}
          <button
            className="welcome-enter-btn"
            onClick={handleEnter}
            aria-label="Enter app"
            style={{
              padding: '9px 20px',
              background: 'rgba(214,122,60,0.12)',
              color: '#d67a3c',
              border: '1px solid rgba(214,122,60,0.35)',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.01em',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Enter Flowr
          </button>
        </div>
      </div>
    </>
  )
}
