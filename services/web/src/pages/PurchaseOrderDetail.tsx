import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { PurchaseOrder } from '../lib/api';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  function load() {
    if (!id) return;
    api.getPurchaseOrder(id).then(setPo).catch((e) => setError(e.message));
  }

  useEffect(load, [id]);

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    setApproveError(null);
    try {
      await api.approvePurchaseOrder(id);
      load();
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setApproving(false);
    }
  }

  if (error) return <div className="px-6 py-8"><div className="bg-white rounded-xl shadow-card p-8 text-center text-rose-600 text-[13.5px]">{error}</div></div>;
  if (!po) return <div className="px-6 py-8 text-[13.5px] text-ink-400">Loading…</div>;

  const canApprove = po.status === 'open' || po.status === 'matched' || po.status === 'flagged';

  return (
    <div className="px-6 py-8 max-w-3xl">
      <Link to="/purchase-orders" className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-ink-900 mb-4">
        <ArrowLeft size={14} /> Back to purchase orders
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-ink-950">{po.supplier.name}</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">Created {new Date(po.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <span className={`text-[12px] font-medium px-3 py-1.5 rounded-lg ${
          po.status === 'matched' ? 'bg-emerald-100 text-emerald-700' :
          po.status === 'flagged' ? 'bg-amber-100 text-amber-700' :
          po.status === 'closed' ? 'bg-ink-100 text-ink-600' : 'bg-blue-100 text-blue-700'
        }`}>{po.status}</span>
      </div>

      {po.matchDetails && (
        <div className="bg-white rounded-xl shadow-card mt-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-ink-100">
            <h2 className="text-[14px] font-semibold text-ink-900">Invoice match comparison</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/50">
                <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase">Item</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase">Expected qty</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase">Invoice qty</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase">Expected price</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase">Invoice price</th>
                <th className="px-6 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase">Result</th>
              </tr>
            </thead>
            <tbody>
              {po.matchDetails.map((line, i) => (
                <tr key={i} className="border-b border-ink-50 last:border-0">
                  <td className="px-6 py-3 text-[13px] text-ink-900">{line.description}</td>
                  <td className="px-4 py-3 text-[13px] text-ink-700 text-right tabular-nums">{line.expectedQty}</td>
                  <td className={`px-4 py-3 text-[13px] text-right tabular-nums ${line.qtyMatch ? 'text-ink-700' : 'text-rose-600 font-medium'}`}>{line.extractedQty ?? '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-ink-700 text-right tabular-nums">₹{line.expectedUnitPrice}</td>
                  <td className={`px-4 py-3 text-[13px] text-right tabular-nums ${line.priceMatch ? 'text-ink-700' : 'text-rose-600 font-medium'}`}>{line.extractedUnitPrice != null ? `₹${line.extractedUnitPrice}` : '—'}</td>
                  <td className="px-6 py-3 text-right">
                    {line.qtyMatch && line.priceMatch ? (
                      <CheckCircle2 size={16} className="text-emerald-500 inline" />
                    ) : (
                      <AlertTriangle size={16} className="text-amber-500 inline" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-card mt-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-ink-100">
          <h2 className="text-[14px] font-semibold text-ink-900">Expected items</h2>
        </div>
        <div className="divide-y divide-ink-50">
          {po.items.map((item) => (
            <div key={item.id} className="px-6 py-3.5 flex items-center justify-between">
              <span className="text-[13.5px] text-ink-900">{item.product.name}</span>
              <span className="text-[13px] text-ink-500">Qty {item.expectedQty} · ₹{item.expectedUnitPrice} each</span>
            </div>
          ))}
        </div>
      </div>

      {approveError && (
        <div className="mt-4 px-4 py-3 rounded-lg bg-rose-50 text-rose-600 text-[13px]">{approveError}</div>
      )}

      {canApprove && po.status !== 'closed' && (
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleApprove}
            disabled={approving}
            className="px-4 py-2.5 rounded-lg bg-ink-950 text-white text-[13.5px] font-medium hover:bg-ink-800 transition-colors disabled:opacity-50"
          >
            {approving ? 'Approving…' : 'Approve & update stock'}
          </button>
          {po.status === 'flagged' && (
            <p className="text-[12.5px] text-amber-600">This PO has mismatches — review carefully before approving.</p>
          )}
        </div>
      )}

      {po.status === 'closed' && (
        <div className="mt-6 flex items-center gap-2 text-[13px] text-ink-500">
          <XCircle size={15} /> This purchase order is closed — stock has already been updated.
        </div>
      )}
    </div>
  );
}
