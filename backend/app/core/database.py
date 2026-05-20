import sqlite3
import os
from datetime import datetime, timezone

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_PATH = os.path.join(DATA_DIR, "app.db")

_conn_pool = None


def get_db() -> sqlite3.Connection:
    """获取数据库连接（单例，线程安全靠 SQLite WAL 模式）"""
    global _conn_pool
    if _conn_pool is None:
        os.makedirs(DATA_DIR, exist_ok=True)
        _conn_pool = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn_pool.row_factory = sqlite3.Row
        _conn_pool.execute("PRAGMA journal_mode=WAL")
        _conn_pool.execute("PRAGMA foreign_keys=ON")
        _init_db(_conn_pool)
    return _conn_pool


def _init_db(conn: sqlite3.Connection):
    """建表 + 自动迁移"""
    # 用户表
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    # 交易表
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            symbol TEXT NOT NULL,
            direction TEXT NOT NULL,
            leverage INTEGER NOT NULL,
            entry_price REAL NOT NULL,
            exit_price REAL,
            amount REAL NOT NULL,
            stop_loss REAL,
            take_profit REAL,
            notes TEXT,
            opened_at TEXT NOT NULL,
            closed_at TEXT,
            emotion_level INTEGER,
            pnl REAL,
            pnl_percent REAL,
            total_fee REAL,
            created_at TEXT NOT NULL
        )
    """)

    # 索引
    conn.execute("CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")

    # 迁移：补列
    cols = [r[1] for r in conn.execute("PRAGMA table_info(trades)").fetchall()]
    if "total_fee" not in cols:
        conn.execute("ALTER TABLE trades ADD COLUMN total_fee REAL")

    conn.commit()
