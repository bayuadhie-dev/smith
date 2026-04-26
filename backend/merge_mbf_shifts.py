import sys
import os

# Add current directory to path so we can import models
sys.path.append(os.getcwd())

from app import create_app
from models.mbf_report import db, MBFReportDetail, MBFReport
from collections import defaultdict

def merge_details():
    app = create_app()
    with app.app_context():
        print("Starting MBF shift merge/cleanup...")
        
        all_details = MBFReportDetail.query.all()
        grouped = defaultdict(list)
        
        for d in all_details:
            key = (d.report_id, d.day_date)
            grouped[key].append(d)
        
        merged_count = 0
        deleted_count = 0
        
        for (report_id, day_date), details in grouped.items():
            if len(details) > 1:
                print(f"Merging {len(details)} shifts for Report #{report_id} on {day_date}")
                primary = details[0]
                
                # Sum up values from other shifts
                for extra in details[1:]:
                    primary.target_octenic += (extra.target_octenic or 0)
                    primary.target_gloveclean += (extra.target_gloveclean or 0)
                    primary.target_total += (extra.target_total or 0)
                    
                    primary.actual_octenic += (extra.actual_octenic or 0)
                    primary.actual_gloveclean += (extra.actual_gloveclean or 0)
                    primary.actual_total += (extra.actual_total or 0)
                    
                    primary.target_cloth_octenic += (extra.target_cloth_octenic or 0)
                    primary.target_cloth_gloveclean += (extra.target_cloth_gloveclean or 0)
                    primary.actual_cloth_octenic += (extra.actual_cloth_octenic or 0)
                    primary.actual_cloth_gloveclean += (extra.actual_cloth_gloveclean or 0)
                    
                    primary.target_isolation_roll += (extra.target_isolation_roll or 0)
                    primary.actual_isolation_roll += (extra.actual_isolation_roll or 0)
                    
                    primary.target_karton_octenic += (extra.target_karton_octenic or 0)
                    primary.target_karton_gloveclean += (extra.target_karton_gloveclean or 0)
                    primary.actual_karton_octenic += (extra.actual_karton_octenic or 0)
                    primary.actual_karton_gloveclean += (extra.actual_karton_gloveclean or 0)
                    
                    # New columns
                    primary.target_roll_packaging_octenic += (extra.target_roll_packaging_octenic or 0)
                    primary.target_roll_packaging_gloveclean += (extra.target_roll_packaging_gloveclean or 0)
                    primary.actual_roll_packaging_octenic += (extra.actual_roll_packaging_octenic or 0)
                    primary.actual_roll_packaging_gloveclean += (extra.actual_roll_packaging_gloveclean or 0)
                    primary.target_roll_sticker_octenic += (extra.target_roll_sticker_octenic or 0)
                    primary.actual_roll_sticker_octenic += (extra.actual_roll_sticker_octenic or 0)
                    
                    # Merge notes
                    if extra.notes:
                        if primary.notes:
                            primary.notes += " / " + extra.notes
                        else:
                            primary.notes = extra.notes
                    
                    db.session.delete(extra)
                    deleted_count += 1
                
                primary.shift_name = 'Daily'
                primary.shift_number = 1
                primary.status = 'achieved' if primary.actual_total >= primary.target_total else 'minus'
                merged_count += 1
            else:
                # Even if single row, update name/number to be consistent
                details[0].shift_name = 'Daily'
                details[0].shift_number = 1

        db.session.commit()
        print(f"Cleanup complete! Merged {merged_count} days, deleted {deleted_count} redundant rows.")

if __name__ == "__main__":
    merge_details()
