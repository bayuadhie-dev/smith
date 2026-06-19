from flask import Blueprint, jsonify, current_app
from flask_jwt_extended import jwt_required

cache_stats_bp = Blueprint('cache_stats', __name__)

@cache_stats_bp.route('/cache/stats', methods=['GET'])
@jwt_required()
def get_cache_stats():
    """
    Get Redis cache statistics
    """
    try:
        # Check if cache is available
        cache = None
        if hasattr(current_app, 'extensions') and 'cache' in current_app.extensions:
            cache = current_app.extensions['cache']
        
        if not cache:
            return jsonify({
                'redis_connected': False,
                'message': 'Cache not initialized'
            }), 200
        
        # Try to get Redis client
        redis_client = None
        if hasattr(cache, 'cache') and hasattr(cache.cache, '_client'):
            redis_client = cache.cache._client
        
        if not redis_client:
            return jsonify({
                'redis_connected': False,
                'message': 'Redis client not available'
            }), 200
        
        # Try to get Redis info
        try:
            info = redis_client.info()
            stats = {
                'redis_connected': True,
                'used_memory': info.get('used_memory_human', 'N/A'),
                'total_keys': info.get('db0', {}).get('keys', 0),
                'hits': info.get('keyspace_hits', 0),
                'misses': info.get('keyspace_misses', 0),
            }
            
            # Calculate hit rate
            total_requests = stats['hits'] + stats['misses']
            if total_requests > 0:
                stats['hit_rate'] = round((stats['hits'] / total_requests) * 100, 2)
            else:
                stats['hit_rate'] = 0.0
            
            return jsonify(stats), 200
        except Exception as redis_error:
            return jsonify({
                'redis_connected': False,
                'message': f'Redis error: {str(redis_error)}'
            }), 200
            
    except Exception as e:
        return jsonify({
            'redis_connected': False,
            'message': f'Error: {str(e)}'
        }), 200

@cache_stats_bp.route('/cache/clear', methods=['POST'])
@jwt_required()
def clear_cache():
    """
    Clear all Redis cache
    """
    try:
        cache = None
        if hasattr(current_app, 'extensions') and 'cache' in current_app.extensions:
            cache = current_app.extensions['cache']
        
        if not cache:
            return jsonify({
                'message': 'Cache not initialized'
            }), 200
        
        try:
            if hasattr(cache, 'cache'):
                cache.cache.clear()
                return jsonify({
                    'message': 'Cache cleared successfully'
                }), 200
            else:
                return jsonify({
                    'message': 'Cache clear method not available'
                }), 200
        except Exception as clear_error:
            return jsonify({
                'message': f'Cache clear error: {str(clear_error)}'
            }), 200
            
    except Exception as e:
        return jsonify({
            'message': f'Error: {str(e)}'
        }), 200
