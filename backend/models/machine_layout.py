from datetime import datetime
from . import db


class MachineLayoutWing(db.Model):
    __tablename__ = 'machine_layout_wings'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    subtitle = db.Column(db.String(200))
    display_order = db.Column(db.Integer, nullable=False, default=0)
    wing_x = db.Column(db.Float, nullable=False, default=40)
    wing_y = db.Column(db.Float, nullable=False, default=20)
    wing_oee_x = db.Column(db.Float, nullable=False, default=420)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, include_nodes=False):
        data = {
            'id': self.id,
            'name': self.name,
            'subtitle': self.subtitle,
            'display_order': self.display_order,
            'wing_x': self.wing_x,
            'wing_y': self.wing_y,
            'wing_oee_x': self.wing_oee_x,
        }
        if include_nodes:
            data['nodes'] = [n.to_dict() for n in sorted(self.nodes, key=lambda n: n.display_order)]
        return data


class MachineLayoutNode(db.Model):
    __tablename__ = 'machine_layout_nodes'

    id = db.Column(db.Integer, primary_key=True)
    wing_id = db.Column(db.Integer, db.ForeignKey('machine_layout_wings.id'), nullable=False)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=False, unique=True)
    icon_type = db.Column(db.String(50), nullable=False)
    icon_variant = db.Column(db.Integer, nullable=True)  # optional numeric variant for icons that render differently based on a count (e.g. banded_pack unit count)
    pos_x = db.Column(db.Float, nullable=False)
    pos_y = db.Column(db.Float, nullable=False)
    label_offset_x = db.Column(db.Float, default=0)
    label_offset_y = db.Column(db.Float, default=0)
    display_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    wing = db.relationship('MachineLayoutWing', backref='nodes')
    machine = db.relationship('Machine', backref=db.backref('layout_node', uselist=False))

    def to_dict(self):
        return {
            'id': self.id,
            'wing_id': self.wing_id,
            'machine_id': self.machine_id,
            'machine_code': self.machine.code if self.machine else None,
            'machine_name': self.machine.name if self.machine else None,
            'icon_type': self.icon_type,
            'icon_variant': self.icon_variant,
            'pos_x': self.pos_x,
            'pos_y': self.pos_y,
            'label_offset_x': self.label_offset_x,
            'label_offset_y': self.label_offset_y,
            'display_order': self.display_order,
        }


class MachineAlias(db.Model):
    __tablename__ = 'machine_aliases'

    id = db.Column(db.Integer, primary_key=True)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=False, unique=True)
    alias_name = db.Column(db.String(200), nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    machine = db.relationship('Machine', backref=db.backref('alias', uselist=False))

    def to_dict(self):
        return {
            'id': self.id,
            'machine_id': self.machine_id,
            'alias_name': self.alias_name,
            'notes': self.notes,
        }
