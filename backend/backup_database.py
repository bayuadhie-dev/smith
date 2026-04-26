#!/usr/bin/env python3
"""
Automated Database Backup Script
Backs up SQLite database to Google Drive
"""

import os
import shutil
import sqlite3
from datetime import datetime, timedelta
import json
import logging

# Google Drive API
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Configuration
DB_PATH = 'instance/erp_database.db'
BACKUP_DIR = 'backups/database'
CREDENTIALS_FILE = 'credentials.json'
TOKEN_FILE = 'token.json'
RETENTION_DAYS = 7
SCOPES = ['https://www.googleapis.com/auth/drive.file']

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/backup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def get_google_drive_service():
    """Get Google Drive service with authentication"""
    creds = None
    
    # Load existing token if available
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    # If no valid credentials, get new ones
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                logger.error(f"Credentials file not found: {CREDENTIALS_FILE}")
                return None
            
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save credentials for future use
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
    
    return build('drive', 'v3', credentials=creds)


def create_local_backup():
    """Create local backup of database"""
    if not os.path.exists(DB_PATH):
        logger.error(f"Database file not found: {DB_PATH}")
        return None
    
    # Create backup directory if not exists
    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    # Generate backup filename with timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_filename = f'erp_database_{timestamp}.db'
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    
    try:
        # Copy database file to backup location
        shutil.copy2(DB_PATH, backup_path)
        logger.info(f"Local backup created: {backup_path}")
        
        # Get file size
        file_size = os.path.getsize(backup_path) / (1024 * 1024)  # MB
        logger.info(f"Backup file size: {file_size:.2f} MB")
        
        return backup_path
    except Exception as e:
        logger.error(f"Failed to create local backup: {str(e)}")
        return None


def upload_to_google_drive(local_backup_path):
    """Upload backup to Google Drive"""
    try:
        service = get_google_drive_service()
        if not service:
            logger.error("Failed to get Google Drive service")
            return None
        
        # Create or find backup folder
        folder_name = 'ERP Database Backups'
        folder_id = None
        
        # Search for existing folder
        results = service.files().list(
            q=f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder'",
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        if results.get('files'):
            folder_id = results['files'][0]['id']
            logger.info(f"Using existing folder: {folder_name} (ID: {folder_id})")
        else:
            # Create new folder
            folder_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            folder = service.files().create(body=folder_metadata, fields='id').execute()
            folder_id = folder.get('id')
            logger.info(f"Created new folder: {folder_name} (ID: {folder_id})")
        
        # Upload backup file
        file_metadata = {
            'name': os.path.basename(local_backup_path),
            'parents': [folder_id]
        }
        
        media = MediaFileUpload(local_backup_path, resumable=True)
        
        logger.info(f"Uploading to Google Drive...")
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        
        file_id = file.get('id')
        logger.info(f"Upload successful! File ID: {file_id}")
        
        return file_id
    except Exception as e:
        logger.error(f"Failed to upload to Google Drive: {str(e)}")
        return None


def cleanup_old_backups():
    """Delete backups older than retention period"""
    try:
        service = get_google_drive_service()
        if not service:
            logger.error("Failed to get Google Drive service for cleanup")
            return
        
        # Get all files in backup folder
        results = service.files().list(
            q="name contains 'erp_database_' and mimeType='application/vnd.google-apps.folder'",
            spaces='drive',
            fields='files(id, name, createdTime)'
        ).execute()
        
        # Find backup folder
        folder_name = 'ERP Database Backups'
        folder_results = service.files().list(
            q=f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder'",
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        if not folder_results.get('files'):
            logger.info("No backup folder found for cleanup")
            return
        
        folder_id = folder_results['files'][0]['id']
        
        # Get all files in backup folder
        files = service.files().list(
            q=f"'{folder_id}' in parents",
            spaces='drive',
            fields='files(id, name, createdTime)'
        ).execute()
        
        # Delete files older than retention period
        from datetime import timezone
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
        deleted_count = 0
        
        for file in files.get('files', []):
            created_time = datetime.fromisoformat(file['createdTime'].replace('Z', '+00:00'))
            if created_time < cutoff_date:
                service.files().delete(fileId=file['id']).execute()
                logger.info(f"Deleted old backup: {file['name']} (created: {created_time})")
                deleted_count += 1
        
        logger.info(f"Cleanup completed. Deleted {deleted_count} old backup(s)")
        
    except Exception as e:
        logger.error(f"Failed to cleanup old backups: {str(e)}")


def cleanup_local_backups():
    """Delete local backups older than retention period"""
    try:
        if not os.path.exists(BACKUP_DIR):
            return
        
        cutoff_date = datetime.now() - timedelta(days=RETENTION_DAYS)
        deleted_count = 0
        
        for filename in os.listdir(BACKUP_DIR):
            filepath = os.path.join(BACKUP_DIR, filename)
            if os.path.isfile(filepath):
                file_time = datetime.fromtimestamp(os.path.getmtime(filepath))
                if file_time < cutoff_date:
                    os.remove(filepath)
                    logger.info(f"Deleted local backup: {filename}")
                    deleted_count += 1
        
        logger.info(f"Local cleanup completed. Deleted {deleted_count} old backup(s)")
        
    except Exception as e:
        logger.error(f"Failed to cleanup local backups: {str(e)}")


def verify_backup_integrity(backup_path):
    """Verify backup file integrity"""
    try:
        # Try to open database
        conn = sqlite3.connect(backup_path)
        cursor = conn.cursor()
        
        # Check if database is valid
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        conn.close()
        
        if tables:
            logger.info(f"Backup integrity verified. Found {len(tables)} tables.")
            return True
        else:
            logger.error("Backup integrity check failed: No tables found")
            return False
    except Exception as e:
        logger.error(f"Backup integrity check failed: {str(e)}")
        return False


def main():
    """Main backup function"""
    logger.info("=" * 60)
    logger.info("Starting database backup process")
    logger.info("=" * 60)
    
    # Create local backup
    local_backup = create_local_backup()
    if not local_backup:
        logger.error("Backup process failed: Could not create local backup")
        return False
    
    # Verify backup integrity
    if not verify_backup_integrity(local_backup):
        logger.error("Backup process failed: Backup integrity check failed")
        return False
    
    # Upload to Google Drive
    file_id = upload_to_google_drive(local_backup)
    if not file_id:
        logger.warning("Backup process completed but upload to Google Drive failed")
        logger.info("Local backup is available at: " + local_backup)
    
    # Cleanup old backups
    cleanup_old_backups()
    cleanup_local_backups()
    
    logger.info("=" * 60)
    logger.info("Backup process completed successfully")
    logger.info("=" * 60)
    
    return True


if __name__ == '__main__':
    try:
        success = main()
        exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Backup process failed with exception: {str(e)}")
        exit(1)
