"""
Desk Routes - Minimal Version for Testing
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

desk_bp = Blueprint('desk', __name__)

@desk_bp.route('/overview', methods=['GET'])
@jwt_required()
def get_desk_overview():
    """
    Get desk overview - minimal version for testing
    """
    try:
        # Return static data for testing
        return jsonify({
            'success': True,
            'data': {
                'quick_stats': [
                    {
                        'label': 'Active Work Orders',
                        'value': 0,
                        'change': 0,
                        'icon': 'clipboard-document-list',
                        'color': 'text-blue-600'
                    },
                    {
                        'label': 'Pending Approvals',
                        'value': 0,
                        'change': 0,
                        'icon': 'document-check',
                        'color': 'text-yellow-600'
                    },
                    {
                        'label': 'Low Stock Items',
                        'value': 0,
                        'change': 0,
                        'icon': 'archive-box',
                        'color': 'text-red-600'
                    },
                    {
                        'label': "Today's Production",
                        'value': '0%',
                        'change': 0,
                        'icon': 'chart-bar',
                        'color': 'text-green-600'
                    }
                ],
                'recent_documents': [],
                'module_stats': {},
                'last_updated': '2024-01-01T00:00:00'
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@desk_bp.route('/test', methods=['GET'])
def test():
    """Simple test endpoint - no auth required"""
    return jsonify({
        'message': 'Desk API is working!',
        'status': 'OK'
    })

@desk_bp.route('/public', methods=['GET'])
def public():
    """Public endpoint to test routing without auth"""
    return jsonify({
        'message': 'Desk public endpoint accessible',
        'routes': {
            'test': '/api/desk/test (no auth)',
            'overview': '/api/desk/overview (requires JWT)',
            'public': '/api/desk/public (no auth)'
        }
    })
