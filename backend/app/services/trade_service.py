from typing import Optional
from datetime import datetime, timezone

from app.services.trade_store import trade_store
from app.services.pnl_calculator import pnl_calculator


class TradeService:
    def add(self, user_id: int, trade_data: dict) -> dict:
        trade_data["user_id"] = user_id
        trade_data["created_at"] = datetime.now(timezone.utc).isoformat()
        if trade_data.get("exit_price") and trade_data.get("entry_price"):
            result = pnl_calculator.calc_single(trade_data)
            trade_data["pnl"] = result["net_pnl"]
            trade_data["pnl_percent"] = result["roi_pct"]
            trade_data["total_fee"] = result["total_fee"]
        return trade_store.add(trade_data)

    def get_all(self, user_id: int) -> list[dict]:
        return trade_store.get_all(user_id)

    def get_by_id(self, user_id: int, trade_id: int) -> Optional[dict]:
        return trade_store.get_by_id(user_id, trade_id)

    def get_stats(self, user_id: int) -> dict:
        user_trades = trade_store.get_all(user_id)
        total = len(user_trades)
        if total == 0:
            return {
                "total": 0, "win_rate": 0, "total_pnl": 0, "avg_leverage": 0,
                "open_positions": 0, "avg_pnl": 0, "profit_factor": 0,
                "risk_reward_ratio": 0, "avg_hold_hours": 0,
                "total_profit": 0, "total_loss": 0,
                "equity_curve": [], "emotion_curve": [],
            }

        wins = [t for t in user_trades if (t.get("pnl") or 0) > 0]
        losses = [t for t in user_trades if (t.get("pnl") or 0) < 0]
        total_pnl = sum(t.get("pnl") or 0 for t in user_trades)
        avg_lev = sum(t.get("leverage", 0) for t in user_trades) / total

        # 未平仓
        open_positions = len([t for t in user_trades if not t.get("exit_price")])

        # 平均盈亏
        settled = [t for t in user_trades if t.get("pnl") is not None]
        avg_pnl = round(sum(t["pnl"] for t in settled) / len(settled), 2) if settled else 0

        # 盈亏因子：总盈利 / |总亏损|
        total_profit = sum(t.get("pnl") or 0 for t in wins)
        total_loss = abs(sum(t.get("pnl") or 0 for t in losses))
        profit_factor = round(total_profit / total_loss, 2) if total_loss > 0 else (round(total_profit, 2) if total_profit > 0 else 0)

        # 风险回报比（平均）
        rr_trades = [t for t in user_trades if t.get("entry_price") and t.get("take_profit") and t.get("stop_loss")]
        rr_values = []
        for t in rr_trades:
            reward = abs(t["take_profit"] - t["entry_price"])
            risk = abs(t["entry_price"] - t["stop_loss"])
            if risk > 0:
                rr_values.append(round(reward / risk, 2))
        risk_reward_ratio = round(sum(rr_values) / len(rr_values), 2) if rr_values else 0

        # 平均持仓时间（小时）
        closed_trades = [t for t in user_trades if t.get("closed_at") and t.get("opened_at")]
        hold_hours = []
        for t in closed_trades:
            try:
                opened = datetime.fromisoformat(t["opened_at"])
                closed = datetime.fromisoformat(t["closed_at"])
                hold_hours.append((closed - opened).total_seconds() / 3600)
            except (ValueError, KeyError):
                continue
        avg_hold_hours = round(sum(hold_hours) / len(hold_hours), 1) if hold_hours else 0

        # 盈亏曲线 + 本金曲线（按开仓时间正序）
        sorted_trades = sorted(user_trades, key=lambda t: t.get("opened_at", ""))
        cum_pnl = 0.0
        cum_invested = 0.0
        equity_curve = []
        for t in sorted_trades:
            cum_pnl += t.get("pnl") or 0
            cum_invested += t.get("amount") or 0
            try:
                ts = t.get("opened_at", "")
                if ts:
                    dt = datetime.fromisoformat(ts)
                    label = dt.strftime("%m/%d %H:%M")
                else:
                    label = ""
            except (ValueError, KeyError):
                label = ""
            equity_curve.append({
                "time": label,
                "value": round(cum_pnl, 2),
                "pnl": t.get("pnl") or 0,
                "principal": round(cum_invested, 2),
            })

        # 情绪曲线（按开仓时间正序）
        emotion_curve = []
        for t in sorted_trades:
            em = t.get("emotion_level")
            if em is not None:
                try:
                    ts = t.get("opened_at", "")
                    if ts:
                        dt = datetime.fromisoformat(ts)
                        label = dt.strftime("%m/%d %H:%M")
                    else:
                        label = ""
                except (ValueError, KeyError):
                    label = ""
                emotion_curve.append({
                    "time": label,
                    "value": em,
                })

        emotion_groups = {"low": [], "high": []}
        for t in user_trades:
            em = t.get("emotion_level", 5)
            if em and em <= 4:
                emotion_groups["low"].append(t)
            elif em and em >= 7:
                emotion_groups["high"].append(t)

        low_win = len([t for t in emotion_groups["low"] if (t.get("pnl") or 0) > 0])
        high_win = len([t for t in emotion_groups["high"] if (t.get("pnl") or 0) > 0])

        hour_groups = {}
        for t in user_trades:
            try:
                hour = datetime.fromisoformat(t["opened_at"]).hour
            except (ValueError, KeyError):
                continue
            hour_groups.setdefault(hour, []).append(t)

        worst_hour = None
        worst_pnl = 0
        for h, ts in hour_groups.items():
            pnl = sum(x.get("pnl") or 0 for x in ts)
            if pnl < worst_pnl:
                worst_pnl = pnl
                worst_hour = h

        return {
            "total": total,
            "wins": len(wins),
            "losses": len(losses),
            "win_rate": round(len(wins) / total * 100, 1),
            "total_pnl": round(total_pnl, 2),
            "avg_leverage": round(avg_lev, 1),
            "open_positions": open_positions,
            "avg_pnl": avg_pnl,
            "profit_factor": profit_factor,
            "risk_reward_ratio": risk_reward_ratio,
            "avg_hold_hours": avg_hold_hours,
            "total_profit": round(total_profit, 2),
            "total_loss": round(total_loss, 2),
            "equity_curve": equity_curve,
            "emotion_curve": emotion_curve,
            "emotion_low_win_rate": round(low_win / len(emotion_groups["low"]) * 100, 1) if emotion_groups["low"] else 0,
            "emotion_high_win_rate": round(high_win / len(emotion_groups["high"]) * 100, 1) if emotion_groups["high"] else 0,
            "worst_hour": worst_hour,
            "worst_pnl": round(worst_pnl, 2),
        }


trade_service = TradeService()
