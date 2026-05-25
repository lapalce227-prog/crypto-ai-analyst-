import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

function Chars({ text }) {
  return text.split('').map((ch, i) => (
    <span key={i} className='char' style={{ display: 'inline-block', whiteSpace: ch === ' ' ? 'pre' : undefined }}>
      {ch === ' ' ? ' ' : ch}
    </span>
  ))
}

export default function Landing() {
  const navigate = useNavigate()
  const app = useRef(null)
  const blobRef = useRef(null)

  useEffect(() => {
    const move = (e) => {
      if (blobRef.current) gsap.to(blobRef.current, { x: e.clientX - 260, y: e.clientY - 260, duration: 3, ease: 'power2.out' })
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])

  useEffect(() => {
    gsap.to('.amb-1', { x: 80, y: -60, duration: 12, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    gsap.to('.amb-2', { x: -100, y: 40, duration: 15, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    gsap.to('.amb-3', { x: -50, y: -80, duration: 10, repeat: -1, yoyo: true, ease: 'sine.inOut' })
  }, [])

  useGSAP(() => {
    const tl = gsap.timeline()
    tl.from('.line1 .char', { y: 140, autoAlpha: 0, skewY: 8, stagger: { each: 0.04, from: 'start' }, duration: 1.1, ease: 'power4.out' })
    tl.from('.line2', { y: 110, autoAlpha: 0, duration: 1, ease: 'power4.out' }, '-=0.55')
    tl.from('.hero-desc', { y: 25, autoAlpha: 0, duration: 0.8, ease: 'power3.out' }, '-=0.4')
    gsap.to('.line1, .line2', { y: -5, duration: 4, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2.8 })
    // Gradient slowly sweeps left to right
    gsap.to('.line2 .gradient-text', { backgroundPosition: '100% center', duration: 6, repeat: -1, yoyo: true, ease: 'none' })
  }, { scope: app })

  return (
    <div ref={app} className='bg-[#050505] text-[#F5F1E8] overflow-x-hidden' style={{ fontFamily: '"Inter Tight", system-ui, sans-serif' }}>

      {/* Ambient blobs */}
      <div className='amb-1 fixed pointer-events-none rounded-full' style={{ width: 700, height: 700, top: '-20%', left: '-10%', filter: 'blur(140px)', background: 'radial-gradient(circle, rgba(139,92,246,0.25), transparent 70%)' }} />
      <div className='amb-2 fixed pointer-events-none rounded-full' style={{ width: 600, height: 600, top: '40%', right: '-15%', filter: 'blur(130px)', background: 'radial-gradient(circle, rgba(236,72,153,0.2), transparent 70%)' }} />
      <div className='amb-3 fixed pointer-events-none rounded-full' style={{ width: 500, height: 500, bottom: '10%', left: '20%', filter: 'blur(120px)', background: 'radial-gradient(circle, rgba(10,228,72,0.15), transparent 70%)' }} />

      {/* Mouse blob */}
      <div ref={blobRef} className='fixed pointer-events-none rounded-full' style={{ width: 520, height: 520, left: 'calc(50% + 150px)', top: 'calc(50% - 300px)', filter: 'blur(100px)', background: 'radial-gradient(circle, rgba(139,92,246,0.35), rgba(236,72,153,0.2), transparent 70%)' }} />

      {/* Nav */}
      <nav className='relative z-10 px-8 py-5 max-w-[1400px] mx-auto flex items-center justify-between'>
        <span className='text-[.95rem] font-semibold tracking-tight'>Rational Trading</span>
        <button onClick={() => navigate('/login')} className='text-[.8rem] text-[#888] hover:text-[#F5F1E8] transition-colors bg-transparent border-0 cursor-pointer'>Sign In</button>
      </nav>

      {/* Module 1: Hero */}
      <section className='relative z-10 min-h-screen flex flex-col items-center justify-center px-6'>
        <h1 className='mb-8 select-none text-center' style={{ fontSize: 'clamp(3.5rem, 11vw, 9rem)', fontWeight: 800, lineHeight: 0.88, letterSpacing: '-0.04em' }}>
          <div className='line1'><Chars text='Rational' /></div>
          <div className='line2'>
            <span className='gradient-text' style={{
              background: 'linear-gradient(90deg, #8B5CF6, #EC4899, #0ae448, #60a5fa, #a78bfa, #8B5CF6)',
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Trading</span>
          </div>
        </h1>
        <p className='hero-desc text-[clamp(1rem,2vw,1.2rem)] max-w-[460px] mx-auto text-center leading-relaxed tracking-tight' style={{ color: '#888' }}>
          AI-powered analytics platform.
        </p>
        <p className='text-[.75rem] mt-12' style={{ color: '#666' }}>↓ Scroll ↓</p>
      </section>

      {/* Modules 2-4 */}
      {[
        { n: '01', title: 'Precision', sub: 'K-line Charts', desc: 'TradingView-level candlestick. Real-time WebSocket, MACD, RSI, Bollinger Bands.', color: '#F5F1E8' },
        { n: '02', title: 'Intelligence', sub: 'AI Agent', desc: 'LangGraph-powered engine. Natural language queries, streaming SSE, 4 built-in tools.', color: '#8B5CF6' },
        { n: '03', title: 'Velocity', sub: 'Strategy Backtest', desc: 'DCA, Martingale, Grid. OHLCV backtesting in milliseconds.', color: '#0ae448' },
        { n: '04', title: 'Integration', sub: 'OKX Auto Sync', desc: 'One-click position import. Auto P&L. Price alerts with persistent storage.', color: '#EC4899' },
      ].map((m, i) => (
        <section key={i} className='relative z-10 min-h-[70vh] flex flex-col justify-center max-w-[900px] mx-auto px-6'>
          <div className='text-[.7rem] tracking-[0.15em] mb-6' style={{ color: m.color }}>{m.n}</div>
          <h2 className='mb-5' style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em', color: m.color }}>
            {m.title}
          </h2>
          <p className='text-[clamp(1rem,2vw,1.3rem)] mb-3 leading-relaxed max-w-[600px] font-medium' style={{ color: '#a0a0a0' }}>{m.sub}</p>
          <p className='text-[.9rem] leading-relaxed max-w-[500px]' style={{ color: '#888' }}>{m.desc}</p>
        </section>
      ))}

      <section className='relative z-10 text-center px-6 py-32'>
        <button onClick={() => navigate('/login')}
          className='inline-flex items-center gap-2 px-9 py-3.5 rounded-full text-[1rem] font-semibold will-change-transform'
          style={{ color: '#050505', background: '#F5F1E8', transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)' }}
          onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.2}px, ${(e.clientY - r.top - r.height / 2) * 0.2}px) scale(1.03)` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translate(0, 0) scale(1)' }}>
          Explore the Platform
          <span style={{ color: '#8B5CF6' }}>→</span>
        </button>
        <p className='text-[.68rem] text-[#2a2a2a] mt-8'>&copy; 2026 Rational Trading</p>
      </section>
    </div>
  )
}
