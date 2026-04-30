    # Technical Debt List

## Overview
Total Technical Debt Items: 206
- Critical: 199 (96.6%)
- Medium: 5 (2.4%)
- Low: 2 (1.0%)

---

## Category 1: Deprecated SQLAlchemy API (193 items)

### Description
Using deprecated `Query.get()` method that will break in SQLAlchemy 2.0. Need to migrate to `db.session.get()`.

### Impact
- **Severity**: High - Will cause errors when upgrading to SQLAlchemy 2.0
- **Scope**: 30+ backend route files
- **Risk**: System will fail to start or query data after upgrade

### Affected Modules

| Module | Count | Files |
|--------|-------|-------|
| Production | 41 | routes/production.py |
| Chat/SocketIO | 25 | routes/socketio_chat.py, routes/group_chat.py |
| User Manual | 13 | routes/user_manual.py |
| RND | 12 | routes/rnd.py |
| Packing List | 10 | routes/packing_list.py |
| Purchasing | 9 | routes/purchasing.py |
| Workflow Integration | 7 | routes/workflow_integration.py |
| Product Changeover | 7 | routes/product_changeover.py |
| Sales | 7 | routes/sales.py |
| Attendance | 5 | routes/attendance.py |
| UoM | 5 | routes/uom.py |
| MRP | 6 | routes/mrp.py |
| MBF Report | 4 | routes/mbf_report.py |
| Material Stock | 4 | routes/material_stock.py |
| KPI Targets | 3 | routes/kpi_targets.py |
| Auth | 8 | routes/auth.py |
| Notification | 3 | routes/notifications.py, routes/notifications_email.py |
| HR | 5 | routes/attendance.py |
| Approval Workflow | 5 | routes/approval_workflow.py |
| Face Recognition | 1 | routes/face_recognition.py |
| WIP Job Costing | 1 | routes/wip_job_costing.py |
| WIP Accounting | 1 | routes/wip_accounting.py |
| Production Integration | 1 | routes/production_integration.py |
| Products New Excel | 1 | routes/products_new_excel.py |

### Fix Pattern
```python
# Before (Deprecated)
user = User.query.get(user_id)
product = Product.query.get(product_id)
order = SalesOrder.query.get(id)

# After (SQLAlchemy 2.0)
user = db.session.get(User, user_id)
product = db.session.get(Product, product_id)
order = db.session.get(SalesOrder, id)
```

### Effort Estimation
- **Automated**: 2-3 hours (find-and-replace with regex)
- **Manual review**: 1-2 hours (verify each replacement)
- **Testing**: 2-3 hours (run tests, manual verification)
- **Total**: 5-8 hours

### Priority
**P0 - Critical** (Must fix before SQLAlchemy upgrade)

---

## Category 2: Missing foreign_keys Parameter (13 items)

### Description
SQLAlchemy relationships missing `foreign_keys` parameter, causing ambiguous relationship errors when multiple foreign keys point to the same table.

### Impact
- **Severity**: Medium - May cause runtime errors or incorrect relationship loading
- **Scope**: Model files
- **Risk**: Data integrity issues, wrong relationship associations

### Affected Modules

| Module | Count | Files |
|--------|-------|-------|
| Maintenance | 5 | models/maintenance.py |
| Settings | 10 | models/settings.py |
| Purchasing | 9 | models/purchasing.py |
| HR | 2 | models/hr.py, models/hr_extended.py |
| OEE | 4 | models/oee.py |
| Notification | 1 | models/notification.py |
| Products | 1 | models/products_new.py |

### Fix Pattern
```python
# Before (Ambiguous)
approved_by_user = db.relationship('User')

# After (Explicit)
approved_by_user = db.relationship('User', foreign_keys=[approved_by])
```

### Effort Estimation
- **Manual fix**: 3-4 hours (each relationship needs review)
- **Testing**: 2-3 hours (relationship queries, data integrity checks)
- **Total**: 5-7 hours

### Priority
**P1 - High** (Fix before production deployment)

---

## Category 3: Field Name Mismatches (27 items)

### Description
Backend routes accessing non-existent model fields due to field name mismatches between models and route code.

### Impact
- **Severity**: High - Runtime errors, data loss, incorrect calculations
- **Scope**: Production, Maintenance, Settings, Finance modules
- **Risk**: Critical business logic failures

### Affected Modules

| Module | Count | Type |
|--------|-------|------|
| Production | 10 | Field name mismatches |
| Maintenance | 8 | Field name mismatches |
| Settings | 10 | Field name mismatches |
| Finance | 8 | Field name mismatches |

### Example Issues
- Routes accessing `machine.name` but model has `machine.machine_name`
- Routes accessing `product.name` but model has `product.product_name`
- Routes accessing `supplier.name` but model has `supplier.company_name`

### Effort Estimation
- **Manual fix**: 4-6 hours (review each mismatch)
- **Testing**: 3-4 hours (end-to-end testing)
- **Total**: 7-10 hours

### Priority
**P0 - Critical** (Fix immediately - system may have runtime errors)

---

## Category 4: Missing Model Fields (3 items)

### Description
Model missing fields that are expected by route logic.

### Impact
- **Severity**: High - Runtime errors, missing functionality
- **Scope**: HR module
- **Risk**: Payroll calculation errors

### Affected Modules

| Module | Count | Field |
|--------|-------|-------|
| HR | 1 | Attendance.late_hours |
| HR | 2 | Leave/TrainingRequest.approved_by_user relationship |

### Effort Estimation
- **Manual fix**: 2-3 hours (add migration)
- **Testing**: 2-3 hours (payroll calculation tests)
- **Total**: 4-6 hours

### Priority
**P1 - High** (Fix before payroll processing)

---

## Category 5: Missing Model (1 item)

### Description
MaintenancePart model referenced in routes but not defined in models.

### Impact
- **Severity**: Medium - Feature not working
- **Scope**: Maintenance module
- **Risk**: Parts management broken

### Effort Estimation
- **Manual fix**: 2-3 hours (create model, migration)
- **Testing**: 1-2 hours (parts CRUD tests)
- **Total**: 3-5 hours

### Priority
**P2 - Medium** (Fix if parts management needed)

---

## Category 6: Missing Indexes (All Modules)

### Description
Models missing database indexes on frequently queried fields.

### Impact
- **Severity**: Medium - Performance degradation
- **Scope**: All modules
- **Risk**: Slow queries as data grows

### Recommended Indexes
- All foreign key fields
- Date/timestamp fields
- Status fields
- Frequently filtered fields

### Effort Estimation
- **Manual fix**: 4-6 hours (add indexes to models)
- **Migration**: 1-2 hours (create migration, run)
- **Testing**: 2-3 hours (performance tests)
- **Total**: 7-11 hours

### Priority
**P2 - Medium** (Fix before production scaling)

---

## Category 7: Missing Cascade Deletes (All Modules)

### Description
Relationships missing cascade delete behavior, causing orphaned records.

### Impact
- **Severity**: Medium - Data integrity issues
- **Scope**: All modules
- **Risk**: Orphaned records when parent deleted

### Effort Estimation
- **Manual fix**: 3-4 hours (review all relationships)
- **Migration**: 1-2 hours
- **Testing**: 2-3 hours (delete cascade tests)
- **Total**: 6-9 hours

### Priority
**P2 - Medium** (Fix before production)

---

## Category 8: Missing Unit Tests

### Description
No unit tests for critical business logic and API endpoints.

### Impact
- **Severity**: High - No regression protection
- **Scope**: All modules
- **Risk**: Bugs in production, difficult to refactor

### Effort Estimation
- **Write tests**: 40-60 hours (critical paths only)
- **Setup CI/CD**: 4-8 hours
- **Total**: 44-68 hours

### Priority
**P1 - High** (Start with critical modules)

---

## Category 9: No Code Review Process

### Description
No formal code review process or pre-commit hooks.

### Impact
- **Severity**: Medium - Technical debt accumulation
- **Scope**: All development
- **Risk**: Bugs introduced over time

### Recommendations
- Setup pre-commit hooks (flake8, black, mypy)
- Require code review for all PRs
- Add SQLAlchemy deprecation checker

### Effort Estimation
- **Setup**: 4-6 hours
- **Total**: 4-6 hours

### Priority
**P1 - High** (Setup immediately)

---

## Category 10: No API Versioning

### Description
Backend API has no versioning strategy.

### Impact
- **Severity**: Medium - Breaking changes affect all clients
- **Scope**: All API routes
- **Risk**: Frontend breaks on backend changes

### Recommendations
- Implement API versioning (/api/v1/, /api/v2/)
- Document deprecation timeline

### Effort Estimation
- **Implementation**: 8-12 hours
- **Frontend updates**: 4-8 hours
- **Total**: 12-20 hours

### Priority
**P2 - Medium** (Plan for next major version)

---

## Recommended Fix Order

### Phase 1: Critical (Week 1)
1. Fix Field Name Mismatches (27 items) - 7-10 hours
2. Fix Missing Model Fields (3 items) - 4-6 hours
3. Fix Deprecated Query.get() (193 items) - 5-8 hours
4. Setup Pre-commit Hooks - 4-6 hours

**Total Phase 1**: 20-30 hours

### Phase 2: High Priority (Week 2)
1. Fix Missing foreign_keys (13 items) - 5-7 hours
2. Add Missing Model (1 item) - 3-5 hours
3. Write Unit Tests for Critical Modules - 20-30 hours

**Total Phase 2**: 28-42 hours

### Phase 3: Medium Priority (Week 3)
1. Add Database Indexes - 7-11 hours
2. Add Cascade Deletes - 6-9 hours
3. Implement API Versioning - 12-20 hours

**Total Phase 3**: 25-40 hours

---

## Total Effort Estimation

| Phase | Hours | Weeks (40h/week) |
|-------|-------|------------------|
| Phase 1 | 20-30 | 0.5-0.75 |
| Phase 2 | 28-42 | 0.7-1.0 |
| Phase 3 | 25-40 | 0.6-1.0 |
| **Total** | **73-112** | **1.8-2.8** |

---

## Prevention Strategies

### 1. Automated Checks
- Pre-commit hooks for deprecated API usage
- CI/CD pipeline with linting and type checking
- SQLAlchemy deprecation warnings treated as errors

### 2. Development Process
- Mandatory code review for all changes
- Pair programming for complex features
- Test-driven development for critical paths

### 3. Documentation
- API documentation with versioning
- Architecture decision records (ADRs)
- Coding standards document

### 4. Monitoring
- Application performance monitoring
- Error tracking (Sentry, Rollbar)
- Technical debt backlog review monthly

---

## Conclusion

Total technical debt: **206 items**
Estimated fix time: **73-112 hours (1.8-2.8 weeks)**

Most critical items (field name mismatches, deprecated API) can be fixed in **Phase 1 (20-30 hours)** to stabilize the system for production use.

**Recommendation**: Start with Phase 1 immediately to address critical runtime errors and deprecated API issues.
