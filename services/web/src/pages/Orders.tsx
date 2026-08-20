import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Order, Customer, Product } from '../lib/api';
import { PageHeader, Card, Skeleton, ErrorState, StatusBadge } from '../components/ui';
import { Plus, X, Trash2 } from 'lucide-react';

export default function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    api.getOrders().then(setOrders).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  if (error) return <div className="p-8"><ErrorState message={error} /></div>;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <PageHeader title="Orders" subtitle={orders ? `${orders.length} orders` : undefined} />
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ink-950 text-white text-[13.5px] font-medium hover:bg-ink-800 transition-colors"
        >
          <Plus size={15} /> New order
        </button>
      </div>

      <Card>
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink-100">
              <Th>Customer</Th>
              <Th>Items</Th>
              <Th align="right">Total</Th>
              <Th>Placed</Th>
              <Th align="right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {!orders &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-ink-50">
                  <td className="px-6 py-4" colSpan={5}><Skeleton className="h-4 w-full" /></td>
                </tr>
              ))}
            {orders?.map((o) => {
              const total = o.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
              return (
                <tr
                  key={o.id}
                  className="border-b border-ink-50 last:border-0 hover:bg-ink-50 transition-colors cursor-pointer"
                >
                  <td className="px-0 py-0">
                    <Link to={`/orders/${o.id}`} className="block px-6 py-3.5 text-[13.5px] font-medium text-ink-900">
                      {o.customer.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-[13.5px] text-ink-600">
                    {o.items.length} item{o.items.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-3.5 text-[13.5px] text-ink-900 text-right tabular-nums font-medium">
                    ${total.toFixed(2)}
                  </td>
                  <td className="px-6 py-3.5 text-[13px] text-ink-500">
                    {new Date(o.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              );
            })}
            {orders?.length === 0 && (
              <tr><td className="px-6 py-10 text-center text-[13.5px] text-ink-400" colSpan={5}>No orders yet</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {showCreate && (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-6 py-3 text-[11.5px] font-semibold text-ink-500 uppercase tracking-wide text-${align}`}>
      {children}
    </th>
  );
}

interface LineItem {
  productId: string;
  quantity: number;
}

function CreateOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ productId: '', quantity: 1 }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.getCustomers(), api.getProducts()]).then(([c, p]) => {
      setCustomers(c);
      setProducts(p);
      if (c[0]) setCustomerId(c[0].id);
    });
  }, []);

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, [field]: value } : li)));
  }

  function addLine() {
    setLineItems((prev) => [...prev, { productId: '', quantity: 1 }]);
  }

  function removeLine(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validLines = lineItems.filter((li) => li.productId && li.quantity > 0);
    if (!customerId || validLines.length === 0) {
      setError('Select a customer and at least one product with a quantity');
      return;
    }

    setLoading(true);
    try {
      await api.createOrder(customerId, validLines);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-950/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-card w-full max-w-xl p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-ink-900">New order</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12.5px] font-medium text-ink-700 mb-1">Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input">
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-ink-700 mb-2">Items</label>
            <div className="space-y-2.5">
              {lineItems.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(i, 'productId', e.target.value)}
                      className="input !w-full"
                    >
                      <option value="">Select product…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} — ${p.unitPrice}</option>)}
                    </select>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, 'quantity', parseInt(e.target.value, 10) || 1)}
                    className="input !w-16 flex-shrink-0 text-right"
                  />
                  {lineItems.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="text-ink-300 hover:text-rose-500 flex-shrink-0">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLine}
              className="mt-2.5 text-[12.5px] font-medium text-blue-600 hover:underline"
            >
              + Add another item
            </button>
          </div>

          {error && <div className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 text-[12.5px]">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-ink-200 text-ink-700 text-[13.5px] font-medium hover:bg-ink-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-ink-950 text-white text-[13.5px] font-medium hover:bg-ink-800 disabled:opacity-50">
              {loading ? 'Creating…' : 'Create order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
