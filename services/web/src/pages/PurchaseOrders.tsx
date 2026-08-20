import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { PurchaseOrder } from '../lib/api';
import { FileText, CheckCircle2, AlertTriangle, Clock, XCircle, Upload, Loader2 } from 'lucide-react';

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  open: { bg: 'bg-blue-50', text: 'text-blue-600', icon: Clock, label: 'Open' },
  matched: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: CheckCircle2, label: 'Matched' },
  flagged: { bg: 'bg-amber-50', text: 'text-amber-600', icon: AlertTriangle, label: 'Needs review' },
  closed: { bg: 'bg-ink-100', text: 'text-ink-500', icon: XCircle, label: 'Closed' },
};

interface UploadResult {
  purchaseOrderId: string;
  poNumber: string;
  vendorName: string | null;
  status: string;
}

export default function PurchaseOrders() {
  const [pos, setPos] = useState<PurchaseOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    api.getPurchaseOrders().then(setPos).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const result = await api.uploadInvoice(file);
      setUploadResult(result);
      load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to process invoice');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (error) {
    return <div className="px-6 py-8"><div className="bg-white rounded-xl shadow-card p-8 text-center text-rose-600 text-[13.5px]">{error}</div></div>;
  }

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-ink-950">Purchase Orders</h1>
          <p className="text-[13.5px] text-ink-500 mt-0.5">{pos ? `${pos.length} purchase orders` : 'Loading…'}</p>
        </div>
        <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-ink-950 text-white text-[13.5px] font-medium hover:bg-ink-800 transition-colors cursor-pointer">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? 'Processing invoice…' : 'Upload invoice'}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFileSelected}
            disabled={uploading}
          />
        </label>
      </div>

      {uploadError && (
        <div className="mt-4 px-5 py-3.5 rounded-xl bg-rose-50 text-rose-700 text-[13.5px]">
          {uploadError}
        </div>
      )}

      {uploadResult && (
        <Link
          to={`/purchase-orders/${uploadResult.purchaseOrderId}`}
          className={`mt-4 flex items-center justify-between px-5 py-4 rounded-xl border transition-colors ${
            uploadResult.status === 'matched'
              ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100'
              : 'bg-amber-50 border-amber-100 hover:bg-amber-100'
          }`}
        >
          <div className="flex items-center gap-3">
            {uploadResult.status === 'matched' ? (
              <CheckCircle2 size={20} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={20} className="text-amber-600" />
            )}
            <div>
              <p className="text-[13.5px] font-medium text-ink-900">
                {uploadResult.poNumber} — {uploadResult.vendorName ?? 'Unknown vendor'}
              </p>
              <p className="text-[12.5px] text-ink-500 mt-0.5">
                {uploadResult.status === 'matched'
                  ? 'Automatically matched — click to view details'
                  : 'Needs review — click to see what didn\u2019t match'}
              </p>
            </div>
          </div>
        </Link>
      )}

      <div className="bg-white rounded-xl shadow-card overflow-hidden mt-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink-100">
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Supplier</th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Items</th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Created</th>
              <th className="px-6 py-3 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {!pos && Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b border-ink-50"><td className="px-6 py-4" colSpan={4}><div className="h-4 bg-ink-100 rounded animate-pulse" /></td></tr>
            ))}
            {pos?.map((po) => {
              const s = STATUS_STYLE[po.status] ?? STATUS_STYLE.open;
              const Icon = s.icon;
              return (
                <tr key={po.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/60 transition-colors">
                  <td className="px-6 py-3.5">
                    <Link to={`/purchase-orders/${po.id}`} className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                        <FileText size={14} className="text-violet-600" />
                      </div>
                      <span className="text-[13.5px] font-medium text-ink-900 hover:underline">{po.supplier.name}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-[13.5px] text-ink-700">{po.items.length} item{po.items.length !== 1 ? 's' : ''}</td>
                  <td className="px-6 py-3.5 text-[12.5px] text-ink-500">{new Date(po.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-lg ${s.bg} ${s.text}`}>
                      <Icon size={12} /> {s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {pos?.length === 0 && (
              <tr><td className="px-6 py-10 text-center text-[13.5px] text-ink-400" colSpan={4}>No purchase orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
