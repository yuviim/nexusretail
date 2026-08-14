import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Product, Order } from '../lib/api';
import { PageHeader, Card, Skeleton, ErrorState, StatusBadge } from '../components/ui';

export default function Dashboard() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getProducts(), api.getOrders()])
      .then(([p, o]) => {
        setProducts(p);
        setOrders(o);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-8"><ErrorState message={error} /></div>;

  const loading = !products || !orders;
  const lowStockCount = products?.filter((p) =>
    p.stockLevels.some((s) => s.quantityOnHand <= p.reorderPoint)
  ).length ?? 0;
  const totalRevenue = orders
    ?.filter((o) => o.status === 'fulfilled')
    .reduce((sum, o) => sum + o.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0), 0);

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader title="Dashboard" subtitle="Northwind Distributors overview" />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total revenue" value={loading ? null : `$${totalRevenue?.toFixed(2)}`} />
        <StatCard label="Orders" value={loading ? null : String(orders!.length)} />
        <StatCard label="Products" value={loading ? null : String(products!.length)} />
        <StatCard
          label="Low stock alerts"
          value={loading ? null : String(lowStockCount)}
          accent={lowStockCount > 0 ? 'amber' : undefined}
        />
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-ink-100">
          <h2 className="text-[14px] font-semibold text-ink-900">Recent orders</h2>
        </div>
        <div className="divide-y divide-ink-100">
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          {!loading &&
            orders!.slice(0, 5).map((o) => (
              <div key={o.id} className="px-6 py-4 flex items-center justify-between hover:bg-ink-50 transition-colors">
                <div>
                  <p className="text-[13.5px] font-medium text-ink-900">{o.customer.name}</p>
                  <p className="text-[12px] text-ink-500 mt-0.5">
                    {o.items.length} item{o.items.length !== 1 ? 's' : ''} · {new Date(o.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | null; accent?: 'amber' }) {
  return (
    <Card className="p-5">
      <p className="text-[12.5px] text-ink-500 font-medium">{label}</p>
      {value === null ? (
        <div className="h-7 w-16 mt-1.5 animate-pulse bg-ink-100 rounded-md" />
      ) : (
        <p className={`text-[24px] font-semibold mt-1 tracking-tight ${accent === 'amber' ? 'text-amber-600' : 'text-ink-900'}`}>
          {value}
        </p>
      )}
    </Card>
  );
}
