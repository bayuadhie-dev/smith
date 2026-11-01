import OpenInvoicesPage from '../../components/Finance/OpenInvoicesPage'

const AccountsPayable = () => (
  <OpenInvoicesPage
    cfg={{
      kind: 'payable',
      title: 'Utang Usaha',
      subtitle: 'Faktur pembelian yang belum lunas dan yang sudah lewat jatuh tempo',
      endpoint: '/api/finance/accounts-payable',
      listKey: 'payables',
      partyKey: 'supplier_name',
      partyLabel: 'Pemasok',
      totalLabel: 'Total utang',
      payLabel: 'Catat pembayaran',
      payPath: '/app/finance/pembayaran-pembelian/new',
      newInvoicePath: '/app/purchasing/invoices/new',
      newInvoiceLabel: 'Faktur pembelian baru',
      invoicePath: (id) => `/app/purchasing/invoices/${id}`,
    }}
  />
)

export default AccountsPayable
