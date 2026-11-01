import OpenInvoicesPage from '../../components/Finance/OpenInvoicesPage'

const AccountsReceivable = () => (
  <OpenInvoicesPage
    cfg={{
      kind: 'receivable',
      title: 'Piutang Usaha',
      subtitle: 'Faktur penjualan yang belum lunas dan yang sudah lewat jatuh tempo',
      endpoint: '/api/finance/accounts-receivable',
      listKey: 'receivables',
      partyKey: 'customer_name',
      partyLabel: 'Pelanggan',
      totalLabel: 'Total piutang',
      payLabel: 'Catat penerimaan',
      payPath: '/app/finance/penerimaan-penjualan/new',
      newInvoicePath: '/app/finance/invoices/new',
      newInvoiceLabel: 'Faktur penjualan baru',
      invoicePath: (id) => `/app/finance/invoices/${id}`,
    }}
  />
)

export default AccountsReceivable
