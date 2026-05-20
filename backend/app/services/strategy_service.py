"""
策略回测引擎 — 不依赖 numpy/pandas，纯 Python 实现。
"""


def _parse_ohlcv(data):
    """Normalize OHLCV list to dict keys: time, open, high, low, close."""
    if not data:
        return []
    if isinstance(data[0], dict):
        return data
    # Assume list-of-lists: [time, open, high, low, close, volume?]
    keys = ["time", "open", "high", "low", "close"]
    result = []
    for row in data:
        candle = {}
        for i, k in enumerate(keys):
            candle[k] = row[i] if i < len(row) else None
        result.append(candle)
    return result


def _max_drawdown(equity_curve):
    """Calculate max drawdown percentage from equity curve."""
    if not equity_curve:
        return 0.0
    peak = equity_curve[0]["value"]
    max_dd = 0.0
    for point in equity_curve:
        v = point["value"]
        if v > peak:
            peak = v
        dd = (peak - v) / peak if peak > 0 else 0
        if dd > max_dd:
            max_dd = dd
    return round(max_dd * 100, 2)


def _roi(final_value, total_invested):
    if total_invested <= 0:
        return 0.0
    return round((final_value - total_invested) / total_invested * 100, 2)


def _win_rate(trades):
    if not trades:
        return 0.0
    wins = sum(1 for t in trades if (t.get("pnl") or 0) > 0)
    return round(wins / len(trades), 2)


def run_dca(ohlcv, params):
    """
    定投策略 (Dollar Cost Averaging)
    params:
      - amount: 每次定投金额 (USDT)
      - interval: 定投间隔 (K线根数), 默认 1
      - direction: "long" / "short"
    """
    candles = _parse_ohlcv(ohlcv)
    if not candles:
        return _empty_result("dca", params)

    amount = float(params.get("amount", 100))
    interval = max(1, int(params.get("interval", 1)))
    direction = params.get("direction", "long")

    total_invested = 0.0
    position = 0.0       # 持仓数量
    cash_spent = 0.0     # 已花费现金
    trades = []
    equity_curve = []

    for i, candle in enumerate(candles):
        close = float(candle.get("close", 0))
        if close <= 0:
            continue

        # 定投买入
        if i % interval == 0:
            qty = amount / close
            position += qty
            cash_spent += amount
            total_invested += amount
            trades.append({
                "time": str(candle.get("time", "")),
                "action": "buy",
                "price": round(close, 6),
                "amount": round(amount, 2),
                "qty": round(qty, 6),
            })

        # 当前持仓价值
        if direction == "short":
            # 做空简化：value = 现金 + 做空市值计算
            entry_avg = cash_spent / position if position > 0 else 0
            pos_value = position * (entry_avg + (entry_avg - close))
        else:
            pos_value = position * close

        equity_curve.append({
            "time": str(candle.get("time", "")),
            "value": round(pos_value, 2),
            "principal": round(total_invested, 2),
        })

    # 最终在最后一根K线平仓
    final_price = float(candles[-1].get("close", 0))
    final_value = round(position * final_price, 2)
    total_pnl = round(final_value - total_invested, 2)

    return {
        "strategy": "dca",
        "params": {"amount": amount, "interval": interval, "direction": direction},
        "total_invested": round(total_invested, 2),
        "final_value": final_value,
        "total_pnl": total_pnl,
        "roi_pct": _roi(final_value, total_invested),
        "max_drawdown_pct": _max_drawdown(equity_curve),
        "trade_count": len(trades),
        "win_rate": 0.0,  # DCA 不打单笔胜率
        "equity_curve": equity_curve,
        "trades": trades,
    }


def run_martin(ohlcv, params):
    """
    马丁格尔策略 (Martingale)
    params:
      - base_amount: 基础仓位 (USDT)
      - max_rounds: 最大翻倍次数 (默认 5)
      - take_profit_pct: 止盈百分比 (默认 5)
      - loss_pct: 止损百分比 (默认 5)
      - direction: "long" / "short"

    逻辑（做多）：
      - 以 base_amount 在 close 价开仓
      - 如果价格跌 loss_pct%，止损平仓，下一仓翻倍
      - 如果价格涨 take_profit_pct%，止盈平仓，仓位重置为 base_amount
      - 连续亏损 max_rounds 次后强制重置为 base_amount
      - 平仓后立刻在下一根K线以 close 价重新开仓
    """
    candles = _parse_ohlcv(ohlcv)
    if not candles:
        return _empty_result("martin", params)

    base_amount = float(params.get("base_amount", 100))
    max_rounds = min(int(params.get("max_rounds", 5)), 10)
    take_profit_pct = float(params.get("take_profit_pct", 5)) / 100.0
    loss_pct = float(params.get("loss_pct", 5)) / 100.0
    direction = params.get("direction", "long")

    total_invested = 0.0
    cash = 0.0              # 平仓后的现金余额（初始为 base_amount 的可用资金）
    position = 0.0          # 当前持仓数量
    entry_price = 0.0       # 当前持仓入场价
    current_amount = base_amount
    consecutive_losses = 0
    in_position = False

    trades = []
    equity_curve = []

    # 初始资金 = base_amount（简化：假设账户最少有 base_amount 资金）
    # 实际盈亏 accumulate 到 cash
    cash = 0.0
    initial_capital = base_amount  # 用于 equity curve 基准

    for i, candle in enumerate(candles):
        close = float(candle.get("close", 0))
        high = float(candle.get("high", close))
        low = float(candle.get("low", close))
        if close <= 0:
            continue

        if not in_position:
            # 开仓
            entry_price = close
            position = current_amount / entry_price
            total_invested += current_amount
            in_position = True
            trades.append({
                "time": str(candle.get("time", "")),
                "action": "open",
                "price": round(close, 6),
                "amount": round(current_amount, 2),
                "round": consecutive_losses + 1,
            })
        else:
            # 检查止损/止盈
            hit_tp = False
            hit_sl = False

            if direction == "long":
                if high >= entry_price * (1 + take_profit_pct):
                    hit_tp = True
                    exit_px = entry_price * (1 + take_profit_pct)
                elif low <= entry_price * (1 - loss_pct):
                    hit_sl = True
                    exit_px = entry_price * (1 - loss_pct)
            else:
                if low <= entry_price * (1 - take_profit_pct):
                    hit_tp = True
                    exit_px = entry_price * (1 - take_profit_pct)
                elif high >= entry_price * (1 + loss_pct):
                    hit_sl = True
                    exit_px = entry_price * (1 + loss_pct)

            if hit_tp or hit_sl:
                # 计算盈亏
                if direction == "long":
                    pnl = (exit_px - entry_price) * position
                else:
                    pnl = (entry_price - exit_px) * position

                cash += pnl
                last_trade = trades[-1]
                last_trade["exit_price"] = round(exit_px, 6)
                last_trade["exit_time"] = str(candle.get("time", ""))
                last_trade["pnl"] = round(pnl, 2)

                in_position = False
                position = 0

                if hit_tp:
                    consecutive_losses = 0
                    current_amount = base_amount
                else:
                    consecutive_losses += 1
                    if consecutive_losses >= max_rounds:
                        consecutive_losses = 0
                        current_amount = base_amount
                    else:
                        current_amount = min(current_amount * 2, base_amount * (2 ** max_rounds))

                # 平仓后立即在下一个循环开新仓（不 break，下一个 i 会开仓）

        # 计算当前权益
        if in_position:
            if direction == "long":
                holding_value = position * close
            else:
                holding_value = position * (entry_price + (entry_price - close))
        else:
            holding_value = 0

        equity = initial_capital + cash + holding_value
        equity_curve.append({
            "time": str(candle.get("time", "")),
            "value": round(equity, 2),
        })

    # 如果最后还在持仓，按最后价格平仓
    if in_position:
        final_price = float(candles[-1].get("close", 0))
        if direction == "long":
            final_pnl = (final_price - entry_price) * position
        else:
            final_pnl = (entry_price - final_price) * position
        cash += final_pnl
        last_trade = trades[-1]
        last_trade["exit_price"] = round(final_price, 6)
        last_trade["exit_time"] = str(candles[-1].get("time", ""))
        last_trade["pnl"] = round(final_pnl, 2)
        position = 0

    final_value = round(initial_capital + cash, 2)
    total_pnl = round(cash, 2)

    return {
        "strategy": "martin",
        "params": {
            "base_amount": base_amount,
            "max_rounds": max_rounds,
            "take_profit_pct": round(take_profit_pct * 100, 1),
            "loss_pct": round(loss_pct * 100, 1),
            "direction": direction,
        },
        "total_invested": round(total_invested, 2),
        "final_value": final_value,
        "total_pnl": total_pnl,
        "roi_pct": _roi(final_value, total_invested) if total_invested > 0 else _roi(final_value, initial_capital),
        "max_drawdown_pct": _max_drawdown(equity_curve),
        "trade_count": len(trades),
        "win_rate": _win_rate(trades),
        "equity_curve": equity_curve,
        "trades": trades,
    }


def _empty_result(strategy, params):
    return {
        "strategy": strategy,
        "params": params,
        "total_invested": 0,
        "final_value": 0,
        "total_pnl": 0,
        "roi_pct": 0.0,
        "max_drawdown_pct": 0.0,
        "trade_count": 0,
        "win_rate": 0.0,
        "equity_curve": [],
        "trades": [],
    }


STRATEGIES = {
    "dca": run_dca,
    "martin": run_martin,
}
