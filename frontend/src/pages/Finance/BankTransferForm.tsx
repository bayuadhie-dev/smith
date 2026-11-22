import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import SearchableSelect from '../../components/SearchableSelect'
import NumberInput from '../../components/ui/NumberInput'

interface CashAccount { id: number; code: string; name: string; currency: string; balance: number }
interface ExpenseAccount { id: number; code: string; name: string }
interface PettyFund { id: number; code: string; name: string; cash_account_id: number; open_request_id: number | null; open_request_amount: number | null; open_request_number: string | null }

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const money = (n: number, ccy = 'IDR') =>
  `${ccy === 'IDR' ? 'Rp' : ccy} ${Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}`

export default function BankTransferForm() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [expenses, setExpenses] = useState<ExpenseAccount[]>([])
  const [pettyFunds, setPettyFunds] = useState<PettyFund[]>([])
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    transfer_date: today(),
    from_account_id: null as number | string | null,
    to_account_id: null as number | string | null,
    amount: '',
    amount_received: '',
    exchange_rate: '',
    exchange_rate_to: '',
    fee_amount: '',
    fee_account_id: null as number | string | null,
    fee_charged_to: 'from' as 'from' | 'to',
    reference_number: '',
    notes: '',
    petty_cash_fund_id: '' as string,
  })
  const set = (k: keyof typeof f, v: any) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    axiosInstance.get('/api/finance/bank-transfers/accounts')
      .then((r) => setAccounts(r.data?.accounts || []))
      .catch(() => toast.error('Gagal memuat akun kas/bank'))
    axiosInstance.get('/api/finance/bank-transfers/expense-accounts')
      .then((r) => setExpenses(r.data?.accounts || []))
      .catch(() => undefined)
    axiosInstance.get('/api/finance/bank-transfers/petty-cash-funds')
      .then((r) => setPettyFunds(r.data?.funds || []))
      .catch(() => undefined)
  }, [])

  const from = accounts.find((a) => a.id === Number(f.from_account_id))
  const to = accounts.find((a) => a.id === Number(f.to_account_id))
  const bedaMataUang = !!from && !!to && from.currency !== to.currency
  const amount = Number(f.amount) || 0
  const fee = Number(f.fee_amount) || 0
  const diterima = bedaMataUang ? Number(f.amount_received) || 0 : amount

  const saldoSesudah = useMemo(() => {
    if (!from || !to) return null
    const keluar = amount + (f.fee_charged_to === 'from' ? fee : 0)
    const masuk = diterima - (f.fee_charged_to === 'to' ? fee : 0)
    return { from: Number(from.balance || 0) - keluar, to: Number(to.balance || 0) + masuk }
  }, [from, to, amount, fee, f.fee_charged_to, diterima])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.from_account_id || !f.to_account_id) { toast.error('Pilih akun asal dan akun tujuan'); return }
    if (f.from_account_id === f.to_account_id) { toast.error('Akun asal dan tujuan tidak boleh sama'); return }
    if (amount <= 0) { toast.error('Isi nilai transfer'); return }
    if (bedaMataUang && diterima <= 0) { toast.error('Isi nilai yang diterima di akun tujuan'); return }
    if (fee > 0 && !f.fee_account_id) { toast.error('Pilih akun beban untuk biaya transfer'); return }
    setSaving(true)
    try {
      const res = await axiosInstance.post('/api/finance/bank-transfers', {
        transfer_date: f.transfer_date,
        from_account_id: Number(f.from_account_id),
        to_account_id: Number(f.to_account_id),
        amount,
        amount_received: bedaMataUang ? diterima : undefined,
        exchange_rate: f.exchange_rate ? Number(f.exchange_rate) : undefined,
        exchange_rate_to: f.exchange_rate_to ? Number(f.exchange_rate_to) : undefined,
        fee_amount: fee || undefined,
        fee_account_id: fee > 0 ? Number(f.fee_account_id) : undefined,
        fee_charged_to: f.fee_charged_to,
        reference_number: f.reference_number || undefined,
        notes: f.notes || undefined,
        petty_cash_fund_id: f.petty_cash_fund_id ? Number(f.petty_cash_fund_id) : undefined,
      })
      toast.success(`Transfer ${res.data?.number} tersimpan, jurnalnya terbentuk otomatis`)
      navigate('/app/finance/bank-transfers')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan transfer')
    } finally {
      setSaving(false)
    }
  }

  const accOptions = accounts.map((a) => ({ id: a.id, code: a.code, name: `${a.name} (${a.currency})` }))

  return (
    <div className="p-4 space-y-6 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white sm:text-[28px] tracking-tight leading-tight">
          <ArrowsRightLeftIcon className="h-6 w-6" aria-hidden="true" />
          Transfer Kas/Bank Baru
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Pindah dana antar rekening sendiri, misalnya Bank BCA ke Kas Purbalingga. Jurnalnya dibuat otomatis.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="card grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Tanggal *</label>
            <input type="date" className="input-field" value={f.transfer_date} onChange={(e) => set('transfer_date', e.target.value)} required />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">No. Bukti Transfer</label>
            <input className="input-field" value={f.reference_number} onChange={(e) => set('reference_number', e.target.value)} placeholder="Opsional, mis. no. referensi m-banking" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Dari Kas/Bank *</label>
            <SearchableSelect options={accOptions} value={f.from_account_id} onChange={(v) => set('from_account_id', v)} placeholder="Pilih akun asal" required />
            {from && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Saldo sekarang {money(from.balance, from.currency)}</p>}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Ke Kas/Bank *</label>
            <SearchableSelect options={accOptions} value={f.to_account_id} onChange={(v) => set('to_account_id', v)} placeholder="Pilih akun tujuan" required />
            {to && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Saldo sekarang {money(to.balance, to.currency)}</p>}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Nilai Transfer * {from ? `(${from.currency})` : ''}</label>
            <NumberInput currency className="input-field" value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0" required />
          </div>
          {bedaMataUang && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium">Nilai Diterima * ({to?.currency})</label>
                <NumberInput currency className="input-field" value={f.amount_received} onChange={(e) => set('amount_received', e.target.value)} placeholder="0" />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Mata uang kedua akun berbeda, jadi nilai masuk diisi sendiri.</p>
              </div>
              {from?.currency !== 'IDR' && (
                <div>
                  <label className="mb-2 block text-sm font-medium">Kurs {from?.currency} ke IDR</label>
                  <NumberInput className="input-field" value={f.exchange_rate} onChange={(e) => set('exchange_rate', e.target.value)} placeholder="Kosongkan untuk kurs tersimpan" />
                </div>
              )}
              {to?.currency !== 'IDR' && (
                <div>
                  <label className="mb-2 block text-sm font-medium">Kurs {to?.currency} ke IDR</label>
                  <NumberInput className="input-field" value={f.exchange_rate_to} onChange={(e) => set('exchange_rate_to', e.target.value)} placeholder="Kosongkan untuk kurs tersimpan" />
                </div>
              )}
            </>
          )}
          {pettyFunds.length > 0 && (
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Untuk pengisian kas kecil (opsional)</label>
              <select
                className="input-field"
                value={f.petty_cash_fund_id}
                onChange={(e) => {
                  const val = e.target.value
                  const pf = pettyFunds.find((x) => String(x.id) === val)
                  setF((p) => ({
                    ...p,
                    petty_cash_fund_id: val,
                    to_account_id: pf ? pf.cash_account_id : p.to_account_id,
                    amount: pf?.open_request_amount ? String(pf.open_request_amount) : p.amount,
                    notes: pf && !p.notes ? `Pengisian ${pf.name}` : p.notes,
                  }))
                }}
              >
                <option value="">Bukan pengisian kas kecil</option>
                {pettyFunds.map((pf) => (
                  <option key={pf.id} value={pf.id}>
                    {pf.name}{pf.open_request_number ? ` - ada permintaan ${pf.open_request_number} ${money(pf.open_request_amount || 0)}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Kalau dipilih, akun tujuan mengikuti akun kas kecilnya dan permintaan pengisian yang terbuka otomatis ditandai sudah diterima.
              </p>
            </div>
          )}
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Keterangan</label>
            <textarea className="input-field" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Untuk apa dana ini dipindahkan?" />
          </div>
        </div>

        <div className="card space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Biaya Transfer</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Biaya admin bank, kalau ada. Kosongkan kalau tidak ada biaya.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium">Nilai Biaya</label>
              <NumberInput currency className="input-field" value={f.fee_amount} onChange={(e) => set('fee_amount', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Akun Beban {fee > 0 && '*'}</label>
              <SearchableSelect options={expenses.map((a) => ({ id: a.id, code: a.code, name: a.name }))} value={f.fee_account_id} onChange={(v) => set('fee_account_id', v)} placeholder="Mis. Biaya Administrasi Bank" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Dibebankan ke</label>
              <select className="input-field" value={f.fee_charged_to} onChange={(e) => set('fee_charged_to', e.target.value as 'from' | 'to')}>
                <option value="from">Saldo pengirim{from ? ` (${from.name})` : ''}</option>
                <option value="to">Saldo penerima{to ? ` (${to.name})` : ''}</option>
              </select>
            </div>
          </div>
        </div>

        {from && to && amount > 0 && (
          <div className="card p-4 sm:p-6">
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">Jurnal yang akan terbentuk</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2">Akun</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Kredit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-3 py-2">{to.code} {to.name}</td>
                    <td className="px-3 py-2 text-right">{money(diterima, to.currency)}</td>
                    <td className="px-3 py-2 text-right">-</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">{from.code} {from.name}</td>
                    <td className="px-3 py-2 text-right">-</td>
                    <td className="px-3 py-2 text-right">{money(amount, from.currency)}</td>
                  </tr>
                  {fee > 0 && (
                    <>
                      <tr>
                        <td className="px-3 py-2">{expenses.find((a) => a.id === Number(f.fee_account_id))?.name || 'Akun beban biaya transfer'}</td>
                        <td className="px-3 py-2 text-right">{money(fee)}</td>
                        <td className="px-3 py-2 text-right">-</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">{f.fee_charged_to === 'from' ? `${from.code} ${from.name}` : `${to.code} ${to.name}`}</td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right">{money(fee)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
            {saldoSesudah && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                Perkiraan saldo sesudahnya: {from.name} {money(saldoSesudah.from, from.currency)}, {to.name} {money(saldoSesudah.to, to.currency)}.
              </p>
            )}
            {bedaMataUang && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Selisih nilai rupiah antara dana keluar dan dana masuk otomatis masuk akun selisih kurs.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan Transfer'}
          </button>
          <button type="button" onClick={() => navigate('/app/finance/bank-transfers')} className="btn-secondary">Batal</button>
        </div>
      </form>
    </div>
  )
}
