import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import toast from 'react-hot-toast';

interface EmailStatus {
  configured: boolean;
  from_email: string | null;
  provider?: string;
}

interface EmailConfig {
  provider: string;
  from_email: string;
  company_name: string;
  app_url: string;
  // Gmail specific
  gmail_address?: string;
  gmail_app_password?: string;
  // Resend specific
  resend_api_key?: string;
}

const EmailSettings: React.FC = () => {
  const { t } = useLanguage();

  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingEmail, setTestingEmail] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  
  const [config, setConfig] = useState<EmailConfig>({
    provider: 'resend',
    from_email: '',
    company_name: '',
    app_url: '',
    gmail_address: '',
    gmail_app_password: '',
    resend_api_key: ''
  });

  // Load email status
  const loadEmailStatus = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/email/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to load email status:', error);
      setStatus({ configured: false, from_email: null });
    } finally {
      setLoading(false);
    }
  };

  // Load email config
  const loadEmailConfig = async () => {
    try {
      const response = await axiosInstance.get('/api/email/config');
      if (response.data?.config) {
        setConfig(prev => ({ ...prev, ...response.data.config }));
      }
    } catch (error) {
      console.error('Failed to load email config:', error);
    }
  };

  useEffect(() => {
    loadEmailStatus();
    loadEmailConfig();
  }, []);

  // Send test email
  const sendTestEmail = async () => {
    try {
      setTestingEmail(true);
      const response = await axiosInstance.post('/api/email/test');
      toast.success(response.data.message || 'Test email sent successfully!');
    } catch (error: any) {
      console.error('Failed to send test email:', error);
      toast.error(error.response?.data?.error || 'Failed to send test email');
    } finally {
      setTestingEmail(false);
    }
  };

  // Save email config
  const saveConfig = async () => {
    try {
      setSavingConfig(true);
      await axiosInstance.post('/api/email/config', config);
      toast.success('Email configuration saved successfully!');
      await loadEmailStatus();
    } catch (error: any) {
      console.error('Failed to save config:', error);
      toast.error(error.response?.data?.error || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Loading email settings...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="fn-label mb-1.5">SISTEM · EMAIL</div>
        <h1 className="text-[28px] font-semibold text-gray-900 dark:text-white mb-2 tracking-tight leading-tight">
          Pengaturan Email
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Atur email pemberitahuan yang dikirim sistem.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Status Card */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <EnvelopeIcon className="h-5 w-5 mr-2" />
              Status layanan email
            </h2>
            
            <div className={`p-4 rounded-lg ${status?.configured ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'}`}>
              <div className="flex items-center">
                {status?.configured ? (
                  <>
                    <CheckCircleIcon className="h-8 w-8 text-green-500 mr-3" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-300">Layanan email sudah diatur</p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Dikirim dari: <span className="font-mono">{status.from_email}</span>
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircleIcon className="h-8 w-8 text-yellow-500 mr-3" />
                    <div>
                      <p className="font-medium text-yellow-800 dark:text-yellow-300">Email Service Not Configured</p>
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Atur penyedia email di berkas .env backend.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Test Email Button */}
            {status?.configured && (
              <div className="mt-4">
                <button
                  onClick={sendTestEmail}
                  disabled={testingEmail}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {testingEmail ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Mengirim email uji...
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                      Kirim email uji
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Email uji dikirim ke alamat email akun kamu.
                </p>
              </div>
            )}
          </div>

          {/* Configuration Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Cog6ToothIcon className="h-5 w-5 mr-2" />
              Panduan pengaturan
            </h2>
            
            <div className="space-y-4">
              {/* Resend Setup */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Pilihan 1: Resend (disarankan)</h3>
                <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Daftar di <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">resend.com</a></li>
                  <li>Buat API key di dashboard penyedia email.</li>
                  <li>Tambahkan ke berkas <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">backend/.env</code>:</li>
                </ol>
                <pre className="mt-2 bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
COMPANY_NAME=Your Company
APP_URL=http://localhost:3000`}
                </pre>
              </div>

              {/* Gmail Setup */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Pilihan 2: Gmail SMTP</h3>
                <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Aktifkan verifikasi dua langkah di akun Google.</li>
                  <li>Buat App Password di <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">Google App Passwords</a></li>
                  <li>Tambahkan ke berkas <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">backend/.env</code>:</li>
                </ol>
                <pre className="mt-2 bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`EMAIL_PROVIDER=gmail
GMAIL_ADDRESS=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_FROM=your-email@gmail.com
COMPANY_NAME=Your Company
APP_URL=http://localhost:3000`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          {/* Email Templates Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Templat email</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Sistem sudah punya templat email untuk:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center text-gray-700 dark:text-gray-200">
                <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                Email sambutan
              </li>
              <li className="flex items-center text-gray-700 dark:text-gray-200">
                <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                Atur ulang kata sandi
              </li>
              <li className="flex items-center text-gray-700 dark:text-gray-200">
                <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                Konfirmasi pesanan
              </li>
              <li className="flex items-center text-gray-700 dark:text-gray-200">
                <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                Peringatan stok menipis
              </li>
              <li className="flex items-center text-gray-700 dark:text-gray-200">
                <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                Pemberitahuan lain
              </li>
            </ul>
          </div>

          {/* Important Notes */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-800">
            <div className="flex items-center mb-2">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 dark:text-blue-400" />
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">Yang perlu diingat</h3>
            </div>
            <ul className="text-sm text-blue-800 space-y-2 dark:text-blue-300">
              <li>• Pengaturan email ada di berkas .env backend.</li>
              <li>• Backend harus di-restart setelah .env diubah.</li>
              <li>• Untuk produksi, pakai domain terverifikasi di Resend.</li>
              <li>• Gmail punya batas kirim harian (500/hari).</li>
            </ul>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6 dark:bg-yellow-900/20 dark:border-yellow-800">
            <div className="flex items-center mb-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-2 dark:text-yellow-400" />
              <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-200">Keamanan</h3>
            </div>
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Jangan pernah menaruh API key atau kata sandi di dalam kode. Pakai variabel lingkungan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailSettings;
