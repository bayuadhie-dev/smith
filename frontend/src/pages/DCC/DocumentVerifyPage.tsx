import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const DocumentVerifyPage = () => {
  const { token } = useParams()
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/dcc/verify/${token}`)
      .then(res => res.json())
      .then(data => { setResult(data); setLoading(false) })
      .catch(() => { setResult({ valid: false }); setLoading(false) })
  }, [token])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Memverifikasi dokumen...</p>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        {result?.valid ? (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-3xl">✓</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Dokumen Valid</h2>
            <p className="text-gray-500 text-sm mb-4">Dokumen ini adalah salinan terkendali yang sah</p>
            <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2 text-sm">
              <div><span className="text-gray-500">No. Dokumen:</span> <span className="font-medium">{result.document_number}</span></div>
              <div><span className="text-gray-500">Judul:</span> <span className="font-medium">{result.title}</span></div>
              <div><span className="text-gray-500">Revisi:</span> <span className="font-medium">Rev {String(result.revision_number).padStart(2, '0')}</span></div>
              <div><span className="text-gray-500">Berlaku:</span> <span className="font-medium">{result.effective_date || '-'}</span></div>
            </div>
            {result?.valid && (
              <div className="mt-4 text-left">
                <p className="text-sm font-medium text-gray-700 mb-2">Riwayat Tanda Tangan</p>
                <div className="space-y-2">
                  {result.signatures?.filter((s: any) => s.signed_at).map((s: any, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-start">
              <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">{s.role}</span>
              <p className="font-medium text-gray-900">{s.name || '-'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.method}</p>
            </div>
            <div className="text-right">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                s.status === 'approved' ? 'bg-green-100 text-green-700' :
                s.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {s.status === 'approved' ? '✓ Disetujui' : s.status === 'rejected' ? '✗ Ditolak' : '✓ Ditandatangani'}
              </span>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(s.signed_at).toLocaleString('id-ID', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-3xl">✗</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Dokumen Tidak Valid</h2>
            <p className="text-gray-500 text-sm">Token tidak ditemukan atau dokumen sudah tidak berlaku</p>
          </>
        )}
      </div>
    </div>
  )
}

export default DocumentVerifyPage