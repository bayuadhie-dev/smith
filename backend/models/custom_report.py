"""
Custom Report Builder persistence (2026-10-06) - external-audit mock-data
cleanup, category 3 item 1/3. Previously CustomReportBuilder.tsx's
saveReport() never called any API - it just toasted success and
navigated away, so nothing was ever actually saved. See
routes/custom_report.py for CRUD + the real preview-query endpoint
(utils/custom_report_registry.py holds the safe whitelist query engine).
"""
import json
from datetime import datetime
from models import db


class CustomReportDefinition(db.Model):
    __tablename__ = 'custom_report_definitions'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    data_sources = db.Column(db.Text, nullable=False)  # JSON list[str]
    fields = db.Column(db.Text, nullable=False)  # JSON list[{source, field, label, aggregation}]
    filters = db.Column(db.Text, nullable=True)  # JSON list[{field, operator, value, label}]
    group_by = db.Column(db.Text, nullable=True)  # JSON list[str]
    order_by = db.Column(db.Text, nullable=True)  # JSON list[{field, direction}]
    chart_type = db.Column(db.String(20), default='table')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'dataSources': json.loads(self.data_sources or '[]'),
            'fields': json.loads(self.fields or '[]'),
            'filters': json.loads(self.filters or '[]'),
            'groupBy': json.loads(self.group_by or '[]'),
            'orderBy': json.loads(self.order_by or '[]'),
            'chartType': self.chart_type,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }
