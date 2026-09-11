"""Flattening helper for the Sales Forecast Matrix (ForecastHeader/ForecastLine) - lets
Safety Stock (utils/mrp_time_phased.py) and MRP dashboard (routes/mrp.py) keep reading
forecast data without their anchor-week/BOM-explosion logic changing at all. See
SALES_FORECAST_MATRIX_RENCANA_TEKNIS.md §4.

Rombak putaran 6 (2026-08-25, rolling + geser lihat histori): forecast qty sekarang
disimpan per bulan KALENDER asli di ForecastLineMonth (bukan qty_m1..12 slot relatif ke
header.period_start lagi) - iterasinya jadi jauh lebih sederhana, period sudah langsung
tanggal kalender nyata, tidak perlu lagi dihitung dari header.month_date().

Replaces the old SalesForecast.query.filter(...) call sites. Each yielded ForecastMonthRow
carries the SAME attribute names old code read off a SalesForecast row (forecast_number,
period_start, period_end, best_case/most_likely/worst_case/committed, confidence_level,
status, created_at, product) so secondary/tertiary MRP dashboard endpoints that display
forecast data (not just Safety Stock's core anchor-week logic) keep working with minimal
changes - not a hack, this is the correct semantic per the §3.1(a) decision: since the
matrix UI only ever writes 1 plain qty per cell now, best_case/most_likely/worst_case/
committed collapse to that SAME qty (no differentiated data exists to show separately
any more), rather than being silently zero or absent.
"""
from calendar import monthrange
from collections import namedtuple

from models.sales import ForecastHeader, ForecastLineMonth

ForecastMonthRow = namedtuple('ForecastMonthRow', [
    'product_id', 'product', 'period_start', 'period_end', 'qty',
    'best_case', 'most_likely', 'worst_case', 'committed',
    'forecast_number', 'name', 'status', 'confidence_level', 'created_at',
    'header_id', 'line_id', 'month',
])


def iter_forecast_month_rows(status_filter=('approved',)):
    """Yield 1 ForecastMonthRow per non-zero (line, calendar month) cell across all
    ForecastHeader rows whose status matches status_filter. Consumers (Safety Stock, MRP)
    iterate this instead of querying SalesForecast directly - their own anchor-week/
    BOM-explosion logic is unchanged, only the data source changed."""
    headers = ForecastHeader.query.filter(ForecastHeader.status.in_(status_filter)).all()
    for header in headers:
        for line in header.lines:
            for flm in line.months:
                qty = flm.quantity
                if not qty or qty <= 0:
                    continue
                period_start = flm.period
                period_end = period_start.replace(day=monthrange(period_start.year, period_start.month)[1])
                qty_f = float(qty)
                yield ForecastMonthRow(
                    product_id=line.product_id,
                    product=line.product,
                    period_start=period_start,
                    period_end=period_end,
                    qty=qty_f,
                    # Collapsed to the same plain qty - see module docstring.
                    best_case=qty_f,
                    most_likely=qty_f,
                    worst_case=qty_f,
                    committed=qty_f,
                    forecast_number=f'FC-{period_start.strftime("%Y%m")}-{line.product_id}',
                    name=header.name,
                    status=header.status,
                    confidence_level=None,
                    created_at=line.created_at,
                    header_id=header.id,
                    line_id=line.id,
                    month=period_start.month,
                )


def forecast_rows_in_range(start_date, end_date, status_filter=('approved', 'submitted')):
    """Convenience wrapper for callers that used to do
    SalesForecast.query.filter(period_start <= end_date, period_end >= start_date, ...) -
    same overlap semantics, applied in Python since this is no longer a real query."""
    return [
        row for row in iter_forecast_month_rows(status_filter=status_filter)
        if row.period_start <= end_date and row.period_end >= start_date
    ]
