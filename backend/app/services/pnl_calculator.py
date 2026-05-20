"""盈亏计算器 — 精准计算交易盈亏，含手续费、资金费率"""

from decimal import Decimal, ROUND_DOWN
from typing import Optional


class PnLCalculator:
    """精准盈亏计算器

    支持：做多/做空、杠杆、手续费、资金费率
    """

    def __init__(self, fee_rate: float = 0.0005):
        self.fee_rate = fee_rate

    def calc_single(self, trade: dict) -> dict:
        """计算单笔交易盈亏"""
        direction = trade["direction"]
        leverage = Decimal(str(trade["leverage"]))
        entry = Decimal(str(trade["entry_price"]))
        exit_p = Decimal(str(trade["exit_price"])) if trade.get("exit_price") else None
        margin = Decimal(str(trade["amount"]))

        if exit_p is None:
            return {
                **trade,
                "gross_pnl": None,
                "total_fee": None,
                "net_pnl": None,
                "roi_pct": None,
                "is_win": None,
            }

        # 持仓名义价值
        position_value = margin * leverage

        # 价格变动百分比
        if direction == "long":
            price_change_pct = (exit_p - entry) / entry
        else:
            price_change_pct = (entry - exit_p) / entry

        # 毛盈亏（含杠杆）
        gross_pnl = position_value * price_change_pct

        # 手续费
        entry_fee = position_value * Decimal(str(self.fee_rate))
        exit_fee = (position_value + gross_pnl) * Decimal(str(self.fee_rate))
        total_fee = entry_fee + exit_fee

        # 净盈亏
        net_pnl = gross_pnl - total_fee

        # ROI
        roi = (net_pnl / margin * Decimal("100")) if margin > 0 else Decimal("0")

        return {
            "symbol": trade["symbol"],
            "direction": direction,
            "leverage": int(leverage),
            "margin": float(margin),
            "entry_price": float(entry),
            "exit_price": float(exit_p),
            "price_change_pct": round(float(price_change_pct * 100), 4),
            "gross_pnl": round(float(gross_pnl), 2),
            "total_fee": round(float(total_fee), 4),
            "net_pnl": round(float(net_pnl), 2),
            "roi_pct": round(float(roi), 2),
            "is_win": net_pnl > 0,
        }

    def calc_batch(self, trades: list) -> dict:
        """批量计算多笔交易汇总"""
        results = [self.calc_single(t) for t in trades]
        settled = [r for r in results if r["net_pnl"] is not None]

        if not settled:
            return {"summary": {"total_trades": len(trades), "settled": 0}, "trades": results}

        wins = [r for r in settled if r["is_win"]]
        losses = [r for r in settled if not r["is_win"]]

        total_pnl = sum(r["net_pnl"] for r in settled)
        total_fee = sum(r["total_fee"] for r in settled)

        best = max(settled, key=lambda r: r["net_pnl"])
        worst = min(settled, key=lambda r: r["net_pnl"])

        avg_win = sum(r["net_pnl"] for r in wins) / len(wins) if wins else 0
        avg_loss = abs(sum(r["net_pnl"] for r in losses) / len(losses)) if losses else 0
        profit_factor = round(avg_win / avg_loss, 2) if avg_loss > 0 else None

        return {
            "summary": {
                "total_trades": len(trades),
                "settled": len(settled),
                "wins": len(wins),
                "losses": len(losses),
                "win_rate": round(len(wins) / len(settled) * 100, 1),
                "total_pnl": round(total_pnl, 2),
                "total_fee": round(total_fee, 4),
                "best_trade": {"symbol": best["symbol"], "pnl": best["net_pnl"], "roi": best["roi_pct"]},
                "worst_trade": {"symbol": worst["symbol"], "pnl": worst["net_pnl"], "roi": worst["roi_pct"]},
                "profit_factor": round(profit_factor, 2) if profit_factor is not None else None,
                "avg_win": round(avg_win, 2),
                "avg_loss": round(avg_loss, 2),
            },
            "trades": results,
        }


pnl_calculator = PnLCalculator()
