"""
activity_log.py - Logger tunggal untuk agent_activity.log (spek poin 6).

File kecil terpisah (bukan bagian dari file manapun di spek asli) supaya
watcher.py, wa_notify.py, wa_webhook.py, dan main.py semua bisa mencatat ke
file log yang sama tanpa saling import melingkar (circular import) satu
sama lain.
"""
import logging

import config

_logger = logging.getLogger("ops_agent_activity")
_logger.setLevel(logging.INFO)

if not _logger.handlers:
    handler = logging.FileHandler(config.ACTIVITY_LOG_PATH, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    _logger.addHandler(handler)


def log_activity(message: str, level: str = "info"):
    getattr(_logger, level, _logger.info)(message)
