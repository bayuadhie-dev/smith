"""
Migration: Add batch_number column to shift_productions table
"""

from app import create_app
from models import db

def add_batch_number_column():
    app = create_app()
    
    with app.app_context():
        try:
            # Check if column already exists
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('shift_productions')]
            
            if 'batch_number' in columns:
                print("✓ Column 'batch_number' already exists in shift_productions table")
                return
            
            # Add batch_number column
            print("Adding batch_number column to shift_productions table...")
            
            with db.engine.connect() as conn:
                conn.execute(text("""
                    ALTER TABLE shift_productions 
                    ADD COLUMN batch_number VARCHAR(100)
                """))
                conn.commit()
                
                # Create index for better performance
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_shift_productions_batch_number 
                    ON shift_productions(batch_number)
                """))
                conn.commit()
            
            print("✓ Column 'batch_number' added successfully to shift_productions table")
            print("✓ Index created on batch_number column")
            
        except Exception as e:
            print(f"✗ Error adding batch_number column: {str(e)}")
            raise

if __name__ == '__main__':
    add_batch_number_column()
