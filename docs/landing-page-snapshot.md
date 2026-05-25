# Landing Page 快照

## 文件
`frontend/src/pages/Landing.jsx`

## 当前结构

```
页面从上到下：

1. Hero (min-h-screen)
   - "Rational" — 逐字 Chars 组件，power4.out，0.04s stagger，skewY:8→0
   - "Trading" — 整体渐变文字，background-clip: text，GSAP 6s 漂移 backgroundPosition
   - 副标题 + ↓ Scroll
   - 紫色光斑跟随鼠标 (520px, blur 100px)

2-5. 四个模块 (min-h-[70vh])
   01 Precision (#F5F1E8) — K-line Charts
   02 Intelligence (#8B5CF6) — AI Agent  
   03 Velocity (#0ae448) — Strategy Backtest
   04 Integration (#EC4899) — OKX Auto Sync

6. CTA
   "Explore the Platform" 磁性按钮 + footer

背景：
- 3 个环境光斑 (amb-1/2/3) 正弦漂移，blur 120-140px
- 1 个跟鼠标光斑 (blobRef)
- 纯黑底 #050505
```

## 关键动画参数

| 元素 | 动画 | 参数 |
|------|------|------|
| line1 chars | from y:140, skewY:8 | stagger 0.04s, power4.out, 1.1s |
| line2 | from y:110 | power4.out, 1s, delay -0.55 |
| hero-desc | from y:25 | power3.out, 0.8s |
| 呼吸 | to y:-5 | sine.inOut, 4s loop, delay 2.8 |
| 渐变漂移 | backgroundPosition 0→100% | 6s loop, ease:none |
| amb-1 | x:80, y:-60 | 12s sine loop |
| amb-2 | x:-100, y:40 | 15s sine loop |
| amb-3 | x:-50, y:-80 | 10s sine loop |
| 鼠标光斑 | 跟随鼠标 | power2.out, 3s |

## 依赖
- gsap + @gsap/react
- 无 ScrollTrigger
- 无 Lenis
