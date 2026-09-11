import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';

interface FixedAssetDetailData {
  id: number;
  asset_code: string;
  asset_name: string;
  category: string;
  description: string | null;
  acquisition_date: string | null;
  acquisition_cost: number;
  depreciation_method: string;
  useful_life_years: number;
  salvage_value: number;
  accumulated_depreciation: number;
  net_book_value: number;
  annual_depreciation: number;
  location: string | null;
  responsible_person: string | null;
  status: string;
}

/**
 * Read-only detail page for a single FixedAsset - previously missing
 * (only list existed), built to fill a broken drill-down link from
 * AccountingManagement.tsx's account detail view (reference_type=
 * 'fixed_asset').
 */
const FixedAssetDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<FixedAssetDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axiosInstance
      .get(`/api/finance/fixed-assets/${id}`)
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Gagal memuat detail aset.');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Aset tidak ditemukan.'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 hover:underline">
          &larr; Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; Kembali
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {data.asset_code} - {data.asset_name}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {data.category} &middot; {data.status}
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400">Tanggal Perolehan</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {data.acquisition_date ? new Date(data.acquisition_date).toLocaleDateString('id-ID') : '-'}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Nilai Perolehan</div>
            <div className="font-medium text-gray-900 dark:text-white">
              Rp{data.acquisition_cost.toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Metode Penyusutan</div>
            <div className="font-medium text-gray-900 dark:text-white capitalize">
              {data.depreciation_method.replace('_', ' ')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Masa Manfaat</div>
            <div className="font-medium text-gray-900 dark:text-white">{data.useful_life_years} tahun</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Nilai Residu</div>
            <div className="font-medium text-gray-900 dark:text-white">
              Rp{data.salvage_value.toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Penyusutan per Tahun</div>
            <div className="font-medium text-gray-900 dark:text-white">
              Rp{data.annual_depreciation.toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Akumulasi Penyusutan</div>
            <div className="font-medium text-gray-900 dark:text-white">
              Rp{data.accumulated_depreciation.toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Nilai Buku</div>
            <div className="font-medium text-gray-900 dark:text-white">
              Rp{data.net_book_value.toLocaleString('id-ID')}
            </div>
          </div>
          {data.location && (
            <div>
              <div className="text-gray-500 dark:text-gray-400">Lokasi</div>
              <div className="font-medium text-gray-900 dark:text-white">{data.location}</div>
            </div>
          )}
          {data.responsible_person && (
            <div>
              <div className="text-gray-500 dark:text-gray-400">Penanggung Jawab</div>
              <div className="font-medium text-gray-900 dark:text-white">{data.responsible_person}</div>
            </div>
          )}
        </div>
        {data.description && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="text-gray-500 dark:text-gray-400 text-sm">Deskripsi</div>
            <div className="text-gray-900 dark:text-white text-sm">{data.description}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FixedAssetDetail;
