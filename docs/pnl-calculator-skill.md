---
name: pnl-calculator
description: Accurately calculate trading profit/loss from JSON trade data. Handles long/short positions, leverage, fees, partial closes, and funding rates. Use when user needs P&L analysis from trade history.
---

# P&L Calculator Skill

Accurately calculate profit and loss from cryptocurrency trading data in JSON format.

## When to use
- User provides trade JSON and needs P&L calculation
- User asks about "盈亏计算", "收益计算", "亏损分析"
- User needs to verify exchange P&L against their own calculation
- OKX/Binance/Bybit trade history analysis

## Core P&L Function (Python)

```python
import json
from typing import Optional
from decimal import Decimal, ROUND_DOWN

class PnLCalculator:
    """精准盈亏计算器
    
    支持：
    - 做多/做空
    - 杠杆
    - 手续费（maker/taker）
    - 资金费率
    - 部分止盈止损
    """

    def __init__(self, fee_rate: float = 0.0005, funding_rate: float = 0.0):
        """
        fee_rate: 手续费率，默认 0.05% (taker)
        funding_rate: 资金费率，只在持仓期间收取
        """
        self.fee_rate = fee_rate
        self.funding_rate = funding_rate

    def calc_single(self, trade: dict) -> dict:
        """计算单笔交易盈亏
        
        输入 JSON 格式：
        {
            "symbol": "BTC/USDT",
            "direction": "long",       // long | short
            "leverage": 10,            // 杠杆倍数
            "entry_price": 43100.5,    // 开仓均价
            "exit_price": 43500.0,     // 平仓均价
            "amount": 100.0,           // 保证金 (USDT)
            "entry_fee": 0.5,          // 开仓手续费 (可选，默认按费率算)
            "exit_fee": 0.5,           // 平仓手续费 (可选)
            "funding_paid": 0.0,       // 已付资金费率 (可选)
            "stop_loss": 42000.0,      // 止损价 (可选)
            "take_profit": 45000.0,    // 止盈价 (可选)
            "close_pct": 100           // 平仓比例%，默认 100
        }
        """
        direction = trade["direction"]
        leverage = trade["leverage"]
        entry = Decimal(str(trade["entry_price"]))
        exit_p = Decimal(str(trade["exit_price"]))
        margin = Decimal(str(trade["amount"]))
        close_pct = Decimal(str(trade.get("close_pct", 100))) / Decimal("100")

        # 实际投入保证金
        actual_margin = margin * close_pct

        # 持仓名义价值
        position_value = actual_margin * Decimal(str(leverage))

        # 价格变动百分比
        if direction == "long":
            price_change_pct = (exit_p - entry) / entry
        else:
            price_change_pct = (entry - exit_p) / entry

        # 毛盈亏（含杠杆）
        gross_pnl = position_value * price_change_pct

        # 手续费
        entry_fee = Decimal(str(trade.get("entry_fee", 0)))
        exit_fee = Decimal(str(trade.get("exit_fee", 0)))
        if entry_fee == 0 and exit_fee == 0:
            # 按费率自动计算
            entry_fee = position_value * Decimal(str(self.fee_rate))
            exit_fee = (position_value + gross_pnl) * Decimal(str(self.fee_rate))
        total_fee = entry_fee + exit_fee

        # 资金费率
        funding = Decimal(str(trade.get("funding_paid", 0)))

        # 净盈亏
        net_pnl = gross_pnl - total_fee - funding

        # ROI
        roi = (net_pnl / actual_margin * Decimal("100")) if actual_margin > 0 else Decimal("0")

        return {
            "symbol": trade["symbol"],
            "direction": direction,
            "leverage": leverage,
            "margin": float(actual_margin),
            "entry_price": float(entry),
            "exit_price": float(exit_p),
            "price_change_pct": float(round(price_change_pct * 100, 4)),
            "gross_pnl": float(round(gross_pnl, 2)),
            "total_fee": float(round(total_fee, 4)),
            "funding_paid": float(funding),
            "net_pnl": float(round(net_pnl, 2)),
            "roi_pct": float(round(roi, 2)),
            "is_win": net_pnl > 0,
        }

    def calc_batch(self, trades: list) -> dict:
        """批量计算多笔交易汇总"""
        results = [self.calc_single(t) for t in trades]
        
        total_trades = len(results)
        wins = [r for r in results if r["is_win"]]
        losses = [r for r in results if not r["is_win"]]
        
        total_pnl = sum(r["net_pnl"] for r in results)
        total_fee = sum(r["total_fee"] for r in results)
        total_funding = sum(r["funding_paid"] for r in results)
        
        # 最大单笔盈利 / 最大单笔亏损
        best = max(results, key=lambda r: r["net_pnl"])
        worst = min(results, key=lambda r: r["net_pnl"])
        
        # 盈亏比
        avg_win = sum(r["net_pnl"] for r in wins) / len(wins) if wins else 0
        avg_loss = abs(sum(r["net_pnl"] for r in losses) / len(losses)) if losses else 0
        profit_factor = avg_win / avg_loss if avg_loss > 0 else float('inf')
        
        return {
            "summary": {
                "total_trades": total_trades,
                "wins": len(wins),
                "losses": len(losses),
                "win_rate": round(len(wins) / total_trades * 100, 1),
                "total_pnl": round(total_pnl, 2),
                "total_fee": round(total_fee, 4),
                "total_funding": round(total_funding, 4),
                "net_after_costs": round(total_pnl - total_fee - total_funding, 2),
                "best_trade": {"symbol": best["symbol"], "pnl": best["net_pnl"], "roi": best["roi_pct"]},
                "worst_trade": {"symbol": worst["symbol"], "pnl": worst["net_pnl"], "roi": worst["roi_pct"]},
                "profit_factor": round(profit_factor, 2),
                "avg_win": round(avg_win, 2),
                "avg_loss": round(avg_loss, 2),
            },
            "trades": results
        }


# ===== 使用示例 =====
if __name__ == "__main__":
    calc = PnLCalculator(fee_rate=0.0005)

    trades = [
        {
            "symbol": "BTC/USDT", "direction": "long", "leverage": 10,
            "entry_price": 43100.5, "exit_price": 43500.0, "amount": 100.0,
        },
        {
            "symbol": "ETH/USDT", "direction": "short", "leverage": 20,
            "entry_price": 3200.0, "exit_price": 3150.0, "amount": 50.0,
        },
        {
            "symbol": "SOL/USDT", "direction": "long", "leverage": 50,
            "entry_price": 145.0, "exit_price": 138.0, "amount": 30.0,
        },
    ]

    result = calc.calc_batch(trades)
    print(json.dumps(result, indent=2, ensure_ascii=False))
```

## Excel/CSV 批量导入模式

如果用户提供的是 CSV 或 Excel，先转换为 JSON：

```python
import csv
def csv_to_trades(csv_path):
    trades = []
    with open(csv_path, 'r') as f:
        for row in csv.DictReader(f):
            trades.append({
                "symbol": row["symbol"],
                "direction": row["direction"],
                "leverage": int(row["leverage"]),
                "entry_price": float(row["entry_price"]),
                "exit_price": float(row["exit_price"]),
                "amount": float(row["amount"]),
            })
    return trades
```

## 支持的费用类型

| 费用 | 默认值 | 说明 |
|------|--------|------|
| 开仓手续费 | 保证金 × 杠杆 × 0.05% | Taker 费率 |
| 平仓手续费 | 平仓价值 × 0.05% | Taker 费率 |
| 资金费率 | 0 | 每 8 小时结算一次 |
| 滑点 | 未计算 | 实际成交价与预期的偏差 |

## 输出字段说明

| 字段 | 含义 |
|------|------|
| `gross_pnl` | 毛盈亏（未扣费用） |
| `total_fee` | 总手续费 |
| `net_pnl` | 净盈亏（实际到手） |
| `roi_pct` | 回报率（相对保证金） |
| `profit_factor` | 盈亏比（总盈利/总亏损） |
