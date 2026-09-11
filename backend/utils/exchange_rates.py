"""
Exchange rate fetching and lookup for SMITH's multi-currency support
(uang muka pelanggan in IDR/CNY/USD, purchasing in foreign currency, etc).

Source: ExchangeRate-API open-access endpoint, no key required.
https://www.exchangerate-api.com/docs/free
"""
import requests
from datetime import datetime

EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD'

# Currencies SMITH actually deals in, per the 2026-08-14 decision to support
# IDR/CNY/USD for uang muka pelanggan and general purchasing.
TRACKED_CURRENCIES = ['IDR', 'CNY']


def fetch_exchange_rates():
    """
    Fetch current USD-based exchange rates and store them as USD_<CCY> pairs
    in the exchange_rates table (one new row per currency per fetch - this
    is an append-only rate history, not an upsert, so get_current_rate()
    always looks at the most recent row).

    On any failure (network, bad response, etc), logs the error and returns
    without raising - callers (the cron endpoint) should treat this as
    "best effort, keep the stale cache" rather than a hard failure, since a
    missed daily refresh shouldn't break anything that reads rates.

    Returns the number of rates successfully stored (0 on total failure).
    """
    from models import db
    from models.finance import ExchangeRate

    try:
        response = requests.get(EXCHANGE_RATE_API_URL, timeout=10)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"[exchange_rates] Failed to fetch rates: {e}")
        return 0

    rates = data.get('rates', {})
    if not rates:
        print("[exchange_rates] API response had no 'rates' field, skipping")
        return 0

    stored = 0
    for currency in TRACKED_CURRENCIES:
        rate_value = rates.get(currency)
        if rate_value is None:
            print(f"[exchange_rates] No rate found for USD_{currency}, skipping")
            continue

        entry = ExchangeRate(
            currency_pair=f'USD_{currency}',
            rate=rate_value,
            fetched_at=datetime.utcnow(),
        )
        db.session.add(entry)
        stored += 1

    if stored:
        db.session.commit()

    return stored


def _get_raw_rate(currency_pair):
    """Fetch the most recent stored rate for an exact pair (e.g. USD_IDR
    as fetched from the API), or None if never fetched."""
    from models.finance import ExchangeRate

    entry = (
        ExchangeRate.query
        .filter_by(currency_pair=currency_pair)
        .order_by(ExchangeRate.fetched_at.desc())
        .first()
    )
    if not entry:
        return None
    return float(entry.rate)


def get_current_rate(currency_pair):
    """
    Get the most recently fetched rate for a currency pair, e.g. 'USD_IDR'
    or 'IDR_USD' or 'IDR_CNY'. Rates are stored raw from the API in
    USD_<CCY> form (the API's own base currency), but SMITH's actual base
    currency is IDR, so this function transparently derives IDR-based and
    inverse pairs on the fly rather than storing every possible direction:

    - 'USD_IDR' / 'USD_CNY': returned directly from the stored raw rate.
    - 'IDR_USD': inverse of the stored USD_IDR rate (1 / rate).
    - 'IDR_CNY' (or any non-USD base): derived via a USD cross-rate -
      (1 / USD_<base>) * USD_<quote>.

    Returns the rate as a float, or None if the underlying raw rate(s)
    needed to derive this pair have never been fetched (caller should
    decide how to handle - e.g. block the transaction, or fall back to a
    manually-entered rate).
    """
    if currency_pair.startswith('USD_'):
        return _get_raw_rate(currency_pair)

    base, quote = currency_pair.split('_', 1)

    if quote == 'USD':
        # e.g. IDR_USD -> inverse of USD_IDR
        usd_to_base = _get_raw_rate(f'USD_{base}')
        if not usd_to_base:
            return None
        return 1 / usd_to_base

    # e.g. IDR_CNY -> cross-rate via USD
    usd_to_base = _get_raw_rate(f'USD_{base}')
    usd_to_quote = _get_raw_rate(f'USD_{quote}')
    if not usd_to_base or not usd_to_quote:
        return None
    return usd_to_quote / usd_to_base
