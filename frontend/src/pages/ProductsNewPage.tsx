import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import {
  ChartBarIcon,
  CubeIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import ProductListNew from '../components/ProductListNew';
import ProductFormNew from '../components/ProductFormNew';
import ProductDetailNew from '../components/ProductDetailNew';
import ProductDashboardNew from '../components/ProductDashboardNew';
import { useBreadcrumbTrail } from '../components/ui/BreadcrumbTrail';
import axiosInstance from '../utils/axiosConfig';
import { showError, showSuccess } from '../components/ui';
interface ProductNew {
  id: number;
  kode_produk: string;
  nama_produk: string;
  gramasi?: number;
  cd?: number;
  md?: number;
  sheet_per_pack?: number;
  pack_per_karton?: number;
  berat_kering?: number;
  ratio?: number;
  ingredient?: number;
  ukuran_batch_vol?: number;
  ukuran_batch_ctn?: number;
  spunlace?: string;
  rayon?: number;
  polyester?: number;
  es?: number;
  slitting_cm?: number;
  lebar_mr_net_cm?: number;
  lebar_mr_gross_cm?: number;
  keterangan_slitting?: string;
  no_mesin_epd?: string;
  speed_epd_pack_menit?: number;
  meter_kain?: number;
  kg_kain?: number;
  kebutuhan_rayon_kg?: number;
  kebutuhan_polyester_kg?: number;
  kebutuhan_es_kg?: number;
  process_produksi?: string;
  kode_jumbo_roll?: string;
  nama_jumbo_roll?: string;
  kode_main_roll?: string;
  nama_main_roll?: string;
  kapasitas_mixing_kg?: number;
  actual_mixing_kg?: number;
  dosing_kg?: number;
  is_active: boolean;
  version: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

type ViewMode = 'dashboard' | 'list' | 'add' | 'edit' | 'detail';

const ProductsNewPage: React.FC = () => {
  const { t } = useLanguage();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const codeParam = searchParams.get('code');
  const viewMode: ViewMode = (['dashboard', 'list', 'add', 'edit', 'detail'] as const).find((v) => v === viewParam) || 'dashboard';
  const [selectedProduct, setSelectedProduct] = useState<ProductNew | null>(null);

  const go = (v: ViewMode, code?: string | null, replace?: boolean) => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      if (v === 'dashboard') n.delete('view'); else n.set('view', v);
      if (code) n.set('code', code); else n.delete('code');
      return n;
    }, { replace });
  };

  const listCrumb = { label: 'Daftar Produk', search: '?view=list' };
  useBreadcrumbTrail(
    viewMode === 'dashboard' ? []
      : viewMode === 'list' ? [{ label: 'Daftar Produk' }]
      : viewMode === 'add' ? [listCrumb, { label: 'Tambah Produk' }]
      : viewMode === 'edit' ? [listCrumb, { label: codeParam ? `Edit ${codeParam}` : 'Edit Produk' }]
      : [listCrumb, { label: codeParam || 'Detail Produk' }]
  );

  // Handle URL params for direct navigation to detail view
  useEffect(() => {
    if ((viewMode === 'detail' || viewMode === 'edit') && codeParam && selectedProduct?.kode_produk !== codeParam) {
      axiosInstance.get(`/api/products-new/kode/${codeParam}`)
        .then(res => {
          setSelectedProduct(res.data.product);
        })
        .catch(err => {
          console.error('Error loading product:', err);
          go('list', null, true);
        });
    }
  }, [viewMode, codeParam]);

  const handleSaveProduct = async (productData: ProductNew) => {
    try {
      const url = productData.id 
        ? `/api/products-excel/${productData.kode_produk}`
        : '/api/products-excel';
      
      const method = productData.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      if (response.ok) {
        const data = await response.json();
        showSuccess(productData.id ? 'Produk berhasil diperbarui!' : 'Produk berhasil ditambahkan!');
        go('list');
        setSelectedProduct(null);
      } else {
        const error = await response.json();
        showError('Gagal menyimpan produk: ' + error.error);
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Terjadi kesalahan saat menyimpan produk');
    }
  };

  const handleEditProduct = (product: ProductNew) => {
    setSelectedProduct(product);
    go('edit', product.kode_produk);
  };

  const handleViewProduct = (product: ProductNew) => {
    setSelectedProduct(product);
    go('detail', product.kode_produk);
  };

  const handleAddProduct = () => {
    setSelectedProduct(null);
    go('add');
  };

  const handleCancel = () => {
    setSelectedProduct(null);
    go('dashboard');
  };

  const handleBackToList = () => {
    setSelectedProduct(null);
    go('list');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <h1 className="sr-only">Produk</h1>
      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => go('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                viewMode === 'dashboard'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <ChartBarIcon className="w-4 h-4" />
              <span>{t('navigation.dashboard')}</span>
            </button>
            <button
              onClick={() => go('list')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                viewMode === 'list'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <CubeIcon className="w-4 h-4" />
              <span>Daftar Produk</span>
            </button>
            <button
              onClick={handleAddProduct}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                viewMode === 'add'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <PlusIcon className="w-4 h-4" />
              <span>Tambah Produk</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === 'dashboard' && (
          <ProductDashboardNew />
        )}

        {viewMode === 'list' && (
          <ProductListNew
            onEdit={handleEditProduct}
            onView={handleViewProduct}
            onAdd={handleAddProduct}
          />
        )}

        {viewMode === 'add' && (
          <ProductFormNew
            onSave={handleSaveProduct}
            onCancel={handleCancel}
          />
        )}

        {viewMode === 'edit' && selectedProduct && (
          <ProductFormNew
            product={selectedProduct}
            onSave={handleSaveProduct}
            onCancel={handleCancel}
          />
        )}

        {viewMode === 'detail' && selectedProduct && (
          <ProductDetailNew
            productId={selectedProduct.kode_produk}
            onEdit={handleEditProduct}
            onBack={handleBackToList}
          />
        )}
      </div>
    </div>
  );
};

export default ProductsNewPage;
