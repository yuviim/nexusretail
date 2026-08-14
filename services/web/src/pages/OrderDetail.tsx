import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Order } from '../lib/api';
import { Card, Skeleton, ErrorState, StatusBadge } from '../components/ui';

const STEPS = ['placed', 'stock_reserved', 'payment', 'fulfilled'] as const;
const STEP_LABELS: Record<string, string> = {
  placed: 'Placed',
  stock_reserved: 'Stock reserved',
  payment: 'Payment',
  fulfilled: 'Fulfilled',
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id) api.getOrder(id).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  async function advanceStatus() {
    if (!order) return;
    const idx = STEPS.indexOf(order.status as typeof STEPS[number]);
    const next = STEPS[idx + 1];
    if (!next) return;

    setUpdating(true);
    try {
      const updated = await api.updateOrderStatus(order.id, next);
      setOrder({ ...order, status: updated.status });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setUpdating(false);
    }
  }

  if (error) return <div className="p-8"><ErrorState message={error} /></div>;
  if (!order) {
    return (
      <div className="p-8 max-w-3xl">
        <Skeleton className="h-6 w-48 mb-4" />
        <Card className="p-6"><Skeleton className="h-32 w-full" /></Card>
      </div>
    );
  }

  const currentIdx = STEPS.indexOf(order.status as typeof STEPS[number]);
  const total = order.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  const isFinal = order.status === 'fulfilled';

  return (
    <div className="p-8 max-w-3xl">
      <Link to="/orders" className="text-[13px] text-ink-500 hover:text-ink-900 transition-colors mb-4 inline-flex items-center gap-1">
        ← Back to orders
      </Link>

      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <h1 className="text-[19px] font-semibold text-ink-900 tracking-tight">{order.customer.name}</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">
            Placed {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <Card className="p-6 mb-5">
        <div className="flex items-center">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors ${
                    i <= currentIdx ? 'bg-emerald-500 text-white' : 'bg-ink-100 text-ink-400'
                  }`}
                >
                  {i < currentIdx ? '✓' : i + 1}
                </div>
                <span className={`text-[11.5px] mt-1.5 font-medium ${i <= currentIdx ? 'text-ink-900' : 'text-ink-400'}`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-[2px] mx-2 rounded-full ${i < currentIdx ? 'bg-emerald-500' : 'bg-ink-100'}`} />
              )}
            </div>
          ))}
        </div>

        {!isFinal && (
          <button
            onClick={advanceStatus}
            disabled={updating}
            className="mt-6 px-4 py-2 rounded-lg bg-ink-950 text-white text-[13.5px] font-medium hover:bg-ink-800 transition-colors disabled:opacity-50"
          >
            {updating ? 'Updating…' : `Advance to "${STEP_LABELS[STEPS[currentIdx + 1]]}"`}
          </button>
        )}
      </Card>

      <Card>
        <div className="px-6 py-4 border-b border-ink-100">
          <h2 className="text-[14px] font-semibold text-ink-900">Items</h2>
        </div>
        <div className="divide-y divide-ink-100">
          {order.items.map((item) => (
            <div key={item.id} className="px-6 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-[13.5px] font-medium text-ink-900">{item.product.name}</p>
                <p className="text-[12px] text-ink-500 mt-0.5">Qty {item.quantity} × ${Number(item.unitPrice).toFixed(2)}</p>
              </div>
              <p className="text-[13.5px] font-medium text-ink-900 tabular-nums">
                ${(item.quantity * Number(item.unitPrice)).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-ink-100 flex justify-between items-center">
          <span className="text-[13.5px] font-semibold text-ink-900">Total</span>
          <span className="text-[15px] font-semibold text-ink-900 tabular-nums">${total.toFixed(2)}</span>
        </div>
      </Card>
    </div>
  );
}
