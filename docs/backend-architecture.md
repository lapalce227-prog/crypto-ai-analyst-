# Laplace Market 后端架构总览

## 1. 入口与应用工厂

### `main.py` — FastAPI 应用工厂

```
app = FastAPI(title="Laplace Market", version="0.4.0")
```

**生命周期事件：**
- `startup`：预创建 LangGraph Agent 图、启动后台告警轮询（每 60s）
- `shutdown`：停止后台告警任务

**中间件：**
- `CORSMiddleware` — 允许所有来源跨域请求

**路由注册：**
- `/api/auth/*` — 认证路由（注册、登录、获取用户）
- `/api/*` — 业务 API 路由（交易、AI、行情、社区等）

**全局异常处理：** 任何未捕获异常统一返回 500 + "服务器内部错误"

---

## 2. 配置系统

### `core/config.py` — pydantic-settings

```python
class Settings(BaseSettings):
    # 三个 LLM 后端
    deepseek_api_key / deepseek_base_url     # DeepSeek (文本)
    dash_api_key / dash_model                # 千问 via DashScope (Agent 文本)
    openai_api_key / openai_model            # OpenAI (备用)

    # Vision
    vision_api_key / vision_base_url / vision_model  # 图片识别 (GPT-4o)

    # 交易所
    okx_api_key / okx_api_secret / okx_api_passphrase  # OKX API

    # JWT
    secret_key / algorithm / access_token_expire_hours

    # 新闻
    cryptopanic_token
```

自动从 `.env` 文件加载，所有敏感信息不硬编码。

---

## 3. 数据库

### `core/database.py` — SQLite + WAL 模式

单例连接，WAL 模式保证读写并发安全。

**表结构：**
- `users` — id, username, hashed_password, created_at
- `trades` — id, user_id, symbol, direction, leverage, entry_price, exit_price, amount, stop_loss, take_profit, pnl, emotion_level 等
- `alerts` (在 alert_service 中管理) — 价格预警
- `agent_history` (在 agent_history_service 中管理) — Agent 对话历史

设计特点：自动迁移（检测缺列时 `ALTER TABLE ADD COLUMN`）。

---

## 4. 认证体系

### `api/auth.py` — 三个端点

| 端点 | 功能 |
|------|------|
| `POST /api/auth/register` | 注册 → 自动返回 JWT token |
| `POST /api/auth/login` | 登录 → 返回 JWT token |
| `GET /api/auth/me` | 获取当前用户信息（需 Bearer Token） |

### `services/auth_service.py` — JWT + bcrypt

- 密码：`bcrypt` 哈希（单向不可逆）
- Token：`PyJWT` 签发，payload 含 `sub`（用户ID）、`username`、`exp`（过期时间）、`iat`（签发时间）
- `get_current_user`：FastAPI 依赖注入，从 `Authorization: Bearer <token>` 头解析用户身份，token 无效/过期返回 401

**依赖注入链：**
```
请求 → Depends(get_current_user) → 解析 JWT → 查数据库 → 注入 user dict
```

---

## 5. 数据模型 (Pydantic)

### `models/user.py`
- `UserCreate` — 注册表单（含 validator：用户名 3-32 位字母数字、密码 ≥ 6 位）
- `UserLogin` — 登录表单
- `TokenResponse` — `{access_token, token_type, user}`

### `models/trade.py`
- `TradeCreate` — 交易录入表单（symbol、direction、leverage、entry/exit、emotion_level 1-10）
- `AIQuestion` / `AIResponse` — AI 对话请求/响应
- `DiagnoseResponse` — 行为诊断结果 `{patterns, briefing, questions}`
- `OkxConfigRequest` / `OkxHistoryRequest` — OKX API 配置

---

## 6. 路由层 (`api/routes.py`)

### 6.1 交易记录 CRUD
| 端点 | 功能 |
|------|------|
| `POST /api/trades` | 创建交易 → 自动计算 PnL → 触发 AI 点评 |
| `GET /api/trades` | 列出当前用户所有交易 |
| `GET /api/trades/{id}` | 获取单笔交易 |

### 6.2 AI 对话（旧版，非 Agent）
| 端点 | 功能 |
|------|------|
| `POST /api/ai/chat` | 文本对话（DeepSeek） |
| `POST /api/ai/review` | 复盘报告生成 |
| `POST /api/ai/diagnose` | 交易行为诊断（≤3 笔拒绝） |

### 6.3 Agent 对话（新版，LangGraph）
| 端点 | 功能 |
|------|------|
| `POST /api/ai/agent/chat` | Agent 对话，非流式 |
| `POST /api/ai/agent/chat/stream` | Agent 对话，**SSE 流式** — 实时推送 text / tool_start / tool_end 事件 |

### 6.4 Agent 对话历史
| 端点 | 功能 |
|------|------|
| `GET /api/ai/agent/history` | 历史列表 |
| `GET /api/ai/agent/history/{id}` | 加载历史 |
| `POST /api/ai/agent/history` | 保存当前对话 |
| `DELETE /api/ai/agent/history/{id}` | 删除历史 |

### 6.5 告警中心
| 端点 | 功能 |
|------|------|
| `GET /api/alerts` | 告警列表 |
| `POST /api/alerts` | 创建价格告警 `{symbol, condition: above/below, target_price}` |
| `DELETE /api/alerts/{id}` | 取消告警 |

### 6.6 OKX 数据导入
| 端点 | 功能 |
|------|------|
| `POST /api/import/okx` | 手动粘贴持仓 JSON |
| `POST /api/import/okx/fetch` | API 自动拉取当前持仓 |
| `POST /api/import/okx/history` | API 拉取历史平仓 |
| `POST /api/import/okx/config` | 保存 OKX API 配置 |

### 6.7 行情代理
| 端点 | 功能 |
|------|------|
| `GET /api/okx/candles` | K线数据代理（Gate.io 优先 → OKX 兜底） |
| `GET /api/index/candles` | 美股指数K线（腾讯财经） / A股K线（新浪） |

### 6.8 图片识别
| 端点 | 功能 |
|------|------|
| `POST /api/vision/analyze` | 独立图片分析（GPT-4o） |

### 6.9 其他
| 端点 | 功能 |
|------|------|
| `GET /api/stats` | 交易统计概览 |
| `POST /api/pnl/batch` | 批量 PnL 计算 |
| `GET /api/pnl/analyze` | 已平仓交易分析 |
| `POST /api/strategy/backtest` | 策略回测（DCA 等） |
| `GET /api/community/posts` | 社区帖子列表 |
| `GET /api/blog` | 博客文章 |
| `GET /api/news` | 加密新闻 RSS 聚合（CoinDesk/CoinTelegraph/Decrypt） |

---

## 7. 核心服务层

### 7.1 LangGraph Agent（`services/agent_graph.py`）

**架构：双向图 `chat` ⇄ `tools`**

```
用户消息
  → chat_node (SystemPrompt + 预处理图片)
    → 千问 qwen-plus 决策：回复 or 调工具
    → 有 tool_calls? → tools_node → chat_node (循环)
    → 无 tool_calls? → END → 返回响应
```

**chat_node 核心逻辑：**
1. 格式化消息历史，注入 SystemPrompt
2. **图片预处理**：检测消息中的 `image_url` → 调用千问 VL (`qwen-vl-plus`) 识别 → 替换为文字描述
3. 调用 LLM（`qwen-plus` + 绑定工具列表）
4. 判断是否有 tool_calls，决定下一跳

**tools_node：** 并发执行多个工具调用 → 结果返回 → 跳回 chat_node

**流式输出：** `astream_events` 捕获 `on_chat_model_stream`（逐 token）、`on_tool_start`、`on_tool_end` 事件

**关键概念：**
- `StateGraph` — LangGraph 的状态图，节点间通过 `Command(goto=...)` 决定跳转
- `add_messages` — 消息归并器，新消息追加而非覆盖
- `RetryPolicy` — tools_node 配置了最多 2 次重试
- `thread_id` — 对话会话隔离（同一用户不同 tab 用不同 session_id）

### 7.2 Agent 工具集（`services/agent_tools.py`）

每个工具用 `@tool` 装饰器声明，LLM 根据描述自动决定何时调用：

| 工具 | 数据源 | 功能 |
|------|--------|------|
| `get_kline` | Gate.io → OKX | K线数据（OHLCV），支持 1m/5m/15m/1H/4H/1D |
| `get_funding_rate` | OKX | 资金费率 + 多空情绪 |
| `get_user_trades` | SQLite | 用户交易统计（胜率、PnL、情绪分析） |
| `get_coin_info` | CoinGecko → OKX | 币种基本面（市值、流通量、ATH） |
| `analyze_image` | 千问 VL | 图片识别（K线截图、持仓截图等） |

### 7.3 AI 服务（`services/ai_service.py`）

旧版 AI（非 Agent），直接调用 DeepSeek API：
- `chat()` — 文本对话
- `analyze_trade()` — 单笔交易点评
- `diagnose()` — 交易行为诊断（输出 patterns / briefing / questions 三段式）
- `review_report()` — 复盘报告

### 7.4 图片识别（`services/vision_service.py`）

独立 Vision API（GPT-4o），分析图表截图。现已被 Agent 的 `analyze_image` 工具取代。

### 7.5 交易服务 + 盈亏计算（`services/trade_service.py` + `pnl_calculator.py`）

- `TradeService.add()` — 创建交易时自动计算 PnL（手续费 0.05%）
- `TradeService.get_stats()` — 完整统计：胜率、盈亏因子、风险回报比、平均持仓时间、权益曲线、情绪曲线、最差时段

### 7.6 告警服务（`services/alert_service.py`）

后台 `asyncio.Task`，每 60s：
1. 查询所有未触发告警
2. 批量获取 OKX 行情
3. 判断价格是否触及阈值
4. 标记已触发

### 7.7 OKX 服务（`services/okx_service.py`）

- HMAC-SHA256 签名认证
- `fetch_positions()` — 拉取当前持仓
- `fetch_positions_history()` — 拉取历史平仓（含合约面值映射）

### 7.8 数据持久层（`trade_store.py` / `user_store.py`）

SQLite CRUD 封装，`user_store` 用 `app.db`，`trade_store` 也操作同一库。

---

## 8. 整体架构图

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (React)                    │
│  AgentChat.jsx → SSE stream ← tool_start/tool_end/text │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP/SSE
┌──────────────────────▼───────────────────────────────┐
│                  FastAPI (main.py)                     │
│  ┌──────────┐  ┌─────────────────────────────────┐    │
│  │ /api/auth│  │           /api/*                 │    │
│  │ JWT认证   │  │  trades / ai / agent / alerts   │    │
│  │ bcrypt   │  │  okx / vision / news / pnl      │    │
│  └──────────┘  └──────────┬──────────────────────┘    │
│                           │                            │
│  ┌────────────────────────▼───────────────────────┐    │
│  │            Services Layer                       │    │
│  │  ┌──────────────┐  ┌──────────────────┐        │    │
│  │  │ AgentGraph    │  │ TradeService     │        │    │
│  │  │ chat⇄tools    │  │ + PnLCalculator  │        │    │
│  │  │ qwen-plus     │  └──────────────────┘        │    │
│  │  │ astream_events│                              │    │
│  │  └──────┬───────┘  ┌──────────────────┐        │    │
│  │         │          │ AlertService     │        │    │
│  │  ┌──────▼───────┐  │ (background task)│        │    │
│  │  │ Agent Tools   │  └──────────────────┘        │    │
│  │  │ get_kline     │                              │    │
│  │  │ get_funding   │  ┌──────────────────┐        │    │
│  │  │ get_trades    │  │ OkxService       │        │    │
│  │  │ get_coin_info │  │ HMAC-SHA256      │        │    │
│  │  │ analyze_image │  └──────────────────┘        │    │
│  │  └──────────────┘                               │    │
│  └─────────────────────────────────────────────────┘    │
│                           │                            │
│  ┌────────────────────────▼───────────────────────┐    │
│  │            Data Layer                           │    │
│  │  SQLite (WAL) + app.db + trades.db              │    │
│  │  users / trades / alerts / agent_history        │    │
│  └─────────────────────────────────────────────────┘    │
│                           │                            │
│  ┌────────────────────────▼───────────────────────┐    │
│  │          External APIs                          │    │
│  │  千问 DashScope │ Gate.io │ OKX │ CoinGecko     │    │
│  │  腾讯财经 / 新浪 │ RSS Feeds                    │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

---

## 9. 关键概念速查

| 概念 | 说明 |
|------|------|
| **LangGraph StateGraph** | 有状态的多节点工作流，chat_node ↔ tools_node 循环直到 LLM 决定不调工具 |
| **Function Calling / Tool Use** | LLM 根据用户问题，自动选择调用哪个工具获取数据，而非人工预设流程 |
| **SSE (Server-Sent Events)** | HTTP 长连接流式推送，前端逐字显示 AI 回复 + 实时展示工具调用状态 |
| **JWT + bcrypt** | 无状态认证：登录后拿 token，每次请求带 `Authorization: Bearer` 头 |
| **Dependency Injection** | FastAPI 的 `Depends(get_current_user)` 自动从 token 解析用户身份注入路由 |
| **WAL 模式** | SQLite Write-Ahead Logging，允许并发读写不阻塞 |
| **自动迁移** | 启动时检测缺列，`ALTER TABLE ADD COLUMN`，不需手动 migration |
| **后台任务** | `asyncio.create_task` 运行告警轮询，不阻塞 HTTP 请求处理 |
| **多数据源容错** | K线先试 Gate.io（国内可达），失败再试 OKX |
| **图片预处理** | 用户发图片 → chat_node 先调千问 VL 识别 → 文字结果注入 → 文本 LLM 处理 |
