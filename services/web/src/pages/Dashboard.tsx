import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Product, Order } from '../lib/api';
import { Search, Package, AlertTriangle, ShoppingCart, ChevronRight, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function load() {
    setError(null);
    Promise.all([api.getProducts(), api.getOrders()])
      .then(([p, o]) => {
        setProducts(p);
        setOrders(o);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  const loading = !products || !orders;
  const lowStockCount = products?.filter((p) => p.stockLevels.some((s) => s.quantityOnHand <= p.reorderPoint)).length ?? 0;
  const revenue = orders?.filter((o) => o.status === 'fulfilled')
    .reduce((sum, o) => sum + o.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0), 0) ?? 0;

  return (
    <div className="px-6 py-8">
      <h1 className="text-[26px] font-bold text-ink-950">Good afternoon, Owner</h1>
      <p className="text-[14px] text-ink-500 mt-1">Here's what's happening at Northwind Distributors today.</p>

      {error && (
        <div className="mt-6 flex items-center justify-between bg-rose-50 border border-rose-100 rounded-xl px-5 py-3.5">
          <div className="flex items-center gap-2.5 text-rose-600 text-[13.5px]">
            <AlertTriangle size={16} />
            {error}
          </div>
          <button onClick={load} className="text-[12.5px] font-medium border border-rose-200 text-rose-600 rounded-lg px-3 py-1.5 hover:bg-rose-100 transition-colors">
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mt-6">
        <TopCard
          barColor="bg-blue-500"
          icon={<Search size={20} className="text-blue-600" />}
          iconBg="bg-blue-50"
          badge="Live"
          badgeColor="bg-blue-50 text-blue-600"
          value={loading ? null : String(products!.length)}
          label="Products tracked"
          sub="Across all warehouses"
        />
        <TopCard
          barColor="bg-emerald-500"
          icon={<ShoppingCart size={20} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          badge={loading ? undefined : `${orders!.length} total`}
          badgeColor="bg-emerald-50 text-emerald-600"
          value={loading ? null : `$${revenue.toFixed(0)}`}
          label="Revenue"
          sub="From fulfilled orders"
        />
        <TopCard
          barColor="bg-amber-500"
          icon={<AlertTriangle size={20} className="text-amber-600" />}
          iconBg="bg-amber-50"
          badge={lowStockCount > 0 ? 'Action needed' : undefined}
          badgeColor="bg-amber-50 text-amber-600"
          value={loading ? null : String(lowStockCount)}
          label="Low stock items"
          sub="Below reorder point"
        />
        <TopCard
          barColor="bg-violet-500"
          icon={<Package size={20} className="text-violet-600" />}
          iconBg="bg-violet-50"
          badge="Active"
          badgeColor="bg-violet-50 text-violet-600"
          value={loading ? null : '3'}
          label="Open purchase orders"
          sub="1 arriving soon"
        />
      </div>

      <div className="grid grid-cols-2 gap-5 mt-8">
        <div>
          <p className="text-[11.5px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Quick actions</p>
          <div className="bg-white rounded-xl shadow-card divide-y divide-ink-100">
            <QuickAction icon={<ShoppingCart size={18} className="text-blue-600" />} iconBg="bg-blue-50" title="Create order" sub="Start a new customer order" onClick={() => navigate('/orders')} />
            <QuickAction icon={<Package size={18} className="text-emerald-600" />} iconBg="bg-emerald-50" title="View inventory" sub="Check stock levels across warehouses" onClick={() => navigate('/inventory')} />
            <QuickAction icon={<RefreshCw size={18} className="text-amber-600" />} iconBg="bg-amber-50" title="Review low stock" sub="See items below reorder point" onClick={() => navigate('/inventory')} />
          </div>
        </div>

        <div>
          <p className="text-[11.5px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Recent orders</p>
          <div className="bg-white rounded-xl shadow-card">
            {loading && <div className="h-40 flex items-center justify-center text-[13px] text-ink-400">Loading…</div>}
            {!loading && orders!.length === 0 && (
              <div className="h-40 flex items-center justify-center text-[13.5px] text-ink-400">No orders yet — create one to get started</div>
            )}
            {!loading &&
              orders!.slice(0, 4).map((o) => (
                <div key={o.id} className="px-5 py-3.5 border-b last:border-0 border-ink-100 flex items-center justify-between">
                  <div>
                    <p className="text-[13.5px] font-medium text-ink-900">{o.customer.name}</p>
                    <p className="text-[12px] text-ink-500 mt-0.5">{o.items.length} items</p>
                  </div>
                  <span className="text-[11.5px] font-medium text-ink-500 capitalize">{o.status.replace('_', ' ')}</span>
                </div>
              ))}
            {!loading && orders!.length > 0 && (
              <a href="/orders" className="block px-5 py-3 text-[12.5px] font-medium text-blue-600 hover:bg-ink-50 transition-colors rounded-b-xl">
                View all orders →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopCard({
  barColor, icon, iconBg, badge, badgeColor, value, label, sub,
}: { barColor: string; icon: React.ReactNode; iconBg: string; badge?: string; badgeColor?: string; value: string | null; label: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden">
      <div className={`h-1 ${barColor}`} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center`}>{icon}</div>
          {badge && <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${badgeColor}`}>{badge}</span>}
        </div>
        {value === null ? (
          <div className="h-8 w-14 bg-ink-100 rounded-lg animate-pulse" />
        ) : (
          <p className="text-[26px] font-bold text-ink-950">{value}</p>
        )}
        <p className="text-[13.5px] font-medium text-ink-900 mt-1">{label}</p>
        <p className="text-[12px] text-ink-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function QuickAction({
  icon, iconBg, title, sub, onClick,
}: { icon: React.ReactNode; iconBg: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-ink-50 transition-colors text-left first:rounded-t-xl last:rounded-b-xl">
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div className="flex-1">
        <p className="text-[13.5px] font-medium text-ink-900">{title}</p>
        <p className="text-[12px] text-ink-500 mt-0.5">{sub}</p>
      </div>
      <ChevronRight size={16} className="text-ink-300" />
    </button>
  );
}
