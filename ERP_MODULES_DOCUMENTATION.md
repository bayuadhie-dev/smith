# SMITH ERP - Complete Module Documentation

**Generated:** May 5, 2026  
**System Version:** 1.0.0  
**Total Modules:** 20+  
**Total Features:** 200+  

---

## Table of Contents

1. [Warehouse & Inventory Management](#1-warehouse--inventory-management)
2. [Production Management](#2-production-management)
3. [Finance & Accounting](#3-finance--accounting)
4. [Human Resources (HR)](#4-human-resources-hr)
5. [Sales & CRM](#5-sales--crm)
6. [Purchasing & Procurement](#6-purchasing--procurement)
7. [Quality Control](#7-quality-control)
8. [Research & Development (R&D)](#8-research--development-rd)
9. [Maintenance Management](#9-maintenance-management)
10. [Shipping & Logistics](#10-shipping--logistics)
11. [Material Requirements Planning (MRP)](#11-material-requirements-planning-mrp)
12. [Overall Equipment Effectiveness (OEE)](#12-overall-equipment-effectiveness-oee)
13. [Document Control Center (DCC)](#13-document-control-center-dcc)
14. [Returns Management](#14-returns-management)
15. [System Settings & Configuration](#15-system-settings--configuration)
16. [Reports & Analytics](#16-reports--analytics)
17. [Approval Workflow System](#17-approval-workflow-system)
18. [Chat & Collaboration](#18-chat--collaboration)
19. [Waste Management](#19-waste-management)
20. [WIP Accounting & Job Costing](#20-wip-accounting--job-costing)

---

## 1. Warehouse & Inventory Management

### Backend Models
- `warehouse.py` - Core warehouse models
- `warehouse_enhanced.py` - Enhanced warehouse features
- `warehouse_adjustment.py` - Stock adjustment models
- `uom.py` - Unit of Measure models

### Backend Routes
- `warehouse.py` - Warehouse API endpoints
- `warehouse_enhanced.py` - Enhanced warehouse endpoints
- `material_stock.py` - Material stock management
- `stock_input.py` - Stock input operations
- `stock_opname.py` - Stock opname (stock count) operations
- `uom.py` - UOM management endpoints

### Frontend Pages (31 pages)
- **WarehouseDashboardEnhanced.tsx** - Main warehouse dashboard with analytics
- **WarehouseZones.tsx** - Zone management
- **WarehouseLocations.tsx** - Location management
- **InventoryList.tsx** - Basic inventory list
- **InventoryListEnhanced.tsx** - Enhanced inventory with advanced features
- **InventoryForm.tsx** - Inventory item creation/editing
- **AddProductToInventory.tsx** - Add products to inventory
- **MaterialStockManagement.tsx** - Material stock management
- **MaterialsDashboard.tsx** - Materials overview dashboard
- **MaterialsList.tsx** - Materials listing
- **MaterialCreate.tsx** - Create new material
- **MaterialEdit.tsx** - Edit material details
- **MaterialView.tsx** - View material details
- **MovementList.tsx** - Stock movement history
- **MovementForm.tsx** - Create stock movements
- **MovementDetail.tsx** - Movement details
- **TransferForm.tsx** - Stock transfer between locations
- **AdjustmentForm.tsx** - Stock adjustment form
- **StockOpnameList.tsx** - Stock opname list
- **StockOpnameForm.tsx** - Create stock opname
- **StockOpnameDetail.tsx** - Stock opname details
- **StockInput.tsx** - Stock input operations
- **LocationList.tsx** - Location listing
- **LocationForm.tsx** - Create/edit locations
- **LocationDetail.tsx** - Location details
- **ReorderList.tsx** - Reorder list
- **ReorderPoints.tsx** - Reorder point management
- **StockAlerts.tsx** - Stock alerts and notifications
- **ABCAnalysis.tsx** - ABC analysis for inventory
- **WarehouseAnalytics.tsx** - Warehouse analytics
- **UoMList.tsx** - Unit of Measure management

### Key Features
- **Zone Management**: Create and manage warehouse zones (Raw Materials, Finished Goods, Packaging, Chemicals)
- **Location Management**: Rack-Level-Position storage locations
- **Inventory Tracking**: Real-time stock levels with FIFO logic
- **Stock Movements**: IN/OUT/TRANSFER/ADJUSTMENT tracking
- **Material Management**: Raw materials and packaging materials
- **Stock Opname**: Physical stock count and reconciliation
- **Reorder Management**: Automatic reorder points and alerts
- **ABC Analysis**: Inventory classification by value
- **UOM Management**: Multiple units of measure with conversions
- **Batch/Lot Tracking**: Batch number and expiry date tracking
- **QC Integration**: Stock status based on QC inspection
- **Warehouse Analytics**: Performance metrics and reports

---

## 2. Production Management

### Backend Models
- `production.py` - Core production models
- `product.py` - Product models
- `mbf_report.py` - MBF (Monthly Breakdown Forecast) report models
- `pre_shift_checklist.py` - Pre-shift checklist models
- `oee.py` - OEE tracking models
- `converting.py` - Converting process models
- `wip_accounting.py` - WIP accounting models
- `wip_job_costing.py` - Job costing models
- `work_order_bom.py` - Work order BOM models

### Backend Routes
- `production.py` - Production API endpoints
- `production_planning.py` - Production planning
- `production_input.py` - Production input operations
- `production_approval.py` - Production approval workflow
- `production_integration.py` - Production integration
- `mbf_report.py` - MBF report endpoints
- `pre_shift_checklist.py` - Pre-shift checklist endpoints
- `oee.py` - OEE tracking endpoints
- `converting.py` - Converting process endpoints
- `product_calculations.py` - Product calculations
- `product_changeover.py` - Product changeover management
- `packing_list.py` - Packing list management
- `weekly_production_plan.py` - Weekly production planning
- `work_order_monitoring.py` - Work order monitoring
- `live_monitoring.py` - Live production monitoring
- `schedule_grid.py` - Production schedule grid

### Frontend Pages (61 pages)
- **ProductionDashboard.tsx** - Main production dashboard
- **WorkOrderList.tsx** - Work order listing
- **WorkOrderForm.tsx** - Create work order
- **WorkOrderDetail.tsx** - Work order details
- **WorkOrderEdit.tsx** - Edit work order
- **WorkOrderKanban.tsx** - Kanban view for work orders
- **WorkOrderTimeline.tsx** - Timeline view
- **WorkOrderStatus.tsx** - Status tracking
- **WorkOrderMonitoring.tsx** - Real-time monitoring
- **WorkOrderProductionInput.tsx** - Production input for work order
- **WorkOrderBreakdown.tsx** - Work order breakdown
- **WorkOrderBOMEdit.tsx** - Edit work order BOM
- **ProductionPlanningList.tsx** - Production planning list
- **ProductionPlanningForm.tsx** - Create production plan
- **ProductionPlanningDashboard.tsx** - Planning dashboard
- **ProductionScheduling.tsx** - Production scheduling
- **ProductionScheduleForm.tsx** - Schedule form
- **MonthlyProductionPlan.tsx** - Monthly production plan
- **WeeklyProductionPlan.tsx** - Weekly production plan
- **WeeklyPlanDetail.tsx** - Weekly plan details
- **DailyController.tsx** - Daily production control
- **DailyControllerDetail.tsx** - Daily controller details
- **WeeklyController.tsx** - Weekly controller
- **MonthlyController.tsx** - Monthly controller
- **ProductionInput.tsx** - Production input form
- **ProductionRecords.tsx** - Production records
- **ProductionRecordForm.tsx** - Create production record
- **EditProductionRecord.tsx** - Edit production record
- **MBFReport.tsx** - MBF report form
- **MBFReportList.tsx** - MBF report list
- **LiveMonitoringDashboard.tsx** - Live monitoring dashboard
- **LiveMonitoringView.tsx** - Live monitoring view
- **LiveMonitoringWeekly.tsx** - Weekly live monitoring
- **MachineList.tsx** - Machine listing
- **MachineForm.tsx** - Create/edit machine
- **MachineDetail.tsx** - Machine details
- **PreShiftChecklist.tsx** - Pre-shift checklist
- **PreShiftChecklistForm.tsx** - Checklist form
- **PreShiftChecklistView.tsx** - Checklist view
- **PreShiftChecklistWeekly.tsx** - Weekly checklist
- **ConvertingDashboard.tsx** - Converting process dashboard
- **ConvertingInput.tsx** - Converting input
- **ProductChangeover.tsx** - Product changeover
- **ChangeoverList.tsx** - Changeover list
- **DowntimeInput.tsx** - Downtime recording
- **EfficiencyTracking.tsx** - Efficiency tracking
- **WIPDashboard.tsx** - WIP dashboard
- **WIPStock.tsx** - WIP stock
- **WIPBatchForm.tsx** - WIP batch form
- **WIPBatchList.tsx** - WIP batch list
- **RemainingStock.tsx** - Remaining stock
- **Traceability.tsx** - Product traceability
- **BreakdownSummary.tsx** - Breakdown summary
- **MaterialIssueList.tsx** - Material issue list
- **MaterialIssueForm.tsx** - Material issue form
- **MaterialIssueDetail.tsx** - Material issue details
- **PackingListNew.tsx** - Create packing list
- **PackingListDetail.tsx** - Packing list details
- **ProductionApprovalList.tsx** - Production approval list
- **ProductionApprovalDetail.tsx** - Production approval details
- **QualityCheckForm.tsx** - Quality check form

### Key Features
- **Work Order Management**: Create, track, and manage work orders
- **Production Planning**: Monthly, weekly, and daily production planning
- **Production Scheduling**: Schedule production across machines and shifts
- **Live Monitoring**: Real-time production monitoring with dashboard
- **MBF Report**: Monthly Breakdown Forecast reporting
- **Pre-Shift Checklist**: Checklist before shift starts
- **Machine Management**: Machine registration and monitoring
- **Product Changeover**: Track changeover times and activities
- **Downtime Tracking**: Record and analyze downtime
- **Efficiency Tracking**: Track production efficiency metrics
- **WIP Management**: Work-in-Progress tracking and management
- **Material Issue**: Issue materials to production
- **Packing List**: Create and manage packing lists
- **Production Approval**: Multi-level approval for production
- **Quality Integration**: Quality checks during production
- **Traceability**: Full product traceability from materials to finished goods
- **Converting Process**: Converting/transforming process management
- **Batch Management**: Batch tracking throughout production

---

## 3. Finance & Accounting

### Backend Models
- `finance.py` - Core finance models
- `wip_accounting.py` - WIP accounting models
- `wip_job_costing.py` - Job costing models

### Backend Routes
- `finance.py` - Finance API endpoints
- `wip_accounting.py` - WIP accounting endpoints
- `wip_job_costing.py` - Job costing endpoints

### Frontend Pages (23 pages)
- **FinanceDashboard.tsx** - Main finance dashboard
- **FinanceDashboardNew.tsx** - Enhanced finance dashboard
- **AccountingManagement.tsx** - Accounting management
- **ChartOfAccounts.tsx** - Chart of accounts
- **GeneralLedger.tsx** - General ledger
- **AccountsPayable.tsx** - Accounts payable management
- **AccountsReceivable.tsx** - Accounts receivable management
- **CashBankManagement.tsx** - Cash and bank management
- **CashFlowManagement.tsx** - Cash flow management
- **InvoiceForm.tsx** - Create invoice
- **InvoiceList.tsx** - Invoice listing
- **PaymentForm.tsx** - Payment form
- **ExpenseForm.tsx** - Expense form
- **BudgetPlanning.tsx** - Budget planning
- **BudgetForm.tsx** - Create/edit budget
- **BudgetForecasting.tsx** - Budget forecasting
- **FinancialReports.tsx** - Financial reports
- **CostingControlling.tsx** - Costing and controlling
- **FixedAssets.tsx** - Fixed assets management
- **TaxManagement.tsx** - Tax management
- **Consolidation.tsx** - Financial consolidation
- **AccountForm.tsx** - Account form
- **WIPLedger.tsx** - WIP ledger

### Key Features
- **Chart of Accounts**: Complete account structure management
- **General Ledger**: Transaction recording and ledger management
- **Accounts Payable**: Manage supplier payments
- **Accounts Receivable**: Manage customer collections
- **Cash & Bank Management**: Cash and bank account management
- **Cash Flow**: Cash flow tracking and forecasting
- **Invoicing**: Create and manage invoices
- **Payments**: Payment processing and tracking
- **Expense Management**: Expense recording and approval
- **Budget Planning**: Create and manage budgets
- **Budget Forecasting**: Forecast future budgets
- **Financial Reports**: P&L, Balance Sheet, Cash Flow statements
- **Costing**: Product costing and cost analysis
- **Fixed Assets**: Asset management and depreciation
- **Tax Management**: Tax calculation and reporting
- **Consolidation**: Multi-entity financial consolidation
- **WIP Accounting**: Work-in-Progress accounting
- **Job Costing**: Job-based cost tracking

---

## 4. Human Resources (HR)

### Backend Models
- `hr.py` - Core HR models
- `hr_extended.py` - Extended HR features

### Backend Routes
- `hr.py` - HR API endpoints
- `hr_extended.py` - Extended HR endpoints
- `hr_payroll.py` - Payroll management
- `hr_training.py` - Training management
- `hr_appraisal.py` - Employee appraisal
- `attendance.py` - Attendance management
- `staff_leave.py` - Staff leave management
- `work_roster.py` - Work roster management
- `face_recognition.py` - Face recognition for attendance

### Frontend Pages (36 pages)
- **HRDashboard.tsx** - Main HR dashboard
- **EmployeeList.tsx** - Employee listing
- **EmployeeForm.tsx** - Create/edit employee
- **Departments.tsx** - Department management
- **AttendancePage.tsx** - Attendance management
- **AttendanceForm.tsx** - Attendance form
- **AttendanceManagement.tsx** - Attendance management
- **AttendanceReport.tsx** - Attendance reports
- **AttendanceCalendar.tsx** - Attendance calendar view
- **AttendanceNotClockedOut.tsx** - Not clocked out alerts
- **AttendanceAdmin.tsx** - Attendance administration
- **LeaveManagement.tsx** - Leave management
- **LeaveForm.tsx** - Leave request form
- **StaffLeaveManagement.tsx** - Staff leave management
- **LeaveRequestForm.tsx** - Leave request form
- **PayrollList.tsx** - Payroll list
- **PayrollForm.tsx** - Payroll form
- **PayrollRecordList.tsx** - Payroll record list
- **PayrollPeriodForm.tsx** - Payroll period form
- **PieceworkLogList.tsx** - Piecework log listing
- **TrainingManagement.tsx** - Training management
- **AppraisalList.tsx** - Appraisal list
- **AppraisalForm.tsx** - Appraisal form
- **AppraisalCycleForm.tsx** - Appraisal cycle form
- **WorkRosterComplete.tsx** - Complete work roster
- **WorkRosterWeekly.tsx** - Weekly work roster
- **RosterManagementComplete.tsx** - Roster management
- **RosterManagementIntegrated.tsx** - Integrated roster management
- **RosterCalendar.tsx** - Roster calendar
- **RosterDragDrop.tsx** - Drag-drop roster
- **RosterDragDropFixed.tsx** - Fixed drag-drop roster
- **RosterDragDropRobust.tsx** - Robust drag-drop roster
- **RosterTest.tsx** - Roster testing
- **OutsourcingVendorList.tsx** - Outsourcing vendor list
- **FaceAdmin.tsx** - Face recognition admin
- **Reports.tsx** - HR reports

### Key Features
- **Employee Management**: Complete employee database
- **Department Management**: Organizational structure
- **Attendance Management**: Clock in/out with face recognition
- **Leave Management**: Leave requests and approval
- **Payroll Management**: Salary calculation and processing
- **Piecework**: Piece rate payment tracking
- **Training Management**: Employee training programs
- **Performance Appraisal**: Employee performance evaluation
- **Work Roster**: Shift scheduling and rostering
- **Outsourcing**: Manage outsourcing vendors
- **Face Recognition**: Biometric attendance
- **HR Reports**: Comprehensive HR analytics

---

## 5. Sales & CRM

### Backend Models
- `sales.py` - Sales models

### Backend Routes
- `sales.py` - Sales API endpoints

### Frontend Pages (24 pages)
- **SalesDashboard.tsx** - Main sales dashboard
- **CustomerList.tsx** - Customer listing
- **CustomerForm.tsx** - Create/edit customer
- **CustomerDetails.tsx** - Customer details
- **LeadList.tsx** - Lead listing
- **LeadListSimple.tsx** - Simple lead list
- **LeadListUpgraded.tsx** - Enhanced lead list
- **LeadForm.tsx** - Create/edit lead
- **OpportunityList.tsx** - Opportunity listing
- **OpportunityListNew.tsx** - New opportunity list
- **OpportunityListUpgraded.tsx** - Enhanced opportunity list
- **OpportunityForm.tsx** - Create/edit opportunity
- **QuotationList.tsx** - Quotation listing
- **QuotationForm.tsx** - Create/edit quotation
- **SalesOrderList.tsx** - Sales order listing
- **SalesOrderListUpgraded.tsx** - Enhanced sales order list
- **SalesOrderForm.tsx** - Create/edit sales order
- **SalesOrderDetails.tsx** - Sales order details
- **InvoiceForm.tsx** - Create invoice
- **ActivityList.tsx** - Activity listing
- **ActivityForm.tsx** - Create/edit activity
- **SalesForecastForm.tsx** - Sales forecast form
- **SalesForecastList.tsx** - Sales forecast list
- **WorkflowStatus.tsx** - Workflow status tracking

### Key Features
- **Customer Management**: Customer database and CRM
- **Lead Management**: Lead tracking and conversion
- **Opportunity Management**: Sales pipeline management
- **Quotation Management**: Create and manage quotations
- **Sales Order Management**: Sales order processing
- **Activity Tracking**: Sales activities and follow-ups
- **Sales Forecasting**: Forecast future sales
- **Workflow Status**: Track sales workflow status
- **Invoice Generation**: Generate invoices from sales orders

---

## 6. Purchasing & Procurement

### Backend Models
- `purchasing.py` - Purchasing models

### Backend Routes
- `purchasing.py` - Purchasing API endpoints
- `purchase_invoice.py` - Purchase invoice management
- `purchase_return.py` - Purchase return management

### Frontend Pages (12 pages)
- **Purchasing.tsx** - Main purchasing dashboard
- **SupplierList.tsx** - Supplier listing
- **SupplierForm.tsx** - Create/edit supplier
- **PurchaseOrderList.tsx** - Purchase order listing
- **PurchaseOrderForm.tsx** - Create/edit purchase order
- **RFQList.tsx** - Request for Quotation list
- **RFQForm.tsx** - Create RFQ
- **QuoteList.tsx** - Supplier quote list
- **SupplierQuoteForm.tsx** - Supplier quote form
- **ContractList.tsx** - Contract management
- **PriceComparison.tsx** - Price comparison tool
- **GRNForm.tsx** - Goods Received Note form

### Key Features
- **Supplier Management**: Supplier database and evaluation
- **Purchase Orders**: Create and manage purchase orders
- **RFQ Management**: Request for Quotation process
- **Supplier Quotes**: Manage supplier quotations
- **Price Comparison**: Compare prices across suppliers
- **Contract Management**: Supplier contracts
- **GRN**: Goods Received Note processing
- **Purchase Invoices**: Supplier invoice management
- **Purchase Returns**: Return goods to suppliers

---

## 7. Quality Control

### Backend Models
- `quality.py` - Quality models
- `quality_enhanced.py` - Enhanced quality features

### Backend Routes
- `quality.py` - Quality API endpoints
- `quality_enhanced.py` - Enhanced quality endpoints

### Frontend Pages (15 pages)
- **QualityDashboardEnhanced.tsx** - Main quality dashboard
- **IncomingQC.tsx** - Incoming material QC
- **InProcessQC.tsx** - In-process QC
- **FinishGoodQC.tsx** - Finished goods QC
- **PendingQC.tsx** - Pending QC inspections
- **QualityTestForm.tsx** - Quality test form
- **QualityTestList.tsx** - Quality test list
- **QualityAlerts.tsx** - Quality alerts
- **QualityAnalytics.tsx** - Quality analytics
- **QualityAudits.tsx** - Quality audits
- **QualityObjectiveProduction.tsx** - Quality objectives for production
- **QCPackingList.tsx** - QC packing list
- **QCToWarehouse.tsx** - QC to warehouse transfer
- **DowntimeAnalysis.tsx** - Downtime analysis
- **WorkOrderQCForm.tsx** - Work order QC form

### Key Features
- **Incoming QC**: Quality inspection for incoming materials
- **In-Process QC**: Quality checks during production
- **Finished Goods QC**: Final product quality inspection
- **Quality Tests**: Define and execute quality tests
- **Quality Alerts**: Alert system for quality issues
- **Quality Analytics**: Quality metrics and trends
- **Quality Audits**: Internal quality audits
- **Quality Objectives**: Set and track quality objectives
- **QC Packing List**: QC for packing
- **QC to Warehouse**: Transfer QC-approved items to warehouse
- **Downtime Analysis**: Analyze downtime for quality issues

---

## 8. Research & Development (R&D)

### Backend Models
- `rd.py` - R&D models
- `rnd.py` - Extended R&D models

### Backend Routes
- `rd.py` - R&D API endpoints
- `rd_experiments.py` - Experiment management
- `rd_extended.py` - Extended R&D endpoints
- `rd_integration.py` - R&D integration
- `rd_materials.py` - R&D materials
- `rd_products.py` - R&D products
- `rd_projects.py` - R&D projects
- `rd_reports.py` - R&D reports
- `rnd.py` - R&D management

### Frontend Pages (12 pages - RD)
- **RDDashboard.tsx** - R&D dashboard
- **ProjectList.tsx** - Project listing
- **ProjectForm.tsx** - Create/edit project
- **ProjectDetails.tsx** - Project details
- **ProjectDetailsForm.tsx** - Project details form
- **ExperimentList.tsx** - Experiment listing
- **ExperimentForm.tsx** - Create/edit experiment
- **MaterialList.tsx** - R&D material list
- **MaterialForm.tsx** - Create/edit R&D material
- **ProductDevelopmentList.tsx** - Product development list
- **ProductDevelopmentForm.tsx** - Product development form
- **ResearchReportsForm.tsx** - Research reports

### Frontend Pages (6 pages - RND)
- **RNDDashboard.tsx** - R&D dashboard
- **RNDProjectList.tsx** - Project listing
- **RNDProjectForm.tsx** - Create/edit project
- **RNDProjectDetail.tsx** - Project details
- **RNDApprovals.tsx** - R&D approvals
- **index.tsx** - R&D index

### Key Features
- **Project Management**: R&D project tracking
- **Experiment Management**: Track experiments and results
- **Material Development**: Develop new materials
- **Product Development**: New product development
- **Research Reports**: Document research findings
- **R&D Approvals**: Approval workflow for R&D activities

---

## 9. Maintenance Management

### Backend Models
- `maintenance.py` - Maintenance models

### Backend Routes
- `maintenance.py` - Maintenance API endpoints
- `maintenance_extended.py` - Extended maintenance endpoints

### Frontend Pages (10 pages)
- **MaintenanceDashboard.tsx** - Main maintenance dashboard
- **MaintenanceDashboardEnhanced.tsx** - Enhanced maintenance dashboard
- **MaintenanceList.tsx** - Maintenance listing
- **MaintenanceForm.tsx** - Create/edit maintenance
- **MaintenanceSchedule.tsx** - Maintenance scheduling
- **MaintenanceRequestForm.tsx** - Maintenance request form
- **MaintenanceWorkOrderForm.tsx** - Maintenance work order form
- **MaintenancePartsForm.tsx** - Maintenance parts form
- **MaintenanceAnalyticsForm.tsx** - Maintenance analytics
- **ChecklistNGItems.tsx** - Checklist items

### Key Features
- **Preventive Maintenance**: Scheduled maintenance activities
- **Corrective Maintenance**: Reactive maintenance requests
- **Maintenance Scheduling**: Schedule maintenance activities
- **Work Orders**: Create and manage maintenance work orders
- **Parts Management**: Manage spare parts
- **Maintenance Analytics**: Analyze maintenance performance
- **Checklist Management**: Maintenance checklists

---

## 10. Shipping & Logistics

### Backend Models
- `shipping.py` - Shipping models
- `shipping_updated.py` - Updated shipping models

### Backend Routes
- `shipping.py` - Shipping API endpoints

### Frontend Pages (11 pages)
- **ShippingDashboard.tsx** - Main shipping dashboard
- **ShippingOrderList.tsx** - Shipping order listing
- **ShippingOrderForm.tsx** - Create/edit shipping order
- **ShippingOrderDetails.tsx** - Shipping order details
- **ShipmentForm.tsx** - Shipment form
- **DeliveryTracking.tsx** - Delivery tracking
- **LogisticsProviders.tsx** - Logistics provider management
- **ShippingCalculator.tsx** - Shipping cost calculator
- **ShippingTrackingForm.tsx** - Shipping tracking form
- **ShippingReportsForm.tsx** - Shipping reports
- **CreateShippingFromQC.tsx** - Create shipping from QC

### Key Features
- **Shipping Orders**: Create and manage shipping orders
- **Delivery Tracking**: Track shipments in real-time
- **Logistics Providers**: Manage logistics providers
- **Shipping Calculator**: Calculate shipping costs
- **Shipping Reports**: Shipping analytics and reports
- **QC Integration**: Create shipping from QC-approved items

---

## 11. Material Requirements Planning (MRP)

### Backend Routes
- `mrp.py` - MRP API endpoints

### Frontend Pages (7 pages)
- **MRPDashboard.tsx** - Main MRP dashboard
- **MRP.tsx** - MRP main page
- **MaterialRequirements.tsx** - Material requirements calculation
- **DemandPlanning.tsx** - Demand planning
- **CapacityPlanning.tsx** - Capacity planning
- **WhatIfSimulation.tsx** - What-if simulation
- **SupplierIntegration.tsx** - Supplier integration

### Key Features
- **Material Requirements**: Calculate material requirements
- **Demand Planning**: Plan material demand
- **Capacity Planning**: Plan production capacity
- **What-If Simulation**: Simulate different scenarios
- **Supplier Integration**: Integrate with supplier systems

---

## 12. Overall Equipment Effectiveness (OEE)

### Backend Models
- `oee.py` - OEE models

### Backend Routes
- `oee.py` - OEE API endpoints

### Frontend Pages (4 pages)
- **OEEDashboard.tsx** - Main OEE dashboard
- **OEEDashboardEnhanced.tsx** - Enhanced OEE dashboard
- **OEERecordForm.tsx** - OEE record form
- **MachineAnalytics.tsx** - Machine analytics

### Key Features
- **OEE Tracking**: Track Overall Equipment Effectiveness
- **Availability**: Monitor machine availability
- **Performance**: Monitor machine performance
- **Quality**: Monitor product quality
- **Machine Analytics**: Detailed machine performance analysis

---

## 13. Document Control Center (DCC)

### Backend Models
- `dcc.py` - DCC models
- `document_management.py` - Document management models

### Backend Routes
- `dcc.py` - DCC API endpoints
- `document_management.py` - Document management endpoints

### Frontend Pages (2 pages)
- **DocumentControlCenter.tsx** - Main DCC page
- **DocumentVerifyPage.tsx** - Document verification

### Frontend Pages (Documents - 7 pages)
- **DocumentDashboard.tsx** - Document dashboard
- **DocumentDashboardUpgraded.tsx** - Upgraded document dashboard
- **DocumentGenerator.tsx** - Document generator
- **DocumentGeneratorUpgraded.tsx** - Upgraded document generator
- **TemplateDesigner.tsx** - Template designer
- **TemplateEditor.tsx** - Template editor
- **TemplateForm.tsx** - Template form
- **TemplateList.tsx** - Template listing

### Key Features
- **Document Control**: ISO 9001:2015 compliant document control
- **Document Verification**: Verify document authenticity
- **Document Generation**: Generate documents from templates
- **Template Management**: Create and manage document templates
- **Version Control**: Document version tracking
- **Approval Workflow**: Document approval workflow
- **Audit Trail**: Complete document audit trail

---

## 14. Returns Management

### Backend Models
- `returns.py` - Returns models

### Backend Routes
- `returns.py` - Returns API endpoints

### Frontend Pages (3 pages)
- **ReturnsDashboard.tsx** - Main returns dashboard
- **CreateReturnForm.tsx** - Create return form
- **ReturnDetails.tsx** - Return details

### Key Features
- **Return Management**: Manage customer returns
- **Return Processing**: Process returned items
- **Return Analytics**: Analyze return data

---

## 15. System Settings & Configuration

### Backend Models
- `settings.py` - Settings models
- `settings_extended.py` - Extended settings models
- `user.py` - User models
- `approval_workflow.py` - Approval workflow models

### Backend Routes
- `settings.py` - Settings API endpoints
- `settings_extended.py` - Extended settings endpoints
- `auth.py` - Authentication endpoints
- `oauth.py` - OAuth endpoints
- `approval_workflow.py` - Approval workflow endpoints

### Frontend Pages (9 pages)
- **Settings.tsx** - Main settings page
- **SettingsMain.tsx** - Main settings
- **UserRoleManagement.tsx** - User and role management
- **UserRoleManagementNew.tsx** - New user and role management
- **AdvancedSystemConfig.tsx** - Advanced system configuration
- **AuditTrail.tsx** - Audit trail viewing
- **BackupRestore.tsx** - Backup and restore
- **EmailSettings.tsx** - Email configuration
- **KPITargetSettings.tsx** - KPI target settings

### Frontend Pages (Auth - 6 pages)
- **Login.tsx** - Login page
- **Register.tsx** - Registration page
- **ForgotPassword.tsx** - Forgot password
- **ResetPassword.tsx** - Reset password
- **CompleteProfile.tsx** - Complete profile
- **OAuthCallback.tsx** - OAuth callback

### Frontend Pages (Approval - 2 pages)
- **ApprovalDashboard.tsx** - Approval dashboard
- **ApprovalDetail.tsx** - Approval details

### Key Features
- **User Management**: Create and manage users
- **Role Management**: Define roles and permissions
- **RBAC**: Role-Based Access Control (40+ roles, 200+ permissions)
- **System Configuration**: Configure system settings
- **Audit Trail**: View complete audit trail
- **Backup & Restore**: Database backup and restore
- **Email Settings**: Configure email services
- **KPI Targets**: Set KPI targets
- **Authentication**: JWT-based authentication
- **OAuth**: Google OAuth integration
- **Approval Workflow**: Multi-level approval system

---

## 16. Reports & Analytics

### Backend Models
- `analytics.py` - Analytics models
- `kpi_target.py` - KPI target models

### Backend Routes
- `reports.py` - Reports API endpoints
- `analytics.py` - Analytics endpoints
- `executive_dashboard.py` - Executive dashboard endpoints
- `kpi_targets.py` - KPI target endpoints
- `dashboard.py` - Dashboard endpoints

### Frontend Pages (9 pages)
- **Reports.tsx** - Main reports page
- **ReportsFixed.tsx** - Fixed reports
- **ReportGenerator.tsx** - Report generator
- **CustomReportBuilder.tsx** - Custom report builder
- **AdvancedReportBuilder.tsx** - Advanced report builder
- **ReportScheduler.tsx** - Schedule reports
- **ScheduledReports.tsx** - Scheduled reports list
- **ExecutiveDashboard.tsx** - Executive dashboard
- **ProductionByProductReport.tsx** - Production by product report

### Frontend Pages (Executive - 2 pages)
- **ProductionExecutiveDashboard.tsx** - Production executive dashboard
- **ProductionMonitoringDashboard.tsx** - Production monitoring dashboard

### Frontend Pages (Dashboard - 2 pages)
- **Dashboard.tsx** - Main dashboard
- **DashboardEnhanced.tsx** - Enhanced dashboard

### Key Features
- **Standard Reports**: Pre-built reports for all modules
- **Custom Reports**: Build custom reports
- **Report Scheduler**: Schedule automatic report generation
- **Executive Dashboard**: High-level executive view
- **Production Dashboard**: Production-specific analytics
- **KPI Tracking**: Track key performance indicators
- **Analytics**: Advanced analytics across all modules

---

## 17. Approval Workflow System

### Backend Models
- `approval_workflow.py` - Approval workflow models
- `workflow_integration.py` - Workflow integration models

### Backend Routes
- `approval_workflow.py` - Approval workflow endpoints
- `workflow.py` - Workflow endpoints
- `workflow_complete.py` - Complete workflow endpoints
- `workflow_integration.py` - Workflow integration endpoints

### Frontend Pages (Approval - 2 pages)
- **ApprovalDashboard.tsx** - Approval dashboard
- **ApprovalDetail.tsx** - Approval details

### Key Features
- **Multi-level Approval**: Configure multi-level approval chains
- **Approval Rules**: Define approval rules based on conditions
- **Approval History**: Track approval history
- **Delegation**: Delegate approval authority
- **Workflow Integration**: Integrate with all modules

---

## 18. Chat & Collaboration

### Backend Models
- `group_chat.py` - Group chat models

### Backend Routes
- `group_chat.py` - Group chat endpoints
- `socketio_chat.py` - Socket.IO chat endpoints

### Frontend Pages (Chat - 2 pages)
- **GroupChat.tsx** - Group chat
- **ServerSettings.tsx** - Server settings

### Frontend Pages (Desk - 1 page)
- **DeskPage.tsx** - Desk page

### Key Features
- **Group Chat**: Real-time group messaging
- **Direct Messaging**: Direct messaging between users
- **File Sharing**: Share files in chat
- **Chat History**: View chat history
- **Real-time**: Socket.IO for real-time updates

---

## 19. Waste Management

### Backend Models
- `waste.py` - Waste models

### Backend Routes
- `waste.py` - Waste API endpoints

### Frontend Pages (Waste - 2 pages)
- **WasteManagement.tsx** - Waste management (file not found in listing)
- **WasteReports.tsx** - Waste reports (file not found in listing)

### Key Features
- **Waste Recording**: Record waste materials
- **Waste Analysis**: Analyze waste data
- **Waste Reports**: Generate waste reports

---

## 20. WIP Accounting & Job Costing

### Backend Models
- `wip_accounting.py` - WIP accounting models
- `wip_job_costing.py` - Job costing models

### Backend Routes
- `wip_accounting.py` - WIP accounting endpoints
- `wip_job_costing.py` - Job costing endpoints

### Frontend Pages (Finance - included in Finance section)
- **WIPLedger.tsx** - WIP ledger

### Key Features
- **WIP Tracking**: Track work-in-progress costs
- **Job Costing**: Track costs by job/order
- **Cost Allocation**: Allocate costs to products
- **WIP Ledger**: WIP accounting ledger
- **Cost Reports**: Generate cost reports

---

## Additional Features

### AI Assistant
- **Backend Route**: `ai_assistant.py` - AI-powered assistant
- **Features**: AI-powered help and recommendations

### Integration
- **Backend Models**: `integration.py`, `integration_extended.py`
- **Backend Routes**: `integration.py`, `integration_extended.py`
- **Frontend Pages (Integration - 4 pages)**:
  - Integration pages (files not listed in detail)
- **Features**: External system integration

### BOM Management
- **Backend Models**: `bom_history.py`, `custom_bom.py`
- **Backend Routes**: `bom.py`, `bom_management.py`, `custom_bom.py`
- **Features**: Bill of Materials management

### Product Management
- **Backend Models**: `product.py`, `product_excel_schema.py`, `product_new_schema.py`
- **Backend Routes**: `products.py`, `products_new.py`, `products_new_excel.py`, `products_new_extended.py`
- **Frontend Pages (Products - 11 pages)**:
  - Product management pages
- **Features**: Product catalog management

### Notifications
- **Backend Models**: `notification.py`
- **Backend Routes**: `notifications.py`, `notifications_email.py`
- **Frontend Pages (Notifications - 1 page)**:
  - Notifications management
- **Features**: In-app and email notifications

### TV Display
- **Backend Routes**: `tv_display.py`
- **Frontend Pages (TVDisplay - 5 pages)**:
  - TV display pages for shop floor
- **Features**: Display production data on TV screens

### System Monitor
- **Backend Routes**: `system_monitor.py`
- **Frontend Pages**: `SystemMonitor.tsx`
- **Features**: System health monitoring

### Search
- **Backend Routes**: `search.py`
- **Frontend Pages (Search - 1 page)**:
  - Global search functionality
- **Features**: Search across all modules

### User Manual
- **Backend Models**: `user_manual.py`
- **Backend Routes**: `user_manual.py`
- **Frontend Pages (Manual - 3 pages)**:
  - User manual pages
- **Features**: Built-in user manual

### Backup
- **Backend Models**: `backup.py`
- **Backend Routes**: `backup.py`
- **Features**: Database backup and restore

### Logs
- **Backend Routes**: `logs.py`
- **Features**: System logs viewing

### Health Check
- **Backend Routes**: `health.py`
- **Features**: System health check endpoint

---

## Summary Statistics

- **Total Backend Models**: 49 files
- **Total Backend Routes**: 100 files
- **Total Frontend Pages**: 56+ pages (organized in 20+ modules)
- **Total Modules**: 20+ main modules
- **Total Features**: 200+ individual features

---

## Module Integration

All modules are fully integrated with:
- **Common Authentication**: JWT-based authentication across all modules
- **Approval Workflow**: Multi-level approval system
- **Audit Trail**: Complete activity logging
- **Notifications**: In-app and email notifications
- **Real-time Updates**: Socket.IO for real-time data
- **Reporting**: Unified reporting system
- **Analytics**: Cross-module analytics

---

## Technology Stack

### Backend
- Python 3.12+
- Flask 3.0.0
- SQLAlchemy 2.0.23
- SQLite (Development) / PostgreSQL (Production)
- Flask-JWT-Extended
- Flask-SocketIO
- Flask-Migrate (Alembic)

### Frontend
- TypeScript 5.2.2
- React 18.2.0
- Redux Toolkit
- Tailwind CSS
- Vite
- Socket.IO Client

---

## Security Features

- **Role-Based Access Control (RBAC)**: 40+ roles, 200+ permissions
- **JWT Authentication**: Secure token-based authentication
- **OAuth Integration**: Google OAuth support
- **Audit Trail**: Complete activity logging
- **Rate Limiting**: API rate limiting
- **CORS**: Cross-Origin Resource Sharing configuration
- **Password Hashing**: Bcrypt for password security

---

## Compliance

- **ISO 9001:2015**: Document Control Center module
- **Audit Trail**: Complete audit trail for compliance
- **Approval Workflows**: Multi-level approval for critical operations
- **Quality Control**: Integrated quality management system

---

**End of Documentation**
