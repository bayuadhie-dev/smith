import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../../lib/axios';

/**
 * Canonical short-link target for a RecurringPaymentTransaction, reached
 * via /app/finance/recurring-payment-transactions/:txId (no master id
 * needed in the URL). Looks up the transaction's master id, then redirects
 * to the full detail route. Exists because getReferenceLink() in
 * AccountingManagement.tsx only has a transaction's own id available (not
 * its master's), so it can't build the full two-id URL directly.
 */
const RecurringPaymentTransactionRedirect: React.FC = () => {
  const { txId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(`/finance/recurring-payment-transactions/${txId}`)
      .then((res) => {
        const masterId = res.data?.recurring_payment_id;
        if (masterId) {
          navigate(`/app/finance/recurring-payments/${masterId}/transactions/${txId}`, { replace: true });
        } else {
          setError('Transaksi tidak ditemukan.');
        }
      })
      .catch(() => setError('Gagal memuat transaksi.'));
  }, [txId, navigate]);

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return <div className="p-6 text-gray-500">Memuat...</div>;
};

export default RecurringPaymentTransactionRedirect;
