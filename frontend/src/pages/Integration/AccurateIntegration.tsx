import React, { useState, useRef } from 'react'
import {
  useGetAccurateConfigQuery,
  useUpdateAccurateConfigMutation,
  useGetAccurateItemsQuery,
  useGetAccurateMappingsQuery,
  useGetAccurateSalesInvoicesQuery,
  useGetAccurateSalesOrdersQuery,
  useGetAccurateCustomersQuery,
  useGetAccuratePurchaseInvoicesQuery,
  useGetAccuratePurchaseOrdersQuery,
  useGetAccurateVendorsQuery,
  useGetAccurateBankTransfersQuery,
  useGetAccurateExpensesQuery,
  useGetAccurateGlAccountsQuery,
  useGetAccurateJournalVouchersQuery,
  useGetAccurateBillsOfMaterialQuery,
  useGetAccurateItemDetailQuery,
  useGetAccurateVendorDetailQuery,
  useGetAccurateCustomerDetailQuery,
  useGetAccurateGlAccountDetailQuery,
  useGetAccurateSalesInvoiceDetailQuery,
  useGetAccurateSalesOrderDetailQuery,
  useGetAccuratePurchaseInvoiceDetailQuery,
  useGetAccuratePurchaseOrderDetailQuery,
  useGetAccurateBankTransferDetailQuery,
  useGetAccurateJournalVoucherDetailQuery,
  useGetAccurateBillOfMaterialDetailQuery,
  useSaveAccurateMappingMutation,
  useRunAccurateDryRunMutation,
  useGetAccurateSyncLogsQuery,
  useApproveAccurateSyncLogMutation,
  useRejectAccurateSyncLogMutation,
  useGetMRPMaterialsQuery,
  useGetProductsQuery,
  useCheckAccurateEjoMutation,
  useScanAccurateBomItemIndexMutation,
  useGetAccurateWorkOrderCacheQuery,
  useGetSmithWorkOrdersByProductQuery,
  useEjoManualMatchMutation,
  useGetWarehouseStockSummaryQuery,
  useGetWarehouseStockDetailQuery,
  useGetWarehouseUnmatchedSuggestionsQuery,
  useGetWarehouseSnapshotSummaryQuery,
  useGetWarehouseSnapshotDetailQuery,
  useSyncWarehouseStockFullMutation,
  useSyncEjoWarehouseStockMutation,
  useScanAccurateWorkOrderCacheMutation,
} from '../../services/api'
import {
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  ShieldCheckIcon,
  ServerIcon,
  CheckIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

export default function AccurateIntegration() {
  const [activeTab, setActiveTab] = useState<'config' | 'mapping' | 'dryrun' | 'approval' | 'modules' | 'ejo' | 'warehouse'>('config')
  const [ejoNumber, setEjoNumber] = useState('')
  const [ejoResult, setEjoResult] = useState<any>(null)
  const [ejoModalAccurateId, setEjoModalAccurateId] = useState<number | null>(null)
  const [checkEjo, { isLoading: isCheckingEjo }] = useCheckAccurateEjoMutation()
  const [scanBomIndex, { isLoading: isScanningIndex }] = useScanAccurateBomItemIndexMutation()

  const handleCheckEjo = async () => {
    if (!ejoNumber.trim()) return
    const mySeq = ++ejoRequestSeq.current
    setEjoModalOpen(true)
    setEjoResult(null)
    setEjoModalAccurateId(null)
    try {
      const res = await checkEjo({ ejo_number: ejoNumber.trim() }).unwrap()
      if (mySeq !== ejoRequestSeq.current) return
      setEjoResult(res.data)
      setEjoModalAccurateId(res.data?.summary?.accurate_id ?? null)
    } catch (err: any) {
      if (mySeq !== ejoRequestSeq.current) return
      setEjoResult({ found: false, message: err?.data?.message || 'Gagal mengambil data dari Accurate.' })
    }
  }

  const handleScanBomIndex = async () => {
    try {
      const res = await scanBomIndex().unwrap()
      alert(`Index BOM berhasil disegarkan: ${res.data.indexed_count} item ter-index.`)
    } catch (err: any) {
      alert(err?.data?.message || 'Gagal menyegarkan index BOM.')
    }
  }

  const { data: woCacheResp, isFetching: fetchingWoCache, refetch: refetchWoCache } = useGetAccurateWorkOrderCacheQuery()
  const [scanWoCache, { isLoading: isScanningWoCache }] = useScanAccurateWorkOrderCacheMutation()
  const [ejoListSearch, setEjoListSearch] = useState('')

  const handleScanWoCache = async () => {
    try {
      const res = await scanWoCache().unwrap()
      alert(`Daftar EJO berhasil disegarkan: ${res.data.cached_count} Perintah Kerja ter-cache. Proses ini butuh beberapa menit.`)
      refetchWoCache()
    } catch (err: any) {
      alert(err?.data?.message || 'Gagal menyegarkan daftar EJO.')
    }
  }

  const [ejoModalOpen, setEjoModalOpen] = useState(false)
  const ejoRequestSeq = useRef(0)
  const [selectedCandidateProductId, setSelectedCandidateProductId] = useState<number | null>(null)
  const { data: candidateWoResp, isFetching: fetchingCandidateWo } = useGetSmithWorkOrdersByProductQuery(
    { product_id: selectedCandidateProductId ?? 0, reference_date: ejoResult?.summary?.final_date },
    { skip: !selectedCandidateProductId }
  )

  const [ejoManualMatch, { isLoading: isManualMatching }] = useEjoManualMatchMutation()

  const { data: warehouseStockResp, isFetching: fetchingWarehouseStock, refetch: refetchWarehouseStock } = useGetWarehouseStockSummaryQuery()
  const [syncWarehouseStock, { isLoading: isSyncingWarehouseStock }] = useSyncEjoWarehouseStockMutation()

  const handleSyncWarehouseStock = async () => {
    try {
      const res = await syncWarehouseStock().unwrap()
      alert(`Sinkronisasi selesai: ${res.data.synced} tahap tersinkron, ${res.data.skipped_already_synced} sudah pernah disync sebelumnya, ${res.data.skipped_no_match} produk tidak cocok.`)
      refetchWarehouseStock()
    } catch (err: any) {
      alert(err?.data?.message || 'Gagal menyinkronkan stok gudang.')
    }
  }

  const [stockDetailQuery, setStockDetailQuery] = useState<{ product_id: number; location: 'epd' | 'fg'; product_name: string } | null>(null)
  const { data: stockDetailResp, isFetching: fetchingStockDetail } = useGetWarehouseStockDetailQuery(
    stockDetailQuery ? { product_id: stockDetailQuery.product_id, location: stockDetailQuery.location } : { product_id: 0, location: 'fg' },
    { skip: !stockDetailQuery }
  )

  const [unmatchedItemQuery, setUnmatchedItemQuery] = useState<string | null>(null)
  const { data: unmatchedSuggestionsResp, isFetching: fetchingUnmatchedSuggestions } = useGetWarehouseUnmatchedSuggestionsQuery(
    { item_name: unmatchedItemQuery ?? '' },
    { skip: !unmatchedItemQuery }
  )

  const { data: snapshotSummaryResp, isFetching: fetchingSnapshotSummary, refetch: refetchSnapshotSummary } = useGetWarehouseSnapshotSummaryQuery()
  const [syncSnapshotFull, { isLoading: isSyncingSnapshotFull }] = useSyncWarehouseStockFullMutation()
  const [snapshotDetailQuery, setSnapshotDetailQuery] = useState<{ ref_id: number; kind: 'product' | 'material'; location: 'pm' | 'epd' | 'fg'; product_name: string } | null>(null)
  const { data: snapshotDetailResp, isFetching: fetchingSnapshotDetail } = useGetWarehouseSnapshotDetailQuery(
    snapshotDetailQuery ? { ref_id: snapshotDetailQuery.ref_id, kind: snapshotDetailQuery.kind, location: snapshotDetailQuery.location } : { ref_id: 0, kind: 'product', location: 'fg' },
    { skip: !snapshotDetailQuery }
  )

  const handleSyncSnapshotFull = async () => {
    try {
      const res = await syncSnapshotFull().unwrap()
      alert(`Sinkronisasi selesai: ${res.data.synced} entri gudang tersinkron dari ${res.data.scanned} item Accurate (${res.data.skipped_no_match} tidak cocok). Proses ini butuh 5-10 menit.`)
      refetchSnapshotSummary()
    } catch (err: any) {
      alert(err?.data?.message || 'Gagal menyinkronkan snapshot stok gudang.')
    }
  }

  const handlePickManualSmithWo = async (wo: any) => {
    if (!ejoResult?.summary || !ejoModalAccurateId) return
    try {
      const res = await ejoManualMatch({ accurate_id: ejoModalAccurateId, smith_work_order_id: wo.id }).unwrap()
      setEjoResult((prev: any) => ({
        ...prev,
        smith_match: res.data.smith_match,
        diff: res.data.diff,
        diff_message: undefined,
      }))
      setSelectedCandidateProductId(null)
    } catch (err: any) {
      alert(err?.data?.message || 'Gagal menghitung perbandingan dengan WO yang dipilih.')
    }
  }

  const handleSelectEjoFromList = (number: string, accurateId: number) => {
    const mySeq = ++ejoRequestSeq.current
    setEjoModalOpen(true)
    setEjoResult(null)
    setEjoModalAccurateId(accurateId)
    checkEjo({ ejo_number: number, accurate_id: accurateId }).unwrap().then((res) => {
      if (mySeq !== ejoRequestSeq.current) return // request usang, ada klik lain setelahnya - abaikan
      setEjoResult(res.data)
    }).catch((err) => {
      if (mySeq !== ejoRequestSeq.current) return
      setEjoResult({ found: false, message: err?.data?.message || 'Gagal mengambil data dari Accurate.' })
    })
  }

  const filteredEjoList = (woCacheResp?.data || []).filter((w: any) =>
    !ejoListSearch.trim() ||
    w.number?.toLowerCase().includes(ejoListSearch.toLowerCase()) ||
    w.item_name?.toLowerCase().includes(ejoListSearch.toLowerCase())
  )

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'true') {
      alert('Berhasil terhubung ke Accurate Online via OAuth!')
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (params.get('oauth_error')) {
      alert('OAuth Error: ' + params.get('oauth_error'))
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const { data: configResp, isLoading: configLoading } = useGetAccurateConfigQuery()
  const [updateConfig, { isLoading: isUpdatingConfig }] = useUpdateAccurateConfigMutation()

  const { data: itemsResp } = useGetAccurateItemsQuery()
  const { data: mappingsResp } = useGetAccurateMappingsQuery()

  // TAB 5: Data Modul (Live)
  const [activeModule, setActiveModule] = useState<
    'item' | 'vendor' | 'customer' | 'glaccount' | 'sales_invoice' | 'sales_order' | 'purchase_invoice' | 'purchase_order' | 'bank_transfer' | 'journal_voucher' | 'bill_of_material'
  >('item')
  const [sortColIndex, setSortColIndex] = useState<number | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchQuery, setSearchQuery] = useState('')

  const handleHeaderClick = (colIdx: number) => {
    if (sortColIndex === colIdx) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortColIndex(null)
        setSortDirection('asc')
      }
    } else {
      setSortColIndex(colIdx)
      setSortDirection('asc')
    }
  }
  const { data: salesInvoicesResp, refetch: refetchSalesInvoices, isFetching: fetchingSalesInvoices } = useGetAccurateSalesInvoicesQuery(undefined, { skip: activeModule !== 'sales_invoice' })
  const { data: salesOrdersResp, refetch: refetchSalesOrders, isFetching: fetchingSalesOrders } = useGetAccurateSalesOrdersQuery(undefined, { skip: activeModule !== 'sales_order' })
  const { data: customersResp, refetch: refetchCustomers, isFetching: fetchingCustomers } = useGetAccurateCustomersQuery(undefined, { skip: activeModule !== 'customer' })
  const { data: purchaseInvoicesResp, refetch: refetchPurchaseInvoices, isFetching: fetchingPurchaseInvoices } = useGetAccuratePurchaseInvoicesQuery(undefined, { skip: activeModule !== 'purchase_invoice' })
  const { data: purchaseOrdersResp, refetch: refetchPurchaseOrders, isFetching: fetchingPurchaseOrders } = useGetAccuratePurchaseOrdersQuery(undefined, { skip: activeModule !== 'purchase_order' })
  const { data: vendorsResp, refetch: refetchVendors, isFetching: fetchingVendors } = useGetAccurateVendorsQuery(undefined, { skip: activeModule !== 'vendor' })
  const { data: bankTransfersResp, refetch: refetchBankTransfers, isFetching: fetchingBankTransfers } = useGetAccurateBankTransfersQuery(undefined, { skip: activeModule !== 'bank_transfer' })
  const { data: glAccountsResp, refetch: refetchGlAccounts, isFetching: fetchingGlAccounts } = useGetAccurateGlAccountsQuery(undefined, { skip: activeModule !== 'glaccount' })
  const { data: journalVouchersResp, refetch: refetchJournalVouchers, isFetching: fetchingJournalVouchers } = useGetAccurateJournalVouchersQuery(undefined, { skip: activeModule !== 'journal_voucher' })
  const { data: billsOfMaterialResp, refetch: refetchBillsOfMaterial, isFetching: fetchingBillsOfMaterial } = useGetAccurateBillsOfMaterialQuery(undefined, { skip: activeModule !== 'bill_of_material' })
  const { data: moduleItemsResp, refetch: refetchModuleItems, isFetching: fetchingModuleItems } = useGetAccurateItemsQuery(undefined, { skip: activeModule !== 'item' })

  // Detail modal state
  const [detailModal, setDetailModal] = useState<{ module: string; id: string } | null>(null)
  // Panggil semua 11 hooks tiap render (aturan Hooks), skip semua kecuali yang aktif di modal
  const itemDetailQ = useGetAccurateItemDetailQuery(detailModal?.id ?? '', { skip: !detailModal || detailModal.module !== 'item' })
  const vendorDetailQ = useGetAccurateVendorDetailQuery(detailModal?.id ?? '', { skip: !detailModal || detailModal.module !== 'vendor' })
  const customerDetailQ = useGetAccurateCustomerDetailQuery(detailModal?.id ?? '', { skip: !detailModal || detailModal.module !== 'customer' })
  const glAccountDetailQ = useGetAccurateGlAccountDetailQuery(detailModal?.id ?? '', { skip: !detailModal || detailModal.module !== 'glaccount' })
  const salesInvoiceDetailQ = useGetAccurateSalesInvoiceDetailQuery(detailModal?.id ?? '', { skip: !detailModal || detailModal.module !== 'sales_invoice' })
  const salesOrderDetailQ = useGetAccurateSalesOrderDetailQuery(detailModal?.id ?? '', { skip: !detailModal || detailModal.module !== 'sales_order' })
  const purchaseInvoiceDetailQ = useGetAccuratePurchaseInvoiceDetailQuery(detailModal?.id ?? '', { skip: !detailModal || detailModal.module !== 'purchase_invoice' })
  const purchaseOrderDetailQ = useGetAccuratePurchaseOrderDetailQuery(detailModal?.id ?? '', { skip: !detailModal || detailModal.module !== 'purchase_order' })
  const bankTransferDetailQ = useGetAccurateBankTransferDetailQuery(detailModal?.id ?? '', { skip: !detailModal || detailModal.module !== 'bank_transfer' })
  const journalVoucherDetailQ = useGetAccurateJournalVoucherDetailQuery(detailModal?.id ?? '', { skip: !detailModal || detailModal.module !== 'journal_voucher' })
  const billOfMaterialDetailQ = useGetAccurateBillOfMaterialDetailQuery(detailModal?.id ?? '', { skip: !detailModal || detailModal.module !== 'bill_of_material' })

  const detailQByModule: Record<string, any> = {
    item: itemDetailQ,
    vendor: vendorDetailQ,
    customer: customerDetailQ,
    glaccount: glAccountDetailQ,
    sales_invoice: salesInvoiceDetailQ,
    sales_order: salesOrderDetailQ,
    purchase_invoice: purchaseInvoiceDetailQ,
    purchase_order: purchaseOrderDetailQ,
    bank_transfer: bankTransferDetailQ,
    journal_voucher: journalVoucherDetailQ,
    bill_of_material: billOfMaterialDetailQ,
  }
  const activeDetailQuery = detailModal ? detailQByModule[detailModal.module] : null
  const [saveMapping, { isLoading: isSavingMapping }] = useSaveAccurateMappingMutation()

  const { data: materialsResp } = useGetMRPMaterialsQuery({ all: true })
  const { data: productsResp } = useGetProductsQuery({})

  const [runDryRun, { isLoading: isRunningDryRun }] = useRunAccurateDryRunMutation()
  const { data: logsResp } = useGetAccurateSyncLogsQuery({})
  const [approveLog, { isLoading: isApproving }] = useApproveAccurateSyncLogMutation()
  const [rejectLog, { isLoading: isRejecting }] = useRejectAccurateSyncLogMutation()

  const config = configResp?.data
  const accurateItems = itemsResp?.data || []
  const mappings = mappingsResp?.data || []
  const materials = materialsResp?.materials || materialsResp?.data || materialsResp?.items || []
  const products = productsResp?.products || productsResp?.data || productsResp?.items || []
  const logs = logsResp?.data || []

  // Config Form State
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [dbId, setDbId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [apiUrl, setApiUrl] = useState('https://accurate.id')

  const callbackUrl = `${window.location.origin}/api/integrations/accurate/oauth/callback`
  const webhookUrl = `${window.location.origin}/api/integrations/accurate/webhook`

  // Mapping Form State
  const [selectedAccNo, setSelectedAccNo] = useState('')
  const [selectedInternalType, setSelectedInternalType] = useState<'material' | 'product'>('material')
  const [selectedInternalId, setSelectedInternalId] = useState<number | ''>('')
  const [uomRatio, setUomRatio] = useState<number>(1.0)

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateConfig({
        client_id: clientId || config?.client_id,
        client_secret: clientSecret || undefined,
        db_id: dbId || config?.db_id,
        access_token: accessToken || undefined,
        api_url: apiUrl || config?.api_url,
      }).unwrap()
      alert('Konfigurasi API Accurate berhasil disimpan!')
    } catch (err: any) {
      alert('Gagal menyimpan konfigurasi: ' + (err?.data?.details || err.message))
    }
  }

  const handleToggleDryRun = async (currentVal: boolean) => {
    try {
      await updateConfig({ is_dry_run: !currentVal }).unwrap()
    } catch (err: any) {
      alert('Gagal mengubah mode dry-run')
    }
  }

  const handleSaveMappingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccNo || !selectedInternalId) {
      alert('Pilih barang Accurate dan item Internal ERP yang ingin di-mapping')
      return
    }
    const accItem = accurateItems.find((i: any) => i.item_no === selectedAccNo)
    try {
      await saveMapping({
        accurate_item_no: selectedAccNo,
        accurate_item_name: accItem?.name || selectedAccNo,
        accurate_item_type: accItem?.item_type || 'ITEM',
        smith_item_type: selectedInternalType,
        smith_material_id: selectedInternalType === 'material' ? Number(selectedInternalId) : null,
        smith_product_id: selectedInternalType === 'product' ? Number(selectedInternalId) : null,
        uom_conversion_ratio: uomRatio,
      }).unwrap()
      alert('Pemetaan barang berhasil disimpan!')
      setSelectedAccNo('')
      setSelectedInternalId('')
    } catch (err: any) {
      alert('Gagal menyimpan pemetaan: ' + (err?.data?.details || err.message))
    }
  }

  const handleRunDryRunSubmit = async () => {
    try {
      await runDryRun().unwrap()
      alert('Simulasi Dry-Run selesai! Hasil preview dapat dilihat di tabel di bawah.')
    } catch (err: any) {
      alert('Gagal menjalankan simulasi: ' + (err?.data?.details || err.message))
    }
  }

  const handleApprove = async (logId: number) => {
    if (window.confirm('Apakah Anda yakin ingin menyetujui transaksi ini dan menerapkan stok ke WMS?')) {
      try {
        await approveLog(logId).unwrap()
        alert('Transaksi berhasil diapprove & stok WMS ter-update!')
      } catch (err: any) {
        alert('Gagal menyetujui: ' + (err?.data?.details || err.message))
      }
    }
  }

  const handleReject = async (logId: number) => {
    if (window.confirm('Apakah Anda yakin ingin menolak transaksi ini?')) {
      try {
        await rejectLog(logId).unwrap()
        alert('Transaksi ditolak')
      } catch (err: any) {
        alert('Gagal menolak: ' + (err?.data?.details || err.message))
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowsRightLeftIcon className="w-8 h-8 text-blue-600" />
            Integrasi Accurate Online API
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Triple-Layer Safe Integration: Dry-Run Simulation, Staging Isolation, & Stock Approval Queue
          </p>
        </div>

        {/* Dry-Run Toggle Badge */}
        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <ShieldCheckIcon className={`w-6 h-6 ${config?.is_dry_run ? 'text-amber-500' : 'text-green-500'}`} />
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Mode Sistem</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {config?.is_dry_run ? (
                <span className="text-amber-600 dark:text-amber-400">Mode Simulasi (Dry-Run Only)</span>
              ) : (
                <span className="text-green-600 dark:text-green-400">Live Sync (Approval Active)</span>
              )}
            </div>
          </div>
          <button
            onClick={() => handleToggleDryRun(config?.is_dry_run)}
            className={`px-3 py-1 text-xs font-semibold rounded-md text-white transition ${
              config?.is_dry_run ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {config?.is_dry_run ? 'Aktifkan Live' : 'Kembali ke Dry-Run'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 flex gap-6">
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 font-medium text-sm border-b-2 transition ${
            activeTab === 'config'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          1. Koneksi & Konfigurasi
        </button>
        <button
          onClick={() => setActiveTab('mapping')}
          className={`pb-3 font-medium text-sm border-b-2 transition ${
            activeTab === 'mapping'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          2. Pemetaan Barang & BOM ({mappings.length})
        </button>
        <button
          onClick={() => setActiveTab('dryrun')}
          className={`pb-3 font-medium text-sm border-b-2 transition ${
            activeTab === 'dryrun'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          3. Simulasi Dry-Run
        </button>
        <button
          onClick={() => setActiveTab('approval')}
          className={`pb-3 font-medium text-sm border-b-2 transition ${
            activeTab === 'approval'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          4. Antrean Approval Sync ({logs.filter((l: any) => l.status === 'PENDING_APPROVAL').length})
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`pb-3 font-medium text-sm border-b-2 transition ${
            activeTab === 'modules'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          5. Data Modul (Live)
        </button>
        <button
          onClick={() => setActiveTab('ejo')}
          className={`pb-3 font-medium text-sm border-b-2 transition ${
            activeTab === 'ejo'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          6. Cek EJO
        </button>
        <button
          onClick={() => setActiveTab('warehouse')}
          className={`pb-3 font-medium text-sm border-b-2 transition ${
            activeTab === 'warehouse'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          7. Gudang EPD/FG
        </button>
      </div>

      {/* TAB 1: Config */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <ServerIcon className="w-5 h-5 text-blue-500" />
                  Pengaturan API & OAuth Accurate Online
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Mendukung OAuth 2.0 Open API & Direct Access Token
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  config?.is_connected
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${config?.is_connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {config?.is_connected ? 'Terhubung (Live)' : 'Belum Terhubung (Mock Mode)'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Client ID (OAuth App)
                  </label>
                  <input
                    type="text"
                    className="input w-full font-mono text-xs"
                    placeholder={config?.client_id || 'Masukkan Client ID API Accurate'}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    className="input w-full font-mono text-xs"
                    placeholder="••••••••••••••••"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Database ID (db_id / Alias) <span className="text-gray-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    className="input w-full font-mono text-xs"
                    placeholder={config?.db_id || 'Otomatis diisi via OAuth / db-list.do'}
                    value={dbId}
                    onChange={(e) => setDbId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    API Base URL
                  </label>
                  <input
                    type="text"
                    className="input w-full font-mono text-xs"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Access Token / API Key <span className="text-gray-400 font-normal">(Direct Access Token jika tidak lewat OAuth browser login)</span>
                </label>
                <textarea
                  rows={2}
                  className="input w-full font-mono text-xs"
                  placeholder={config?.access_token ? '•••• Token terpasang ••••' : 'Tempel Access Token dari Accurate jika ada...'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={isUpdatingConfig} className="btn btn-primary">
                  Simpan Pengaturan
                </button>

                {config?.client_id && (
                  <a
                    href={`https://account.accurate.id/oauth/authorize?client_id=${config.client_id}&response_type=code&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent('item_view item_save sales_invoice_view sales_invoice_save purchase_invoice_view purchase_invoice_save sales_order_view purchase_order_view customer_view vendor_view glaccount_view journal_voucher_view bank_transfer_view bill_of_material_view bill_of_material_save work_order_view work_order_save')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2"
                  >
                    <ArrowsRightLeftIcon className="w-4 h-4" />
                    Connect via OAuth Login Accurate
                  </a>
                )}
              </div>
            </form>
          </div>

          {/* Webhook & Callback URL Guide Box */}
          <div className="card p-6 space-y-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Panduan Integrasi open.accurate.id
            </h3>
            
            <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
              <div>
                <span className="font-semibold text-gray-900 dark:text-white block mb-1">1. OAuth Redirect / Callback URL:</span>
                <p className="text-gray-500 dark:text-gray-400 mb-1">Salin URL ini dan tempel di menu **Aplikasi OAuth → Redirect URI** di portal Developer Accurate (`open.accurate.id`):</p>
                <div className="p-2 bg-white dark:bg-slate-900 rounded border border-gray-200 dark:border-gray-700 font-mono text-[11px] select-all break-all text-blue-600 dark:text-blue-400">
                  {callbackUrl}
                </div>
              </div>

              <div>
                <span className="font-semibold text-gray-900 dark:text-white block mb-1">2. Webhook Listener URL (Opsional):</span>
                <p className="text-gray-500 dark:text-gray-400 mb-1">Jika kamu mengaktifkan fitur Webhook Realtime Push di Accurate:</p>
                <div className="p-2 bg-white dark:bg-slate-900 rounded border border-gray-200 dark:border-gray-700 font-mono text-[11px] select-all break-all text-emerald-600 dark:text-emerald-400">
                  {webhookUrl}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 space-y-1">
                <p>💡 **Tips:** Setelah menyimpan Client ID & Client Secret di sebelah kiri, klik tombol **Connect via OAuth Login Accurate** untuk langsung menghubungkan akun.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Item & BOM Mapping */}
      {activeTab === 'mapping' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Hubungkan Barang Accurate ↔ Internal ERP</h3>
            <form onSubmit={handleSaveMappingSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  1. Barang / BOM Accurate
                </label>
                <select
                  className="input w-full"
                  value={selectedAccNo}
                  onChange={(e) => setSelectedAccNo(e.target.value)}
                >
                  <option value="">-- Pilih Barang Accurate --</option>
                  {accurateItems.map((item: any) => (
                    <option key={item.item_no} value={item.item_no}>
                      [{item.item_no}] {item.name} ({item.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  2. Tipe Item Internal ERP
                </label>
                <select
                  className="input w-full"
                  value={selectedInternalType}
                  onChange={(e: any) => setSelectedInternalType(e.target.value)}
                >
                  <option value="material">Material (Bahan Baku)</option>
                  <option value="product">Product (Barang Jadi/WIP)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  3. Item Internal ERP
                </label>
                <select
                  className="input w-full"
                  value={selectedInternalId}
                  onChange={(e) => setSelectedInternalId(Number(e.target.value))}
                >
                  <option value="">-- Pilih Item Target --</option>
                  {selectedInternalType === 'material'
                    ? materials.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          [{m.code || m.id}] {m.name} (Stok: {m.current_stock ?? m.stock_quantity ?? 0})
                        </option>
                      ))
                    : products.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          [{p.code || p.id}] {p.name} (Stok: {p.current_stock ?? p.stock_quantity ?? 0})
                        </option>
                      ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  4. Rasio UoM (Accurate/Internal ERP)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    className="input w-full"
                    value={uomRatio}
                    onChange={(e) => setUomRatio(Number(e.target.value))}
                  />
                  <button type="submit" disabled={isSavingMapping} className="btn btn-primary whitespace-nowrap">
                    Simpan Map
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Table mappings */}
          <div className="card">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 font-semibold">
              Daftar Pemetaan yang Sudah Diset
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Kode Barang Accurate</th>
                    <th>Nama Barang Accurate</th>
                    <th>Tipe Item Internal</th>
                    <th>Target Item Internal</th>
                    <th>Rasio Konversi UoM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {mappings.map((m: any) => (
                    <tr key={m.id}>
                      <td className="font-mono text-xs">{m.accurate_item_no}</td>
                      <td>{m.accurate_item_name || '-'}</td>
                      <td>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {m.smith_item_type}
                        </span>
                      </td>
                      <td className="font-medium text-gray-900 dark:text-white">{m.smith_item_name || '-'}</td>
                      <td>1 Accurate = {m.uom_conversion_ratio} Internal</td>
                    </tr>
                  ))}
                  {mappings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-gray-500">
                        Belum ada pemetaan barang. Silakan isi form di atas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Dry-Run Simulation */}
      {activeTab === 'dryrun' && (
        <div className="space-y-6">
          <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <PlayIcon className="w-5 h-5 text-amber-500" />
                Uji Coba Penarikan API & Simulasi Perhitungan Stok (Dry-Run)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Proses ini akan memanggil API Accurate, melakukan mapping, menghitung selisih stok & dampak MRP secara aman tanpa mengubah database produksi.
              </p>
            </div>
            <button
              onClick={handleRunDryRunSubmit}
              disabled={isRunningDryRun}
              className="btn btn-primary bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2"
            >
              <PlayIcon className="w-4 h-4" />
              {isRunningDryRun ? 'Menjalankan Simulasi...' : 'Jalankan Simulasi Dry-Run'}
            </button>
          </div>

          {/* Render simulation logs preview */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 dark:text-white">Hasil Simulasi Terakhir:</h4>
            {logs.map((log: any) => (
              <div key={log.id} className="card p-5 border-l-4 border-l-amber-500 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 dark:text-white">Tx #{log.accurate_tx_no}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {log.transaction_type}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      {log.status} (Dry-Run)
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{log.created_at}</div>
                </div>

                {/* Diff Tables */}
                {log.mapping_summary && (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Barang Accurate</th>
                          <th>Qty Accurate</th>
                          <th>Status Map</th>
                          <th>Item Target Internal</th>
                          <th>Simulasi Tambah Stok</th>
                        </tr>
                      </thead>
                      <tbody>
                        {log.mapping_summary.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td>[{item.accurate_item_no}] {item.accurate_item_name}</td>
                            <td>{item.accurate_qty} {item.accurate_unit}</td>
                            <td>
                              {item.is_mapped ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                                  <CheckCircleIcon className="w-4 h-4" /> Ter-map
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold">
                                  <ExclamationTriangleIcon className="w-4 h-4" /> Unmapped
                                </span>
                              )}
                            </td>
                            <td className="font-medium">{item.smith_item_name}</td>
                            <td className="font-bold text-green-600">+{item.converted_qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Approval Queue */}
      {activeTab === 'approval' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Antrean Persetujuan Transaksi Accurate (WMS Approval Queue)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Setiap transaksi yang ditarik dari Accurate tersimpan di antrean ini. Klik <strong>Approve</strong> untuk menerapkan perubahan stok secara nyata ke WMS.
            </p>
          </div>

          <div className="space-y-4">
            {logs.map((log: any) => (
              <div key={log.id} className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 dark:text-white">No Tx: {log.accurate_tx_no}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {log.status}
                    </span>
                  </div>
                  {log.status === 'PENDING_APPROVAL' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(log.id)}
                        disabled={isRejecting}
                        className="px-3 py-1 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
                      >
                        <XMarkIcon className="w-4 h-4" /> Tolak (Reject)
                      </button>
                      <button
                        onClick={() => handleApprove(log.id)}
                        disabled={isApproving}
                        className="px-3 py-1 text-xs font-semibold bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                      >
                        <CheckIcon className="w-4 h-4" /> Approve & Apply WMS
                      </button>
                    </div>
                  )}
                </div>

                {log.mapping_summary && (
                  <div className="table-container">
                    <table className="table text-xs">
                      <thead>
                        <tr>
                          <th>Item Accurate</th>
                          <th>Qty Accurate</th>
                          <th>Mapped Item Internal</th>
                          <th>Stok Baru Setelah Sync</th>
                        </tr>
                      </thead>
                      <tbody>
                        {log.mapping_summary.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td>{item.accurate_item_name}</td>
                            <td>{item.accurate_qty} {item.accurate_unit}</td>
                            <td>{item.smith_item_name}</td>
                            <td className="font-bold text-green-600">+{item.converted_qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Item-master sync rows (item_new/item_deleted/item_stock_change/item_price_change) -- tidak punya mapping_summary, tampilkan ringkasan bahasa natural dari proposed_* fields */}
                {!log.mapping_summary && log.accurate_item_name && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-sm space-y-2">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {log.accurate_item_name}
                    </div>

                    {log.transaction_type === 'item_new' && (
                      <p className="text-gray-700 dark:text-gray-300">
                        Item baru dari Accurate. Akan ditambahkan sebagai{' '}
                        <strong>{log.proposed_target_table === 'products' ? 'Barang Jadi' : 'Bahan/Material'}</strong>
                        {log.proposed_category && <> dengan kategori <strong>{log.proposed_category}</strong></>}.
                        {log.proposed_changes?.stock != null && (
                          <> Stok awal: <strong>{Number(log.proposed_changes.stock).toLocaleString('id-ID')} {log.proposed_changes.unit || ''}</strong>.</>
                        )}
                      </p>
                    )}

                    {log.transaction_type === 'item_stock_change' && log.proposed_changes && (
                      <p className="text-gray-700 dark:text-gray-300">
                        Stok di Accurate berbeda dari Internal ERP. Stok Internal saat ini:{' '}
                        <strong>{Number(log.proposed_changes.smith_stock).toLocaleString('id-ID')}</strong>, stok Accurate:{' '}
                        <strong>{Number(log.proposed_changes.accurate_stock).toLocaleString('id-ID')}</strong>.{' '}
                        {log.proposed_changes.diff > 0 ? (
                          <span className="text-green-600 font-semibold">Akan naik {Number(log.proposed_changes.diff).toLocaleString('id-ID')} unit.</span>
                        ) : (
                          <span className="text-red-600 font-semibold">Akan turun {Number(Math.abs(log.proposed_changes.diff)).toLocaleString('id-ID')} unit.</span>
                        )}
                      </p>
                    )}

                    {log.transaction_type === 'item_price_change' && log.proposed_changes && (
                      <p className="text-gray-700 dark:text-gray-300">
                        Harga di Accurate berbeda dari Internal ERP. Harga Internal saat ini:{' '}
                        <strong>Rp {Number(log.proposed_changes.smith_price).toLocaleString('id-ID')}</strong>, harga Accurate:{' '}
                        <strong>Rp {Number(log.proposed_changes.accurate_price).toLocaleString('id-ID')}</strong>.{' '}
                        {log.proposed_changes.diff > 0 ? (
                          <span className="text-green-600 font-semibold">Akan naik Rp {Number(log.proposed_changes.diff).toLocaleString('id-ID')}.</span>
                        ) : (
                          <span className="text-red-600 font-semibold">Akan turun Rp {Number(Math.abs(log.proposed_changes.diff)).toLocaleString('id-ID')}.</span>
                        )}
                      </p>
                    )}

                    {log.transaction_type === 'item_deleted' && (
                      <p className="text-gray-700 dark:text-gray-300">
                        Item ini sudah tidak ditemukan lagi di Accurate.{' '}
                        <strong>Item TIDAK akan dihapus permanen</strong> dari Internal ERP -- hanya akan dinonaktifkan
                        (disembunyikan dari daftar aktif) agar histori transaksi lama tetap aman.
                      </p>
                    )}

                    {log.transaction_type === 'bom_new' && log.proposed_changes && (
                      <div className="text-gray-700 dark:text-gray-300 space-y-2">
                        <p>
                          Formula/BOM baru untuk produk <strong>{log.accurate_item_name}</strong>{' '}
                          (batch {log.proposed_changes.batch_size} {log.proposed_changes.batch_uom}), berisi{' '}
                          <strong>{log.proposed_changes.lines?.length || 0} bahan</strong>:
                        </p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {(log.proposed_changes.lines || []).map((line: any, idx: number) => (
                            <li key={idx} className={line.is_mapped ? '' : 'text-red-600 dark:text-red-400 font-semibold'}>
                              {line.item_name} -- {line.quantity} {line.unit}
                              {!line.is_mapped && ' (belum ter-mapping ke Internal ERP)'}
                            </li>
                          ))}
                        </ul>
                        {(log.proposed_changes.lines || []).some((l: any) => !l.is_mapped) && (
                          <p className="text-red-600 dark:text-red-400 text-xs font-semibold">
                            Approve akan ditolak sampai semua bahan di atas ter-mapping ke Internal ERP terlebih dahulu.
                          </p>
                        )}
                      </div>
                    )}

                    {log.transaction_type === 'bom_line_changed' && log.proposed_changes && (
                      <div className="text-gray-700 dark:text-gray-300 space-y-2">
                        <p>Formula/BOM untuk produk <strong>{log.accurate_item_name}</strong> berubah di Accurate:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {(log.proposed_changes.added_lines || []).map((line: any, idx: number) => (
                            <li key={`add-${idx}`} className="text-green-600 dark:text-green-400">
                              + Ditambah: {line.name} -- {line.quantity} {line.unit}
                            </li>
                          ))}
                          {(log.proposed_changes.removed_lines || []).map((line: any, idx: number) => (
                            <li key={`rem-${idx}`} className="text-red-600 dark:text-red-400">
                              - Dihapus: {line.name} -- {line.quantity} {line.unit}
                            </li>
                          ))}
                          {(log.proposed_changes.changed_lines || []).map((line: any, idx: number) => (
                            <li key={`chg-${idx}`} className="text-amber-600 dark:text-amber-400">
                              ~ {line.name}: {line.old_quantity} -&gt; {line.new_quantity} {line.unit}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {log.transaction_type === 'bom_deleted' && (
                      <p className="text-gray-700 dark:text-gray-300">
                        Formula/BOM untuk produk <strong>{log.accurate_item_name}</strong> sudah tidak ditemukan lagi di Accurate.{' '}
                        <strong>BOM TIDAK akan dihapus permanen</strong> dari Internal ERP -- hanya akan dinonaktifkan.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* TAB 5: Data Modul (Live) */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap gap-2">
            {([
              ['item', 'Item / Barang'],
              ['vendor', 'Vendor'],
              ['customer', 'Customer'],
              ['glaccount', 'GL Account'],
              ['sales_invoice', 'Faktur Penjualan'],
              ['sales_order', 'Pesanan Penjualan'],
              ['purchase_invoice', 'Faktur Pembelian'],
              ['purchase_order', 'Pesanan Pembelian'],
              ['bank_transfer', 'Transfer Kas/Bank'],
              ['journal_voucher', 'Jurnal Umum'],
              ['bill_of_material', 'BOM / Formula Manufaktur'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setActiveModule(key)
                  setSortColIndex(null)
                  setSearchQuery('')
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${
                  activeModule === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {(() => {
            const moduleConfig: Record<string, { data: any; refetch: () => void; fetching: boolean; columns: string[]; rowMapper: (row: any) => (string | number)[]; idField: string }> = {
              item: {
                data: moduleItemsResp?.data,
                refetch: refetchModuleItems,
                fetching: fetchingModuleItems,
                columns: ['No Item', 'Nama', 'Tipe', 'Satuan', 'Stok', 'Harga'],
                rowMapper: (r) => [r.item_no, r.name, r.item_type, r.unit, r.stock, r.unit_price],
                idField: 'item_no',
              },
              vendor: {
                data: vendorsResp?.data,
                refetch: refetchVendors,
                fetching: fetchingVendors,
                columns: ['No Vendor', 'Nama', 'Email', 'Telepon'],
                rowMapper: (r) => [r.vendor_no, r.name, r.email || '-', r.phone || '-'],
                idField: 'vendor_no',
              },
              customer: {
                data: customersResp?.data,
                refetch: refetchCustomers,
                fetching: fetchingCustomers,
                columns: ['No Customer', 'Nama', 'Email', 'Telepon'],
                rowMapper: (r) => [r.customer_no, r.name, r.email || '-', r.phone || '-'],
                idField: 'customer_no',
              },
              glaccount: {
                data: glAccountsResp?.data,
                refetch: refetchGlAccounts,
                fetching: fetchingGlAccounts,
                columns: ['No Akun', 'Nama', 'Tipe'],
                rowMapper: (r) => [r.account_no, r.name, r.account_type],
                idField: 'account_no',
              },
              sales_invoice: {
                data: salesInvoicesResp?.data,
                refetch: refetchSalesInvoices,
                fetching: fetchingSalesInvoices,
                columns: ['No Faktur', 'Tanggal', 'Customer', 'Total', 'Status'],
                rowMapper: (r) => [r.number, r.date, r.customer_name, r.total, r.status],
                idField: 'number',
              },
              sales_order: {
                data: salesOrdersResp?.data,
                refetch: refetchSalesOrders,
                fetching: fetchingSalesOrders,
                columns: ['No Order', 'Tanggal', 'Customer', 'Total', 'Status'],
                rowMapper: (r) => [r.number, r.date, r.customer_name, r.total, r.status],
                idField: 'number',
              },
              purchase_invoice: {
                data: purchaseInvoicesResp?.data,
                refetch: refetchPurchaseInvoices,
                fetching: fetchingPurchaseInvoices,
                columns: ['No Faktur', 'Tanggal', 'Vendor', 'Total', 'Status'],
                rowMapper: (r) => [r.number, r.date, r.vendor_name, r.total, r.status],
                idField: 'number',
              },
              purchase_order: {
                data: purchaseOrdersResp?.data,
                refetch: refetchPurchaseOrders,
                fetching: fetchingPurchaseOrders,
                columns: ['No Order', 'Tanggal', 'Vendor', 'Total', 'Status'],
                rowMapper: (r) => [r.number, r.date, r.vendor_name, r.total, r.status],
                idField: 'number',
              },
              bank_transfer: {
                data: bankTransfersResp?.data,
                refetch: refetchBankTransfers,
                fetching: fetchingBankTransfers,
                columns: ['No Transfer', 'Tanggal', 'Dari Bank', 'Ke Bank', 'Jumlah'],
                rowMapper: (r) => [r.number, r.date, r.from_bank, r.to_bank, r.amount],
                idField: 'number',
              },
              journal_voucher: {
                data: journalVouchersResp?.data,
                refetch: refetchJournalVouchers,
                fetching: fetchingJournalVouchers,
                columns: ['No Jurnal', 'Tanggal', 'Deskripsi'],
                rowMapper: (r) => [r.number, r.date, r.description],
                idField: 'number',
              },
              bill_of_material: {
                data: billsOfMaterialResp?.data,
                refetch: refetchBillsOfMaterial,
                fetching: fetchingBillsOfMaterial,
                columns: ['No BOM', 'Nama Formula', 'Produk Hasil'],
                rowMapper: (r) => [r.number, r.name, r.product_name || '-'],
                idField: 'number',
              },
            }
            const current = moduleConfig[activeModule]
            const rawRows: any[] = current.data || []

            // Filter by search query
            let processedRows = rawRows
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase().trim()
              processedRows = rawRows.filter((r) => {
                const cells = current.rowMapper(r)
                return cells.some((cell) => String(cell ?? '').toLowerCase().includes(q))
              })
            }

            // Sort by selected column
            if (sortColIndex !== null) {
              processedRows = [...processedRows].sort((a, b) => {
                const cellA = current.rowMapper(a)[sortColIndex]
                const cellB = current.rowMapper(b)[sortColIndex]

                if (cellA === cellB) return 0
                if (cellA == null || cellA === '-') return 1
                if (cellB == null || cellB === '-') return -1

                const numA = typeof cellA === 'number' ? cellA : parseFloat(String(cellA).replace(/[^0-9.-]+/g, ''))
                const numB = typeof cellB === 'number' ? cellB : parseFloat(String(cellB).replace(/[^0-9.-]+/g, ''))

                let cmp = 0
                if (!isNaN(numA) && !isNaN(numB) && String(cellA).trim() === String(numA) && String(cellB).trim() === String(numB)) {
                  cmp = numA - numB
                } else {
                  cmp = String(cellA).localeCompare(String(cellB), undefined, { numeric: true, sensitivity: 'base' })
                }
                return sortDirection === 'asc' ? cmp : -cmp
              })
            }

            return (
              <div className="card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {processedRows.length} data ditemukan
                      {searchQuery && (
                        <span className="text-xs font-normal text-gray-500 ml-2">
                          (difilter dari total {rawRows.length})
                        </span>
                      )}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Realtime Search Box */}
                    <div className="relative">
                      <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari data..."
                        className="input text-xs pl-9 py-1.5 w-48 focus:w-64 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    <button
                      onClick={() => current.refetch()}
                      disabled={current.fetching}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                    >
                      <ArrowsRightLeftIcon className={`w-4 h-4 ${current.fetching ? 'animate-spin' : ''}`} />
                      {current.fetching ? 'Mengambil data...' : 'Fetch / Refresh Data'}
                    </button>
                  </div>
                </div>

                {processedRows.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 dark:text-gray-400 text-sm">
                    {searchQuery
                      ? `Tidak ada data yang cocok dengan kata kunci "${searchQuery}"`
                      : 'Belum ada data. Klik "Fetch / Refresh Data" untuk menarik data terbaru dari Accurate.'}
                    <br />
                    {!searchQuery && (
                      <span className="text-xs">(Jika tetap kosong, kemungkinan akun Accurate belum memiliki hak akses ke modul ini.)</span>
                    )}
                  </div>
                ) : (
                  <div className="table-container overflow-x-auto">
                    <table className="table text-xs w-full">
                      <thead>
                        <tr>
                          {current.columns.map((col, cidx) => {
                            const isSorted = sortColIndex === cidx
                            return (
                              <th
                                key={col}
                                onClick={() => handleHeaderClick(cidx)}
                                className="cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                title="Klik untuk mengurutkan"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span>{col}</span>
                                  {isSorted ? (
                                    sortDirection === 'asc' ? (
                                      <ChevronUpIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 font-bold" />
                                    ) : (
                                      <ChevronDownIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 font-bold" />
                                    )
                                  ) : (
                                    <ChevronUpDownIcon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                                  )}
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {processedRows.map((row, idx) => (
                          <tr
                            key={idx}
                            onClick={() => {
                              const idVal = (row as any)[(current as any).idField]
                              if (idVal) setDetailModal({ module: activeModule, id: String(idVal) })
                            }}
                            className="cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 transition"
                            title="Klik untuk melihat detail"
                          >
                            {current.rowMapper(row).map((cell, cidx) => (
                              <td key={cidx}>{cell ?? '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Detail Modal */}
          {detailModal && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setDetailModal(null)}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Detail: {detailModal.id}
                  </h3>
                  <button
                    onClick={() => setDetailModal(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto p-4">
                  {!activeDetailQuery || activeDetailQuery.isFetching ? (
                    <div className="text-center py-10 text-sm text-gray-500 dark:text-gray-400">
                      Memuat detail...
                    </div>
                  ) : activeDetailQuery.isError || !activeDetailQuery.data?.data ? (
                    <div className="text-center py-10 text-sm text-red-500">
                      Gagal memuat detail data ini.
                    </div>
                  ) : (() => {
                    const d = activeDetailQuery.data.data

                    // BOM: tampilkan komponen material + quantity
                    if (detailModal.module === 'bill_of_material') {
                      const materials: any[] = d.detailMaterial || []
                      return (
                        <div className="space-y-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Formula: {d.name || d.number}
                          </div>
                          {materials.length === 0 ? (
                            <div className="text-xs text-gray-500">Tidak ada komponen material.</div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400">
                                  <th className="py-1.5 pr-4 font-medium">Item Komponen</th>
                                  <th className="py-1.5 pr-4 font-medium">Satuan</th>
                                  <th className="py-1.5 font-medium">Quantity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {materials.map((m, i) => (
                                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                                    <td className="py-1.5 pr-4">{m.item?.name || m.item?.no || '-'}</td>
                                    <td className="py-1.5 pr-4">{m.itemUnit?.name || '-'}</td>
                                    <td className="py-1.5 font-semibold">{m.quantity ?? '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )
                    }

                    // Item: field penting saja
                    if (detailModal.module === 'item') {
                      const rows: [string, any][] = [
                        ['Nama', d.name],
                        ['No Item', d.no],
                        ['Tipe', d.itemType],
                        ['Satuan', d.unit1Name],
                        ['Stok Tersedia', d.availableToSell],
                        ['Total Stok (semua gudang)', d.balance],
                        ['Harga Jual', d.unitPrice],
                        ['Kategori', d.itemCategory?.name],
                      ]
                      return (
                        <table className="w-full text-xs">
                          <tbody>
                            {rows.map(([k, v]) => (
                              <tr key={k} className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-1.5 pr-4 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{k}</td>
                                <td className="py-1.5 text-gray-900 dark:text-gray-100">{v === null || v === undefined ? '-' : String(v)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    }

                    // Vendor / Customer: field penting saja
                    if (detailModal.module === 'vendor' || detailModal.module === 'customer') {
                      const rows: [string, any][] = [
                        ['Nama', d.name],
                        ['No', d.customerNo || d.vendorNo],
                        ['Email', d.email],
                        ['Telepon', d.mobilePhone || d.phone],
                        ['Alamat', d.billStreetAddress || d.address],
                        ['NPWP', d.npwpNo],
                      ]
                      return (
                        <table className="w-full text-xs">
                          <tbody>
                            {rows.map(([k, v]) => (
                              <tr key={k} className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-1.5 pr-4 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{k}</td>
                                <td className="py-1.5 text-gray-900 dark:text-gray-100">{v === null || v === undefined ? '-' : String(v)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    }

                    // GL Account: field penting saja
                    if (detailModal.module === 'glaccount') {
                      const rows: [string, any][] = [
                        ['Nama Akun', d.name],
                        ['No Akun', d.no],
                        ['Tipe', d.accountType],
                        ['Saldo', d.balance],
                      ]
                      return (
                        <table className="w-full text-xs">
                          <tbody>
                            {rows.map(([k, v]) => (
                              <tr key={k} className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-1.5 pr-4 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{k}</td>
                                <td className="py-1.5 text-gray-900 dark:text-gray-100">{v === null || v === undefined ? '-' : String(v)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    }

                    // Sales/Purchase Invoice & Order: header + daftar item transaksi
                    if (['sales_invoice', 'sales_order', 'purchase_invoice', 'purchase_order'].includes(detailModal.module)) {
                      const partyName = d.customer?.name || d.vendor?.name
                      const detailItems: any[] = d.detailItem || d.detailInvoice || []
                      return (
                        <div className="space-y-3">
                          <table className="w-full text-xs">
                            <tbody>
                              <tr className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-1.5 pr-4 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">No Transaksi</td>
                                <td className="py-1.5">{d.number || '-'}</td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-1.5 pr-4 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Tanggal</td>
                                <td className="py-1.5">{d.transDate || '-'}</td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-1.5 pr-4 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Customer/Vendor</td>
                                <td className="py-1.5">{partyName || '-'}</td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-1.5 pr-4 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Total</td>
                                <td className="py-1.5 font-semibold">{d.totalAmount ?? '-'}</td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-1.5 pr-4 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Status</td>
                                <td className="py-1.5">{d.statusName || '-'}</td>
                              </tr>
                            </tbody>
                          </table>
                          {detailItems.length > 0 && (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400">
                                  <th className="py-1.5 pr-4 font-medium">Item</th>
                                  <th className="py-1.5 pr-4 font-medium">Qty</th>
                                  <th className="py-1.5 font-medium">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detailItems.map((it: any, i: number) => (
                                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                                    <td className="py-1.5 pr-4">{it.item?.name || it.detailName || '-'}</td>
                                    <td className="py-1.5 pr-4">{it.quantity ?? '-'}</td>
                                    <td className="py-1.5">{it.subTotal ?? '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )
                    }

                    // Bank Transfer / Journal Voucher: field penting saja
                    const rows: [string, any][] = [
                      ['No Transaksi', d.number],
                      ['Tanggal', d.transDate],
                      ['Deskripsi', d.description || d.memo],
                      ['Jumlah', d.amount || d.totalAmount],
                    ]
                    return (
                      <table className="w-full text-xs">
                        <tbody>
                          {rows.map(([k, v]) => (
                            <tr key={k} className="border-b border-gray-100 dark:border-gray-700">
                              <td className="py-1.5 pr-4 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{k}</td>
                              <td className="py-1.5 text-gray-900 dark:text-gray-100">{v === null || v === undefined ? '-' : String(v)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* TAB 6: Cek EJO */}
      {activeTab === 'ejo' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Kroscek Hasil Produksi via Nomor EJO</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Masukkan nomor Perintah Kerja Accurate (contoh: EJO/26/08/018-5 S-1) untuk melihat detail
                  produksi, rincian bahan bertingkat (Barang Jadi &rarr; WIP &rarr; Mixing), histori gudang,
                  dan perbandingan dengan data WO Internal ERP.
                </p>
              </div>
              <button
                onClick={handleScanBomIndex}
                disabled={isScanningIndex}
                className="shrink-0 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                title="Bangun ulang index BOM Accurate (perlu dijalankan ulang bila struktur BOM di Accurate berubah)"
              >
                {isScanningIndex ? 'Menyegarkan index BOM...' : 'Segarkan Index BOM'}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={ejoNumber}
                onChange={(e) => setEjoNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCheckEjo() }}
                placeholder="EJO/26/08/018-5 S-1"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
              <button
                onClick={handleCheckEjo}
                disabled={isCheckingEjo || !ejoNumber.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {isCheckingEjo ? 'Mencari...' : 'Cek'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Daftar Perintah Kerja Terbaru ({(woCacheResp?.data || []).length})
              </h4>
              <button
                onClick={handleScanWoCache}
                disabled={isScanningWoCache}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                title="Ambil ulang daftar dari Accurate (butuh beberapa menit)"
              >
                {isScanningWoCache ? 'Menyegarkan...' : 'Segarkan Daftar'}
              </button>
            </div>
            <input
              type="text"
              value={ejoListSearch}
              onChange={(e) => setEjoListSearch(e.target.value)}
              placeholder="Cari nomor EJO atau nama item..."
              className="w-full mb-2 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            />
            {fetchingWoCache ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Memuat...</p>
            ) : filteredEjoList.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Belum ada data. Klik "Segarkan Daftar" untuk mengambil dari Accurate.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-gray-800">
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                      <th className="py-1.5 pr-2">Nomor EJO</th>
                      <th className="py-1.5 pr-2">Item</th>
                      <th className="py-1.5 pr-2">Qty</th>
                      <th className="py-1.5 pr-2">Status</th>
                      <th className="py-1.5 pr-2">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEjoList.slice(0, 200).map((w: any) => (
                      <tr
                        key={w.accurate_id}
                        onClick={() => handleSelectEjoFromList(w.number, w.accurate_id)}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                      >
                        <td className="py-1.5 pr-2 font-mono text-blue-600 dark:text-blue-400">{w.number}</td>
                        <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{w.item_name}</td>
                        <td className="py-1.5 pr-2 text-gray-500 dark:text-gray-400">{w.quantity_real} {w.unit}</td>
                        <td className="py-1.5 pr-2 text-gray-500 dark:text-gray-400">{w.status}</td>
                        <td className="py-1.5 pr-2 text-gray-400">{w.final_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {ejoModalOpen && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setEjoModalOpen(false)}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Detail EJO{ejoResult?.summary?.number ? `: ${ejoResult.summary.number}` : ''}
                  </h3>
                  <button
                    onClick={() => setEjoModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto p-4 space-y-4">
                  {!ejoResult ? (
                    <div className="text-center py-10 text-sm text-gray-500 dark:text-gray-400">
                      Memuat detail...
                    </div>
                  ) : (
                    <>
          {ejoResult && !ejoResult.found && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">{ejoResult.message}</p>
            </div>
          )}

          {ejoResult && ejoResult.found && (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Ringkasan</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <SummaryField label="Nomor EJO" value={ejoResult.summary.number} />
                  <SummaryField label="Item" value={ejoResult.summary.item} />
                  <SummaryField label="Status" value={ejoResult.summary.status} />
                  <SummaryField
                    label="Qty Hasil"
                    value={`${ejoResult.summary.quantity_real ?? '-'} ${ejoResult.summary.unit ?? ''}`}
                  />
                  <SummaryField label="Tanggal Mulai" value={ejoResult.summary.start_date} />
                  <SummaryField label="Tanggal Selesai" value={ejoResult.summary.final_date} />
                  <SummaryField label="Nomor BOM" value={ejoResult.summary.bom_number} />
                  <SummaryField
                    label="Qty Unit Dasar"
                    value={`${ejoResult.summary.quantity_default ?? '-'}`}
                  />
                  <SummaryField label="Mesin" value={ejoResult.summary.machine} />
                  <SummaryField label="Operator" value={ejoResult.summary.operator} />
                  <SummaryField label="Shift" value={ejoResult.summary.shift} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Histori Tahap Gudang</h4>
                <div className="space-y-2">
                  {ejoResult.process_history.map((h: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-gray-50 dark:bg-gray-900">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        h.stage_type === 'FGS'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}>
                        {h.stage_type}
                      </span>
                      <span className="flex-1 text-gray-700 dark:text-gray-300">{h.stage_label}</span>
                      <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{h.number}</span>
                      <span className="text-gray-400 text-xs">{h.date}</span>
                    </div>
                  ))}
                </div>
              </div>

              {ejoResult.finished_good_slips && ejoResult.finished_good_slips.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    EJO Penyelesaian ({ejoResult.finished_good_slips.length})
                  </h4>
                  <div className="space-y-2">
                    {ejoResult.finished_good_slips.map((fgs: any, idx: number) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 text-sm p-2 rounded-lg ${
                          fgs.is_waste
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : 'bg-gray-50 dark:bg-gray-900'
                        }`}
                      >
                        {fgs.is_waste && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            WASTE
                          </span>
                        )}
                        <span className="flex-1 text-gray-700 dark:text-gray-300 font-mono text-xs">{fgs.number}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">{fgs.machine}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">{fgs.operator}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">{fgs.shift}</span>
                        <span className="text-gray-400 text-xs">{fgs.trans_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Rincian Bahan Bertingkat (Barang Jadi &rarr; WIP &rarr; Mixing)
                </h4>
                <div className="space-y-1">
                  {ejoResult.material_tree.map((node: any, idx: number) => (
                    <MaterialTreeNode key={idx} node={node} depth={0} />
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Perbandingan dengan Internal ERP</h4>
                {!ejoResult.smith_match && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                      <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{ejoResult.diff_message}</span>
                    </div>
                    {ejoResult.smith_suggestions && ejoResult.smith_suggestions.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          Kandidat produk mirip di Internal ERP (klik untuk pilih manual):
                        </p>
                        <div className="space-y-1">
                          {ejoResult.smith_suggestions.map((s: any) => (
                            <div key={s.id}>
                              <button
                                onClick={() => setSelectedCandidateProductId(
                                  selectedCandidateProductId === s.id ? null : s.id
                                )}
                                className={`w-full flex items-center justify-between text-sm p-2 rounded-lg transition ${
                                  selectedCandidateProductId === s.id
                                    ? 'bg-blue-100 dark:bg-blue-900/40'
                                    : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                              >
                                <span className="text-gray-700 dark:text-gray-300">{s.name}</span>
                                <span className="text-xs text-gray-400">
                                  kemiripan {Math.round(s.similarity * 100)}%
                                </span>
                              </button>
                              {selectedCandidateProductId === s.id && (
                                <div className="mt-1 ml-3 pl-3 border-l-2 border-blue-200 dark:border-blue-800">
                                  {fetchingCandidateWo ? (
                                    <p className="text-xs text-gray-400 py-2">Memuat WO Internal ERP...</p>
                                  ) : (candidateWoResp?.data || []).length === 0 ? (
                                    <p className="text-xs text-gray-400 py-2">Tidak ada WO Internal ERP untuk produk ini.</p>
                                  ) : (
                                    <div className="space-y-1 py-1">
                                      {(candidateWoResp?.data || []).map((wo: any) => (
                                        <button
                                          key={wo.id}
                                          onClick={() => handlePickManualSmithWo(wo)}
                                          disabled={isManualMatching}
                                          className="w-full flex items-center justify-between text-xs p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left disabled:opacity-50"
                                        >
                                          <span className="font-mono text-gray-600 dark:text-gray-400">{wo.wo_number}</span>
                                          <span className="text-gray-500 dark:text-gray-400">
                                            {wo.quantity_produced} | {wo.status} | {wo.actual_end_date}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {ejoResult.smith_match && ejoResult.diff && (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Cocok dengan WO Internal ERP: <span className="font-mono">{ejoResult.smith_match.wo_number}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                      <SummaryField label="Qty Accurate" value={`${ejoResult.diff.output_quantity.accurate ?? '-'}`} />
                      <SummaryField label="Qty Internal ERP" value={`${ejoResult.diff.output_quantity.smith ?? '-'}`} />
                      <SummaryField
                        label="Selisih"
                        value={`${ejoResult.diff.output_quantity.diff ?? '-'}`}
                        highlight={ejoResult.diff.output_quantity.diff && ejoResult.diff.output_quantity.diff !== 0}
                      />
                    </div>
                    {ejoResult.diff.materials.length === 0 ? (
                      <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1">
                        <CheckCircleIcon className="w-4 h-4" /> Semua bahan cocok, tidak ada selisih.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {ejoResult.diff.materials.map((m: any, idx: number) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-3 text-sm p-2 rounded-lg ${
                              m.status === 'only_in_accurate'
                                ? 'bg-red-50 dark:bg-red-900/20'
                                : m.status === 'only_in_smith'
                                ? 'bg-amber-50 dark:bg-amber-900/20'
                                : 'bg-yellow-50 dark:bg-yellow-900/20'
                            }`}
                          >
                            <span className="flex-1 text-gray-700 dark:text-gray-300">{m.name}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">
                              Accurate: {m.accurate_qty ?? '-'} | Internal ERP: {m.smith_qty ?? '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* TAB 7: Gudang EPD/FG */}
      {activeTab === 'warehouse' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Stok Resmi Accurate (PM/EPD/FG)</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Snapshot langsung dari data gudang resmi Accurate (GUDANG PM/EPD/FG), mencakup seluruh
                  katalog barang -- lebih lengkap dan akurat dibanding perkiraan dari histori EJO di bawah.
                  Klik nama produk untuk lihat nama gudang asli, PIC, dan rincian per satuan.
                </p>
              </div>
              <button
                onClick={handleSyncSnapshotFull}
                disabled={isSyncingSnapshotFull}
                className="shrink-0 px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
              >
                {isSyncingSnapshotFull ? 'Menyinkronkan (5-10 menit)...' : 'Sinkronkan Penuh'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['pm', 'epd', 'fg'] as const).map((loc) => (
              <div key={loc} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Gudang {loc.toUpperCase()} ({(snapshotSummaryResp?.data?.[loc] || []).length})
                </h4>
                {fetchingSnapshotSummary ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Memuat...</p>
                ) : (snapshotSummaryResp?.data?.[loc] || []).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada data. Klik "Sinkronkan Penuh".</p>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {snapshotSummaryResp.data[loc].map((row: any) => (
                      <button
                        key={row.product_id}
                        onClick={() => setSnapshotDetailQuery({ ref_id: row.ref_id, kind: row.kind, location: loc, product_name: row.product_name })}
                        className="w-full flex items-center justify-between text-sm p-2 rounded-lg bg-gray-50 dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition"
                      >
                        <span className="text-gray-700 dark:text-gray-300 truncate pr-2">{row.product_name}</span>
                        <span className="text-gray-500 dark:text-gray-400 font-medium shrink-0">{row.quantity_on_hand.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Modal Detail Snapshot Resmi Accurate */}
          {snapshotDetailQuery && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setSnapshotDetailQuery(null)}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {snapshotDetailQuery.product_name}
                  </h3>
                  <button
                    onClick={() => setSnapshotDetailQuery(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto p-4">
                  {fetchingSnapshotDetail ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Memuat...</p>
                  ) : !snapshotDetailResp?.data ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Data tidak ditemukan.</p>
                  ) : (
                    <div className="space-y-3">
                      <SummaryField label="Gudang Accurate" value={snapshotDetailResp.data.accurate_warehouse_name} />
                      <SummaryField label="PIC" value={snapshotDetailResp.data.pic} />
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Rincian per Satuan</div>
                        <div className="space-y-1">
                          {snapshotDetailResp.data.units
                            .filter((u: any) => u.name)
                            .map((u: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm p-2 rounded-lg bg-gray-50 dark:bg-gray-900">
                                <span className="text-gray-600 dark:text-gray-400">{u.name}</span>
                                <span className="font-medium text-gray-900 dark:text-white">{u.quantity?.toLocaleString() ?? '-'}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                        Terakhir disinkron: {snapshotDetailResp.data.synced_at}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Stok Gudang EPD dan FG (dari Histori EJO)</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Stok kumulatif hasil sinkronisasi dari histori tahap EJO Accurate (EPD = hasil produksi
                  belum packing list, FG = setelah packing list). Klik nama produk untuk lihat rincian EJO
                  yang berkontribusi ke angka tersebut.
                </p>
              </div>
              <button
                onClick={handleSyncWarehouseStock}
                disabled={isSyncingWarehouseStock}
                className="shrink-0 px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
              >
                {isSyncingWarehouseStock ? 'Menyinkronkan...' : 'Sinkronkan Stok'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Gudang EPD</h4>
              {fetchingWarehouseStock ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Memuat...</p>
              ) : (warehouseStockResp?.data?.epd || []).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada data. Klik "Sinkronkan Stok".</p>
              ) : (
                <div className="space-y-1">
                  {warehouseStockResp.data.epd.map((row: any) => (
                    <button
                      key={row.product_id}
                      onClick={() => setStockDetailQuery({ product_id: row.product_id, location: 'epd', product_name: row.product_name })}
                      className="w-full flex items-center justify-between text-sm p-2 rounded-lg bg-gray-50 dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition"
                    >
                      <span className="text-gray-700 dark:text-gray-300">{row.product_name}</span>
                      <span className="text-gray-500 dark:text-gray-400 font-medium">{row.quantity_on_hand.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Gudang FG</h4>
              {fetchingWarehouseStock ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Memuat...</p>
              ) : (warehouseStockResp?.data?.fg || []).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada data. Klik "Sinkronkan Stok".</p>
              ) : (
                <div className="space-y-1">
                  {warehouseStockResp.data.fg.map((row: any) => (
                    <button
                      key={row.product_id}
                      onClick={() => setStockDetailQuery({ product_id: row.product_id, location: 'fg', product_name: row.product_name })}
                      className="w-full flex items-center justify-between text-sm p-2 rounded-lg bg-gray-50 dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition"
                    >
                      <span className="text-gray-700 dark:text-gray-300">{row.product_name}</span>
                      <span className="text-gray-500 dark:text-gray-400 font-medium">{row.quantity_on_hand.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(warehouseStockResp?.data?.unmatched || []).length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-300">
                    Produk Belum Tersinkron ({warehouseStockResp.data.unmatched.length})
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Nama item di Accurate ini tidak cocok persis dengan nama produk di Internal ERP, jadi stoknya
                    belum ikut ke sync. Perlu diseragamkan namanya di salah satu sistem.
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                {warehouseStockResp.data.unmatched.map((u: any, idx: number) => (
                  <div key={idx}>
                    <button
                      onClick={() => setUnmatchedItemQuery(
                        unmatchedItemQuery === u.accurate_item_name ? null : u.accurate_item_name
                      )}
                      className={`w-full flex items-center justify-between text-sm p-2 rounded-lg transition ${
                        unmatchedItemQuery === u.accurate_item_name
                          ? 'bg-blue-100 dark:bg-blue-900/40'
                          : 'bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      <span className="text-gray-700 dark:text-gray-300">{u.accurate_item_name}</span>
                      <span className="text-xs text-gray-400">
                        {u.occurrence_count}x | terakhir: {u.last_ejo_number}
                      </span>
                    </button>
                    {unmatchedItemQuery === u.accurate_item_name && (
                      <div className="mt-1 ml-3 pl-3 border-l-2 border-blue-200 dark:border-blue-800">
                        {fetchingUnmatchedSuggestions ? (
                          <p className="text-xs text-gray-400 py-2">Mencari kandidat mirip...</p>
                        ) : (unmatchedSuggestionsResp?.data || []).length === 0 ? (
                          <p className="text-xs text-gray-400 py-2">Tidak ada kandidat mirip ditemukan.</p>
                        ) : (
                          <div className="space-y-1 py-1">
                            {(unmatchedSuggestionsResp?.data || []).map((s: any) => (
                              <div
                                key={s.id}
                                className="flex items-center justify-between text-xs p-1.5 rounded bg-gray-50 dark:bg-gray-800"
                              >
                                <span className="text-gray-600 dark:text-gray-400">{s.name}</span>
                                <span className="text-gray-400">kemiripan {Math.round(s.similarity * 100)}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Detail Stok */}
          {stockDetailQuery && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setStockDetailQuery(null)}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Rincian: {stockDetailQuery.product_name} ({stockDetailQuery.location.toUpperCase()})
                  </h3>
                  <button
                    onClick={() => setStockDetailQuery(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto p-4">
                  {fetchingStockDetail ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Memuat rincian...</p>
                  ) : (
                    <>
                      <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                        Total: <span className="font-semibold text-gray-900 dark:text-white">
                          {stockDetailResp?.data?.total_quantity?.toLocaleString() ?? '-'}
                        </span> dari {stockDetailResp?.data?.entries?.length ?? 0} EJO
                      </div>
                      <div className="space-y-1">
                        {(stockDetailResp?.data?.entries || []).map((e: any, idx: number) => (
                          <div key={idx} className="text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-900 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-gray-700 dark:text-gray-300">{e.ejo_number}</span>
                              <span className="font-medium text-gray-900 dark:text-white">{e.quantity_added?.toLocaleString()}</span>
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {e.machine} | {e.operator} | {e.shift} | {e.trans_date}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryField({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`font-medium ${highlight ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
        {value ?? '-'}
      </div>
    </div>
  )
}

function MaterialTreeNode({ node, depth }: { node: any; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div className="flex items-center gap-2 text-sm py-1">
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4 rotate-90" />}
          </button>
        ) : (
          <span className="w-4 inline-block" />
        )}
        <span className={node.is_produced ? 'font-medium text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}>
          {node.name}
        </span>
        <span className="text-gray-400 text-xs">
          {node.quantity} {node.uom}
        </span>
        {node.sub_bom_number && (
          <span className="text-xs text-gray-400 font-mono">(BOM {node.sub_bom_number})</span>
        )}
        {node.warning && (
          <span className="text-xs text-amber-600 dark:text-amber-400" title={node.warning}>
            &#9888;
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child: any, idx: number) => (
            <MaterialTreeNode key={idx} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
