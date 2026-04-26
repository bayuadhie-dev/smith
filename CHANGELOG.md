# Changelog

All notable changes to SMITH ERP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CI/CD pipeline with GitHub Actions
- Comprehensive test suite with 50%+ coverage
- Proprietary license for commercial use

---

## [3.1.1] - 2026-04-26

### 📚 Documentation Update

#### Updated
- **README.md** — Complete verification and update of all modules:
  - Backend routes: 91 files verified and documented
  - Frontend pages: 32 → **35 modules** (Approval, Chat, Desk, Documents, Landing, Manual, Notifications, OEE, Profile, Public, RND, Returns, TVDisplay, Workspace added)
  - Database models: 48 → **49 files**
  - Total codebase: 811 files → **816+ files**, 304K → **310K+ lines of code**
  
- **R&D Module Documentation** — Enhanced from 1 file to **8 backend files**:
  - `rd.py` — Core R&D utilities
  - `rd_projects.py` — Project management and milestones
  - `rd_experiments.py` — Lab experiments and test tracking
  - `rd_materials.py` — Material research and formulations
  - `rd_products.py` — New product development
  - `rd_reports.py` — R&D analytics and reporting
  - `rd_extended.py` — Extended R&D features
  - `rd_integration.py` — Integration with Production and Quality
  - Total: **135KB of R&D backend code**

#### Added Modules to Documentation
- **Face Recognition** — Attendance with face verification
- **Live Monitoring** — Real-time production monitoring
- **Material Stock** — Raw material inventory tracking
- **Converting** — Converting production tracking
- **Desk/Workspace** — Personal workspace management

---

## [3.1.0] - 2026-04-20

### 🔐 RBAC Overhaul & Permission System

#### Added
- **RBAC Overhaul** — 40+ roles, 200+ permissions, module-level access control
- **DCC Permission** — Module `dcc` dengan 5 actions (view, create, edit, delete, approve) assigned to 13 roles
- **Accounting Permission** — Module `accounting` dengan 5 actions assigned to finance roles
- **Pre-Shift Checklist Permission** — New module for K3 safety checks
- **CAPA: Referensi Penyimpangan Mutu** — Manual input field for document reference when CPAR source = PM
- **Sidebar RBAC** — Permission checks for DCC & Accounting in frontend sidebar
- **Group Chat** — Accessible for all users without permission check

#### Fixed
- **DCC Sidebar Fix** — Query-aware active state for tab-based navigation
- **Seed Script Upgrade** — Now updates existing roles with new permissions (no longer skips)

---

## [3.0.0] - 2026-03-15

### 📋 Document Control Center (DCC) & CAPA

#### Added
- **DCC Module** — Document Control Center with 13 tables (ISO 9001:2015)
  - Document Management — Master document, revisions, distribution
  - Quality Records — Daftar induk rekaman mutu (FRM-DCC-03)
  - Change Notice — Pemberitahuan perubahan dokumen
  - Document Review — Review schedule and execution
- **CAPA Module** — CPAR/SCAR/CCHF dengan auto-numbering & RCA 5-Why
  - Corrective Action — Root cause analysis with 5-Why methodology
  - Preventive Action — Risk-based prevention
  - Verification — CAPA effectiveness tracking
  - Monthly Reports — CAPA performance analytics
- **Internal Memo** — Cross-department communication with read receipts
- **Document Destruction** — Berita acara pemusnahan (FRM-DCC-14)

---

## [2.1.0] - 2026-01-20

### 📦 WIP Stock & Enhanced Modules

#### Added
- **WIP Stock Module** — Work In Progress tracking per product
  - Real-time WIP quantity per product/machine
  - WIP movements and history
  - Packing list integration
- **Packing List Terpisah** — Independent packing list from Work Order
  - Standalone packing list creation
  - Carton weighing integration
  - QR code generation for packages
- **R&D Module Enhanced** — Research & Development expansion
  - Project tracking with milestones and approvals
  - Laboratory experiments and test management
  - Material research and formulation tracking
  - New product development workflows
  - **8 backend files, 135KB total code**
- **Public Attendance** — QR Code based attendance system
  - Self check-in/check-out via QR scan
  - Location-based validation
  - No login required for employees

---

## [2.0.0] - 2025-12-10

### 🎯 Quality Objective & Production Analytics

#### Added
- **Quality Objective Module** — Manual target setting per machine
  - OEE targets with daily/weekly/monthly tracking
  - Achievement percentage calculation
  - Performance gap analysis
- **Downtime Analysis** — Production interruption analytics
  - Top 3 downtime reasons tracking
  - Root cause analysis dashboard
  - MTBF/MTTR calculations
- **Enhanced QC Workflows** — Three-stage quality control
  - Incoming QC — Raw material inspection
  - In-Process QC — Production stage checks
  - Finish Good QC — Final product validation

---

## [1.0.0] - 2024-06-01

### 🎉 Initial Release

#### Core Modules
- **Authentication & Authorization**
  - JWT-based authentication
  - Role-Based Access Control (RBAC)
  - Multi-level permissions system
  - 25+ predefined role templates (from CEO to Operator)

- **Product Management**
  - Product catalog with specifications
  - Material management
  - Bill of Materials (BOM)
  - Product categories

- **Sales Management**
  - Customer management
  - Sales quotations
  - Sales orders
  - Lead management
  - Invoice generation

- **Purchasing**
  - Supplier management
  - Purchase requisitions
  - Purchase orders
  - Goods receipt

- **Production**
  - Work order management
  - Machine management
  - Production lines
  - Downtime tracking
  - OEE (Overall Equipment Effectiveness)

- **Warehouse & Inventory**
  - Multi-warehouse support
  - Location management
  - Stock movements
  - Stock transfers
  - Inventory valuation

- **Quality Control**
  - Inspection management
  - Defect tracking
  - Quality parameters
  - Quality standards

- **Finance**
  - Chart of accounts
  - Journal entries
  - Invoicing
  - Payments
  - Financial reports

- **Human Resources**
  - Employee management
  - Department management
  - Attendance tracking
  - Leave management
  - Payroll

- **Reports & Analytics**
  - Dashboard analytics
  - Sales reports
  - Production reports
  - Financial reports
  - Custom reports

#### Technical Features
- RESTful API architecture
- React + TypeScript frontend
- Flask + SQLAlchemy backend
- PostgreSQL database
- Real-time notifications
- Multi-language support (ID/EN)
- Dark/Light theme
- Responsive design

---

## Commit Convention

We use conventional commits for clear history:

### Types
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, etc.) |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `build` | Build system changes |
| `ci` | CI/CD changes |
| `chore` | Other changes |

### Scopes
| Scope | Description |
|-------|-------------|
| `auth` | Authentication & authorization |
| `products` | Product management |
| `sales` | Sales module |
| `purchasing` | Purchasing module |
| `production` | Production module |
| `warehouse` | Warehouse & inventory |
| `quality` | Quality control |
| `finance` | Finance module |
| `hr` | Human resources |
| `reports` | Reports & analytics |
| `frontend` | Frontend changes |
| `backend` | Backend changes |
| `api` | API changes |
| `db` | Database changes |
| `ui` | UI/UX changes |

### Examples
```
feat(auth): add multi-factor authentication
fix(sales): correct invoice calculation
docs(api): update API documentation
test(production): add work order tests
ci: add GitHub Actions workflow
```

### Release Commits
To trigger a release, include `[release]` and version in commit message:
```
chore: [release] v1.0.0 - Initial release
```

---

## Roadmap

### v1.1.0 (Planned)
- [ ] Mobile responsive improvements
- [ ] Email notifications
- [ ] PDF export for all reports
- [ ] Batch operations

### v1.2.0 (Planned)
- [ ] API rate limiting
- [ ] Audit log improvements
- [ ] Data import/export
- [ ] Backup automation

### v2.0.0 (Future)
- [ ] Multi-tenant support
- [ ] Advanced analytics with ML
- [ ] Integration with external systems
- [ ] Mobile app (React Native)

---

## Support

For support and inquiries:
- Email: baymngrh@gmail.com
- GitHub: https://github.com/bayuadhie-dev/smith

---

[Unreleased]: https://github.com/bayuadhie-dev/smith
