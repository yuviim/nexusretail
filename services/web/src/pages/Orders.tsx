import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Order } from '../lib/api';
import { PageHeader, Card, Skeleton, ErrorState, StatusBadge } from '../components/ui';

export default function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getOrders().then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-8"><ErrorState message={error} /></div>;

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader title="Orders" subtitle={orders ? `${orders.length} orders` : undefined} />

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
          </tbody>
        </table>
      </Card>
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
