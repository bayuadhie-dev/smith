import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from './hooks/redux'
import { checkAuth } from './store/slices/authSlice'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import axiosInstance from './utils/axiosConfig'
import { ThemeProvider } from './contexts/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { PermissionProvider } from './contexts/PermissionContext'
import { ToastProvider, ErrorBoundary, ConfirmDialogProvider } from './components/ui'
import SessionTimeoutModal from './components/SessionTimeoutModal'
import Layout from './components/Layout/Layout'

/**
 * Tiap deploy, nama berkas potongan kode (chunk) berubah dan yang lama dihapus
 * dari server. Tab yang sudah terbuka sejak sebelum deploy masih memegang
 * daftar nama yang lama, jadi begitu pindah halaman impor-nya 404 dan React
 * melempar - yang terlihat oleh pemakai sebagai "Oops! Terjadi Kesalahan" di
 * banyak halaman sekaligus, padahal aplikasinya sehat.
 *
 * Muat ulang sekali saja: index.html yang baru menunjuk nama yang benar.
 * Penanda di sessionStorage menjaga supaya tidak berputar kalau penyebabnya
 * ternyata bukan itu.
 */
const KUNCI_MUAT_ULANG = 'chunk-dimuat-ulang'

const muat = <T,>(impor: () => Promise<T>): Promise<T> =>
  impor().then((m) => {
    sessionStorage.removeItem(KUNCI_MUAT_ULANG)
    return m
  }).catch((e) => {
    if (sessionStorage.getItem(KUNCI_MUAT_ULANG)) throw e
    sessionStorage.setItem(KUNCI_MUAT_ULANG, '1')
    window.location.reload()
    return new Promise<T>(() => {})      // tertahan: halaman sedang dimuat ulang
  })

import { registerAppRoutes } from './workspace/routeRegistry'
import RoleBasedRedirect from './components/RoleBasedRedirect'
const Login = lazy(() => muat(() => import('./pages/Auth/Login')))
const Register = lazy(() => muat(() => import('./pages/Auth/Register')))
const ForgotPassword = lazy(() => muat(() => import('./pages/Auth/ForgotPassword')))
const ResetPassword = lazy(() => muat(() => import('./pages/Auth/ResetPassword')))
const PageLoader = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
  </div>
)

const ApprovalEmail = lazy(() => muat(() => import('./pages/Public/ApprovalEmail')))
const OAuthCallback = lazy(() => muat(() => import('./pages/Auth/OAuthCallback')))
const CompleteProfile = lazy(() => muat(() => import('./pages/Auth/CompleteProfile')))
const DashboardModules = lazy(() => muat(() => import('./pages/Dashboard/DashboardModules')))
const GlobalSearchPage = lazy(() => muat(() => import('./pages/Search/GlobalSearchPage')))
const ProductList = lazy(() => muat(() => import('./pages/Products/ProductList')))
const NonwovenCalculator = lazy(() => muat(() => import('./pages/Products/NonwovenCalculator')))
const ProductDashboard = lazy(() => muat(() => import('./pages/Products/ProductDashboard')))
const ProductAnalytics = lazy(() => muat(() => import('./pages/Products/ProductAnalytics')))
const ProductCategories = lazy(() => muat(() => import('./pages/Products/ProductCategories')))
const BOMManagement = lazy(() => muat(() => import('./pages/Products/BOMManagement')))
const ProductLifecycle = lazy(() => muat(() => import('./pages/Products/ProductLifecycle')))
const ProductsNewPage = lazy(() => muat(() => import('./pages/ProductsNewPage')))
const ImportCenter = lazy(() => muat(() => import('./pages/ImportCenter')))
const PurchaseInvoiceForm = lazy(() => muat(() => import('./pages/Purchasing/PurchaseInvoiceForm')))
const MasterDataPage = lazy(() => muat(() => import('./pages/MasterData/MasterDataPage')))
import ProductFormNew from './components/ProductFormNew'
import ProductVersionHistory from './components/ProductVersionHistory'
import ProductCompare from './components/ProductCompare'
const WarehouseLocations = lazy(() => muat(() => import('./pages/Warehouse/WarehouseLocations')))
const WarehouseDashboardEnhanced = lazy(() => muat(() => import('./pages/Warehouse/WarehouseDashboardEnhanced')))
const WarehouseAnalytics = lazy(() => muat(() => import('./pages/Warehouse/WarehouseAnalytics')))
const ABCAnalysis = lazy(() => muat(() => import('./pages/Warehouse/ABCAnalysis')))
const InventoryList = lazy(() => muat(() => import('./pages/Warehouse/InventoryList')))
const InventoryListEnhanced = lazy(() => muat(() => import('./pages/Warehouse/InventoryListEnhanced')))
const RawMaterialStockPage = lazy(() => muat(() => import('./pages/Warehouse/RawMaterialStockPage')))
const AddProductToInventory = lazy(() => muat(() => import('./pages/Warehouse/AddProductToInventory')))
const InventoryForm = lazy(() => muat(() => import('./pages/Warehouse/InventoryForm')))
const LocationForm = lazy(() => muat(() => import('./pages/Warehouse/LocationForm')))
const MovementForm = lazy(() => muat(() => import('./pages/Warehouse/MovementForm')))
const MovementDetail = lazy(() => muat(() => import('./pages/Warehouse/MovementDetail')))
const AdjustmentForm = lazy(() => muat(() => import('./pages/Warehouse/AdjustmentForm')))
const AdjustmentList = lazy(() => muat(() => import('./pages/Warehouse/AdjustmentList')))
const AdjustmentDetail = lazy(() => muat(() => import('./pages/Warehouse/AdjustmentDetail')))
const TransferHub = lazy(() => muat(() => import('./pages/Warehouse/TransferHub')))
const StockTransferForm = lazy(() => muat(() => import('./pages/Warehouse/StockTransferForm')))
const StockTransferDetail = lazy(() => muat(() => import('./pages/Warehouse/StockTransferDetail')))
const ItemStockPage = lazy(() => muat(() => import('./pages/Warehouse/ItemStockPage')))
const LocationList = lazy(() => muat(() => import('./pages/Warehouse/LocationList')))
const LocationDetail = lazy(() => muat(() => import('./pages/Warehouse/LocationDetail')))
const MovementList = lazy(() => muat(() => import('./pages/Warehouse/MovementList')))
const StockInput = lazy(() => muat(() => import('./pages/Warehouse/StockInput')))
const WarehouseZones = lazy(() => muat(() => import('./pages/Warehouse/WarehouseZones')))
const ZoneStockPage = lazy(() => muat(() => import('./pages/Warehouse/ZoneStockPage')))
const MaterialsDashboard = lazy(() => muat(() => import('./pages/Warehouse/MaterialsDashboard')))
const MaterialsList = lazy(() => muat(() => import('./pages/Warehouse/MaterialsList')))
const MaterialView = lazy(() => muat(() => import('./pages/Warehouse/MaterialView')))
const MaterialEdit = lazy(() => muat(() => import('./pages/Warehouse/MaterialEdit')))
const MaterialCreate = lazy(() => muat(() => import('./pages/Warehouse/MaterialCreate')))
const MaterialStockManagement = lazy(() => muat(() => import('./pages/Warehouse/MaterialStockManagement')))
const StockOpnameList = lazy(() => muat(() => import('./pages/Warehouse/StockOpnameList')))
const StockOpnameResultsPage = lazy(() => muat(() => import('./pages/Warehouse/StockOpnameResultsPage')))
const StockOpnameForm = lazy(() => muat(() => import('./pages/Warehouse/StockOpnameForm')))
const StockOpnameDetail = lazy(() => muat(() => import('./pages/Warehouse/StockOpnameDetail')))
const UoMList = lazy(() => muat(() => import('./pages/Warehouse/UoMList')))
const StockAlerts = lazy(() => muat(() => import('./pages/Warehouse/StockAlerts')))
const CustomerList = lazy(() => muat(() => import('./pages/Sales/CustomerList')))
const CustomerForm = lazy(() => muat(() => import('./pages/Sales/CustomerForm')))
const CustomerDetails = lazy(() => muat(() => import('./pages/Sales/CustomerDetails')))
const WorkflowStatus = lazy(() => muat(() => import('./pages/Sales/WorkflowStatus')))
const SalesOrderList = lazy(() => muat(() => import('./pages/Sales/SalesOrderListUpgraded')))
const SalesOrderDetails = lazy(() => muat(() => import('./pages/Sales/SalesOrderDetails')))
const SalesOrderForm = lazy(() => muat(() => import('./pages/Sales/SalesOrderForm')))
const SalesOrderSourcePicker = lazy(() => muat(() => import('./pages/Sales/SalesOrderSourcePicker')))
const LeadList = lazy(() => muat(() => import('./pages/Sales/LeadListUpgraded')))
const LeadForm = lazy(() => muat(() => import('./pages/Sales/LeadForm')))
const OpportunityList = lazy(() => muat(() => import('./pages/Sales/OpportunityListUpgraded')))
const OpportunityForm = lazy(() => muat(() => import('./pages/Sales/OpportunityForm')))
const QuotationList = lazy(() => muat(() => import('./pages/Sales/QuotationList')))
const QuotationForm = lazy(() => muat(() => import('./pages/Sales/QuotationForm')))
const ActivityList = lazy(() => muat(() => import('./pages/Sales/ActivityList')))
const ActivityForm = lazy(() => muat(() => import('./pages/Sales/ActivityForm')))
const SalesDashboard = lazy(() => muat(() => import('./pages/Sales/SalesDashboard')))
const SalesForecastList = lazy(() => muat(() => import('./pages/Sales/SalesForecastList')))
const SalesForecastGrid = lazy(() => muat(() => import('./pages/Sales/SalesForecastGrid')))
const SalesInvoiceForm = lazy(() => muat(() => import('./pages/Sales/InvoiceForm')))
const SalesInvoiceFormNew = lazy(() => muat(() => import('./pages/Sales/SalesInvoiceFormNew')))
const SupplierList = lazy(() => muat(() => import('./pages/Purchasing/SupplierList')))
const SupplierForm = lazy(() => muat(() => import('./pages/Purchasing/SupplierForm')))
const PurchaseOrderList = lazy(() => muat(() => import('./pages/Purchasing/PurchaseOrderList')))
const PurchaseOrderForm = lazy(() => muat(() => import('./pages/Purchasing/PurchaseOrderForm')))
const PODetail = lazy(() => muat(() => import('./pages/Purchasing/PODetail')))
const Purchasing = lazy(() => muat(() => import('./pages/Purchasing/Purchasing')))
const PriceComparison = lazy(() => muat(() => import('./pages/Purchasing/PriceComparison')))
const ContractList = lazy(() => muat(() => import('./pages/Purchasing/ContractList')))
const ContractForm = lazy(() => muat(() => import('./pages/Purchasing/ContractForm')))
const RFQList = lazy(() => muat(() => import('./pages/Purchasing/RFQList')))
const QuoteList = lazy(() => muat(() => import('./pages/Purchasing/QuoteList')))
const RFQForm = lazy(() => muat(() => import('./pages/Purchasing/RFQForm')))
const GRNForm = lazy(() => muat(() => import('./pages/Purchasing/GRNForm')))
const SupplierQuoteForm = lazy(() => muat(() => import('./pages/Purchasing/SupplierQuoteForm')))
const PRList = lazy(() => muat(() => import('./pages/Purchasing/PRList')))
const PRForm = lazy(() => muat(() => import('./pages/Purchasing/PRForm')))
const PRDetail = lazy(() => muat(() => import('./pages/Purchasing/PRDetail')))
const GRNList = lazy(() => muat(() => import('./pages/Purchasing/GRNList')))
const GRNDetail = lazy(() => muat(() => import('./pages/Purchasing/GRNDetail')))
const DownPaymentList = lazy(() => muat(() => import('./pages/Purchasing/DownPaymentList')))
const DownPaymentForm = lazy(() => muat(() => import('./pages/Purchasing/DownPaymentForm')))
const DownPaymentDetail = lazy(() => muat(() => import('./pages/Purchasing/DownPaymentDetail')))
const PurchaseInvoiceList = lazy(() => muat(() => import('./pages/Purchasing/InvoiceList')))
const InvoiceMatching = lazy(() => muat(() => import('./pages/Purchasing/InvoiceMatching')))
const PurchaseReturnList = lazy(() => muat(() => import('./pages/Purchasing/PurchaseReturnList')))
const PurchaseReturnDetail = lazy(() => muat(() => import('./pages/Purchasing/PurchaseReturnDetail')))
const PurchaseReturnForm = lazy(() => muat(() => import('./pages/Purchasing/PurchaseReturnForm')))
const MachineList = lazy(() => muat(() => import('./pages/Production/MachineList')))
const MachineForm = lazy(() => muat(() => import('./pages/Production/MachineForm')))
const MachineDetail = lazy(() => muat(() => import('./pages/Production/MachineDetail')))
const WorkCenterDashboard = lazy(() => muat(() => import('./pages/Production/WorkCenterDashboard')))
const WorkOrderList = lazy(() => muat(() => import('./pages/Production/WorkOrderList')))
const WorkOrderForm = lazy(() => muat(() => import('./pages/Production/WorkOrderForm')))
const ProductionDashboard = lazy(() => muat(() => import('./pages/Production/ProductionDashboard')))
const ProductionScheduling = lazy(() => muat(() => import('./pages/Production/ProductionScheduling')))
const ProductionRecords = lazy(() => muat(() => import('./pages/Production/ProductionRecords')))
const ProductionRecordForm = lazy(() => muat(() => import('./pages/Production/ProductionRecordForm')))
const EfficiencyTracking = lazy(() => muat(() => import('./pages/Production/EfficiencyTracking')))
const Traceability = lazy(() => muat(() => import('./pages/Production/Traceability')))
const MBFReport = lazy(() => muat(() => import('./pages/Production/MBFReport')))
const MBFReportList = lazy(() => muat(() => import('./pages/Production/MBFReportList')))
const ProductionPlanningList = lazy(() => muat(() => import('./pages/Production/ProductionPlanningList')))
const ProductionPlanningForm = lazy(() => muat(() => import('./pages/Production/ProductionPlanningForm')))
const ProductionPlanningDashboard = lazy(() => muat(() => import('./pages/Production/ProductionPlanningDashboard')))
const BatchSchedulingMasterData = lazy(() => muat(() => import('./pages/Production/BatchSchedulingMasterData')))
const BatchSchedulingSettings = lazy(() => muat(() => import('./pages/Settings/BatchSchedulingSettings')))
const BatchPlanning = lazy(() => muat(() => import('./pages/Production/BatchPlanning')))
const MaterialIssueList = lazy(() => muat(() => import('./pages/Production/MaterialIssueList')))
const MaterialIssueDetail = lazy(() => muat(() => import('./pages/Production/MaterialIssueDetail')))
const MaterialIssueShortages = lazy(() => muat(() => import('./pages/Production/MaterialIssueShortages')))
const WIPBatchForm = lazy(() => muat(() => import('./pages/Production/WIPBatchForm')))
const ProductionApprovalList = lazy(() => muat(() => import('./pages/Production/ProductionApprovalList')))
const ProductionApprovalDetail = lazy(() => muat(() => import('./pages/Production/ProductionApprovalDetail')))
const FGConversionList = lazy(() => muat(() => import('./pages/Production/FGConversionList')))
const FGConversionDetail = lazy(() => muat(() => import('./pages/Production/FGConversionDetail')))
const ProductChangeover = lazy(() => muat(() => import('./pages/Production/ProductChangeover')))
const ChangeoverList = lazy(() => muat(() => import('./pages/Production/ChangeoverList')))
const NotFound = lazy(() => muat(() => import('./pages/NotFound')))
const WeeklyProductionPlan = lazy(() => muat(() => import('./pages/Production/WeeklyProductionPlan')))
const WeeklyPlanDetail = lazy(() => muat(() => import('./pages/Production/WeeklyPlanDetail')))
const MonthlyProductionPlan = lazy(() => muat(() => import('./pages/Production/MonthlyProductionPlan')))
const DailyController = lazy(() => muat(() => import('./pages/Production/DailyController')))
const WeeklyController = lazy(() => muat(() => import('./pages/Production/WeeklyController')))
const MonthlyController = lazy(() => muat(() => import('./pages/Production/MonthlyController')))
const ConvertingDashboard = lazy(() => muat(() => import('./pages/Production/ConvertingDashboard')))
const ConvertingInput = lazy(() => muat(() => import('./pages/Production/ConvertingInput')))
const ConvertingDetail = lazy(() => muat(() => import('./pages/Production/ConvertingDetail')))
const WorkOrderMonitoring = lazy(() => muat(() => import('./pages/Production/WorkOrderMonitoring')))
const BreakdownSummary = lazy(() => muat(() => import('./pages/Production/BreakdownSummary')))
const WorkOrderTimeline = lazy(() => muat(() => import('./pages/Production/WorkOrderTimeline')))
const WorkOrderBreakdown = lazy(() => muat(() => import('./pages/Production/WorkOrderBreakdown')))
const WorkOrderStatus = lazy(() => muat(() => import('./pages/Production/WorkOrderStatus')))
const WorkOrderKanban = lazy(() => muat(() => import('./pages/Production/WorkOrderKanban')))
const QualityTestList = lazy(() => muat(() => import('./pages/Quality/QualityTestList')))
const QualityTestForm = lazy(() => muat(() => import('./pages/Quality/QualityTestForm')))
const QualityInspectionDetail = lazy(() => muat(() => import('./pages/Quality/QualityInspectionDetail')))
const QualityDashboardEnhanced = lazy(() => muat(() => import('./pages/Quality/QualityDashboardEnhanced')))
const QualityAlerts = lazy(() => muat(() => import('./pages/Quality/QualityAlerts')))
const QualityAnalytics = lazy(() => muat(() => import('./pages/Quality/QualityAnalytics')))
const QualityAudits = lazy(() => muat(() => import('./pages/Quality/QualityAudits')))
const PendingQC = lazy(() => muat(() => import('./pages/Quality/PendingQC')))
const WorkOrderQCForm = lazy(() => muat(() => import('./pages/Quality/WorkOrderQCForm')))
const QCToWarehouse = lazy(() => muat(() => import('./pages/Quality/QCToWarehouse')))
const IncomingQC = lazy(() => muat(() => import('./pages/Quality/IncomingQC')))
const SPCDashboard = lazy(() => muat(() => import('./pages/Quality/SPC/SPCDashboard')))
const InProcessQC = lazy(() => muat(() => import('./pages/Quality/InProcessQC')))
const FinishGoodQC = lazy(() => muat(() => import('./pages/Quality/FinishGoodQC')))
const FinishGoodDetail = lazy(() => muat(() => import('./pages/Quality/FinishGoodDetail')))
const BatchStatusChange = lazy(() => muat(() => import('./pages/Quality/BatchStatusChange')))
const QualityObjectiveProduction = lazy(() => muat(() => import('./pages/Quality/QualityObjectiveProduction')))
const DowntimeAnalysis = lazy(() => muat(() => import('./pages/Quality/DowntimeAnalysis')))
const ShippingDashboard = lazy(() => muat(() => import('./pages/Shipping/ShippingDashboard')))
const ShippingOrderList = lazy(() => muat(() => import('./pages/Shipping/ShippingOrderList')))
const ShippingOrderForm = lazy(() => muat(() => import('./pages/Shipping/ShippingOrderForm')))
const CreateShippingFromQC = lazy(() => muat(() => import('./pages/Shipping/CreateShippingFromQC')))
const ShippingOrderDetails = lazy(() => muat(() => import('./pages/Shipping/ShippingOrderDetails')))
const ShippingTrackingForm = lazy(() => muat(() => import('./pages/Shipping/ShippingTrackingForm')))
const ShippingReportsForm = lazy(() => muat(() => import('./pages/Shipping/ShippingReportsForm')))
const DeliveryTracking = lazy(() => muat(() => import('./pages/Shipping/DeliveryTracking')))
const ShippingCalculator = lazy(() => muat(() => import('./pages/Shipping/ShippingCalculator')))
const LogisticsProviders = lazy(() => muat(() => import('./pages/Shipping/LogisticsProviders')))
const FinanceDashboard = lazy(() => muat(() => import('./pages/Finance/FinanceDashboard')))
const AccountingManagement = lazy(() => muat(() => import('./pages/Finance/AccountingManagement')))
const JournalEntryPage = lazy(() => muat(() => import('./pages/Finance/JournalEntryPage')))
const BudgetPlanning = lazy(() => muat(() => import('./pages/Finance/BudgetPlanning')))
const BankReconciliation = lazy(() => muat(() => import('./pages/Finance/BankReconciliation')))
const CashFlowManagement = lazy(() => muat(() => import('./pages/Finance/CashFlowManagement')))
const FinancialReports = lazy(() => muat(() => import('./pages/Finance/FinancialReports')))
const SalesReport = lazy(() => muat(() => import('./pages/Finance/SalesReport')))
const AgingReport = lazy(() => muat(() => import('./pages/Finance/AgingReport')))
const ReportsHub = lazy(() => muat(() => import('./pages/Finance/Reports/ReportsHub')))
const FinanceSearch = lazy(() => muat(() => import('./pages/Finance/FinanceSearch')))
const TrialBalance = lazy(() => muat(() => import('./pages/Finance/Reports/TrialBalance')))
const InventoryMutation = lazy(() => muat(() => import('./pages/Finance/Reports/InventoryMutation')))
const InventoryByWarehouse = lazy(() => muat(() => import('./pages/Finance/Reports/InventoryByWarehouse')))
const StockVsLedger = lazy(() => muat(() => import('./pages/Finance/Reports/StockVsLedger')))
const NearExpiry = lazy(() => muat(() => import('./pages/Finance/Reports/NearExpiry')))
const AccountLedger = lazy(() => muat(() => import('./pages/Finance/Reports/AccountLedger')))
const CashDaily = lazy(() => muat(() => import('./pages/Finance/Reports/CashDaily')))
const CashDailyDetail = lazy(() => muat(() => import('./pages/Finance/Reports/CashDailyDetail')))
const CashPosition = lazy(() => muat(() => import('./pages/Finance/Reports/CashPosition')))
const PartyStatements = lazy(() => muat(() => import('./pages/Finance/Reports/PartyStatements')))
const PartyStatementDetail = lazy(() => muat(() => import('./pages/Finance/Reports/PartyStatementDetail')))
const PurchaseReport = lazy(() => muat(() => import('./pages/Finance/Reports/PurchaseReport')))
const VatReport = lazy(() => muat(() => import('./pages/Finance/Reports/VatReport')))
const VatDetail = lazy(() => muat(() => import('./pages/Finance/Reports/VatDetail')))
const EquityChanges = lazy(() => muat(() => import('./pages/Finance/Reports/EquityChanges')))
const CreditMemoList = lazy(() => muat(() => import('./pages/Finance/CreditMemoList')))
const InvoiceList = lazy(() => muat(() => import('./pages/Finance/InvoiceList')))
const FinanceInvoiceForm = lazy(() => muat(() => import('./pages/Finance/InvoiceForm')))
const AccountsReceivable = lazy(() => muat(() => import('./pages/Finance/AccountsReceivable')))
const AccountsPayable = lazy(() => muat(() => import('./pages/Finance/AccountsPayable')))
const GeneralLedger = lazy(() => muat(() => import('./pages/Finance/GeneralLedger')))
const ChartOfAccounts = lazy(() => muat(() => import('./pages/Finance/ChartOfAccounts')))
const PeriodClose = lazy(() => muat(() => import('./pages/Finance/PeriodClose')))
const RecurringPayment = lazy(() => muat(() => import('./pages/Finance/RecurringPayment')))
const RecurringPaymentTransactionDetail = lazy(() => muat(() => import('./pages/Finance/RecurringPaymentTransactionDetail')))
const RecurringPaymentTransactionRedirect = lazy(() => muat(() => import('./pages/Finance/RecurringPaymentTransactionRedirect')))
const ReimbursementDetail = lazy(() => muat(() => import('./pages/Finance/ReimbursementDetail')))
const ExpenseDetail = lazy(() => muat(() => import('./pages/Finance/ExpenseDetail')))
const PurchaseInvoiceDetail = lazy(() => muat(() => import('./pages/Finance/PurchaseInvoiceDetail')))
const SalesInvoiceDetail = lazy(() => muat(() => import('./pages/Finance/SalesInvoiceDetail')))
const CashBankManagement = lazy(() => muat(() => import('./pages/Finance/CashBankManagement')))
const TaxManagement = lazy(() => muat(() => import('./pages/Finance/TaxManagement')))
const CostingControlling = lazy(() => muat(() => import('./pages/Finance/CostingControlling')))
const Consolidation = lazy(() => muat(() => import('./pages/Finance/Consolidation')))
const PaymentForm = lazy(() => muat(() => import('./pages/Finance/PaymentForm')))
const PaymentList = lazy(() => muat(() => import('./pages/Finance/PaymentList')))
const BankTransferList = lazy(() => muat(() => import('./pages/Finance/BankTransferList')))
const RollList = lazy(() => muat(() => import('./pages/Production/RollList')))
const BankTransferForm = lazy(() => muat(() => import('./pages/Finance/BankTransferForm')))
const AdvanceRecap = lazy(() => muat(() => import('./pages/Finance/AdvanceRecap')))
const PaymentDetail = lazy(() => muat(() => import('./pages/Finance/PaymentDetail')))
const EmployeeExpenseForm = lazy(() => muat(() => import('./pages/Finance/EmployeeExpenseForm')))
const ClaimsHub = lazy(() => muat(() => import('./pages/Finance/ClaimsHub')))
const ReimbursementForm = lazy(() => muat(() => import('./pages/Finance/ReimbursementForm')))
const EmployeeList = lazy(() => muat(() => import('./pages/HR/EmployeeList')))
const EmployeeForm = lazy(() => muat(() => import('./pages/HR/EmployeeForm')))
const RosterCalendar = lazy(() => muat(() => import('./pages/HR/RosterCalendar')))
const RosterManagementComplete = lazy(() => muat(() => import('./pages/HR/RosterManagementComplete')))
const WorkRosterComplete = lazy(() => muat(() => import('./pages/HR/WorkRosterComplete')))
const WorkRosterWeekly = lazy(() => muat(() => import('./pages/HR/WorkRosterWeekly')))
const HRDashboard = lazy(() => muat(() => import('./pages/HR/HRDashboard')))
const PettyCash = lazy(() => muat(() => import('./pages/HR/PettyCash')))
const FingerprintMapping = lazy(() => muat(() => import('./pages/HR/FingerprintMapping')))
const FingerprintAttendance = lazy(() => muat(() => import('./pages/HR/FingerprintAttendance')))
const AttendanceSchedules = lazy(() => muat(() => import('./pages/HR/AttendanceSchedules')))
const PayrollList = lazy(() => muat(() => import('./pages/HR/PayrollList')))
const PayrollPeriodForm = lazy(() => muat(() => import('./pages/HR/PayrollPeriodForm')))
const PayrollRecordList = lazy(() => muat(() => import('./pages/HR/PayrollRecordList')))
const AttendanceManagement = lazy(() => muat(() => import('./pages/HR/AttendanceManagement')))
const AttendanceAdmin = lazy(() => muat(() => import('./pages/HR/AttendanceAdmin')))
const AttendanceReconciliation = lazy(() => muat(() => import('./pages/HR/AttendanceReconciliation')))
const WorkScheduleManagement = lazy(() => muat(() => import('./pages/HR/WorkScheduleManagement')))
const FaceAdmin = lazy(() => muat(() => import('./pages/HR/FaceAdmin')))
const AttendancePage = lazy(() => muat(() => import('./pages/HR/AttendancePage')))
const AttendanceReport = lazy(() => muat(() => import('./pages/HR/AttendanceReport')))
const PublicAttendance = lazy(() => muat(() => import('./pages/Public/PublicAttendance')))
const StaffLeaveRequest = lazy(() => muat(() => import('./pages/Public/StaffLeaveRequest')))
const FaceRegistration = lazy(() => muat(() => import('./pages/Public/FaceRegistration')))
const AttendanceCalendar = lazy(() => muat(() => import('./pages/HR/AttendanceCalendar')))
const AttendanceNotClockedOut = lazy(() => muat(() => import('./pages/HR/AttendanceNotClockedOut')))
const StaffLeaveManagement = lazy(() => muat(() => import('./pages/HR/StaffLeaveManagement')))
const LeaveManagement = lazy(() => muat(() => import('./pages/HR/LeaveManagement')))
const LeaveRequestForm = lazy(() => muat(() => import('./pages/HR/LeaveRequestForm')))
const AppraisalList = lazy(() => muat(() => import('./pages/HR/AppraisalList')))
const AppraisalCycleForm = lazy(() => muat(() => import('./pages/HR/AppraisalCycleForm')))
const TrainingManagement = lazy(() => muat(() => import('./pages/HR/TrainingManagement')))
const AttendanceForm = lazy(() => muat(() => import('./pages/HR/AttendanceForm')))
const LeaveForm = lazy(() => muat(() => import('./pages/HR/LeaveForm')))
const PayrollForm = lazy(() => muat(() => import('./pages/HR/PayrollForm')))
const OutsourcingVendorList = lazy(() => muat(() => import('./pages/HR/OutsourcingVendorList')))
const PieceworkLogList = lazy(() => muat(() => import('./pages/HR/PieceworkLogList')))
const Departments = lazy(() => muat(() => import('./pages/HR/Departments')))
const PositionManagement = lazy(() => muat(() => import('./pages/HR/PositionManagement')))
const HRReports = lazy(() => muat(() => import('./pages/HR/Reports')))
const MaintenanceList = lazy(() => muat(() => import('./pages/Maintenance/MaintenanceList')))
const MaintenancePartsForm = lazy(() => muat(() => import('./pages/Maintenance/MaintenancePartsForm')))
const MachineParts = lazy(() => muat(() => import('./pages/Maintenance/MachineParts')))
const SparePartRequests = lazy(() => muat(() => import('./pages/Maintenance/SparePartRequests')))
const MaintenanceAnalyticsForm = lazy(() => muat(() => import('./pages/Maintenance/MaintenanceAnalyticsForm')))
const MaintenanceDashboardEnhanced = lazy(() => muat(() => import('./pages/Maintenance/MaintenanceDashboardEnhanced')))
const MaintenanceSchedule = lazy(() => muat(() => import('./pages/Maintenance/MaintenanceSchedule')))
const MaintenanceForm = lazy(() => muat(() => import('./pages/Maintenance/MaintenanceForm')))
const MaintenanceRequestForm = lazy(() => muat(() => import('./pages/Maintenance/MaintenanceRequestForm')))
const SparePartStock = lazy(() => muat(() => import('./pages/Maintenance/SparePartStock')))
const SparePartDetail = lazy(() => muat(() => import('./pages/Maintenance/SparePartDetail')))
const ChecklistNGItems = lazy(() => muat(() => import('./pages/Maintenance/ChecklistNGItems')))
const WMSDashboard = lazy(() => muat(() => import('./pages/WMS').then((m) => ({ default: m.WMSDashboard }))))
const StockByWorkOrder = lazy(() => muat(() => import('./pages/WMS').then((m) => ({ default: m.StockByWorkOrder }))))
const StockByWODetail = lazy(() => muat(() => import('./pages/WMS').then((m) => ({ default: m.StockByWODetail }))))
const MaterialConsumptionPage = lazy(() => muat(() => import('./pages/WMS').then((m) => ({ default: m.MaterialConsumptionPage }))))
const TransactionsPage = lazy(() => muat(() => import('./pages/WMS').then((m) => ({ default: m.TransactionsPage }))))
const TransactionDetail = lazy(() => muat(() => import('./pages/WMS').then((m) => ({ default: m.TransactionDetail }))))
const PickListPage = lazy(() => muat(() => import('./pages/WMS').then((m) => ({ default: m.PickListPage }))))
const TransferOrderPage = lazy(() => muat(() => import('./pages/WMS').then((m) => ({ default: m.TransferOrderPage }))))
const CycleCountPage = lazy(() => muat(() => import('./pages/WMS').then((m) => ({ default: m.CycleCountPage }))))
const BatchTraceability = lazy(() => muat(() => import('./pages/WMS').then((m) => ({ default: m.BatchTraceability }))))
const AssetDashboard = lazy(() => muat(() => import('./pages/AssetManagement/AssetDashboard')))
const AssetList = lazy(() => muat(() => import('./pages/AssetManagement/AssetList')))
const AssetDetail = lazy(() => muat(() => import('./pages/AssetManagement/AssetDetail')))
const AssetForm = lazy(() => muat(() => import('./pages/AssetManagement/AssetForm')))
const FunctionalLocations = lazy(() => muat(() => import('./pages/AssetManagement/FunctionalLocations')))
const SparePartsList = lazy(() => muat(() => import('./pages/AssetManagement/SparePartsList')))
const DepreciationReport = lazy(() => muat(() => import('./pages/AssetManagement/DepreciationReport')))
const RNDDashboard = lazy(() => muat(() => import('./pages/RND').then((m) => ({ default: m.RNDDashboard }))))
const RNDProjectList = lazy(() => muat(() => import('./pages/RND').then((m) => ({ default: m.RNDProjectList }))))
const RNDProjectDetail = lazy(() => muat(() => import('./pages/RND').then((m) => ({ default: m.RNDProjectDetail }))))
const RNDProjectForm = lazy(() => muat(() => import('./pages/RND').then((m) => ({ default: m.RNDProjectForm }))))
const RNDApprovals = lazy(() => muat(() => import('./pages/RND').then((m) => ({ default: m.RNDApprovals }))))
const WasteRecordList = lazy(() => muat(() => import('./pages/Waste/WasteRecordList')))
const WasteRecordForm = lazy(() => muat(() => import('./pages/Waste/WasteRecordForm')))
const ReturnsDashboard = lazy(() => muat(() => import('./pages/Returns/ReturnsDashboard')))
const ReturnDetails = lazy(() => muat(() => import('./pages/Returns/ReturnDetails')))
const CreateReturnForm = lazy(() => muat(() => import('./pages/Returns/CreateReturnForm')))
const OEEDashboard = lazy(() => muat(() => import('./pages/OEE/OEEDashboard')))
const EWSDashboard = lazy(() => muat(() => import('./pages/EWS/EWSDashboard')))
const OEEDashboardEnhanced = lazy(() => muat(() => import('./pages/OEE/OEEDashboardEnhanced')))
const OEERecordForm = lazy(() => muat(() => import('./pages/OEE/OEERecordForm')))
const MachineAnalytics = lazy(() => muat(() => import('./pages/OEE/MachineAnalytics')))
const ProductionInput = lazy(() => muat(() => import('./pages/Production/ProductionInput')))
const DowntimeInput = lazy(() => muat(() => import('./pages/Production/DowntimeInput')))
const WorkOrderProductionInput = lazy(() => muat(() => import('./pages/Production/WorkOrderProductionInput')))
const EditProductionRecord = lazy(() => muat(() => import('./pages/Production/EditProductionRecord')))
const WorkOrderEdit = lazy(() => muat(() => import('./pages/Production/WorkOrderEdit')))
const WorkOrderBOMEdit = lazy(() => muat(() => import('./pages/Production/WorkOrderBOMEdit')))
const CloseWorkOrder = lazy(() => muat(() => import('./pages/Production/CloseWorkOrder')))
const BatchClose = lazy(() => muat(() => import('./pages/Production/BatchClose')))
const BatchRecord = lazy(() => muat(() => import('./pages/Production/BatchRecord')))
const BatchRecordList = lazy(() => muat(() => import('./pages/Production/BatchRecordList')))
const BatchRecordWeeklyReport = lazy(() => muat(() => import('./pages/Production/BatchRecordWeeklyReport')))
const BOMForm = lazy(() => muat(() => import('./pages/Products/BOMForm')))
const ProductionScheduleForm = lazy(() => muat(() => import('./pages/Production/ProductionScheduleForm')))
const QualityCheckForm = lazy(() => muat(() => import('./pages/Production/QualityCheckForm')))
const MaterialIssueForm = lazy(() => muat(() => import('./pages/Production/MaterialIssueForm')))
const WIPDashboard = lazy(() => muat(() => import('./pages/Production/WIPDashboard')))
const WIPBatchList = lazy(() => muat(() => import('./pages/Production/WIPBatchList')))
const RemainingStock = lazy(() => muat(() => import('./pages/Production/RemainingStock')))
const WIPStock = lazy(() => muat(() => import('./pages/Production/WIPStock')))
const Reports = lazy(() => muat(() => import('./pages/Reports/ReportsFixed')))
const AdvancedReportBuilder = lazy(() => muat(() => import('./pages/Reports/AdvancedReportBuilder')))
const ExecutiveDashboard = lazy(() => muat(() => import('./pages/Reports/ExecutiveDashboard')))
const ProductionByProductReport = lazy(() => muat(() => import('./pages/Reports/ProductionByProductReport')))
const ProductionMonitoringDashboard = lazy(() => muat(() => import('./pages/Executive/ProductionMonitoringDashboard')))
const FactoryLayoutDashboard = lazy(() => muat(() => import('./pages/Executive/FactoryLayoutDashboard')))
const LiveMonitoringDashboard = lazy(() => muat(() => import('./pages/Production/LiveMonitoringDashboard')))
const LiveMonitoringWeekly = lazy(() => muat(() => import('./pages/Production/LiveMonitoringWeekly')))
const LiveMonitoringView = lazy(() => muat(() => import('./pages/Production/LiveMonitoringView')))
const PreShiftChecklist = lazy(() => muat(() => import('./pages/Production/PreShiftChecklist')))
const PreShiftChecklistForm = lazy(() => muat(() => import('./pages/Production/PreShiftChecklistForm')))
const PreShiftChecklistView = lazy(() => muat(() => import('./pages/Production/PreShiftChecklistView')))
const PreShiftChecklistWeekly = lazy(() => muat(() => import('./pages/Production/PreShiftChecklistWeekly')))
const DocumentControlCenter = lazy(() => muat(() => import('./pages/DCC/DocumentControlCenter')))
const DocumentVerifyPage = lazy(() => muat(() => import('./pages/DCC/DocumentVerifyPage')))
const ReportGenerator = lazy(() => muat(() => import('./pages/Reports/ReportGenerator')))
const CustomReportBuilder = lazy(() => muat(() => import('./pages/Reports/CustomReportBuilder')))
const ReportScheduler = lazy(() => muat(() => import('./pages/Reports/ReportScheduler')))
const Landing = lazy(() => muat(() => import('./pages/Landing/Landing')))
const ApprovalDashboard = lazy(() => muat(() => import('./pages/Approval/ApprovalDashboard')))
const ApprovalDetail = lazy(() => muat(() => import('./pages/Approval/ApprovalDetail')))
const WIPLedger = lazy(() => muat(() => import('./pages/Finance/WIPLedger')))
const WIPLedgerDetail = lazy(() => muat(() => import('./pages/Finance/WIPLedgerDetail')))
const DocumentDashboard = lazy(() => muat(() => import('./pages/Documents/DocumentDashboardUpgraded')))
const DocumentGenerator = lazy(() => muat(() => import('./pages/Documents/DocumentGeneratorUpgraded')))
const TemplateList = lazy(() => muat(() => import('./pages/Documents/TemplateList')))
const TemplateVersionEditor = lazy(() => muat(() => import('./pages/Documents/TemplateVersionEditor')))
const WorkOrderDetail = lazy(() => muat(() => import('./pages/Production/WorkOrderDetail')))
const Settings = lazy(() => muat(() => import('./pages/Settings/Settings')))
const AdvancedSystemConfig = lazy(() => muat(() => import('./pages/Settings/AdvancedSystemConfig')))
const UserRoleManagement = lazy(() => muat(() => import('./pages/Settings/UserRoleManagement')))
const AuditTrail = lazy(() => muat(() => import('./pages/Settings/AuditTrail')))
const BackupRestore = lazy(() => muat(() => import('./pages/Settings/BackupRestore')))
const EmailSettings = lazy(() => muat(() => import('./pages/Settings/EmailSettings')))
const KPITargetSettings = lazy(() => muat(() => import('./pages/Settings/KPITargetSettings')))
const AccountPreferences = lazy(() => muat(() => import('./pages/Settings/AccountPreferences')))
const SystemHealth = lazy(() => muat(() => import('./pages/Settings/SystemHealth')))
const NettoDeductionRulesManager = lazy(() => muat(() => import('./pages/Settings/NettoDeductionRulesManager')))
const FactoryLayoutAdmin = lazy(() => muat(() => import('./pages/Settings/FactoryLayoutAdmin')))
const UserProfile = lazy(() => muat(() => import('./pages/Profile/UserProfile')))
const UserManual = lazy(() => muat(() => import('./pages/Manual/UserManual')))
const FAQPage = lazy(() => muat(() => import('./pages/Manual/FAQPage')))
const ManualAdmin = lazy(() => muat(() => import('./pages/Manual/ManualAdmin')))
import AdminRoute from './components/Auth/AdminRoute'
import StaffAdminRoute from './components/Auth/StaffAdminRoute'
const AccurateIntegration = lazy(() => muat(() => import('./pages/Integration/AccurateIntegration')))
const TVDisplayProduction = lazy(() => muat(() => import('./pages/TVDisplay/TVDisplayProduction')))
const TVDisplayShipping = lazy(() => muat(() => import('./pages/TVDisplay/TVDisplayShipping')))
const TVDisplaySelector = lazy(() => muat(() => import('./pages/TVDisplay/TVDisplaySelector')))
const TVDisplayRoster = lazy(() => muat(() => import('./pages/TVDisplay/TVDisplayRoster')))
const TVDisplayOverview = lazy(() => muat(() => import('./pages/TVDisplay/TVDisplayOverview')))
const MRP = lazy(() => muat(() => import('./pages/MRP/MRP')))
const WhatIfSimulation = lazy(() => muat(() => import('./pages/MRP/WhatIfSimulation')))
const MRPDashboard = lazy(() => muat(() => import('./pages/MRP/MRPDashboard')))
const MRPRun = lazy(() => muat(() => import('./pages/MRP/MRPRun')))
const DemandPlanning = lazy(() => muat(() => import('./pages/MRP/DemandPlanning')))
const CapacityPlanning = lazy(() => muat(() => import('./pages/MRP/CapacityPlanning')))
const MaterialRequirements = lazy(() => muat(() => import('./pages/MRP/MaterialRequirements')))
const SupplierIntegration = lazy(() => muat(() => import('./pages/MRP/SupplierIntegration')))
const NotificationsPage = lazy(() => muat(() => import('./pages/Notifications/NotificationsPage')))
// Redirect component for warehouse zones with ID
const WarehouseZoneRedirect = () => {
  const { id } = useParams()
  return <Navigate to={`/app/warehouse/zones/${id}`} replace />
}

// Redirect component for warehouse zone locations with ID
const WarehouseZoneLocationsRedirect = () => {
  const { id } = useParams()
  return <Navigate to={`/app/warehouse/zones/${id}/locations`} replace />
}

// Wrapper for ProductFormNew to handle routing
const ProductFormNewWrapper = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (id) {
      setLoading(true)
      axiosInstance.get(`/api/products-new/${id}`)
        .then(res => setProduct(res.data))
        .catch(err => console.error('Error loading product:', err))
        .finally(() => setLoading(false))
    }
  }, [id])

  const handleSave = () => {
    navigate('/app/products/list')
  }
  const handleCancel = () => {
    navigate(-1)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  }

  return <ProductFormNew product={product} onSave={handleSave} onCancel={handleCancel} />
}


// Every /app/* page. Rendered by the main router (non-module pages) and by each workspace tab.
function AppChildRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
                <Route index element={<DashboardModules />} />

                {/* Old Dashboard */}

                {/* Production Monitoring */}
                <Route path="executive/production-monitoring" element={<ProductionMonitoringDashboard />} />
                <Route path="executive/factory-layout" element={<FactoryLayoutDashboard />} />
                <Route path="production/live-monitoring" element={<LiveMonitoringDashboard />} />
                <Route path="production/live-monitoring/weekly" element={<LiveMonitoringWeekly />} />
                <Route path="production/live-monitoring/view/:id" element={<LiveMonitoringView />} />
                <Route path="production/pre-shift-checklist" element={<PreShiftChecklist />} />
                <Route path="production/pre-shift-checklist/form" element={<PreShiftChecklistForm />} />
                <Route path="production/pre-shift-checklist/view/:id" element={<PreShiftChecklistView />} />
                <Route path="production/pre-shift-checklist/weekly" element={<PreShiftChecklistWeekly />} />

                {/* Master Data */}
                <Route path="master-data" element={<MasterDataPage />} />

                {/* Products */}
                <Route path="products" element={<ProductsNewPage />} />
                <Route path="products/dashboard" element={<ProductDashboard />} />
                <Route path="products/list" element={<ProductsNewPage />} />
                <Route path="products/list/old" element={<ProductList />} />
                <Route path="products/analytics" element={<ProductAnalytics />} />
                <Route path="products/categories" element={<ProductCategories />} />
                <Route path="products/bom" element={<BOMManagement />} />
                <Route path="products/boms" element={<BOMManagement />} />
                <Route path="products/boms/new" element={<BOMForm />} />
                <Route path="products/boms/:id" element={<BOMForm />} />
                <Route path="products/boms/:id/edit" element={<BOMForm />} />
                <Route path="products/:id" element={<ProductFormNewWrapper />} />
                <Route path="products/lifecycle" element={<ProductLifecycle />} />
                {/* Kalkulator nonwoven sudah lama ada tapi tidak pernah
                    dipasang rutenya - halamannya tidak bisa dibuka sama sekali.
                    Pintasannya ada di dashboard produk. */}
                <Route path="products/calculator" element={<NonwovenCalculator />} />
                <Route path="products/new" element={<ProductFormNewWrapper />} />
                <Route path="products/:id/edit" element={<ProductFormNewWrapper />} />
                <Route path="products/:kode_produk/versions" element={<ProductVersionHistory />} />
                <Route path="products/:kode_produk/compare" element={<ProductCompare />} />
                <Route path="products-v2" element={<ProductsNewPage />} />

                {/* Warehouse */}
                <Route path="warehouse" element={<WarehouseDashboardEnhanced />} />
                <Route path="warehouse/dashboard" element={<WarehouseDashboardEnhanced />} />
                <Route path="warehouse/analytics" element={<WarehouseAnalytics />} />
                <Route path="warehouse/abc-analysis" element={<ABCAnalysis />} />
                <Route path="warehouse/zones" element={<WarehouseZones />} />
                <Route path="warehouse/gudang/:id" element={<ZoneStockPage />} />
                <Route path="warehouse/zones/:id" element={<WarehouseZones />} />
                <Route path="warehouse/zones/:id/locations" element={<WarehouseLocations />} />
                <Route path="warehouse/zones/new" element={<WarehouseZones />} />
                <Route path="warehouse/locations" element={<LocationList />} />
                <Route path="warehouse/locations/new" element={<LocationForm />} />
                <Route path="warehouse/locations/:id" element={<LocationDetail />} />
                <Route path="warehouse/locations/:id/edit" element={<LocationForm />} />
                <Route path="warehouse/inventory" element={<RawMaterialStockPage />} />
                <Route path="warehouse/inventory/add-product" element={<AddProductToInventory />} />
                <Route path="warehouse/inventory/new" element={<InventoryForm />} />
                <Route path="warehouse/inventory/:id/edit" element={<InventoryForm />} />
                <Route path="warehouse/stock-input" element={<StockInput />} />
                <Route path="warehouse/stock-summary" element={<InventoryListEnhanced />} />
                <Route path="warehouse/alerts" element={<StockAlerts />} />
                <Route path="warehouse/uom" element={<UoMList />} />
                <Route path="warehouse/material-issues" element={<MaterialIssueList />} />
                <Route path="warehouse/movements" element={<MovementList />} />
                <Route path="warehouse/movements/new" element={<MovementForm />} />
                <Route path="warehouse/movements/:id" element={<MovementDetail />} />
                <Route path="warehouse/movements/:id/edit" element={<MovementForm />} />
                <Route path="warehouse/adjustments" element={<AdjustmentList />} />
                <Route path="warehouse/adjustments/new" element={<AdjustmentForm />} />
                <Route path="warehouse/adjustments/:id" element={<AdjustmentDetail />} />
                <Route path="warehouse/transfers" element={<TransferHub />} />
                <Route path="warehouse/transfers/new" element={<StockTransferForm />} />
                <Route path="warehouse/transfers/receive" element={<TransferHub />} />
                <Route path="warehouse/transfers/:id" element={<StockTransferDetail />} />
                <Route path="warehouse/item-stock/:kind/:id" element={<ItemStockPage />} />
                <Route path="warehouse/reports" element={<InventoryList />} />
                <Route path="warehouse/materials" element={<MaterialsDashboard />} />
                <Route path="warehouse/materials/list" element={<MaterialsList />} />
                <Route path="warehouse/materials/stock" element={<MaterialStockManagement />} />
                <Route path="warehouse/materials/new" element={<MaterialCreate />} />
                <Route path="warehouse/materials/:id" element={<MaterialView />} />
                <Route path="warehouse/materials/:id/edit" element={<MaterialEdit />} />
                <Route path="warehouse/stock-opname" element={<StockOpnameList />} />
                <Route path="warehouse/stock-opname/new" element={<StockOpnameForm />} />
                <Route path="warehouse/stock-opname/results" element={<StockOpnameResultsPage />} />
                <Route path="warehouse/stock-opname/:id" element={<StockOpnameDetail />} />

                {/* Sales */}
                <Route path="sales" element={<Navigate to="/app/sales/dashboard" replace />} />
                <Route path="sales/dashboard" element={<SalesDashboard />} />
                <Route path="sales/leads" element={<LeadList />} />
                <Route path="sales/leads/new" element={<LeadForm />} />
                <Route path="sales/leads/:id" element={<LeadForm />} />
                <Route path="sales/leads/:id/edit" element={<LeadForm />} />
                <Route path="sales/opportunities" element={<OpportunityList />} />
                <Route path="sales/opportunities/new" element={<OpportunityForm />} />
                <Route path="sales/opportunities/:id" element={<OpportunityForm />} />
                <Route path="sales/opportunities/:id/edit" element={<OpportunityForm />} />
                <Route path="sales/quotations" element={<QuotationList />} />
                <Route path="sales/quotations/new" element={<QuotationForm />} />
                <Route path="sales/quotations/:id/edit" element={<QuotationForm />} />
                <Route path="sales/activities" element={<ActivityList />} />
                <Route path="sales/activities/new" element={<ActivityForm />} />
                <Route path="sales/customers" element={<CustomerList />} />
                <Route path="sales/customers/new" element={<CustomerForm />} />
                <Route path="sales/customers/:id" element={<CustomerDetails />} />
                <Route path="sales/customers/:id/edit" element={<CustomerForm />} />
                <Route path="sales/orders" element={<SalesOrderList />} />
                <Route path="sales/orders/new" element={<SalesOrderSourcePicker />} />
                <Route path="sales/orders/new/manual" element={<SalesOrderForm />} />
                <Route path="sales/orders/:id/workflow" element={<WorkflowStatus />} />
                <Route path="sales/orders/:id/edit" element={<SalesOrderForm />} />
                <Route path="sales/orders/:id" element={<SalesOrderDetails />} />
                <Route path="sales/forecasts" element={<SalesForecastList />} />
                <Route path="sales/forecasts/:id" element={<SalesForecastGrid />} />
                <Route path="sales/invoices" element={<Navigate to="/app/finance/invoices?scope=sales" replace />} />
                <Route path="sales/invoices/new" element={<SalesInvoiceFormNew />} />
                <Route path="sales/invoices/:id/edit" element={<SalesInvoiceForm />} />
                <Route path="sales/invoices/:id" element={<SalesInvoiceDetail />} />

                {/* Purchasing */}
                <Route path="purchasing" element={<Purchasing />} />
                <Route path="purchasing/suppliers" element={<SupplierList />} />
                <Route path="purchasing/suppliers/new" element={<SupplierForm />} />
                <Route path="purchasing/suppliers/:id" element={<SupplierForm />} />
                <Route path="purchasing/suppliers/:id/edit" element={<SupplierForm />} />
                <Route path="purchasing/purchase-orders" element={<PurchaseOrderList />} />
                <Route path="purchasing/purchase-orders/new" element={<PurchaseOrderForm />} />
                <Route path="purchasing/purchase-orders/:id" element={<PODetail />} />
                <Route path="purchasing/purchase-orders/:id/edit" element={<PurchaseOrderForm />} />
                <Route path="purchasing/orders" element={<PurchaseOrderList />} />
                <Route path="purchasing/orders/new" element={<PurchaseOrderForm />} />
                <Route path="purchasing/orders/:id" element={<PurchaseOrderForm />} />
                <Route path="purchasing/orders/:id/edit" element={<PurchaseOrderForm />} />
                <Route path="purchasing/rfq" element={<RFQList />} />
                <Route path="purchasing/rfqs" element={<RFQList />} />
                <Route path="purchasing/rfqs/new" element={<RFQForm />} />
                <Route path="purchasing/rfqs/:id" element={<RFQForm />} />
                <Route path="purchasing/rfqs/:id/edit" element={<RFQForm />} />
                <Route path="purchasing/grn" element={<GRNList />} />
                <Route path="purchasing/grn/new" element={<GRNForm />} />
                <Route path="purchasing/grn/:id" element={<GRNDetail />} />
                <Route path="purchasing/grn/:id/edit" element={<GRNForm />} />
                <Route path="purchasing/returns" element={<PurchaseReturnList />} />
                <Route path="purchasing/returns/new" element={<PurchaseReturnForm />} />
                <Route path="purchasing/returns/:id" element={<PurchaseReturnDetail />} />
                <Route path="purchasing/quotes" element={<QuoteList />} />
                <Route path="purchasing/quotes/new" element={<SupplierQuoteForm />} />
                <Route path="purchasing/quotes/:id" element={<SupplierQuoteForm />} />
                <Route path="purchasing/quotes/:id/edit" element={<SupplierQuoteForm />} />
                <Route path="purchasing/contracts" element={<ContractList />} />
                <Route path="purchasing/contracts/new" element={<ContractForm />} />
                <Route path="purchasing/contracts/:id" element={<ContractForm />} />
                <Route path="purchasing/contracts/:id/edit" element={<ContractForm />} />
                <Route path="purchasing/price-comparison" element={<PriceComparison />} />
                <Route path="purchasing/down-payments" element={<DownPaymentList />} />
                <Route path="purchasing/down-payments/new" element={<DownPaymentForm />} />
                <Route path="purchasing/down-payments/:id" element={<DownPaymentDetail />} />
                <Route path="purchasing/invoices" element={<PurchaseInvoiceList />} />
                <Route path="purchasing/invoices/new" element={<PurchaseInvoiceForm />} />
                <Route path="purchasing/invoices/:id/match" element={<InvoiceMatching />} />
                <Route path="purchasing/invoices/:id" element={<PurchaseInvoiceDetail />} />
                <Route path="purchasing/requisitions" element={<PRList />} />
                <Route path="purchasing/requisitions/new" element={<PRForm />} />
                <Route path="purchasing/requisitions/:id" element={<PRDetail />} />
                <Route path="purchasing/requisitions/:id/edit" element={<PRForm />} />
                <Route path="purchasing/supplier-integration" element={<SupplierIntegration />} />

                {/* Production */}
                <Route path="production" element={<ProductionDashboard />} />
                <Route path="production/dashboard" element={<ProductionDashboard />} />
                <Route path="production/machines" element={<MachineList />} />
                <Route path="production/machines/new" element={<MachineForm />} />
                <Route path="production/machines/:id" element={<MachineDetail />} />
                <Route path="production/machines/:id/edit" element={<MachineForm />} />
                <Route path="production/machines/:id/efficiency" element={<MachineDetail />} />
                <Route path="production/work-center" element={<WorkCenterDashboard />} />
                <Route path="production/machines/:id/analytics" element={<MachineDetail />} />
                <Route path="production/controller" element={<DailyController />} />
                <Route path="production/weekly-controller" element={<WeeklyController />} />
                <Route path="production/monthly-controller" element={<MonthlyController />} />
                <Route path="production/converting" element={<ConvertingDashboard />} />
                <Route path="production/converting/input" element={<ConvertingInput />} />
                <Route path="production/converting/:id" element={<ConvertingDetail />} />
                <Route path="production/work-orders" element={<WorkOrderList />} />
                <Route path="production/work-orders-monitoring" element={<WorkOrderMonitoring />} />
                <Route path="production/breakdown-summary" element={<BreakdownSummary />} />
                <Route path="production/work-orders/new" element={<WorkOrderForm />} />
                <Route path="production/work-orders/:id" element={<WorkOrderDetail />} />
                <Route path="production/work-orders/:id/edit" element={<WorkOrderEdit />} />
                <Route path="production/work-orders/:id/input" element={<WorkOrderProductionInput />} />
                <Route path="production/work-orders/:id/records/:recordId/edit" element={<EditProductionRecord />} />
                <Route path="production/work-orders/:id/timeline" element={<WorkOrderTimeline />} />
                <Route path="production/work-orders/:id/breakdown" element={<WorkOrderBreakdown />} />
                <Route path="production/work-order-status" element={<WorkOrderStatus />} />
                <Route path="production/work-orders-kanban" element={<WorkOrderKanban />} />
                <Route path="production/work-orders/:id/bom-edit" element={<WorkOrderBOMEdit />} />
                <Route path="production/work-orders/:id/close" element={<CloseWorkOrder />} />
                <Route path="production/batches/:id/close" element={<BatchClose />} />
                <Route path="production/batch-records" element={<BatchRecordList />} />
                <Route path="production/batches/weekly-report" element={<BatchRecordWeeklyReport />} />
                <Route path="production/batches/:id/record" element={<BatchRecord />} />
                <Route path="production/remaining-stock" element={<RemainingStock />} />
                <Route path="production/scheduling" element={<WeeklyProductionPlan />} />
                <Route path="production/monthly-schedule" element={<MonthlyProductionPlan />} />
                <Route path="production/weekly-plans/:id" element={<WeeklyPlanDetail />} />
                <Route path="production/schedules/new" element={<Navigate to="/app/production/scheduling?new=true" replace />} />
                <Route path="production/records" element={<ProductionRecords />} />
                <Route path="production/records/new" element={<ProductionRecordForm />} />
                <Route path="production/schedules/new" element={<ProductionScheduleForm />} />
                <Route path="production/schedules/:id/edit" element={<ProductionScheduleForm />} />
                <Route path="production/quality-checks/new" element={<QualityCheckForm />} />
                <Route path="production/quality-checks/:id/edit" element={<QualityCheckForm />} />
                <Route path="production/material-issues" element={<MaterialIssueList />} />
                <Route path="production/material-issues/shortages" element={<MaterialIssueShortages />} />
                <Route path="production/material-issues/new" element={<MaterialIssueForm />} />
                <Route path="production/material-issues/:id" element={<MaterialIssueDetail />} />
                <Route path="production/efficiency" element={<EfficiencyTracking />} />
                <Route path="production/traceability" element={<Traceability />} />
                <Route path="production/mbf-report" element={<MBFReportList />} />
                <Route path="production/mbf-report/new" element={<MBFReport />} />
                <Route path="production/mbf-report/:id" element={<MBFReport />} />
                <Route path="production/planning" element={<ProductionPlanningList />} />
                <Route path="production/planning/create" element={<ProductionPlanningForm />} />
                <Route path="production/planning/edit/:id" element={<ProductionPlanningForm />} />
                <Route path="production/planning/dashboard" element={<ProductionPlanningDashboard />} />
                <Route path="production/batch-scheduling" element={<BatchSchedulingMasterData />} />
                <Route path="production/batch-planning" element={<BatchPlanning />} />

                {/* FG Conversion - WIP to Finish Good */}
                <Route path="production/fg-conversion" element={<FGConversionList />} />
                <Route path="production/fg-conversion/:id" element={<FGConversionDetail />} />

                {/* Production MRP Integration */}
                <Route path="production/mrp" element={<MRPDashboard />} />
                <Route path="production/mrp-run" element={<MRPRun />} />
                <Route path="production/demand-planning" element={<DemandPlanning />} />
                <Route path="production/capacity-planning" element={<CapacityPlanning />} />
                <Route path="production/material-requirements" element={<MaterialRequirements />} />
                <Route path="production/supplier-integration" element={<SupplierIntegration />} />
                <Route path="production/simulation" element={<WhatIfSimulation />} />

                {/* Legacy MRP routes (redirect to production) */}
                <Route path="mrp" element={<Navigate to="/app/production/mrp" replace />} />
                <Route path="mrp/dashboard" element={<Navigate to="/app/production/mrp" replace />} />
                <Route path="mrp/demand-planning" element={<Navigate to="/app/production/demand-planning" replace />} />
                <Route path="mrp/capacity-planning" element={<Navigate to="/app/production/capacity-planning" replace />} />
                <Route path="mrp/material-requirements" element={<Navigate to="/app/production/material-requirements" replace />} />
                <Route path="mrp/supplier-integration" element={<Navigate to="/app/production/supplier-integration" replace />} />
                <Route path="mrp/legacy" element={<MRP />} />
                <Route path="mrp/simulation" element={<Navigate to="/app/production/simulation" replace />} />

                {/* Quality */}
                <Route path="quality" element={<QualityDashboardEnhanced />} />
                <Route path="quality/dashboard" element={<QualityDashboardEnhanced />} />
                <Route path="quality/incoming" element={<IncomingQC />} />
                <Route path="quality/spc" element={<SPCDashboard />} />
                <Route path="quality/in-process" element={<InProcessQC />} />
                <Route path="quality/finish-good" element={<FinishGoodQC />} />
                <Route path="quality/batch-status" element={<BatchStatusChange />} />
                <Route path="quality/finish-good/:woId/input" element={<WorkOrderQCForm />} />
                <Route path="quality/finish-good/:woId/detail" element={<FinishGoodDetail />} />
                <Route path="quality/finish-good/:woId/to-warehouse" element={<QCToWarehouse />} />
                <Route path="quality/objective/production" element={<QualityObjectiveProduction />} />
                <Route path="quality/objective/downtime-analysis" element={<DowntimeAnalysis />} />
                <Route path="quality/analytics" element={<QualityAnalytics />} />
                <Route path="quality/pending-qc" element={<PendingQC />} />
                <Route path="quality/pending-qc/:woId" element={<WorkOrderQCForm />} />
                <Route path="quality/tests" element={<QualityTestList />} />
                <Route path="quality/tests/new" element={<QualityTestForm />} />
                <Route path="quality/tests/:id" element={<QualityTestForm />} />
                <Route path="quality/tests/:id/edit" element={<QualityTestForm />} />
                <Route path="quality/inspections" element={<QualityTestList />} />
                <Route path="quality/inspections/new" element={<QualityTestForm />} />
                <Route path="quality/inspections/:id" element={<QualityInspectionDetail />} />
                <Route path="quality/inspections/:id/edit" element={<QualityTestForm />} />
                <Route path="quality-enhanced/dashboard" element={<QualityDashboardEnhanced />} />
                <Route path="quality-enhanced/alerts" element={<QualityAlerts />} />
                <Route path="quality-enhanced/analytics" element={<QualityAnalytics />} />
                <Route path="quality-enhanced/audits" element={<QualityAudits />} />
                <Route path="quality/to-warehouse" element={<QCToWarehouse />} />

                {/* Shipping */}
                <Route path="shipping" element={<ShippingDashboard />} />
                <Route path="shipping/orders" element={<ShippingOrderList />} />
                <Route path="shipping/orders/new" element={<ShippingOrderForm />} />
                <Route path="shipping/orders/from-qc" element={<CreateShippingFromQC />} />
                <Route path="shipping/orders/:id/edit" element={<ShippingOrderForm />} />
                <Route path="shipping/tracking" element={<DeliveryTracking />} />
                <Route path="shipping/calculator" element={<ShippingCalculator />} />
                <Route path="shipping/providers" element={<LogisticsProviders />} />
                <Route path="shipping/orders/:id" element={<ShippingOrderDetails />} />
                <Route path="shipping/orders/:orderId/tracking/new" element={<ShippingTrackingForm />} />
                <Route path="shipping/tracking/:trackingId/edit" element={<ShippingTrackingForm />} />
                <Route path="shipping/reports" element={<ShippingReportsForm />} />

                {/* Finance */}
                <Route path="finance" element={<FinanceDashboard />} />
                <Route path="finance/dashboard" element={<FinanceDashboard />} />
                <Route path="finance/accounting" element={<AccountingManagement />} />
                <Route path="finance/budget" element={<BudgetPlanning />} />
                <Route path="accounting/bank-reconciliation" element={<BankReconciliation />} />
                <Route path="finance/cash-flow" element={<CashFlowManagement />} />
                <Route path="finance/invoices" element={<InvoiceList />} />
                <Route path="finance/invoices/new" element={<SalesInvoiceFormNew />} />
                <Route path="finance/invoices/:id" element={<FinanceInvoiceForm />} />
                <Route path="finance/invoices/:id/edit" element={<FinanceInvoiceForm />} />
                <Route path="finance/payments/:id" element={<PaymentDetail />} />
                <Route path="finance/cash-bank" element={<CashBankManagement />} />
                <Route path="finance/costing" element={<CostingControlling />} />
                <Route path="finance/consolidation" element={<Consolidation />} />
                <Route path="finance/payments/new" element={<PaymentForm />} />
                <Route path="finance/rekap-uang-muka" element={<AdvanceRecap />} />
                <Route path="finance/penerimaan" element={<PaymentList key="kas_in" type="receipt" source="kas" />} />
                <Route path="finance/pembayaran" element={<PaymentList key="kas_out" type="payment" source="kas" />} />
                <Route path="production/rolls" element={<RollList />} />
                <Route path="finance/bank-transfers" element={<BankTransferList />} />
                <Route path="finance/bank-transfers/new" element={<BankTransferForm />} />
                <Route path="finance/penerimaan-penjualan" element={<PaymentList key="ar" type="receipt" source="invoice" />} />
                <Route path="finance/pembayaran-pembelian" element={<PaymentList key="ap" type="payment" source="invoice" />} />
                <Route path="finance/penerimaan/new" element={<PaymentForm key="kas_in" kind="kas_in" />} />
                <Route path="finance/pembayaran/new" element={<PaymentForm key="kas_out" kind="kas_out" />} />
                <Route path="finance/penerimaan-penjualan/new" element={<PaymentForm key="ar" kind="ar" />} />
                <Route path="finance/pembayaran-pembelian/new" element={<PaymentForm key="ap" kind="ap" />} />
                {/* Employee Expense Claims */}
                <Route path="finance/expenses" element={<ClaimsHub />} />
                <Route path="finance/expenses/new" element={<EmployeeExpenseForm />} />
                <Route path="finance/expenses/:id/edit" element={<EmployeeExpenseForm />} />
                <Route path="finance/expenses/:id" element={<ExpenseDetail />} />
                {/* Reimbursements */}
                <Route path="finance/reimbursements" element={<ClaimsHub />} />
                <Route path="finance/reimbursements/new" element={<ReimbursementForm />} />
                <Route path="finance/reimbursements/:id" element={<ReimbursementDetail />} />
                {/* Company Expenses (Supplier-based) */}

                {/* Accounting - Separated module for accountants */}
                <Route path="accounting" element={<AccountingManagement />} />
                <Route path="accounting/chart-of-accounts" element={<ChartOfAccounts />} />
                <Route path="accounting/period-close" element={<PeriodClose />} />
                <Route path="finance/recurring-payments" element={<RecurringPayment />} />
                <Route path="finance/recurring-payments/:masterId/transactions/:txId" element={<RecurringPaymentTransactionDetail />} />
                <Route path="finance/recurring-payment-transactions/:txId" element={<RecurringPaymentTransactionRedirect />} />
                <Route path="accounting/general-ledger" element={<GeneralLedger />} />
                <Route path="accounting/journal" element={<JournalEntryPage />} />
                <Route path="accounting/receivable" element={<AccountsReceivable />} />
                <Route path="accounting/payable" element={<AccountsPayable />} />
                <Route path="accounting/tax" element={<TaxManagement />} />
                <Route path="accounting/reports" element={<FinancialReports />} />
                <Route path="finance/sales-report" element={<SalesReport />} />
                <Route path="finance/aging" element={<AgingReport />} />
                <Route path="finance/search" element={<FinanceSearch />} />
                <Route path="finance/reports" element={<ReportsHub />} />
                <Route path="finance/reports/trial-balance" element={<TrialBalance />} />
                <Route path="finance/reports/inventory-mutation" element={<InventoryMutation />} />
                <Route path="finance/reports/inventory-by-warehouse" element={<InventoryByWarehouse />} />
                <Route path="finance/reports/stock-vs-ledger" element={<StockVsLedger />} />
                <Route path="finance/reports/near-expiry" element={<NearExpiry />} />
                <Route path="finance/reports/bank-mutation" element={<AccountLedger mode="bank" />} />
                <Route path="finance/reports/ledger/:accountId" element={<AccountLedger mode="ledger" />} />
                <Route path="finance/reports/cash-daily" element={<CashDaily />} />
                <Route path="finance/reports/cash-daily/:date" element={<CashDailyDetail />} />
                <Route path="finance/reports/cash-position" element={<CashPosition />} />
                <Route path="finance/reports/customer-statements" element={<PartyStatements kind="customer" />} />
                <Route path="finance/reports/supplier-statements" element={<PartyStatements kind="supplier" />} />
                <Route path="finance/reports/statement/:type/:id" element={<PartyStatementDetail />} />
                <Route path="finance/reports/purchase" element={<PurchaseReport />} />
                <Route path="finance/reports/vat" element={<VatReport />} />
                <Route path="finance/reports/vat/:month" element={<VatDetail />} />
                <Route path="finance/reports/equity" element={<EquityChanges />} />
                <Route path="finance/credit-memos" element={<CreditMemoList />} />

                {/* Approval Workflow */}
                <Route path="approval" element={<ApprovalDashboard />} />
                <Route path="approval/:id" element={<ApprovalDetail />} />

                {/* WIP Accounting */}
                <Route path="finance/wip-ledger" element={<WIPLedger />} />
                <Route path="finance/wip-ledger/:id" element={<WIPLedgerDetail />} />

                {/* Documents */}
                <Route path="documents" element={<DocumentDashboard />} />
                <Route path="documents/generate" element={<DocumentGenerator />} />
                <Route path="documents/templates" element={<TemplateList />} />
                <Route path="documents/templates/:templateId/versions/:versionId/edit" element={<TemplateVersionEditor />} />

                {/* HR */}
                <Route path="hr" element={<HRDashboard />} />
                <Route path="hr/dashboard" element={<HRDashboard />} />
                <Route path="hr/petty-cash" element={<PettyCash />} />
                <Route path="hr/fingerprint-mapping" element={<FingerprintMapping />} />
                <Route path="hr/fingerprint-attendance" element={<FingerprintAttendance />} />
                <Route path="hr/attendance-schedules" element={<AttendanceSchedules />} />
                <Route path="hr/employees" element={<EmployeeList />} />
                <Route path="hr/employees/new" element={<EmployeeForm />} />
                <Route path="hr/employees/:id" element={<EmployeeForm />} />
                <Route path="hr/employees/:id/edit" element={<EmployeeForm />} />
                <Route path="hr/departments" element={<Departments />} />
                <Route path="hr/positions" element={<PositionManagement />} />
                <Route path="hr/reports" element={<HRReports />} />
                <Route path="hr/attendance" element={<AttendanceManagement />} />
                <Route path="hr/attendance-admin" element={<AttendanceAdmin />} />
                <Route path="hr/attendance-reconciliation" element={<AttendanceReconciliation />} />
                <Route path="hr/work-schedules" element={<WorkScheduleManagement />} />
                <Route path="hr/face-admin" element={<FaceAdmin />} />
                <Route path="hr/attendance-report" element={<AttendanceReport />} />
                <Route path="hr/attendance-calendar" element={<AttendanceCalendar />} />
                <Route path="hr/attendance-not-clocked-out" element={<AttendanceNotClockedOut />} />
                <Route path="hr/staff-leave" element={<StaffLeaveManagement />} />
                <Route path="hr/absensi" element={<AttendancePage />} />
                <Route path="hr/leaves" element={<LeaveManagement />} />
                <Route path="hr/leaves/new" element={<LeaveRequestForm />} />
                <Route path="hr/attendance/new" element={<AttendanceForm />} />
                <Route path="hr/attendance/:id/edit" element={<AttendanceForm />} />
                <Route path="hr/leaves/request/new" element={<LeaveForm />} />
                <Route path="hr/leaves/:id/edit" element={<LeaveForm />} />
                <Route path="hr/payroll" element={<PayrollList />} />
                <Route path="hr/payroll/new" element={<PayrollForm />} />
                <Route path="hr/payroll/:id/edit" element={<PayrollForm />} />
                <Route path="hr/payroll/periods/new" element={<PayrollPeriodForm />} />
                <Route path="hr/payroll/periods/:periodId/records" element={<PayrollRecordList />} />
                <Route path="hr/payroll/outsourcing-vendors" element={<OutsourcingVendorList />} />
                <Route path="hr/payroll/piecework-logs" element={<PieceworkLogList />} />
                <Route path="hr/appraisal" element={<AppraisalList />} />
                <Route path="hr/appraisal/cycles/new" element={<AppraisalCycleForm />} />
                <Route path="hr/training" element={<TrainingManagement />} />
                <Route path="hr/roster/integrated" element={<RosterManagementComplete key="integrated" />} />
                <Route path="hr/roster/manage" element={<RosterManagementComplete key="manage" />} />
                <Route path="hr/roster/calendar" element={<RosterCalendar />} />
                <Route path="hr/roster/daily" element={<WorkRosterComplete />} />
                <Route path="hr/roster" element={<WorkRosterWeekly />} />

                {/* Asset Management */}
                <Route path="assets" element={<AssetDashboard />} />
                <Route path="assets/dashboard" element={<AssetDashboard />} />
                <Route path="assets/list" element={<AssetList />} />
                <Route path="assets/new" element={<AssetForm />} />
                <Route path="assets/functional-locations" element={<FunctionalLocations />} />
                <Route path="assets/:id" element={<AssetDetail />} />
                <Route path="assets/:id/edit" element={<AssetForm />} />
                <Route path="assets/spare-parts" element={<SparePartsList />} />
                <Route path="assets/depreciation" element={<DepreciationReport />} />

                {/* WMS Advanced */}
                <Route path="wms" element={<WMSDashboard />} />
                <Route path="wms/dashboard" element={<WMSDashboard />} />
                <Route path="wms/stock-by-wo" element={<StockByWorkOrder />} />
                <Route path="wms/stock-by-wo/:woId" element={<StockByWODetail />} />
                <Route path="wms/material-consumption" element={<MaterialConsumptionPage />} />
                <Route path="wms/transactions" element={<TransactionsPage />} />
                <Route path="wms/transactions/:txnId" element={<TransactionDetail />} />
                <Route path="wms/pick-lists" element={<PickListPage />} />
                <Route path="wms/transfers" element={<TransferOrderPage />} />
                <Route path="wms/cycle-counts" element={<CycleCountPage />} />
                <Route path="wms/batch-traceability" element={<BatchTraceability />} />

                {/* Maintenance */}
                <Route path="maintenance" element={<MaintenanceDashboardEnhanced />} />
                <Route path="maintenance/dashboard" element={<MaintenanceDashboardEnhanced />} />
                <Route path="maintenance/records" element={<MaintenanceList />} />
                <Route path="maintenance/schedules" element={<MaintenanceSchedule />} />
                <Route path="maintenance/new" element={<MaintenanceForm />} />
                <Route path="maintenance/request/new" element={<MaintenanceRequestForm />} />
                <Route path="maintenance/request/:id/edit" element={<MaintenanceRequestForm />} />
                <Route path="maintenance/work-orders/new" element={<Navigate to="/app/maintenance/new" replace />} />
                <Route path="maintenance/work-orders/:id/edit" element={<Navigate to="/app/maintenance/records" replace />} />
                <Route path="maintenance/parts-requests/new" element={<MaintenancePartsForm />} />
                <Route path="maintenance/parts-requests/:id/edit" element={<Navigate to="/app/maintenance/spare-part-requests" replace />} />
                <Route path="maintenance/spare-part-requests" element={<SparePartRequests />} />
                <Route path="maintenance/machine-parts" element={<MachineParts />} />
                <Route path="maintenance/analytics" element={<MaintenanceAnalyticsForm />} />
                <Route path="maintenance/spare-parts" element={<SparePartStock />} />
                <Route path="maintenance/spare-parts/:id" element={<SparePartDetail />} />
                <Route path="maintenance/:id" element={<MaintenanceForm />} />
                <Route path="maintenance/:id/edit" element={<MaintenanceForm />} />
                <Route path="maintenance/checklist-ng" element={<ChecklistNGItems />} />

                {/* DCC - Document Control Center */}
                <Route path="dcc" element={<DocumentControlCenter />} />


                {/* RND (New R&D Module) */}
                <Route path="rnd" element={<RNDDashboard />} />
                <Route path="rnd/dashboard" element={<RNDDashboard />} />
                <Route path="rnd/projects" element={<RNDProjectList />} />
                <Route path="rnd/projects/new" element={<RNDProjectForm />} />
                <Route path="rnd/projects/:id" element={<RNDProjectDetail />} />
                <Route path="rnd/projects/:id/edit" element={<RNDProjectForm />} />
                <Route path="rnd/approvals" element={<RNDApprovals />} />

                {/* Waste */}
                <Route path="waste" element={<WasteRecordList />} />
                <Route path="waste/new" element={<WasteRecordForm />} />
                <Route path="waste/:id/edit" element={<WasteRecordForm />} />

                {/* Returns */}
                <Route path="returns" element={<ReturnsDashboard />} />
                <Route path="returns/new" element={<CreateReturnForm />} />
                <Route path="returns/:id" element={<ReturnDetails />} />

                {/* OEE */}
                <Route path="oee" element={<OEEDashboardEnhanced />} />
                <Route path="ews" element={<EWSDashboard />} />
                <Route path="oee/monitoring" element={<OEEDashboardEnhanced />} />
                <Route path="oee/dashboard" element={<OEEDashboardEnhanced />} />
                <Route path="oee/records" element={<OEEDashboardEnhanced />} />
                <Route path="oee/records/new" element={<OEERecordForm />} />
                <Route path="oee/records/:id" element={<OEERecordForm />} />
                <Route path="oee/records/:id/edit" element={<OEERecordForm />} />
                <Route path="oee/downtime" element={<OEEDashboardEnhanced />} />
                <Route path="oee/machines/:machineId/analytics" element={<MachineAnalytics />} />
                <Route path="oee/legacy" element={<OEEDashboard />} />

                {/* Production Input */}
                <Route path="production/input" element={<ProductionInput />} />
                <Route path="production/downtime" element={<DowntimeInput />} />

                {/* WIP & Job Costing */}
                <Route path="production/wip" element={<WIPDashboard />} />
                <Route path="production/wip-batches" element={<WIPBatchList />} />
                <Route path="production/wip-batches/new" element={<WIPBatchForm />} />
                <Route path="production/wip-batches/:id" element={<WIPBatchList />} />
                <Route path="production/job-costs" element={<WIPBatchList />} />

                {/* Packing List (New - Separate from WO) */}
                <Route path="production/wip-stock" element={<WIPStock />} />

                {/* Production Approval */}
                <Route path="production/approvals" element={<ProductionApprovalList />} />
                <Route path="production/approvals/:id" element={<ProductionApprovalDetail />} />

                {/* Product Changeover */}
                <Route path="production/changeovers" element={<ChangeoverList />} />
                <Route path="production/work-orders/:woId/changeover" element={<ProductChangeover />} />

                {/* TV Display */}
                <Route path="tv-display" element={<TVDisplaySelector />} />

                {/* Notifications */}
                <Route path="notifications" element={<NotificationsPage />} />

                {/* Settings - Admin Only */}
                <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
                <Route path="settings/system-config" element={<AdminRoute><AdvancedSystemConfig /></AdminRoute>} />
                <Route path="settings/user-roles" element={<AdminRoute><UserRoleManagement /></AdminRoute>} />
                <Route path="settings/audit-trail" element={<AdminRoute><AuditTrail /></AdminRoute>} />
                <Route path="settings/backup-restore" element={<AdminRoute><BackupRestore /></AdminRoute>} />
                <Route path="settings/email" element={<AdminRoute><EmailSettings /></AdminRoute>} />
                <Route path="settings/kpi-targets" element={<AdminRoute><KPITargetSettings /></AdminRoute>} />
                <Route path="settings/account-preferences" element={<StaffAdminRoute><AccountPreferences /></StaffAdminRoute>} />
                <Route path="settings/system-health" element={<AdminRoute><SystemHealth /></AdminRoute>} />
                <Route path="settings/netto-deductions" element={<AdminRoute><NettoDeductionRulesManager /></AdminRoute>} />
                <Route path="settings/factory-layout" element={<AdminRoute><FactoryLayoutAdmin /></AdminRoute>} />
                {/* Not AdminRoute-gated: same access level as the old /production/batch-scheduling
                    page it was split off from (Recipe/Kalender Global/Exception tabs moved here
                    2026-08-24) - gating it would lock out PPIC/production staff who aren't Admin. */}
                <Route path="settings/batch-scheduling" element={<BatchSchedulingSettings />} />

                {/* Profile */}
                <Route path="profile" element={<UserProfile />} />
                <Route path="profile/:userId" element={<UserProfile />} />

                {/* User Manual */}
                <Route path="manual" element={<UserManual />} />
                <Route path="manual/faq" element={<FAQPage />} />
                <Route path="manual/article" element={<UserManual />} />
                <Route path="manual/article/:articleSlug" element={<UserManual />} />
                <Route path="manual/category/:categorySlug" element={<UserManual />} />
                <Route path="manual/admin" element={<AdminRoute><ManualAdmin /></AdminRoute>} />

                {/* Group Chat */}

                {/* Integration - Admin Only */}
                <Route path="integration/accurate" element={<StaffAdminRoute><AccurateIntegration /></StaffAdminRoute>} />
                <Route path="reports" element={<Reports />} />
                <Route path="imports" element={<ImportCenter />} />
                <Route path="reports/advanced-builder" element={<AdvancedReportBuilder />} />
                {/* Halaman "Scheduled Reports" yang lama memanggil
                    /api/reports/scheduled yang tidak pernah ada, jadi semua
                    tombolnya 404. Penjadwalan yang hidup ada di
                    /reports/scheduler (2026-11-22). */}
                <Route path="reports/scheduled" element={<Navigate to="/app/reports/scheduler" replace />} />
                <Route path="reports/executive" element={<ExecutiveDashboard />} />
                <Route path="reports/generate/:reportId" element={<ReportGenerator />} />
                <Route path="reports/custom" element={<CustomReportBuilder />} />
                <Route path="reports/scheduler" element={<ReportScheduler />} />
                <Route path="reports/production-by-product" element={<ProductionByProductReport />} />
                <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  )
}
registerAppRoutes(AppChildRoutes)

function App() {
  const dispatch = useAppDispatch()
  const { isAuthenticated, loading } = useAppSelector((state: { auth: { isAuthenticated: boolean; loading: boolean } }) => state.auth)
  const location = useLocation()
  
  // Check if current route is public (no session timeout needed)
  const isPublicRoute = location.pathname.startsWith('/public/') || 
                        location.pathname === '/' || 
                        location.pathname === '/login' ||
                        location.pathname === '/register' ||
                        location.pathname === '/forgot-password' ||
                        location.pathname === '/reset-password' ||
                        location.pathname === '/absensi' ||
                        location.pathname.startsWith('/approval-email/')

  // Update document title dynamically based on company settings
  useDocumentTitle()

  useEffect(() => {
    // Check auth if token exists in localStorage
    const token = localStorage.getItem('token')
    if (token) {
      dispatch(checkAuth())
    }
  }, [dispatch])

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900">
        <div className="text-center">
          <div className="relative h-16 w-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-[3px] border-white/10" />
            <div
              className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary-500 border-r-primary-300 animate-spin"
              style={{ animationDuration: '0.9s' }}
            />
            <div
              className="absolute inset-[6px] rounded-full border-[3px] border-transparent border-b-[rgb(var(--spinner-inner-dark))] animate-spin [animation-direction:reverse]"
              style={{ animationDuration: '1.4s' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-primary-600 to-primary-700 animate-pulse" />
            </div>
          </div>
          <p className="text-emerald-100 text-sm font-medium">Verifying session...</p>
        </div>
      </div>
    )
  }
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <PermissionProvider>
            <ToastProvider />
            <ConfirmDialogProvider />
            {!isPublicRoute && <SessionTimeoutModal />}
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* System Overview for non-authenticated users */}
              <Route path="/" element={!isAuthenticated ? <Landing /> : <RoleBasedRedirect />} />
              <Route path="/approval-email/:token" element={<ApprovalEmail />} />
              <Route path="/absensi" element={<PublicAttendance />} />
              <Route path="/public/attendance" element={<PublicAttendance />} />
              <Route path="/public/leave-request" element={<StaffLeaveRequest />} />
              <Route path="/public/face-registration" element={<FaceRegistration />} />
              {/* Public Production Monitoring - No login required */}
              <Route path="/public/production-monitoring" element={<ProductionMonitoringDashboard />} />
              <Route path="/public/factory-layout" element={<FactoryLayoutDashboard />} />
              <Route path="/login" element={!isAuthenticated ? <Login /> : <RoleBasedRedirect />} />
              <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPassword /> : <RoleBasedRedirect />} />
              <Route path="/reset-password" element={!isAuthenticated ? <ResetPassword /> : <RoleBasedRedirect />} />
              <Route path="/register" element={!isAuthenticated ? <Register /> : <RoleBasedRedirect />} />
              <Route path="/oauth/callback" element={<OAuthCallback />} />
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/verify/:token" element={<DocumentVerifyPage />} />

              {/* Global Search Route */}
              <Route path="/app/search" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
                <Route index element={<GlobalSearchPage />} />
              </Route>

              {/* Redirect old /workspace/:module requests to dashboard */}
              <Route path="/workspace/:module" element={<Navigate to="/app" replace />} />

              {/* Redirect specific old URLs to correct app structure */}
              <Route path="/sales/opportunities" element={<Navigate to="/app/sales/opportunities" replace />} />
              <Route path="/sales/opportunities/new" element={<Navigate to="/app/sales/opportunities/new" replace />} />
              <Route path="/sales/opportunities/:id/edit" element={<Navigate to="/app/sales/opportunities" replace />} />
              <Route path="/sales/leads" element={<Navigate to="/app/sales/leads" replace />} />
              <Route path="/sales/leads/new" element={<Navigate to="/app/sales/leads/new" replace />} />
              <Route path="/sales/leads/:id/edit" element={<Navigate to="/app/sales/leads" replace />} />
              <Route path="/sales/quotations" element={<Navigate to="/app/sales/quotations" replace />} />
              <Route path="/sales/quotations/new" element={<Navigate to="/app/sales/quotations/new" replace />} />
              <Route path="/sales/quotations/:id/edit" element={<Navigate to="/app/sales/quotations" replace />} />
              <Route path="/sales/activities" element={<Navigate to="/app/sales/activities" replace />} />
              <Route path="/sales/activities/new" element={<Navigate to="/app/sales/activities/new" replace />} />
              <Route path="/sales/customers" element={<Navigate to="/app/sales/customers" replace />} />
              <Route path="/sales/customers/new" element={<Navigate to="/app/sales/customers/new" replace />} />
              <Route path="/sales/customers/:id/edit" element={<Navigate to="/app/sales/customers" replace />} />
              <Route path="/sales/orders" element={<Navigate to="/app/sales/orders" replace />} />
              <Route path="/sales/orders/new" element={<Navigate to="/app/sales/orders/new" replace />} />
              <Route path="/sales/orders/:id/edit" element={<Navigate to="/app/sales/orders" replace />} />
              <Route path="/production/machines" element={<Navigate to="/app/production/machines" replace />} />
              <Route path="/production/work-orders" element={<Navigate to="/app/production/work-orders" replace />} />
              <Route path="/production/work-orders/new" element={<Navigate to="/app/production/work-orders/new" replace />} />
              <Route path="/production/work-orders/:id/edit" element={<Navigate to="/app/production/work-orders" replace />} />

              <Route path="/tv/production" element={<TVDisplayProduction />} />
              <Route path="/tv/shipping" element={<TVDisplayShipping />} />
              <Route path="/tv/roster" element={<TVDisplayRoster />} />
              <Route path="/tv/overview" element={<TVDisplayOverview />} />

              {/* Redirect old product routes to app routes */}
              <Route path="/products" element={<Navigate to="/app/products" replace />} />
              <Route path="/products/new" element={<Navigate to="/app/products/new" replace />} />
              <Route path="/products/:id/edit" element={<Navigate to="/app/products" replace />} />

              {/* Redirect old warehouse routes to app routes */}
              <Route path="/warehouse/inventory" element={<Navigate to="/app/warehouse/inventory" replace />} />
              <Route path="/warehouse/stock-summary" element={<Navigate to="/app/warehouse/stock-summary" replace />} />
              <Route path="/warehouse/locations" element={<Navigate to="/app/warehouse/locations" replace />} />
              <Route path="/warehouse/locations/new" element={<Navigate to="/app/warehouse/locations/new" replace />} />
              <Route path="/warehouse/zones" element={<Navigate to="/app/warehouse/zones" replace />} />
              <Route path="/warehouse/zones/:id" element={<WarehouseZoneRedirect />} />
              <Route path="/warehouse/zones/:id/locations" element={<WarehouseZoneLocationsRedirect />} />
              <Route path="/warehouse/zones/new" element={<Navigate to="/app/warehouse/zones/new" replace />} />
              <Route path="/warehouse/alerts" element={<Navigate to="/app/warehouse/alerts" replace />} />
              <Route path="/warehouse/movements" element={<Navigate to="/app/warehouse/movements" replace />} />
              <Route path="/warehouse/movements/new" element={<Navigate to="/app/warehouse/movements/new" replace />} />
              <Route path="/warehouse/reports" element={<Navigate to="/app/warehouse/reports" replace />} />

              {/* Redirect old purchasing routes to app routes */}
              <Route path="/purchasing/suppliers" element={<Navigate to="/app/purchasing/suppliers" replace />} />
              <Route path="/purchasing/suppliers/new" element={<Navigate to="/app/purchasing/suppliers/new" replace />} />
              <Route path="/purchasing/suppliers/:id/edit" element={<Navigate to="/app/purchasing/suppliers" replace />} />
              <Route path="/purchasing/purchase-orders" element={<Navigate to="/app/purchasing/purchase-orders" replace />} />
              <Route path="/purchasing/purchase-orders/new" element={<Navigate to="/app/purchasing/purchase-orders/new" replace />} />
              <Route path="/purchasing/purchase-orders/:id/edit" element={<Navigate to="/app/purchasing/purchase-orders" replace />} />

              {/* Redirect old quality routes to app routes */}
              <Route path="/quality/tests/new" element={<Navigate to="/app/quality/tests/new" replace />} />
              <Route path="/quality/tests/:id/edit" element={<Navigate to="/app/quality/tests" replace />} />
              <Route path="/quality/tests" element={<Navigate to="/app/quality/tests" replace />} />

              {/* Redirect old maintenance routes to app routes */}
              <Route path="/maintenance/new" element={<Navigate to="/app/maintenance/new" replace />} />
              <Route path="/maintenance/:id/edit" element={<Navigate to="/app/maintenance" replace />} />
              <Route path="/maintenance" element={<Navigate to="/app/maintenance" replace />} />

              {/* Redirect old returns routes to app routes */}
              <Route path="/returns" element={<Navigate to="/app/returns" replace />} />
              <Route path="/returns/new" element={<Navigate to="/app/returns/new" replace />} />
              <Route path="/returns/:id" element={<Navigate to="/app/returns" replace />} />

              {/* Redirect old converting routes to app routes */}
              <Route path="/production/converting" element={<Navigate to="/app/production/converting" replace />} />
              <Route path="/production/converting/input" element={<Navigate to="/app/production/converting/input" replace />} />

              {/* Redirect old MBF report routes to app routes */}
              <Route path="/production/mbf-report" element={<Navigate to="/app/production/mbf-report" replace />} />
              <Route path="/production/mbf-report/:id" element={<Navigate to="/app/production/mbf-report" replace />} />

              {/* Bypass auth for specific debug route */}
              <Route path="/app/debug/roster" element={
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                  <div className="p-6">
                    <h1 className="text-2xl font-bold text-purple-600 dark:text-purple-400">🔧 DEBUG ROSTER (Bypass Auth)</h1>
                    <p className="mt-2">This route completely bypasses authentication.</p>
                    <div className="mt-4 p-4 bg-purple-100 border border-purple-400 rounded dark:bg-purple-900/30">
                      <p className="text-purple-800 dark:text-purple-300">Authentication Status: {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}</p>
                      <p className="text-purple-800 dark:text-purple-300">Token: {localStorage.getItem('token') ? '✅ Present' : '❌ Missing'}</p>
                      <button
                        onClick={() => window.location.href = '/app/hr/roster/integrated'}
                        className="mt-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                      >
                        Try Normal Route
                      </button>
                    </div>
                  </div>
                </div>
              } />

              <Route path="/app" element={isAuthenticated ? <Layout /> : <Navigate to="/" />}>
                <Route index element={<DashboardModules />} />
                <Route path="*" element={<AppChildRoutes />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </PermissionProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  )
}

export default App
