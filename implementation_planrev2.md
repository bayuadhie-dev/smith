# ERP Implementation Plan

## Overview
This document contains the comprehensive implementation plan for upgrading the ERP system with new features and performance optimizations.

**⚠️ CRITICAL WARNING**: This plan is designed for a solo developer/small team. Phase 1 (C-based computation) contains high-risk items that should be approached with caution.

---

## 🚨 DECISION REQUIRED: Week 1 Priority

### External Portal Authentication Architecture

**⚠️ BLOCKER**: Keputusan ini HARUS diambil di Week 1 sebelum coding apapun untuk Customer Portal/Supplier Portal.

#### Problem Statement
Customer Portal dan Supplier Portal memerlukan arsitektur autentikasi yang berbeda dari internal ERP:
- External users (customers/suppliers) ≠ Internal staff
- Data isolation antar customer/supplier yang berbeda
- Security boundary yang lebih ketat

#### Option A: Shared Auth System (Extended JWT)
**Architecture**: Gunakan existing JWT system dengan extension

**Implementation**:
- Tambahkan `external_customer`, `external_supplier` roles
- Row-level security di database untuk data isolation
- Separate middleware untuk external portal validation

**Pros:**
- Single sign-on experience (jika nanti butuh)
- Konsisten dengan existing auth flow
- Lebih sedikit code duplication

**Cons:**
- Existing auth system lebih kompleks
- Risk: Bug di auth bisa affect internal + external
- Harder to audit (mixed internal/external logs)

**Effort**: 1-2 minggu (extend existing)

---

#### Option B: Separate Auth System (Micro-auth)
**Architecture**: Auth system terpisah untuk external portals

**Implementation**:
- Separate JWT secret/key untuk external
- API Gateway pattern: External → Internal API dengan service account
- Standalone auth service ( bisa pakai Keycloak, Auth0, atau custom sederhana)

**Pros:**
- Strong isolation (security breach external ≠ internal breach)
- Easier to audit dan monitor
- Can scale external auth independently
- Can use managed auth service (Auth0, Firebase Auth) - less code

**Cons:**
- Double maintenance (2 auth systems)
- Users must login terpisah (unless SSO implemented)
- More complex deployment

**Effort**: 2-4 minggu (new system) atau 1 minggu (kalau pakai managed service seperti Auth0)

---

#### Option C: API-Key Based (Simplest)
**Architecture**: API keys untuk machine-to-machine, JWT untuk user

**Implementation**:
- Customers dapat API key untuk integrations
- Portal pakai simple JWT dengan short expiry
- No shared auth dengan internal ERP

**Pros:**
- Simplest implementation
- Clear separation of concerns
- Easy to revoke access per customer

**Cons:**
- Tidak ada user session management yang advanced
- Limited untuk portal features (read-only mostly)

**Effort**: 3-5 hari

---

#### Rekomendasi untuk Solo Dev
**Primary Recommendation: Option A (Extended JWT)**

**Alasan**:
1. **Speed**: Bisa reuse existing JWT infrastructure
2. **Maintainability**: 1 codebase untuk auth logic
3. **Risk**: Sudah familiar dengan existing system
4. **Isolation**: Row-level security di database cukup untuk data isolation

**Trade-off yang acceptable**:
- Security risk lebih tinggi tapi manageable dengan proper row-level security
- Debugging lebih kompleks tapi logging yang baik bisa mitigate

**Kalau ada budget untuk managed service**: Option B dengan Auth0/Firebase (save development time, tapi ada ongoing cost)

---

#### Week 1 Deliverables (Decision Phase)
**Jangan mulai coding Customer Portal sebelum ini selesai:**

- [ ] **Day 1-2**: Evaluate existing JWT implementation, identify extension points
- [ ] **Day 3**: Prototype Option A (extend existing auth dengan new role)
- [ ] **Day 4**: Test data isolation dengan row-level security
- [ ] **Day 5**: Final decision dan document arsitektur

**Blocker untuk Week 2**:
- Auth architecture belum diputuskan
- Database row-level security belum dites
- External user roles belum didefinisikan

---

## 🧪 Testing Strategy (Shift-Left - Parallel dengan Dev)

**⚠️ CRITICAL**: Testing bukan di Q4! Testing HARUS berjalan PARALLEL dengan development sejak Week 1.

### Shift-Left Testing Approach
**Filosofi**: Cari bug sedini mungkin, bukan di akhir. Fix bug di development 10x lebih murah daripada fix di production.

### Week 1-2: Foundation Testing (Start Here!)
**Jangan tunggu sampai Q4 untuk bikin test suite!**

- [ ] **Audit existing tests**: Cek coverage 18+ modul yang sudah ada
- [ ] **Set up testing infrastructure**: pytest config, CI/CD hooks
- [ ] **Create test data fixtures**: Sample data untuk regression testing
- [ ] **Document critical paths**: List 20 most critical user flows

### Per-Feature Testing (Parallel Development)
**Setiap fitur BARU harus include testing DARI AWAL:**

#### Unit Tests (Wajib - Sebelum Merge)
- [ ] **Backend API tests**: Minimum 70% coverage untuk setiap endpoint baru
- [ ] **Frontend component tests**: React Testing Library untuk critical components
- [ ] **Integration tests**: API + Database integration
- **Rule**: No merge tanpa tests!

#### Regression Tests (Per Sprint)
- [ ] **Critical path tests**: Run setiap sprint (2 minggu sekali)
- [ ] **Smoke tests**: After setiap deploy ke staging
- [ ] **API contract tests**: Ensure backward compatibility

#### End-to-End Tests (Monthly)
- [ ] **Full user flows**: Playwright tests untuk critical paths
- [ ] **Cross-browser tests**: Chrome, Firefox, Safari
- [ ] **Mobile responsive tests**: Tablet dan mobile breakpoints

### Testing Pyramid (Target Coverage)
```
       /\
      /  \  E2E Tests (10%) - Critical flows only
     /____\
    /      \  Integration Tests (20%) - API + DB
   /________\
  /          \  Unit Tests (70%) - Business logic
 /____________\
```

### Test-First Development (TDD untuk Fitur Kompleks)
**Untuk fitur dengan logic kompleks (Algorithm, Auth, Finance):**
1. Write test cases dulu (GIVEN-WHEN-THEN)
2. Implement fitur sampai tests pass
3. Refactor dengan confidence (tests tetap pass)

**Fitur yang WAJIB TDD**:
- [ ] Production Scheduling Algorithm
- [ ] Auth/Permission logic
- [ ] Financial calculations
- [ ] Inventory allocation logic

### Continuous Testing (CI/CD)
**Automated testing pipeline**:
- **Pre-commit**: Linting, type checking
- **On push**: Unit tests (< 2 menit)
- **On PR**: Full test suite + integration tests (< 10 menit)
- **On merge to main**: E2E tests (< 30 menit)
- **Nightly**: Full regression suite (< 2 jam)

### Tools & Setup (Week 1-2)
- **Unit Testing**: pytest (backend), Vitest/Jest (frontend)
- **Integration Testing**: pytest + TestClient (FastAPI)
- **E2E Testing**: Playwright
- **Coverage**: pytest-cov, coverage threshold 70%
- **CI/CD**: GitHub Actions atau GitLab CI (set up di Week 2)
- **Test Data**: Factory Boy (backend), MSW (frontend mocking)

### Database Migration Testing
**Setiap migration harus tested**:
- [ ] **Forward migration**: Apply ke staging DB
- [ ] **Rollback test**: Rollback dan verify data integrity
- [ ] **Data validation**: Sample queries untuk verify schema changes

### Bug Regression Prevention
**Untuk setiap bug fix**:
- [ ] Tulis test yang reproduce bug
- [ ] Fix bug
- [ ] Verify test pass
- [ ] Commit dengan format: `fix: [description] + test`

---

## Risk Assessment & Revised Approach

### Critical Risks Identified

#### 1. Phase 1 (C-Based Heavy Computation) - HIGH RISK ⚠️
**Problem**: 10 fitur C-based sangat kompleks dan berisiko untuk solo developer:
- Job Shop Scheduling → NP-hard problem
- Quality Control dengan Computer Vision → butuh GPU + deep learning expertise  
- Supply Chain Network Optimization → butuh commercial solver (Gurobi berharga mahal)

**Impact**: Maintainability C extension/Cython sangat sulit. Debugging bug di C layer jauh lebih sulit daripada Python.

**Rekomendasi**: 
- Mulai dengan **Python + OR-Tools atau SciPy** dulu
- C extension hanya kalau sudah **proven bottleneck** lewat profiling
- Jangan optimize prematurely

#### 2. Tidak Ada Estimasi Waktu & Resource
**Problem**: 26 fitur tanpa estimasi jam/hari pengerjaan.

**Contoh Realistis**:
- Customer Portal: 4-8 minggu (full-time)
- Helpdesk: 3-6 minggu
- Advanced BI: 6-10 minggu
- IoT Integration: 4-8 minggu (exclude hardware procurement)

#### 3. Overlap Antar Fitur Tanpa Dependency Mapping
**Problem**: Beberapa fitur saling overlap tapi tidak ada koordinasi:
- "Demand Forecasting ML" dan "Advanced BI" sama-sama butuh data warehouse foundation
- "Real-time OEE Analysis" overlap dengan "IoT Integration" — seharusnya satu workstream

#### 4. Infrastructure Prerequisites Tidak Diaddress
**Problem**: Beberapa fitur butuh infrastruktur yang belum ada:

| Fitur | Prerequisite | Status |
|-------|-------------|--------|
| IoT Integration | MQTT broker, IoT gateway hardware | ❌ Not Ready |
| Predictive Maintenance | Sensor infrastructure | ❌ Not Ready |
| Computer Vision | GPU server | ❌ Not Ready |
| Multi-Company | Database schema refactor significant | ❌ Not Ready |

---

## Global Definition of Done (DoD)

Setiap fitur di plan ini harus memenuhi kriteria berikut untuk dianggap **selesai**:

### Technical Requirements (Wajib untuk Semua Fitur)
- [ ] **Backend API** - Semua endpoint bekerja dengan baik, documented di Postman/API docs
- [ ] **Frontend Pages** - UI responsive, mobile-friendly, tidak ada console errors
- [ ] **Database Migration** - Alembic migration script tested dan reversible
- [ ] **Authentication & Authorization** - JWT token, role-based access control implemented
- [ ] **Error Handling** - Graceful error handling, user-friendly error messages
- [ ] **Logging** - Key events logged untuk debugging

### Quality Requirements (Wajib untuk Semua Fitur)
- [ ] **Unit Tests** - Minimum 70% code coverage untuk backend
- [ ] **Integration Tests** - Critical paths tested end-to-end
- [ ] **Manual QA** - Tested di staging environment, test cases documented
- [ ] **Code Review** - Self-review (untuk solo dev) atau peer review (jika ada tim)
- [ ] **Performance** - Page load < 2 detik, API response < 500ms untuk 95th percentile

### Documentation Requirements (Wajib untuk Semua Fitur)
- [ ] **User Manual** - Basic usage instructions di `/docs` atau inline help
- [ ] **API Documentation** - Swagger/OpenAPI docs updated
- [ ] **Changelog** - Changes documented di CHANGELOG.md

### Deployment Requirements (Wajib untuk Semua Fitur)
- [ ] **Staging Deployment** - Deployed dan tested di staging
- [ ] **Feature Flags** (jika breaking change) - Can be toggled on/off
- [ ] **Rollback Plan** - Database rollback tested, deployment can be reverted

### Acceptance Criteria Template
Setiap fitur akan punya Acceptance Criteria (AC) spesifik yang mengikuti format:

```
**AC-X.Y: [Feature Name] - [Scenario]**
GIVEN [precondition]
WHEN [action]
THEN [expected result]

**Success Metrics:**
- [KPI 1]: [Target value]
- [KPI 2]: [Target value]
```

### Anti-Scope Creep Rules
1. **80/20 Rule** - Implement 20% features yang deliver 80% value dulu
2. **MVP First** - Build minimum viable product, iterate based on feedback
3. **Time Boxing** - Set hard deadline per fitur, cut features if over time
4. **No Perfectionism** - "Good enough" is better than "perfect but late"
5. **Feature Freeze** - No new features added during development phase

---

## Dependency Mapping & Feature Groups

### Group A: Data Foundation (Must Do First)
**Dependencies**: None - Foundation for other features

| Fitur | Estimasi | Risk Level | Resource |
|-------|----------|------------|----------|
| Data Warehouse Schema | 2-3 minggu | Medium | Database design |
| ETL Pipeline | 3-4 minggu | Medium | Python/SQL |
| Security & Auth Audit | 1-2 minggu | Low | Security review |

**Total**: 6-9 minggu

### Group B: Customer-Facing Features (High Priority)
**Dependencies**: 
- ✅ Week 1: Auth Architecture Decision (CRITICAL - must complete first)
- ✅ Group A: Security Audit

**⚠️ WARNING**: Jangan mulai fitur ini sebelum Week 1 auth decision selesai! Refactor auth di tengah jalan akan sangat mahal.

| Fitur | Estimasi | Risk Level | Resource |
|-------|----------|------------|----------|
| Customer Portal | 4-8 minggu | Medium | Full-stack dev |
| Helpdesk | 3-6 minggu | Low-Medium | Full-stack dev |
| Supplier Portal | 3-5 minggu | Medium | Full-stack dev |

**Total**: 10-19 minggu (parallel development possible)

### Group C: Intelligence Features
**Dependencies**: Group A (data warehouse)

| Fitur | Estimasi | Risk Level | Resource |
|-------|----------|------------|----------|
| Advanced BI & Analytics | 6-10 minggu | High | Data engineer + Frontend |
| Production Scheduling (Python) | 4-6 minggu | Medium | Algorithm dev |
| Warehouse Route Optimization | 3-5 minggu | Medium | Algorithm dev |

**Note**: Demand Forecasting ML (Phase 1 item 3) - **Merged into Advanced BI** sebagai satu workstream.

**Total**: 13-21 minggu (parallel development possible)

### Group D: IoT & Smart Factory
**Dependencies**: Group A + Infrastructure Prerequisites

| Fitur | Estimasi | Risk Level | Resource |
|-------|----------|------------|----------|
| IoT Infrastructure Setup | 2-4 minggu | High | DevOps + Hardware |
| Real-time OEE with IoT | 4-8 minggu | High | Embedded + Backend |
| Predictive Maintenance | 6-12 minggu | Very High | Data science + IoT |

**Note**: Real-time OEE Analysis (Phase 1 item 9) - **Merged with IoT Integration** (Phase 2 item 15) sebagai satu workstream.

**Total**: 12-24 minggu (sequential - infrastructure must be ready first)

### Group E: Optimization Features (C-Based - High Risk)
**Dependencies**: Group C (proven Python bottlenecks)

| Fitur | Estimasi | Risk Level | Resource |
|-------|----------|------------|----------|
| Production Scheduling (C) | 6-10 minggu | Very High | C/C++ expert |
| Warehouse Route (C) | 4-8 minggu | Very High | C/C++ expert |
| Demand Forecasting (C) | 8-12 minggu | Very High | ML + C expert |
| Quality Control CV | 10-16 minggu | Very High | ML + GPU expert |

**Warning**: Only attempt if Python implementation proven too slow via profiling.

### Group F: Support Features
**Dependencies**: Group A (minimal)

| Fitur | Estimasi | Risk Level | Resource |
|-------|----------|------------|----------|
| Contract Management | 2-4 minggu | Low | Backend dev |
| Document AI / OCR | 3-5 minggu | Medium | AI integration |
| Advanced Workflow | 4-6 minggu | Medium | Full-stack dev |
| Subscription Billing | 3-5 minggu | Medium | Backend dev |

---

## Revised Timeline (Realistic Solo Developer)

### Quarter 1: Foundation + Customer Features
- **Week 1: 🚨 AUTH ARCHITECTURE DECISION (CRITICAL)**
  - Day 1-2: Evaluate existing JWT, identify extension points
  - Day 3: Prototype Option A (Extended JWT)
  - Day 4: Test row-level security untuk data isolation
  - Day 5: Final decision, document architecture
  - **BLOCKER**: Jangan mulai coding Customer Portal sebelum ini selesai!
- Week 2-4: Data Warehouse Schema + ETL Pipeline
- Week 4-9: Customer Portal (MVP) - bisa mulai karena auth sudah fix
- Week 7-11: Helpdesk (parallel)

### Quarter 2: Intelligence + Optimization
- Week 11-18: Advanced BI (Python-based)
- Week 14-18: Production Scheduling (Python OR-Tools)
- Week 16-20: Warehouse Route Optimization (Python)

### Quarter 3: IoT (If Infrastructure Ready)
- Week 21-24: IoT Infrastructure (if budget available)
- Week 25-30: Real-time OEE with IoT

### Quarter 4: Final Integration & Hardening (NOT Testing from Scratch!)
**⚠️ Note**: Testing sudah berjalan parallel sejak Week 1. Q4 adalah final integration dan hardening, bukan mulai testing dari nol.

- **Week 31-34: Final Integration Testing**
  - Full system integration test (all modules)
  - Performance testing (load testing, stress testing)
  - Security audit dan penetration testing
  - User Acceptance Testing (UAT) dengan real users
- **Week 33-36: Hardening & Documentation**
  - Bug fixes dari UAT feedback
  - Production deployment preparation
  - Documentation finalization (user manual, API docs)
  - Monitoring and alerting setup
- **Week 37-40: Optional C optimization** (only if Python proven slow via profiling)

**Total**: 10-12 bulan untuk deliver yang benar-benar solid.

---

## Risk Assessment (Continued)

#### 5. Security Strategy Kurang Detail
**Problem**: Portal-portal baru (Customer, Supplier, Employee) hanya bilang "JWT authentication, role-based access" tanpa strategi konkret.

**Concerns**:
- Sistem existing sudah punya 40+ roles dan 200+ permissions
- Portal eksternal pakai auth system yang sama atau terpisah?
- Data isolation antara customers?

#### 6. Testing Strategy di Q4 (HIGH RISK - FIXED ✅)
**Problem (ORIGINAL)**: Testing strategy di Q4 berarti debugging regression di akhir, sangat mahal.

**Solution (APPLIED)**: ✅ **Shift-Left Testing** - Testing berjalan PARALLEL dengan development sejak Week 1

**Now Includes**:
- ✅ Week 1-2: Setup testing infrastructure, audit existing coverage
- ✅ Per-feature: Unit tests wajib (70% coverage) sebelum merge
- ✅ Regression tests per sprint (2 minggu sekali)
- ✅ Continuous Testing: Pre-commit → On Push → On PR → Nightly
- ✅ Database migration testing (forward + rollback)
- ✅ Feature flags untuk gradual rollout

**Q4 Focus**: Final Integration Testing & UAT (bukan bikin test suite dari nol)

---

## Revised Implementation Strategy

### Approach: Python-First, C-Only-When-Necessary

1. **Phase 1 Revised**: Gunakan Python + OR-Tools/SciPy untuk optimization
2. **C Extension**: Hanya untuk bottleneck yang sudah terbukti via profiling
3. **MVP First**: Build minimum viable product dulu, optimize later

### Prerequisite Infrastructure (Harus Dikerjakan Dulu)

#### Infrastructure Phase (Sebelum Fitur Baru)
1. **Database Schema Audit** - Cek readiness untuk multi-company, data warehouse
2. **DevOps Setup** - CI/CD, staging environment, automated testing
3. **Security Audit** - Auth strategy untuk external portals
4. **Hardware Procurement Plan** - GPU, IoT gateway (jika budget tersedia)

#### Timeline Infrastruktur: 2-4 minggu

---

## Security Strategy Detail

### External Portals (Customer, Supplier, Employee)

#### Option A: Shared Auth System (Recommended)
- Gunakan existing JWT auth system
- Tambahkan role khusus: `external_customer`, `external_supplier`
- Data isolation via row-level security di database
- Pro: Single sign-on experience
- Cons: More complex permission system

#### Option B: Separate Auth System
- Portal pakai auth system terpisah
- Integration via API keys/token exchange
- Pro: Isolation yang lebih kuat
- Cons: Double maintenance, user harus login terpisah

#### Data Isolation Strategy
```sql
-- Row-level security example
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_isolation ON sales_orders
  USING (customer_id = current_setting('app.current_customer_id')::int);
```

---

## Phase 1: Heavy Calculation Features (REVISED - Python-First)

### 1. Production Scheduling Optimization (Job Shop Scheduling)

#### Description
Optimize work order scheduling across multiple machines with various constraints (setup time, machine capacity, priority, due dates).

#### Algorithm Options
- Genetic Algorithm
- Simulated Annealing
- Tabu Search
- Ant Colony Optimization

#### Complexity
- NP-hard problem
- Exponential time complexity for exact solutions
- Heuristic approaches required for large-scale problems

#### Implementation Strategy (Python-First)
- **Phase 1**: Start with **Python + OR-Tools** or **SciPy Optimize**
  - Use Constraint Programming or Genetic Algorithm via OR-Tools
  - Sufficient for most SME scheduling needs
- **Phase 2 (C Extension)**: Only if Python proven too slow via profiling
  - Use Cython for 10-50x speedup on bottleneck functions
  - Keep C code minimal and well-documented

#### Implementation
- **Module**: `production.py`, `schedule_grid.py`
- **Integration**: Python OR-Tools (default) → Cython (if needed)
- **Use Case**: Auto-schedule work orders with optimal machine assignment

#### Expected Benefits
- Reduced production lead time
- Better machine utilization
- Fewer schedule conflicts

#### Definition of Done (DoD)
**MVP Scope (Must Have):**
- [ ] Algorithm can schedule 50+ work orders across 10+ machines in < 5 seconds
- [ ] Respects constraints: machine capacity, setup time, due dates
- [ ] UI to view/edit generated schedule
- [ ] Can regenerate schedule when new work order added

**Out of Scope (Nice to Have):**
- [ ] Real-time automatic rescheduling
- [ ] Multi-objective optimization (cost + time)
- [ ] Cython optimization (only if Python < 10 sec proven)

**Acceptance Criteria:**
- **AC-1.1**: GIVEN 50 work orders with various constraints, WHEN scheduling algorithm runs, THEN all work orders scheduled without conflicts in < 5 seconds
- **AC-1.2**: GIVEN new urgent work order, WHEN user clicks reschedule, THEN algorithm updates schedule in < 5 seconds

**Success Metrics:**
- Schedule generation time: < 5 seconds for 50 work orders
- Machine utilization improved by > 10% vs manual scheduling
- Zero scheduling conflicts in generated schedule

---

### 2. Warehouse Route Optimization (Picking Path)

#### Description
Calculate optimal picking routes for warehouse workers to minimize travel distance and time.

#### Algorithm Options
- Traveling Salesman Problem (TSP) solvers
- Vehicle Routing Problem (VRP)
- Nearest Neighbor heuristic
- 2-opt optimization

#### Complexity
- NP-hard for exact solutions
- Polynomial for heuristic approaches
- Real-time calculation required

#### Implementation Strategy (Python-First)
- **Phase 1**: Start with **Python + NetworkX** or **OR-Tools**
  - Nearest Neighbor + 2-opt heuristic (fast, good enough)
  - TSP solver for small-medium warehouses (< 1000 locations)
- **Phase 2 (C Extension)**: Only if real-time requirement not met
  - Warehouse > 10,000 locations
  - Sub-second response time required

#### Implementation
- **Module**: `warehouse.py`, `warehouse_enhanced.py`
- **Integration**: Python OR-Tools/NetworkX (default) → Cython (if needed)
- **Use Case**: Generate optimal picking routes for orders

#### Expected Benefits
- Reduced picking time
- Lower labor costs
- Improved warehouse efficiency

#### Definition of Done (DoD)
**MVP Scope (Must Have):**
- [ ] Route optimization for single warehouse (< 500 locations)
- [ ] Nearest Neighbor + 2-opt heuristic
- [ ] Integration with picking order workflow
- [ ] Route displayed on warehouse map/floor plan

**Out of Scope (Nice to Have):**
- [ ] Multi-warehouse route optimization
- [ ] Real-time route updates during picking
- [ ] C extension for large warehouses (> 5000 locations)

**Acceptance Criteria:**
- **AC-2.1**: GIVEN picking order with 20 items, WHEN route optimization runs, THEN route calculated in < 2 seconds
- **AC-2.2**: GIVEN optimized route vs manual route, WHEN compared, THEN distance reduced by > 15%

**Success Metrics:**
- Route calculation time: < 2 seconds for 50 items
- Average picking time reduced by > 10%
- Route distance 15% shorter than manual routing

---

### 3. Demand Forecasting with Machine Learning

#### Description
Advanced demand forecasting using time series analysis and machine learning models.

#### Algorithm Options
- ARIMA/SARIMA
- LSTM Neural Networks
- Prophet (Facebook)
- Ensemble methods (Random Forest, XGBoost)
- Exponential Smoothing

#### Complexity
- Model training: Heavy computation
- Inference: Light to medium
- Feature engineering: Medium

#### Implementation Strategy (Python-First)
- **Phase 1**: Start with **Prophet**, **ARIMA**, or **scikit-learn**
  - Facebook Prophet: Easy to use, automatic seasonality detection
  - Statsmodels ARIMA: For time series with trends
  - XGBoost/LightGBM: For regression with multiple features
- **Phase 2 (Deep Learning)**: Only if statistical methods insufficient
  - LSTM/Transformer for complex seasonality patterns
  - Requires ML expertise and significant data

#### Implementation
- **Module**: `mrp.py`, `sales.py`
- **Integration**: Prophet/scikit-learn (default) → TensorFlow/PyTorch (if needed)
- **Use Case**: Predict future demand for MRP and inventory planning

#### Expected Benefits
- Better inventory accuracy
- Reduced stockouts
- Lower carrying costs

#### Definition of Done (DoD)
**MVP Scope (Must Have):**
- [ ] Prophet or ARIMA model for top 20 products by volume
- [ ] 30-day and 90-day forecasts
- [ ] Dashboard showing forecast vs actual
- [ ] Alert when forecast variance > 20%

**Out of Scope (Nice to Have):**
- [ ] Deep learning models (LSTM, Transformer)
- [ ] Multi-variate forecasting (weather, seasonality, promotions)
- [ ] Auto-reorder suggestions

**Acceptance Criteria:**
- **AC-3.1**: GIVEN 2 years historical data, WHEN model trained, THEN MAPE (Mean Absolute Percentage Error) < 20%
- **AC-3.2**: GIVEN forecast dashboard, WHEN user views it, THEN can see next 30/90 days forecast with confidence intervals

**Success Metrics:**
- Forecast accuracy (MAPE): < 20%
- Stockout incidents reduced by > 15%
- Inventory carrying cost reduced by > 5%

---

### 4. Predictive Maintenance

#### Description
Predict machine failures before they occur using sensor data and historical maintenance records.

#### Algorithm Options
- Anomaly Detection (Isolation Forest, One-Class SVM)
- Survival Analysis (Cox Proportional Hazards)
- Time Series Forecasting
- Regression models (RUL prediction)

#### Complexity
- Real-time analysis required
- Pattern recognition on sensor data
- Feature extraction from time series

#### Implementation Strategy (Python-First)
- **Phase 1**: Start with **scikit-learn anomaly detection**
  - Isolation Forest for anomaly detection on sensor data
  - Logistic Regression for failure probability
  - Rule-based alerts for known failure patterns
- **Phase 2 (Real-time C Extension)**: Only if high-frequency data (> 1Hz)
  - For IoT sensors streaming > 1000 data points/second
  - Keep Python for model training, C for inference only

#### Implementation
- **Module**: `maintenance.py`, `oee.py`
- **Integration**: scikit-learn (default) → C Extension (if high-frequency needed)
- **Use Case**: Alert before machine breakdown

#### Expected Benefits
- Reduced unplanned downtime
- Lower maintenance costs
- Extended equipment life

---

### 5. Quality Control with Computer Vision

#### Description
Automated defect detection using image processing and deep learning.

#### Algorithm Options
- Convolutional Neural Networks (CNN)
- Object Detection (YOLO, SSD)
- Image Classification
- Anomaly detection on images

#### Complexity
- Very heavy (deep learning inference)
- GPU acceleration recommended
- Real-time processing requirements

#### Implementation Strategy (API-First, Not Custom)
- **Phase 1**: Use **Cloud Vision API** (Google, AWS, Azure)
  - Pre-trained models for common defects
  - No ML expertise needed
  - Pay-per-use, scalable
- **Phase 2 (Custom Model)**: Only if API insufficient
  - Train custom model with YOLO/EfficientNet
  - Requires GPU + ML engineer
- **⚠️ Not Recommended**: Building custom C extension for CV
  - Use existing libraries (OpenCV Python bindings, TensorFlow)
  - Writing custom C for CV is extremely high risk

#### Implementation
- **Module**: `quality.py`
- **Integration**: Cloud Vision API (default) → Custom model (if needed)
- **Use Case**: Automatic defect detection on production line

#### Expected Benefits
- Improved quality consistency
- Reduced manual inspection
- Faster defect detection

---

### 6. Multi-Echelon Inventory Optimization

#### Description
Optimize inventory levels across multiple warehouse locations with demand uncertainty.

#### Algorithm Options
- Stochastic optimization
- Dynamic programming
- Mixed-integer programming
- Simulation-based optimization

#### Complexity
- Large-scale optimization
- Many variables and constraints
- Stochastic elements

#### Implementation Strategy (Python-First)
- **Phase 1**: Start with **Python + OR-Tools** or **PuLP**
  - Linear programming for inventory allocation
  - Simulation with SimPy for what-if analysis
- **Phase 2 (C Extension)**: Only if optimization > 10 seconds
  - Large network: > 50 warehouses × 1000 SKUs
  - Real-time rebalancing requirements

#### Implementation
- **Module**: `warehouse_enhanced.py`, `mrp.py`
- **Integration**: Python OR-Tools/PuLP (default) → Cython (if needed)
- **Use Case**: Optimal inventory distribution across warehouses

#### Expected Benefits
- Reduced total inventory cost
- Better service levels
- Lower stockouts

---

### 7. Production Line Balancing

#### Description
Distribute workload evenly across workstations to minimize bottlenecks.

#### Algorithm Options
- Integer programming
- Heuristic algorithms
- Genetic algorithms
- Simulated annealing

#### Complexity
- Combinatorial optimization
- NP-hard for exact solutions
- Medium to large scale

#### Implementation Strategy (Python-First)
- **Phase 1**: Start with **Python + OR-Tools** or **heuristic algorithms**
  - Ranked positional weight method (simple heuristic)
  - COMSOAL algorithm for line balancing
- **Phase 2 (C Extension)**: Rarely needed for line balancing
  - Only if > 100 workstations × 1000 tasks
  - Python usually sufficient

#### Implementation
- **Module**: `production.py`
- **Integration**: Python heuristic/constraint programming (default)
- **Use Case**: Balance production line workload

#### Expected Benefits
- Reduced bottlenecks
- Higher throughput
- Better resource utilization

---

### 8. Supply Chain Network Optimization

#### Description
Optimize the entire supply chain network from suppliers to customers.

#### Algorithm Options
- Network flow optimization
- Mixed-integer programming
- Multi-objective optimization
- Constraint programming

#### Complexity
- Large-scale optimization
- Multiple echelons
- Many constraints

#### Implementation Strategy (Python-First)
- **Phase 1**: Start with **Python + OR-Tools** or **NetworkX**
  - Network flow algorithms for distribution
  - Facility location heuristics
  - Free and open-source
- **Phase 2 (Commercial Solver)**: Only if enterprise-scale
  - > 1000 nodes in supply chain network
  - Complex multi-objective optimization
  - Budget for Gurobi/CPLEX license ($10k+/year)

#### Implementation
- **Module**: `mrp.py`, `purchasing.py`
- **Integration**: Python OR-Tools/NetworkX (default) → Commercial solver (if enterprise)
- **Use Case**: Optimal supply chain configuration

#### Expected Benefits
- Lower total supply chain cost
- Improved service levels
- Better risk management

---

### 9. Real-time OEE Analysis with Streaming Data

#### Description
Real-time analysis of OEE metrics from high-frequency sensor data.

#### Algorithm Options
- Time series analysis
- Moving window calculations
- Anomaly detection
- Statistical process control

#### Complexity
- High-frequency data processing
- Real-time requirements
- Large data volumes

#### Implementation Strategy (Python-First)
- **Phase 1**: Start with **Python + InfluxDB/TimescaleDB**
  - Time-series database for sensor data
  - Python pandas for OEE calculations
  - Sufficient for 1Hz - 10Hz data rates
- **Phase 2 (C Extension)**: Only if high-frequency streaming
  - > 100Hz data rates from machines
  - Sub-millisecond latency requirements
  - Use C for data ingestion, Python for analysis

**Note**: Real-time OEE Analysis merged with IoT Integration workstream

#### Implementation
- **Module**: `oee.py`, `live_monitoring.py`
- **Integration**: Python time-series stack (default) → C for ingestion (if needed)
- **Use Case**: Real-time OEE monitoring and alerting

#### Expected Benefits
- Immediate performance feedback
- Faster issue detection
- Better process control

---

### 10. Advanced Material Requirements Planning

#### Description
MRP with multi-objective optimization (cost, lead time, quality).

#### Algorithm Options
- Multi-objective optimization
- Constraint programming
- Goal programming
- Pareto optimization

#### Complexity
- Multiple objectives
- Many constraints
- Large-scale problem

#### Implementation Strategy (Python-First)
- **Phase 1**: Start with **Python + OR-Tools** or **PuLP**
  - Multi-objective optimization with weighted goals
  - Constraint programming for material allocation
- **Phase 2 (C Extension)**: Only if complex trade-offs
  - > 10 objectives with Pareto optimization
  - Large-scale stochastic programming

#### Implementation
- **Module**: `mrp.py`
- **Integration**: Python OR-Tools/PuLP (default) → Cython (if needed)
- **Use Case**: Optimal material planning with trade-offs

#### Expected Benefits
- Better cost optimization
- Improved lead time management
- Balanced decision making

---

## Phase 2: New Feature Modules

### 11. Customer Service / Helpdesk ⭐ HIGH PRIORITY

#### Description
Ticket management system for handling customer complaints, inquiries, and support requests.

#### Features
- Ticket creation and tracking
- SLA management and alerts
- Knowledge base
- Email integration
- Escalation rules
- Customer satisfaction surveys
- Multi-channel support (email, phone, chat)

#### Implementation
- **Backend**: `routes/helpdesk.py`, `models/helpdesk.py`
- **Frontend**: `pages/Helpdesk/`
- **Integration**: Sales Orders, Shipping, Quality

#### Expected Benefits
- Better customer satisfaction
- Faster issue resolution
- Reduced support workload

#### Definition of Done (DoD)
**MVP Scope (Must Have):**
- [ ] Customer can create ticket via web form
- [ ] Support staff can view/assign/resolve tickets
- [ ] Email notifications for ticket updates
- [ ] Basic ticket status tracking (Open → In Progress → Resolved)
- [ ] Knowledge base with 20+ articles

**Out of Scope (Nice to Have):**
- [ ] Live chat integration
- [ ] SLA tracking and alerts
- [ ] Customer satisfaction surveys
- [ ] AI-powered ticket routing

**Acceptance Criteria:**
- **AC-11.1**: GIVEN customer creates ticket, WHEN submitted, THEN support staff receives notification within 1 minute
- **AC-11.2**: GIVEN ticket assigned to staff, WHEN staff updates status, THEN customer receives email notification
- **AC-11.3**: GIVEN ticket in "Resolved" status, WHEN 7 days passed without reopen, THEN automatically closed

**Success Metrics:**
- Ticket response time: < 4 hours (business hours)
- Ticket resolution time: < 48 hours for standard issues
- Self-service rate: > 30% via knowledge base

---

### 12. Customer Portal ⭐ HIGH PRIORITY

#### Description
Self-service portal for customers to view their orders, invoices, and submit requests.

#### Features
- Order status tracking
- Invoice download
- Certificate of Analysis (COA) download
- Submit complaints/tickets
- Track shipments
- View account balance
- Request quotes

#### Implementation
- **Backend**: `routes/customer_portal.py`, `models/customer_portal.py`
- **Frontend**: `pages/CustomerPortal/`
- **Security**: JWT authentication, role-based access

**⚠️ PREREQUISITE**: Week 1 Auth Architecture Decision harus selesai dan documented sebelum mulai coding fitur ini!

#### Expected Benefits
- Improved customer experience
- Reduced support calls
- 24/7 self-service availability

#### Definition of Done (DoD)
**MVP Scope (Must Have):**
- [ ] Customer can view order status and history
- [ ] Customer can download invoices and delivery notes
- [ ] Customer can view account balance and payment history
- [ ] Customer can submit support ticket
- [ ] Mobile-responsive design

**Out of Scope (Nice to Have):**
- [ ] Real-time order tracking with GPS
- [ ] Online payment integration
- [ ] Request quotes online
- [ ] Multi-language support

**Acceptance Criteria:**
- **AC-12.1**: GIVEN customer logged in, WHEN clicks "My Orders", THEN sees last 50 orders with status
- **AC-12.2**: GIVEN order delivered, WHEN customer views it, THEN can download invoice PDF
- **AC-12.3**: GIVEN customer on mobile, WHEN accessing portal, THEN all features work without horizontal scroll

**Success Metrics:**
- Portal adoption rate: > 60% of active customers
- Support call reduction: > 20% for order status inquiries
- Customer satisfaction: > 4.0/5.0 rating

---

### 13. Supplier Portal

#### Description
Portal for suppliers to manage purchase orders, submit invoices, and track payments.

#### Features
- View purchase orders
- Submit delivery confirmations
- Upload invoices
- Track payment status
- Submit price quotes
- View supplier performance metrics
- Update company information

#### Implementation
- **Backend**: `routes/supplier_portal.py`, `models/supplier_portal.py`
- **Frontend**: `pages/SupplierPortal/`
- **Security**: Supplier-specific authentication

**⚠️ PREREQUISITE**: Week 1 Auth Architecture Decision harus selesai dan documented sebelum mulai coding fitur ini!

#### Expected Benefits
- Better supplier collaboration
- Reduced manual communication
- Faster procurement cycle

#### Definition of Done (DoD)
**MVP Scope (Must Have):**
- [ ] Supplier can view purchase orders assigned to them
- [ ] Supplier can confirm PO and update delivery date
- [ ] Supplier can upload delivery documents
- [ ] Supplier can view payment status
- [ ] Email notifications for new POs

**Out of Scope (Nice to Have):**
- [ ] Supplier performance dashboard
- [ ] Online price quote submission
- [ ] Supplier quality metrics
- [ ] Invoice submission portal

**Acceptance Criteria:**
- **AC-13.1**: GIVEN new PO created, WHEN saved, THEN supplier receives email notification within 5 minutes
- **AC-13.2**: GIVEN supplier confirms PO, WHEN confirmed, THEN procurement team receives notification
- **AC-13.3**: GIVEN delivery completed, WHEN supplier uploads documents, THEN auto-linked to GRN

**Success Metrics:**
- Supplier adoption rate: > 70% of active suppliers
- PO confirmation time reduced by > 30%
- Manual communication reduced by > 40%

---

### 14. Advanced Business Intelligence & Analytics ⭐ HIGH PRIORITY

#### Description
Enhanced analytics with data warehouse, OLAP, and self-service reporting.

#### Features
- Data warehouse with star schema
- OLAP cubes for multi-dimensional analysis
- Drag-and-drop report builder
- Dashboard with drill-down capabilities
- Scheduled report generation
- Data export (Excel, PDF, CSV)
- Predictive analytics integration

#### Implementation
- **Backend**: `routes/bi.py`, `models/analytics.py`
- **Frontend**: `pages/BI/`
- **Database**: Data warehouse tables
- **Tools**: Apache Superset atau custom solution

#### Expected Benefits
- Better decision making
- Self-service analytics
- Real-time insights

#### Definition of Done (DoD)
**MVP Scope (Must Have):**
- [ ] 5 key dashboards: Sales, Production, Inventory, Finance, HR
- [ ] Data warehouse with daily ETL refresh
- [ ] Drag-and-drop report builder (basic)
- [ ] Scheduled email reports (daily/weekly)
- [ ] Export to Excel/PDF

**Out of Scope (Nice to Have):**
- [ ] Real-time streaming analytics
- [ ] Predictive analytics models
- [ ] Custom KPI builder
- [ ] Advanced visualizations (sankey, heatmaps)

**Acceptance Criteria:**
- **AC-14.1**: GIVEN user opens dashboard, WHEN data loaded, THEN dashboard displays in < 3 seconds
- **AC-14.2**: GIVEN user creates custom report, WHEN saved, THEN can schedule auto-email daily
- **AC-14.3**: GIVEN dashboard data, WHEN exported, THEN Excel file downloads correctly

**Success Metrics:**
- Dashboard adoption: > 50% of managers use weekly
- Report generation time: < 5 seconds
- Data freshness: Daily (last 24 hours max)

---

### 15. IoT Integration & Smart Factory ⭐ HIGH PRIORITY

#### Description
Integration with IoT sensors and devices for smart manufacturing.

#### Features
- Real-time sensor data collection (temperature, pressure, humidity)
- Machine status monitoring
- Energy consumption tracking
- Environmental monitoring
- Predictive maintenance alerts
- Automated quality checks
- OEE real-time dashboard

#### Implementation
- **Backend**: `routes/iot.py`, `models/iot.py`
- **Frontend**: `pages/IoT/`, enhanced `pages/OEE/`
- **Protocol**: MQTT, OPC-UA
- **Hardware**: IoT gateways, sensors

#### Expected Benefits
- Real-time production visibility
- Reduced downtime
- Energy cost savings

#### Definition of Done (DoD)
**MVP Scope (Must Have):**
- [ ] MQTT broker setup and connection to 5+ machines
- [ ] Real-time OEE dashboard (Availability, Performance, Quality)
- [ ] Alert when OEE < target threshold
- [ ] Historical data storage (30 days)
- [ ] Machine status indicator (Running, Idle, Down)

**Out of Scope (Nice to Have):**
- [ ] Predictive maintenance alerts
- [ ] Energy consumption tracking
- [ ] Environmental monitoring (temp, humidity)
- [ ] Machine learning on sensor data

**Acceptance Criteria:**
- **AC-15.1**: GIVEN machine running, WHEN sensor sends data, THEN dashboard updates in < 5 seconds
- **AC-15.2**: GIVEN OEE drops below 70%, WHEN threshold crossed, THEN alert sent to production manager
- **AC-15.3**: GIVEN user opens OEE dashboard, WHEN viewing, THEN can see last 24 hours trend

**Success Metrics:**
- Data latency: < 5 seconds from machine to dashboard
- Alert response time: < 1 minute
- Uptime monitoring coverage: > 80% of production machines

---

### 16. Contract Management

#### Description
Manage supplier contracts, customer agreements, and service level agreements.

#### Features
- Contract repository
- Expiry date tracking and alerts
- Auto-renewal management
- Contract value analysis
- Amendment tracking
- Approval workflows
- Contract templates

#### Implementation
- **Backend**: `routes/contracts.py`, `models/contracts.py`
- **Frontend**: `pages/Contracts/`
- **Integration**: Purchasing, Sales, Finance

#### Expected Benefits
- No missed contract renewals
- Better contract compliance
- Improved supplier management

#### Definition of Done (DoD)
**MVP Scope (Must Have):**
- [ ] Contract repository with search
- [ ] Expiry date alerts (30, 15, 7 days before)
- [ ] Contract value tracking
- [ ] Basic approval workflow (Create → Review → Approved)
- [ ] Contract document upload and versioning

**Out of Scope (Nice to Have):**
- [ ] Contract AI analysis
- [ ] Compliance tracking per clause
- [ ] Integration with e-signature (DocuSign)
- [ ] Contract performance metrics

**Acceptance Criteria:**
- **AC-16.1**: GIVEN contract expires in 30 days, WHEN daily check runs, THEN alert email sent to responsible person
- **AC-16.2**: GIVEN user searches contract, WHEN entering keywords, THEN results appear in < 2 seconds
- **AC-16.3**: GIVEN contract uploaded, WHEN new version added, THEN old version preserved with version number

**Success Metrics:**
- Contract renewal on-time rate: > 95%
- Contract search time: < 2 seconds
- Contract approval time: < 5 days

---

### 17. Subscription & Recurring Billing

#### Description
Handle subscription-based products and services with automated billing.

#### Features
- Subscription plans management
- Recurring invoice generation
- Payment collection automation
- Prorated billing
- Subscription upgrades/downgrades
- Dunning management (failed payments)
- Revenue recognition

#### Implementation
- **Backend**: `routes/subscription.py`, `models/subscription.py`
- **Frontend**: `pages/Subscription/`
- **Integration**: Finance, Sales

#### Expected Benefits
- Predictable revenue stream
- Automated billing process
- Reduced manual invoicing

---

### 18. Advanced Workflow Automation

#### Description
Visual workflow builder with conditional logic and automated actions.

#### Features
- Drag-and-drop workflow designer
- Conditional logic (if-then-else)
- Auto-approval based on rules
- Parallel and sequential approvals
- Escalation rules with timers
- Email notifications
- Integration with external systems

#### Implementation
- **Backend**: `routes/workflow_advanced.py`, `models/workflow_advanced.py`
- **Frontend**: `pages/WorkflowDesigner/`
- **Engine**: Custom workflow engine or Camunda/n8n

#### Expected Benefits
- Faster approval processes
- Reduced manual work
- Better compliance

---

### 19. Document AI / OCR

#### Description
Automated document processing using AI and OCR technology.

#### Features
- Auto-extract data from invoices, POs, receipts
- Smart document classification
- Auto-routing based on document type
- Data validation and verification
- Integration with document management
- Multi-language support

#### Implementation
- **Backend**: `routes/document_ai.py`
- **Integration**: DCC, Purchasing, Finance
- **Tools**: Tesseract, Google Cloud Vision, AWS Textract

#### Expected Benefits
- Reduced manual data entry
- Faster document processing
- Improved accuracy

---

### 20. Employee Self-Service Portal

#### Description
Portal for employees to manage their own HR-related tasks.

#### Features
- Payslip download
- Leave request submission
- Profile updates
- Training enrollment
- Attendance tracking
- Benefits information
- Company announcements

#### Implementation
- **Backend**: `routes/employee_portal.py`
- **Frontend**: `pages/EmployeePortal/`
- **Integration**: HR, Payroll, Attendance

#### Expected Benefits
- Reduced HR administrative work
- Improved employee satisfaction
- 24/7 access to HR services

---

### 21. Field Service Management (jika ada service di lokasi customer)

#### Description
Manage field service operations for on-site customer support.

#### Features
- Service appointment scheduling
- Technician dispatch
- Mobile app for field technicians
- Service reporting
- Parts inventory tracking
- Customer signature capture
- Service history

#### Implementation
- **Backend**: `routes/field_service.py`, `models/field_service.py`
- **Frontend**: `pages/FieldService/`, Mobile App
- **Integration**: Maintenance, Sales, Warehouse

#### Expected Benefits
- Faster service response
- Better technician utilization
- Improved customer satisfaction

---

### 22. Fleet/Vehicle Management (jika ada delivery fleet)

#### Description
Manage company vehicles and delivery fleet operations.

#### Features
- Vehicle tracking (GPS)
- Maintenance schedules
- Fuel consumption tracking
- Driver management
- Route optimization
- Vehicle utilization reports
- Compliance tracking

#### Implementation
- **Backend**: `routes/fleet.py`, `models/fleet.py`
- **Frontend**: `pages/Fleet/`
- **Integration**: Shipping, Maintenance, HR

#### Expected Benefits
- Reduced fuel costs
- Better vehicle maintenance
- Improved delivery efficiency

---

## Phase 3: Integration & External Systems

### 23. E-Commerce / B2B Web Shop

#### Description
Online store for B2B customers to place orders directly.

#### Features
- Product catalog with pricing
- Online ordering
- Account-based pricing
- Order history
- Reorder functionality
- Payment gateway integration
- Inventory availability check

#### Implementation
- **Backend**: `routes/ecommerce.py`
- **Frontend**: `pages/ECommerce/` atau separate web app
- **Integration**: Sales, Warehouse, Finance

---

### 24. Point of Sale (POS) System

#### Description
Retail POS system for direct sales operations.

#### Features
- Quick checkout
- Barcode scanning
- Multiple payment methods
- Receipt printing
- Cash management
- Shift management
- End-of-day reconciliation

#### Implementation
- **Backend**: `routes/pos.py`
- **Frontend**: `pages/POS/` atau standalone app
- **Hardware**: Barcode scanner, receipt printer, cash drawer

---

### 25. Multi-Currency & Multi-Company Support

#### Description
Support for multiple currencies and company entities.

#### Features
- Real-time exchange rate updates
- Multi-currency transactions
- Currency conversion
- Consolidated reporting
- Inter-company transactions
- Transfer pricing

#### Implementation
- **Backend**: Enhance `routes/finance.py`, `models/finance.py`
- **Frontend**: Enhance `pages/Finance/`
- **Integration**: Exchange rate APIs

---

### 26. API Gateway & Third-Party Integrations

#### Description
Centralized API management and integrations with external systems.

#### Integrations
- Accounting software (QuickBooks, Xero)
- Shipping carriers (FedEx, UPS, DHL)
- Payment gateways (Stripe, PayPal)
- E-commerce platforms (Shopify, WooCommerce)
- Government APIs (tax, customs)
- Banking APIs

#### Implementation
- **Backend**: `routes/integrations.py`
- **Tools**: Zapier, n8n, atau custom integrations

---

## Implementation Priority (Revised - Python-First)

### Phase 1: Foundation (Q1) - High Priority
**Dependencies**: None (start here)

1. **Data Warehouse Schema** - Foundation for all BI features
2. **Security & Auth Audit** - Required for external portals
3. **Customer Portal** - Direct customer experience improvement
4. **Helpdesk** - Customer support efficiency

### Phase 2: Intelligence (Q2) - High Priority
**Dependencies**: Phase 1 complete

5. **Advanced BI & Analytics** - Better decision making (Python-based)
6. **Production Scheduling (Python + OR-Tools)** - Production efficiency
7. **Warehouse Route Optimization (Python)** - Warehouse efficiency

### Phase 3: Enhancement (Q3) - Medium Priority
**Dependencies**: Phase 2 complete, infrastructure ready

8. **Supplier Portal** - Supply chain optimization
9. **Advanced Workflow** - Operational efficiency
10. **Contract Management** - Better compliance
11. **Document AI** - Reduced manual work (API-based, not custom ML)
12. **IoT Integration** - Smart factory (only if hardware budget available)

### Phase 4: C-Optimization (Q4+) - Conditional Priority
**⚠️ Only if Python implementation proven too slow via profiling**

13. **Production Scheduling (C)** - Only if Python version bottleneck
14. **Warehouse Route (C)** - Only if Python version bottleneck

### Phase 5: Advanced Features (Year 2) - Low Priority
**Only if resources and budget permit**

15. **Subscription Billing** - If applicable to business model
16. **E-Commerce** - If B2C or B2B online sales needed
17. **Field Service** - If on-site service offered
18. **Employee Portal** - HR efficiency
19. **Multi-Currency Support** - If international operations

### Research Phase (Future Exploration)
**Require significant investment and expertise**

20. **Quality Control with Computer Vision** - Requires GPU + ML expertise
21. **Predictive Maintenance** - Requires sensor infrastructure + data science
22. **Demand Forecasting ML** - Requires data science expertise
23. **Supply Chain Network Optimization** - Requires commercial solver license

---

## Infrastructure Budget Estimate

### Hardware Requirements & Costs

| Component | Specification | Estimated Cost (USD) | Priority |
|-----------|--------------|----------------------|----------|
| **GPU Server** | NVIDIA RTX 4090 / A4000 | $2,000 - $4,000 | Optional (Year 2) |
| **IoT Gateway** | Industrial IoT Gateway | $500 - $2,000 | Only if IoT features needed |
| **MQTT Broker** | Self-hosted vs Cloud | $0 (self) / $50/mo (cloud) | Only if IoT features needed |
| **Sensors** | Temperature, pressure, vibration | $100 - $500 per machine | Only if Predictive Maintenance |
| **Production Server Upgrade** | More RAM, SSD | $1,000 - $3,000 | Medium |
| **Backup Storage** | NAS / Cloud backup | $500 - $1,500 | High |
| **Development Machine** | Workstation upgrade | $1,500 - $3,000 | Medium |

**Total Essential**: $3,000 - $7,500 (without IoT/ML)
**Total With IoT/ML**: $8,000 - $20,000+

### Software & Service Costs (Annual)

| Service | Cost (USD/year) | Notes |
|---------|----------------|-------|
| **Commercial Solver** (Gurobi/CPLEX) | $10,000 - $50,000 | Only if needed for optimization |
| **Cloud ML API** (Google Vision, AWS Textract) | $100 - $2,000 | For Document AI |
| **Monitoring Tools** (Sentry, etc.) | $500 - $2,000 | Recommended |
| **CI/CD** (GitHub Actions, etc.) | $0 - $500 | Optional |
| **Staging Environment** | $500 - $1,500 | Highly recommended |

### ROI Decision Framework

#### When to Invest in Hardware?

**GPU Server**
- ✅ Production volume > 100,000 units/day
- ✅ Quality defects cost > $10,000/month
- ✅ Have ML engineer on team
- ❌ Volume < 10,000 units/day (manual QC sufficient)

**IoT Infrastructure**
- ✅ Downtime cost > $5,000/hour
- ✅ Machine breakdown > 2x per month
- ✅ Maintenance team > 5 people
- ❌ Small workshop (< 5 machines)

**Commercial Solver License**
- ✅ Scheduling complexity > 50 machines × 100 jobs
- ✅ Python OR-Tools proven insufficient
- ✅ Save > $50,000/year in efficiency
- ❌ Can use free OR-Tools or Google OR-Tools

### Phased Investment Recommendation

**Phase 1 (Q1): $500 - $2,000**
- Backup storage
- Staging environment
- Monitoring tools

**Phase 2 (Q2): $1,000 - $3,000**
- Production server upgrade
- Development tools

**Phase 3+ (Q3+): $5,000 - $20,000+**
- Only if Phase 1 & 2 successful
- IoT hardware (if business case proven)
- GPU server (if ML features justified)

---

## Technical Considerations

### C Integration Methods
1. **Python C Extension** - Best performance, most complex
2. **Cython** - Good balance of performance and ease of use
3. **ctypes/cffi** - For existing C libraries
4. **PyBind11** - For C++ code
5. **Commercial Solvers** - Gurobi, CPLEX for optimization problems

### Performance Requirements
- **Real-time**: < 100ms response time
- **Batch**: Can take minutes to hours
- **Interactive**: < 1 second response time

### Hardware Requirements
- **CPU**: Multi-core for parallel processing
- **GPU**: For deep learning (Quality Control)
- **Memory**: Sufficient RAM for large datasets
- **Storage**: Fast SSD for I/O intensive operations

---

## Development Roadmap (Revised - Aligned with Timeline)

### Quarter 1: Foundation + Customer Features
- Week 1-3: Data Warehouse Schema + Security Audit
- Week 3-8: Customer Portal (MVP)
- Week 6-10: Helpdesk (parallel)

### Quarter 2: Intelligence + Optimization (Python-Based)
- Week 11-18: Advanced BI & Analytics (Python)
- Week 14-18: Production Scheduling (Python + OR-Tools)
- Week 16-20: Warehouse Route Optimization (Python)

### Quarter 3: Enhancement + IoT (If Ready)
- Week 21-24: IoT Infrastructure (if budget available)
- Week 21-26: Supplier Portal
- Week 25-30: Real-time OEE with IoT
- Week 26-32: Advanced Workflow + Contract Management

### Quarter 4: Final Integration + C-Optimization (Conditional)
**⚠️ Note**: Testing sudah berjalan parallel sejak Week 1 via Shift-Left approach.

- **Week 31-34: Final Integration & UAT**
  - Full system integration test
  - User Acceptance Testing dengan real users
  - Performance testing (load, stress)
- **Week 33-36: Hardening & Documentation**
  - Bug fixes dari UAT
  - Production deployment prep
  - Documentation finalization
- **Week 37-40: Optional C optimization** (only if Python proven slow)

### Year 2: Advanced Features (If Resources Permit)
- Q5: Subscription Billing, E-Commerce (if needed)
- Q6: Field Service, Employee Portal (if needed)
- Q7-Q8: Advanced ML features (only with proper resources)

---

## References

### Optimization Libraries
- Google OR-Tools
- SciPy Optimization
- Pyomo
- CVXPY

### Machine Learning Libraries
- TensorFlow
- PyTorch
- scikit-learn
- XGBoost

### Commercial Solvers
- Gurobi
- CPLEX
- FICO Xpress

### IoT & Integration
- MQTT (Eclipse Mosquitto)
- OPC-UA
- Apache Kafka
- Node-RED

---

## Notes
- All features should be benchmarked against pure Python implementation
- Consider maintainability vs performance trade-offs
- Document C code thoroughly for future maintenance
- Provide fallback to Python implementation if C module fails
- Prioritize features based on business impact and ROI
