# Laplace Agent

加密货币 + 股指 K 线分析平台，集成 AI 对话、交易复盘、社区交流。

## 快速启动

```bash
# 1. 后端
cd backend
cp .env.example .env          # 编辑 .env 填入 DeepSeek API Key
pip install -r requirements.txt --break-system-packages
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 2. 前端
cd frontend
npm config set registry https://registry.npmmirror.com   # 国内镜像
npm install
npm run dev
```

打开 http://localhost:5173 ，注册账户即可使用。

## 环境变量 (.env)

```bash
# 必填 — AI 对话
DEEPSEEK_API_KEY=sk-your-key-here

# 可选 — 图片分析（K线截图识别）
VISION_API_KEY=
VISION_BASE_URL=https://api.openai.com
VISION_MODEL=gpt-4o

# 可选 — OKX 数据导入（需 VPN）
OKX_API_KEY=
OKX_API_SECRET=
OKX_API_PASSPHRASE=
```

## 功能

- **K 线图** — 20 种加密货币 + 中美股指，实时 WebSocket，MA5/10/20/60 均线
- **AI 分析** — DeepSeek 对话 + K 线截图识别（需配置 Vision API）
- **交易记录** — 手动录入 + OKX API 自动导入
- **复盘报告** — AI 分析胜率、亏损规律、改进建议
- **风险看板** — 情绪vs胜率、各时段盈亏分布
- **社区** — 发帖/回复/点赞
- **市场观察** — 博客文章发布与阅读

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite + lightweight-charts |
| 后端 | Python FastAPI + JWT + bcrypt |
| AI | DeepSeek Chat API |
| 数据源 | Gate.io（加密货币）、腾讯财经（美股指数）、新浪财经（A股） |

## 数据存储

| 数据 | 位置 | 持久化 |
|---|---|---|
| 用户 | `backend/app/data/users.json` | ✅ |
| 交易记录 | 内存 `TradeService._trades` | ❌ 重启丢失 |
| 社区帖子 | `backend/app/data/community.json` | ✅ |
| 博客文章 | `backend/app/data/blog.json` | ✅ |

> 交易记录目前存在内存中，服务重启会丢失。后续可接 MySQL / SQLite。

## 国内网络说明

未配置 VPN 情况下的数据源可用性：

| 功能 | 数据源 | 状态 |
|---|---|---|
| 加密货币 K 线 | Gate.io | ✅ |
| A股指数（上证/深证） | 新浪财经 | ✅ |
| 美股指数（纳指/标普） | 腾讯财经（有限） | ⚠️ |
| AI 对话 | DeepSeek | ✅ |
| OKX 数据导入 | OKX API | ❌ 需 VPN |

## 项目结构

```
├── backend/
│   └── app/
│       ├── api/           # auth.py, routes.py
│       ├── core/          # config.py
│       ├── data/          # JSON 文件存储
│       ├── models/        # Pydantic 模型
│       └── services/      # AI / OKX / 交易 / 社区 / 博客
├── frontend/
│   └── src/
│       ├── components/    # KLineChart, AIChat, TradeInput, etc.
│       ├── context/       # AuthContext
│       ├── pages/         # Login, Register
│       └── hooks/         # 自定义 hooks
└── start.sh
```

## API 端点

```
POST   /api/auth/register      # 注册
POST   /api/auth/login         # 登录
GET    /api/auth/me            # 当前用户

GET    /api/trades             # 交易列表
POST   /api/trades             # 新增交易
GET    /api/stats              # 统计数据

POST   /api/ai/chat            # AI 对话
POST   /api/ai/review          # AI 复盘
POST   /api/vision/analyze     # 图片分析

GET    /api/okx/candles        # 加密货币K线（自动切换 Gate.io）
GET    /api/index/candles      # 指数K线

POST   /api/import/okx         # 手动粘贴OKX持仓JSON
POST   /api/import/okx/fetch   # OKX API拉取持仓
POST   /api/import/okx/history # OKX API拉取历史

GET    /api/community/posts    # 社区帖子列表
POST   /api/community/posts    # 发帖/回复
POST   /api/community/posts/{id}/like  # 点赞

GET    /api/blog               # 博客列表
GET    /api/blog/{id}          # 文章详情
POST   /api/blog               # 发布文章
```
