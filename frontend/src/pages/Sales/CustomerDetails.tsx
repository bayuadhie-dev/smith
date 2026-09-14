import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  useGetCustomerQuery,
  useGetCustomerMaterialInfoQuery,
  useCreateCustomerMaterialInfoMutation,
  useUpdateCustomerMaterialInfoMutation,
  useDeleteCustomerMaterialInfoMutation,
  useGetProductsQuery,
  useGetPricingConditionsQuery,
  useCreatePricingConditionMutation,
  useDeletePricingConditionMutation,
} from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';
import { TrashIcon } from '@heroicons/react/24/outline';
import {
  ArrowLeftIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  CreditCardIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  MapPinIcon,
  PencilIcon
,
  PhoneIcon,
  UserIcon
} from '@heroicons/react/24/outline';
const CustomerDetails: React.FC = () => {
  const { t } = useLanguage();

  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading, error } = useGetCustomerQuery(id!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Loading customer details...</span>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <UserIcon className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Customer Not Found</h3>
        <p className="text-gray-500 mb-4">The customer you're looking for doesn't exist.</p>
        <Link
          to="/app/sales/customers"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/app/sales/customers"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-200"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Customers
          </Link>
        </div>
        <Link
          to={`/app/sales/customers/${id}/edit`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <PencilIcon className="h-4 w-4 mr-2" />
          Edit Customer
        </Link>
      </div>

      {/* Customer Info Card */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <UserIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{customer.name}</h1>
              <p className="text-sm text-gray-500">Customer ID: {customer.customer_number || customer.id}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Contact Information</h3>
              
              {customer.email && (
                <div className="flex items-center">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Email</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{customer.email}</p>
                  </div>
                </div>
              )}

              {customer.phone && (
                <div className="flex items-center">
                  <PhoneIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Phone</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{customer.phone}</p>
                  </div>
                </div>
              )}

              {customer.address && (
                <div className="flex items-start">
                  <MapPinIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Address</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{customer.address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Company Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Company Information</h3>
              
              {customer.company && (
                <div className="flex items-center">
                  <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Company</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{customer.company}</p>
                  </div>
                </div>
              )}

              {customer.job_title && (
                <div className="flex items-center">
                  <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Job Title</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{customer.job_title}</p>
                  </div>
                </div>
              )}

              {customer.industry && (
                <div className="flex items-center">
                  <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Industry</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{customer.industry}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Account Information</h3>
              
              <div className="flex items-center">
                <div className={`h-3 w-3 rounded-full mr-3 ${
                  customer.status === 'active' ? 'bg-green-400' : 'bg-red-400'
                }`}></div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t('common.status')}</p>
                  <p className={`text-sm capitalize ${
                    customer.status === 'active' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {customer.status || 'Active'}
                  </p>
                </div>
              </div>

              {customer.credit_limit && (
                <div className="flex items-center">
                  <CreditCardIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Credit Limit</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Rp {customer.credit_limit.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              )}

              {customer.created_at && (
                <div className="flex items-center">
                  <CalendarIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Created</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {new Date(customer.created_at).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      {(customer.billing_address || customer.shipping_address || customer.notes) && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Additional Information</h2>
          </div>
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {customer.billing_address && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Billing Address</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{customer.billing_address}</p>
                </div>
              )}

              {customer.shipping_address && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Shipping Address</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{customer.shipping_address}</p>
                </div>
              )}

              {customer.notes && (
                <div className="md:col-span-2">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Notes</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{customer.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer-Material Info Record (SAP SD concept, 2026-09-14) - harga khusus,
          MOQ, dan lead time per produk untuk customer ini. Dipakai sebagai basis harga
          di Pricing Procedure (utils/pricing_procedure.py) saat entry Sales Order. */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Harga & Info Khusus Produk</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kode barang, harga khusus, MOQ, dan lead time customer ini per produk.</p>
        </div>
        <div className="px-6 py-6">
          <CustomerMaterialInfoManager customerId={parseInt(id!)} />
        </div>
      </div>

      {/* Pricing Procedure conditions scoped to this customer (global/product-scoped
          conditions are managed via the backend CRUD only for now - see
          routes/sales.py::get_pricing_conditions). */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Kondisi Harga Khusus (Diskon/Surcharge)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Berlaku untuk semua produk yang dibeli customer ini, digabung dengan kondisi umum yang aktif.</p>
        </div>
        <div className="px-6 py-6">
          <PricingConditionsManager customerId={parseInt(id!)} />
        </div>
      </div>
    </div>
  );
};

function PricingConditionsManager({ customerId }: { customerId: number }) {
  const { data, refetch } = useGetPricingConditionsQuery({ customer_id: customerId });
  const [createCondition, { isLoading: creating }] = useCreatePricingConditionMutation();
  const [deleteCondition] = useDeletePricingConditionMutation();

  const [name, setName] = useState('');
  const [conditionType, setConditionType] = useState('discount');
  const [calcType, setCalcType] = useState('percentage');
  const [value, setValue] = useState('');

  const rows: any[] = data?.pricing_conditions || [];

  const handleAdd = async () => {
    if (!name || !value) {
      toast.error('Nama dan nilai wajib diisi');
      return;
    }
    try {
      await createCondition({
        name, condition_type: conditionType, calculation_type: calcType,
        value: Number(value), customer_id: customerId,
      }).unwrap();
      toast.success('Kondisi harga ditambahkan');
      setName('');
      setValue('');
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.error || 'Gagal menyimpan');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCondition(id).unwrap();
      toast.success('Dihapus');
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.error || 'Gagal menghapus');
    }
  };

  return (
    <div>
      {rows.length > 0 && (
        <div className="space-y-1 mb-4">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm border border-gray-200 dark:border-gray-700 rounded px-3 py-2">
              <span>
                {c.name} - {c.condition_type} {c.calculation_type === 'percentage' ? `${c.value}%` : `Rp${Number(c.value).toLocaleString('id-ID')}`}
                {c.product_name && <span className="ml-2 text-xs text-gray-500">({c.product_name} saja)</span>}
              </span>
              <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <input className="input-field w-48" placeholder="Nama kondisi" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="input-field w-32" value={conditionType} onChange={(e) => setConditionType(e.target.value)}>
          <option value="discount">Diskon</option>
          <option value="surcharge">Surcharge</option>
          <option value="tax">Pajak</option>
        </select>
        <select className="input-field w-32" value={calcType} onChange={(e) => setCalcType(e.target.value)}>
          <option value="percentage">Persen %</option>
          <option value="fixed_amount">Nominal Rp</option>
        </select>
        <input type="number" className="input-field w-28" placeholder="Nilai" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn-secondary" disabled={creating} onClick={handleAdd}>
          Tambah
        </button>
      </div>
    </div>
  );
}

function CustomerMaterialInfoManager({ customerId }: { customerId: number }) {
  const { data: infoData, refetch } = useGetCustomerMaterialInfoQuery({ customer_id: customerId });
  const { data: productsData } = useGetProductsQuery({ all: true });
  const [createInfo, { isLoading: creating }] = useCreateCustomerMaterialInfoMutation();
  const [updateInfo] = useUpdateCustomerMaterialInfoMutation();
  const [deleteInfo] = useDeleteCustomerMaterialInfoMutation();

  const [productId, setProductId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [price, setPrice] = useState('');
  const [moq, setMoq] = useState('');
  const [leadTime, setLeadTime] = useState('');

  const rows: any[] = infoData?.customer_material_info || [];
  const products: any[] = productsData?.products || productsData?.data || [];
  const productOptions = products.map((p) => ({ id: p.id, name: `${p.code} - ${p.name}` }));

  const handleAdd = async () => {
    if (!productId) {
      toast.error('Pilih produk dulu');
      return;
    }
    try {
      await createInfo({
        customer_id: customerId,
        product_id: productId,
        customer_material_code: code || undefined,
        special_price: price ? Number(price) : undefined,
        min_order_qty: moq ? Number(moq) : undefined,
        lead_time_days: leadTime ? Number(leadTime) : undefined,
      }).unwrap();
      toast.success('Info produk customer disimpan');
      setProductId(null);
      setCode('');
      setPrice('');
      setMoq('');
      setLeadTime('');
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.error || 'Gagal menyimpan');
    }
  };

  const handleDelete = async (rowId: number) => {
    try {
      await deleteInfo(rowId).unwrap();
      toast.success('Dihapus');
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.error || 'Gagal menghapus');
    }
  };

  return (
    <div>
      {rows.length > 0 && (
        <div className="space-y-1 mb-4">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border border-gray-200 dark:border-gray-700 rounded px-3 py-2">
              <div>
                <span className="font-medium">{r.product_name}</span>
                {r.customer_material_code && <span className="ml-2 text-xs text-gray-500">Kode: {r.customer_material_code}</span>}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {r.special_price != null && <>Harga: Rp{Number(r.special_price).toLocaleString('id-ID')} </>}
                  {r.min_order_qty != null && <>| MOQ: {r.min_order_qty} </>}
                  {r.lead_time_days != null && <>| Lead time: {r.lead_time_days} hari</>}
                </div>
              </div>
              <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Produk</label>
          <SearchableSelect options={productOptions} value={productId} onChange={(v) => setProductId(v === null ? null : Number(v))} placeholder="Pilih produk..." />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Kode Customer</label>
          <input className="input-field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SKU customer" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Harga Khusus</label>
          <input type="number" className="input-field" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Rp" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">MOQ</label>
          <input type="number" className="input-field" value={moq} onChange={(e) => setMoq(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end mt-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Lead Time (hari)</label>
          <input type="number" className="input-field" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
        </div>
        <button className="btn-secondary" disabled={creating} onClick={handleAdd}>
          Tambah
        </button>
      </div>
    </div>
  );
}

export default CustomerDetails;
