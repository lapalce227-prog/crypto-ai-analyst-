import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

function Bars() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    let active = true
    const tick = () => {
      if (!active || !el) return
      el.innerHTML = ''
      for (let i = 0; i < 12; i++) {
        const h = 20 + Math.random() * 60
        const bar = document.createElement('div')
        bar.style.cssText = `flex:1;border-radius:4px;background:rgba(34,197,94,.12);height:${h}px;transition:height .4s ease`
        el.appendChild(bar)
      }
      setTimeout(tick, 2500)
    }
    tick()
    return () => { active = false }
  }, [])
  return <div ref={ref} className="flex items-end gap-[6px] h-20 my-4" />
}

function MiniSvg({ color, animate }) {
  const [d, setD] = useState('M0,50')
  useEffect(() => {
    if (!animate) {
      let d = 'M0,50'
      for (let x = 5; x < 400; x += 5) d += ` L${x},${30 + Math.sin(x * .03) * 20 + Math.sin(x * .08) * 10}`
      setD(d); return
    }
    const iv = setInterval(() => {
      let d = 'M0,60'; let y = 60
      for (let x = 5; x < 400; x += 5) { y += Math.random() * 6 - 2.8; y = Math.max(10, Math.min(75, y)); d += ` L${x},${y}` }
      setD(d)
    }, 2000)
    return () => clearInterval(iv)
  }, [animate])

  const areaD = d + ' L400,80 L0,80 Z'
  const gid = animate ? 'btg' : 'aig'

  return (
    <div className="my-4" style={{ height: 80 }}>
      <svg viewBox="0 0 400 80" width="100%" height="80" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.2" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gid})`} />
        <path d={d} fill="none" stroke={color} strokeWidth="2" />
      </svg>
    </div>
  )
}

function VizCard({ icon, children }) {
  return (
    <div className="w-full max-w-[440px] rounded-[20px] border border-white/[.04] px-8 py-8
      bg-white/[.015] backdrop-blur-[16px] relative overflow-hidden
      shadow-[0_4px_30px_rgba(0,0,0,.4),inset_0_0_0_1px_rgba(255,255,255,.02)]
      before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px
      before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)]">
      <div className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-4" style={icon.style}>{icon.el}</div>
      {children}
    </div>
  )
}

const MODULE_ICONS = {
  charts: { el: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round"><rect x="2" y="4" width="20" height="14" rx="2"/><polyline points="2 10 9 14 12 10 22 15"/></svg>, style: { background: 'rgba(34,197,94,.08)' } },
  ai: { el: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21"/><circle cx="12" cy="12" r="3"/></svg>, style: { background: 'rgba(59,130,246,.08)' } },
  bt: { el: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>, style: { background: 'rgba(139,92,246,.08)' } },
  okx: { el: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/></svg>, style: { background: 'rgba(245,158,11,.08)' } },
}

const MODULES = [
  {
    num: '01', tag: 'Charts',
    title: 'Professional-grade K-line analysis',
    desc: 'TradingView-level candlestick charts with MACD, RSI, and Bollinger Bands. Real-time WebSocket data from Gate.io and OKX with automatic reconnection.',
    tags: ['MACD', 'RSI', 'Bollinger', 'WebSocket', 'Sub-second'],
    icon: 'charts',
    visual: (icon) => <VizCard icon={icon}>
      <div className="flex gap-6 mb-4">
        {[['$97,234', '#22c55e', 'BTC/USDT'], ['+2.34%', '#22c55e', '24h Change'], ['1H', '#fafafa', 'Timeframe']].map(([n, c, l], i) => (
          <div key={i} className="text-center"><div className="text-[1.5rem] font-bold font-mono leading-tight" style={{ color: c }}>{n}</div><div className="text-[.65rem] text-[#666] mt-1 uppercase tracking-wider">{l}</div></div>
        ))}
      </div>
      <Bars />
    </VizCard>,
  },
  {
    num: '02', tag: 'AI Engine',
    title: 'Deep behavioral pattern recognition',
    desc: 'Our AI analyzes every trade against your historical patterns. It spots emotional entries, timing weaknesses, and leverage abuse — then gives you actionable advice in plain language.',
    tags: ['LLM Analysis', 'Pattern Detection', 'Risk Scoring', 'Weekly Reports'],
    icon: 'ai',
    visual: (icon) => <VizCard icon={icon}>
      <MiniSvg color="#3b82f6" animate={false} />
      <div className="flex gap-6 mt-4">
        {[['68.4%', '#22c55e', 'Win Rate'], ['-12.3%', '#ef4444', 'Max Drawdown'], ['2.41', '#3b82f6', 'Sharpe']].map(([n, c, l], i) => (
          <div key={i} className="text-center"><div className="text-[1.5rem] font-bold font-mono leading-tight" style={{ color: c }}>{n}</div><div className="text-[.65rem] text-[#666] mt-1 uppercase tracking-wider">{l}</div></div>
        ))}
      </div>
    </VizCard>,
  },
  {
    num: '03', tag: 'Backtesting',
    title: 'Validate before you risk capital',
    desc: 'Run DCA and Martingale strategies against historical OHLCV data. View equity curves, ROI, max drawdown, and per-trade PnL — all computed locally in milliseconds.',
    tags: ['DCA', 'Martingale', 'Equity Curve', 'PnL Analysis'],
    icon: 'bt',
    visual: (icon) => <VizCard icon={icon}>
      <MiniSvg color="#a78bfa" animate={true} />
      <div className="flex gap-6 mt-4">
        {[['+12.8%', '#22c55e', 'Best ROI'], ['347', '#f59e0b', 'Total Trades'], ['2.1s', '#a78bfa', 'Compute Time']].map(([n, c, l], i) => (
          <div key={i} className="text-center"><div className="text-[1.5rem] font-bold font-mono leading-tight" style={{ color: c }}>{n}</div><div className="text-[.65rem] text-[#666] mt-1 uppercase tracking-wider">{l}</div></div>
        ))}
      </div>
    </VizCard>,
  },
  {
    num: '04', tag: 'Integration',
    title: 'One-click OKX position sync',
    desc: 'Connect your OKX account via API key. Historical positions are automatically imported with PnL calculated. No more spreadsheets, no more manual data entry.',
    tags: ['OKX API', 'Auto Import', 'PnL Calc', 'CSV Export'],
    icon: 'okx',
    visual: (icon) => <VizCard icon={icon}>
      <div className="flex gap-6 py-4">
        {[['Instant', '#fafafa', 'Setup Time'], ['$48M+', '#22c55e', 'Volume Tracked'], ['99.9%', '#f59e0b', 'Accuracy']].map(([n, c, l], i) => (
          <div key={i} className="text-center"><div className="text-[1.5rem] font-bold font-mono leading-tight" style={{ color: c }}>{n}</div><div className="text-[.65rem] text-[#666] mt-1 uppercase tracking-wider">{l}</div></div>
        ))}
      </div>
    </VizCard>,
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)

  // Particles
  useEffect(() => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'); const dpr = devicePixelRatio || 1
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25,
      r: .5 + Math.random() * 1.5, o: .15 + Math.random() * .35,
    }))
    let active = true

    const resize = () => {
      c.width = innerWidth * dpr; c.height = innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px'
    }
    resize(); addEventListener('resize', resize)

    const draw = () => {
      if (!active) return
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = innerWidth; if (p.x > innerWidth) p.x = 0
        if (p.y < 0) p.y = innerHeight; if (p.y > innerHeight) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${p.o})`; ctx.fill()
      })
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 100) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(255,255,255,${.03 * (1 - d / 100)})`; ctx.lineWidth = .5; ctx.stroke()
          }
        }
      }
      requestAnimationFrame(draw)
    }
    draw()
    return () => { active = false; removeEventListener('resize', resize) }
  }, [])

  // Scroll reveal
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } })
    }, { threshold: .15, rootMargin: '-50px' })
    document.querySelectorAll('[data-animate]').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-[#070707] text-[#fafafa] font-['Inter'] antialiased overflow-x-hidden">
      {/* custom styles for @property animations */}
      <style>{`
        @property --gradient-angle{syntax:"<angle>";inherits:false;initial-value:0deg}
        @property --gradient-angle-offset{syntax:"<angle>";inherits:false;initial-value:0deg}
        @property --gradient-percent{syntax:"<percentage>";inherits:false;initial-value:20%}
        @property --gradient-shine{syntax:"<color>";inherits:false;initial-value:#3b82f6}
        .shiny-cta{
          --gradient-angle:0deg;--gradient-angle-offset:0deg;--gradient-percent:20%;--gradient-shine:#3b82f6;
          position:relative;overflow:hidden;border-radius:9999px;padding:.9rem 2.5rem;font-size:1rem;font-weight:500;line-height:1.2;
          color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:8px;
          background:linear-gradient(#000,#000) padding-box,
            conic-gradient(from calc(var(--gradient-angle) - var(--gradient-angle-offset)),
              transparent 0%,#2563eb 5%,var(--gradient-shine) 15%,#2563eb 30%,transparent 40%,transparent 100%) border-box;
          border:2px solid transparent;outline:none;
          box-shadow:inset 0 0 0 1px #1a1818;
          transition:--gradient-angle-offset .8s cubic-bezier(.25,1,.5,1),--gradient-percent .8s cubic-bezier(.25,1,.5,1),--gradient-shine .8s cubic-bezier(.25,1,.5,1),box-shadow .3s;
          isolation:isolate;z-index:0;animation:border-spin 2.5s linear infinite;text-decoration:none;
        }
        .shiny-cta:hover{--gradient-angle-offset:45deg;--gradient-percent:30%;--gradient-shine:#60a5fa}
        .shiny-cta:active{transform:translateY(1px)}
        @keyframes border-spin{to{--gradient-angle:360deg}}
        .shiny-cta:before{
          content:"";pointer-events:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:0;
          --size:calc(100% - 6px);--position:2px;--space:4px;width:var(--size);height:var(--size);
          background:radial-gradient(circle at var(--position) var(--position),white .5px,transparent 0) padding-box;
          background-size:var(--space) var(--space);background-repeat:space;
          mask-image:conic-gradient(from calc(var(--gradient-angle) + 45deg),black,transparent 10% 90%,black);
          -webkit-mask-image:conic-gradient(from calc(var(--gradient-angle) + 45deg),black,transparent 10% 90%,black);
          border-radius:inherit;opacity:.4;
        }
        .shiny-cta:after{
          content:"";pointer-events:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1;
          --size:calc(100% + 1rem);width:var(--size);height:var(--size);
          background:linear-gradient(-50deg,transparent,#2563eb,transparent);
          mask-image:radial-gradient(circle at bottom,transparent 40%,black);
          -webkit-mask-image:radial-gradient(circle at bottom,transparent 40%,black);
          border-radius:inherit;opacity:.5;animation:shimmer 4s linear infinite;
        }
        @keyframes shimmer{to{transform:translate(-50%,-50%) rotate(360deg)}}
        .gradient-blur>div,.gradient-blur:after{position:absolute;left:0;right:0}
        .gradient-blur:before{content:"";z-index:1;height:100%;backdrop-filter:blur(.5px);-webkit-backdrop-filter:blur(.5px);mask:linear-gradient(to top,transparent 0%,#000 12.5%,#000 25%,transparent 37.5%);-webkit-mask:linear-gradient(to top,transparent 0%,#000 12.5%,#000 25%,transparent 37.5%)}
        .gradient-blur>div:nth-of-type(1){z-index:2;height:100%;backdrop-filter:blur(1px);-webkit-backdrop-filter:blur(1px);mask:linear-gradient(to top,transparent 12.5%,#000 25%,#000 37.5%,transparent 50%);-webkit-mask:linear-gradient(to top,transparent 12.5%,#000 25%,#000 37.5%,transparent 50%)}
        .gradient-blur>div:nth-of-type(2){z-index:3;height:100%;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);mask:linear-gradient(to top,transparent 25%,#000 37.5%,#000 50%,transparent 62.5%);-webkit-mask:linear-gradient(to top,transparent 25%,#000 37.5%,#000 50%,transparent 62.5%)}
        .gradient-blur>div:nth-of-type(3){z-index:4;height:100%;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);mask:linear-gradient(to top,transparent 37.5%,#000 50%,#000 62.5%,transparent 75%);-webkit-mask:linear-gradient(to top,transparent 37.5%,#000 50%,#000 62.5%,transparent 75%)}
        .gradient-blur>div:nth-of-type(4){z-index:5;height:100%;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);mask:linear-gradient(to top,transparent 50%,#000 62.5%,#000 75%,transparent 87.5%);-webkit-mask:linear-gradient(to top,transparent 50%,#000 62.5%,#000 75%,transparent 87.5%)}
        .gradient-blur>div:nth-of-type(5){z-index:6;height:100%;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);mask:linear-gradient(to top,transparent 62.5%,#000 75%,#000 87.5%,transparent 100%);-webkit-mask:linear-gradient(to top,transparent 62.5%,#000 75%,#000 87.5%,transparent 100%)}
        .gradient-blur>div:nth-of-type(6){z-index:7;height:100%;backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);mask:linear-gradient(to top,transparent 75%,#000 87.5%,#000 100%);-webkit-mask:linear-gradient(to top,transparent 75%,#000 87.5%,#000 100%)}
        .gradient-blur:after{content:"";z-index:8;height:100%;backdrop-filter:blur(64px);-webkit-backdrop-filter:blur(64px);mask:linear-gradient(to top,transparent 87.5%,#000 100%);-webkit-mask:linear-gradient(to top,transparent 87.5%,#000 100%)}
        [data-animate]{opacity:0;transform:translateY(30px);transition:opacity .8s ease,transform .8s cubic-bezier(.25,1,.5,1)}
        [data-animate].visible{opacity:1;transform:translateY(0)}
      `}</style>

      {/* Particles */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />

      {/* Gradient Blur */}
      <div className="gradient-blur fixed inset-0 pointer-events-none z-0"><div></div><div></div><div></div><div></div><div></div><div></div></div>

      {/* Grid */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[.025]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.9) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.9) 1px,transparent 1px)',
        backgroundSize: '96px 96px',
        maskImage: 'linear-gradient(180deg,transparent 0%,#000 16%,#000 78%,transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg,transparent 0%,#000 16%,#000 78%,transparent 100%)',
      }} />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2.5 font-semibold text-[.95rem] text-white tracking-[-.3px]">
          <span className="w-[7px] h-[7px] rounded-full bg-[#22c55e] shadow-[0_0_10px_rgba(34,197,94,.5)]" />Laplace Market
        </div>
        <div className="flex gap-8 text-[.8rem] text-[#888]">
          <span className="cursor-pointer hover:text-white transition-colors">Market</span>
          <span className="cursor-pointer hover:text-white transition-colors">Strategies</span>
          <span className="cursor-pointer hover:text-white transition-colors">AI Analysis</span>
          <span className="cursor-pointer hover:text-white transition-colors">Docs</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center px-8 pt-36 pb-32 max-w-[800px] mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-[20px] text-[.78rem] text-[#a3a3a3] bg-white/[.04] border border-white/[.08] mb-8">
          <span className="w-[6px] h-[6px] rounded-full bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,.6)]" />AI Trading Analytics — Live
        </div>
        <h1 className="text-[clamp(2.8rem,7vw,5rem)] font-extrabold leading-[1.04] tracking-[-2px] text-white mb-5">
          See the truth<br />behind every <span className="bg-gradient-to-r from-[#22c55e] via-[#4ade80] to-[#a3e635] bg-clip-text text-transparent">trade</span>
        </h1>
        <p className="text-[1.05rem] text-[#888] max-w-[520px] mx-auto mb-10 leading-relaxed">
          AI-powered trading analysis platform. Auto-sync positions, diagnose behavioral patterns, uncover what's really costing you money.
        </p>
        <button onClick={() => navigate('/login')} className="shiny-cta">Start Free Trial →</button>
      </section>

      {/* Modules */}
      <section className="relative z-10 max-w-[1100px] mx-auto px-8 pb-20">
        {MODULES.map((m, i) => (
          <div key={i} data-animate className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-12 border-t border-white/[.04]"
            style={{ direction: i % 2 === 1 ? 'rtl' : 'ltr' }}>
            <div style={{ direction: 'ltr' }}>
              <div className="text-[.7rem] font-semibold tracking-[1px] text-[#444] uppercase mb-3">{m.num} · {m.tag}</div>
              <h2 className="text-[1.8rem] font-bold tracking-[-.6px] leading-tight mb-3.5 text-[#fafafa]">{m.title}</h2>
              <p className="text-[.92rem] text-[#777] leading-relaxed max-w-[420px]">{m.desc}</p>
              <div className="flex gap-2 mt-5 flex-wrap">
                {m.tags.map(t => <span key={t} className="text-[.7rem] px-3 py-1 rounded-lg bg-white/[.03] border border-white/[.06] text-[#888]">{t}</span>)}
              </div>
            </div>
            <div className="flex items-center justify-center" style={{ direction: 'ltr' }}>{m.visual(MODULE_ICONS[m.icon])}</div>
          </div>
        ))}
      </section>

      {/* Numbers */}
      <div className="relative z-10 flex justify-center gap-16 flex-wrap py-10 border-t border-white/[.04] max-w-[1100px] mx-auto text-center">
        {[['1,200+', 'Active Traders'], ['$48M+', 'Volume Analyzed'], ['99.9%', 'Data Accuracy'], ['24/7', 'AI Monitoring']].map(([n, l], i) => (
          <div key={i}><div className="text-[1.6rem] font-bold text-[#fafafa]">{n}</div><div className="text-[.75rem] text-[#666] mt-0.5">{l}</div></div>
        ))}
      </div>

      {/* CTA */}
      <section className="relative z-10 text-center px-8 py-12 pb-24">
        <p className="text-[.95rem] text-[#888] mb-7">Ready to see what your trading data is hiding?</p>
        <button onClick={() => navigate('/login')} className="shiny-cta">Start Free Trial →</button>
      </section>

      <footer className="relative z-10 text-center py-6 text-[#444] text-[.7rem] border-t border-white/[.04]">
        &copy; 2026 Laplace Market. Built for traders who want to see the truth.
      </footer>
    </div>
  )
}
