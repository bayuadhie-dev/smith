#!/usr/bin/env python3
"""
Unit tests for week calculation logic
CRITICAL: These tests must pass before any deployment
"""
import unittest
from datetime import datetime, timedelta

class TestWeekCalculation(unittest.TestCase):
    """Test week calculation for production monitoring"""
    
    def calculate_first_monday(self, year, month):
        """Calculate first Monday of the month"""
        first_day = datetime(year, month, 1).date()
        days_until_monday = (7 - first_day.weekday()) % 7
        if first_day.weekday() != 0:
            return first_day + timedelta(days=days_until_monday)
        return first_day
    
    def test_may_2026_first_monday(self):
        """Test May 2026: First day is Friday, first Monday should be May 4"""
        first_monday = self.calculate_first_monday(2026, 5)
        self.assertEqual(first_monday, datetime(2026, 5, 4).date())
        self.assertEqual(first_monday.weekday(), 0)  # Monday
    
    def test_week_1_boundaries(self):
        """Test Week 1 should be May 4-10 (Mon-Sun)"""
        first_monday = self.calculate_first_monday(2026, 5)
        week_1_start = first_monday
        week_1_end = first_monday + timedelta(days=6)
        
        self.assertEqual(week_1_start, datetime(2026, 5, 4).date())
        self.assertEqual(week_1_end, datetime(2026, 5, 10).date())
    
    def test_week_2_boundaries(self):
        """Test Week 2 should be May 11-17 (Mon-Sun)"""
        first_monday = self.calculate_first_monday(2026, 5)
        week_2_start = first_monday + timedelta(days=7)
        week_2_end = week_2_start + timedelta(days=6)
        
        self.assertEqual(week_2_start, datetime(2026, 5, 11).date())
        self.assertEqual(week_2_end, datetime(2026, 5, 17).date())
    
    def test_no_overlap_between_weeks(self):
        """Test Week 1 and Week 2 should not overlap"""
        first_monday = self.calculate_first_monday(2026, 5)
        
        week_1_start = first_monday
        week_1_end = first_monday + timedelta(days=6)
        
        week_2_start = first_monday + timedelta(days=7)
        week_2_end = week_2_start + timedelta(days=6)
        
        # Week 1 end should be before Week 2 start
        self.assertLess(week_1_end, week_2_start)
        
        # No overlap
        overlaps = week_1_start <= week_2_end and week_1_end >= week_2_start
        self.assertFalse(overlaps)
    
    def test_working_days_count(self):
        """Test each week should have 5 working days (Mon-Fri)"""
        first_monday = self.calculate_first_monday(2026, 5)
        
        for week_num in range(1, 5):
            week_start = first_monday + timedelta(days=(week_num - 1) * 7)
            week_end = week_start + timedelta(days=6)
            
            working_days = 0
            current = week_start
            while current <= week_end:
                if current.weekday() < 5:  # Mon-Fri
                    working_days += 1
                current += timedelta(days=1)
            
            self.assertEqual(working_days, 5, 
                f"Week {week_num} should have 5 working days, got {working_days}")

if __name__ == '__main__':
    unittest.main()
