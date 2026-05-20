from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TradeCreate(BaseModel):
    symbol: str           # BTC/USDT
    direction: str        # long / short
    leverage: int         # 杠杆倍数
    entry_price: float
    exit_price: Optional[float] = None
    amount: float         # 投入金额(USDT)
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    notes: Optional[str] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None
    emotion_level: Optional[int] = None  # 1-10, 开仓时情绪强度

class Trade(TradeCreate):
    id: int
    pnl: Optional[float] = None       # 盈亏金额
    pnl_percent: Optional[float] = None
    created_at: datetime

class ReviewRequest(BaseModel):
    period: str = "week"   # week / month / all

class AIQuestion(BaseModel):
    question: str
    context_trade_id: Optional[int] = None

class AIResponse(BaseModel):
    answer: str

class OkxConfigRequest(BaseModel):
    api_key: str
    api_secret: str
    api_passphrase: str

class OkxHistoryRequest(OkxConfigRequest):
    begin: str = ""   # ISO 时间，如 2025-01-01T00:00:00
    end: str = ""
    limit: int = 100

class DiagnoseResponse(BaseModel):
    patterns: str = ""
    briefing: str = ""
    questions: list[str] = []
    message: str = ""

class OkxImportRequest(BaseModel):
    positions: list[dict]
