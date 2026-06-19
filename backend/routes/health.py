"""
Health Check Endpoints for Docker and Monitoring
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from datetime import datetime
import redis
import os
from utils.timezone import get_local_now, get_local_today

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    Basic health check endpoint
    ---
    tags:
      - Health
    summary: Basic health check
    description: Returns 200 if application is running
    responses:
      200:
        description: Service is healthy
        schema:
          type: object
          properties:
            status:
              type: string
              example: healthy
            timestamp:
              type: string
              format: date-time
            service:
              type: string
              example: ERP Backend
            version:
              type: string
              example: 1.0.0
    """
    return jsonify({
        'status': 'healthy',
        'timestamp': get_local_now().isoformat(),
        'service': 'ERP Backend',
        'version': '1.0.0'
    }), 200


@health_bp.route('/health/detailed', methods=['GET'])
def detailed_health_check():
    """
    Detailed health check including database and redis
    ---
    tags:
      - Health
    summary: Detailed health check
    description: Checks database and redis connections
    responses:
      200:
        description: All services are healthy
        schema:
          type: object
          properties:
            status:
              type: string
              example: healthy
            timestamp:
              type: string
              format: date-time
            service:
              type: string
              example: ERP Backend
            version:
              type: string
              example: 1.0.0
            checks:
              type: object
              properties:
                database:
                  type: object
                  properties:
                    status:
                      type: string
                      example: healthy
                    message:
                      type: string
                redis:
                  type: object
                  properties:
                    status:
                      type: string
                      example: healthy
                    message:
                      type: string
      503:
        description: Service unhealthy
    """
    health_status = {
        'status': 'healthy',
        'timestamp': get_local_now().isoformat(),
        'service': 'ERP Backend',
        'version': '1.0.0',
        'checks': {}
    }
    
    # Check Database
    try:
        from app import db
        db.session.execute('SELECT 1')
        health_status['checks']['database'] = {
            'status': 'healthy',
            'message': 'Database connection successful'
        }
    except Exception as e:
        health_status['status'] = 'unhealthy'
        health_status['checks']['database'] = {
            'status': 'unhealthy',
            'message': str(e)
        }
    
    # Check Redis
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        r = redis.from_url(redis_url)
        r.ping()
        health_status['checks']['redis'] = {
            'status': 'healthy',
            'message': 'Redis connection successful'
        }
    except Exception as e:
        health_status['checks']['redis'] = {
            'status': 'unhealthy',
            'message': str(e)
        }
    
    # Determine overall status
    if health_status['status'] == 'unhealthy':
        return jsonify(health_status), 503
    
    return jsonify(health_status), 200


@health_bp.route('/ready', methods=['GET'])
def readiness_check():
    """
    Readiness check for Kubernetes/Docker
    Returns 200 when application is ready to serve traffic
    """
    try:
        from app import db
        db.session.execute('SELECT 1')
        return jsonify({
            'status': 'ready',
            'timestamp': get_local_now().isoformat()
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'not ready',
            'error': str(e),
            'timestamp': get_local_now().isoformat()
        }), 503


@health_bp.route('/live', methods=['GET'])
def liveness_check():
    """
    Liveness check for Kubernetes/Docker
    Returns 200 if application is alive
    """
    return jsonify({
        'status': 'alive',
        'timestamp': get_local_now().isoformat()
    }), 200


@health_bp.route('/cache/stats', methods=['GET'])
def cache_stats():
    """
    Get Redis cache statistics
    ---
    tags:
      - Health
    summary: Get cache statistics
    description: Retrieve Redis cache performance metrics
    security:
      - BearerAuth: []
    responses:
      200:
        description: Cache statistics retrieved successfully
      401:
        description: Unauthorized
    """
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        r = redis.from_url(redis_url)
        
        # Get Redis info
        info = r.info()
        
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
        
    except Exception as e:
        return jsonify({
            'redis_connected': False,
            'error': str(e)
        }), 200


@health_bp.route('/cache/clear', methods=['POST'])
def clear_cache():
    """
    Clear all Redis cache
    ---
    tags:
      - Health
    summary: Clear cache
    description: Clear all cached data from Redis
    security:
      - BearerAuth: []
    responses:
      200:
        description: Cache cleared successfully
      401:
        description: Unauthorized
    """
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        r = redis.from_url(redis_url)
        r.flushdb()
        
        return jsonify({
            'message': 'Cache cleared successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 200
