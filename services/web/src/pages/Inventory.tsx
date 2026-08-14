import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Product } from '../lib/api';
import { PageHeader, Card, Skeleton, ErrorState, StockBadge } from '../components/ui';

export default function Inventory() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getProducts().then(setProducts).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-8"><ErrorState message={error} /></div>;

  const filtered = products?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader title="Inventory" subtitle={products ? `${products.length} products across all warehouses` : undefined} />

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 px-3 py-2 rounded-lg border border-ink-200 text-[13.5px] placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
        />
      </div>

      <Card>
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink-100">
              <Th>Product</Th>
              <Th>SKU</Th>
              <Th>Warehouse</Th>
              <Th align="right">On hand</Th>
              <Th align="right">Reorder at</Th>
              <Th align="right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {!products &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-ink-50">
                  <td className="px-6 py-4" colSpan={6}><Skeleton className="h-4 w-full" /></td>
                </tr>
              ))}
            {filtered?.map((p) => {
              const stock = p.stockLevels[0];
              return (
                <tr key={p.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50 transition-colors">
                  <td className="px-6 py-3.5 text-[13.5px] font-medium text-ink-900">{p.name}</td>
                  <td className="px-6 py-3.5 text-[13px] text-ink-500 font-mono">{p.sku}</td>
                  <td className="px-6 py-3.5 text-[13.5px] text-ink-700">{stock?.warehouse.name ?? '—'}</td>
                  <td className="px-6 py-3.5 text-[13.5px] text-ink-900 text-right tabular-nums">{stock?.quantityOnHand ?? 0}</td>
                  <td className="px-6 py-3.5 text-[13.5px] text-ink-500 text-right tabular-nums">{p.reorderPoint}</td>
                  <td className="px-6 py-3.5 text-right">
                    <StockBadge qty={stock?.quantityOnHand ?? 0} reorderPoint={p.reorderPoint} />
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
