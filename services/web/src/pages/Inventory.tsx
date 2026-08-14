import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Product, Warehouse } from '../lib/api';
import { Package, Plus, Pencil, Trash2, X } from 'lucide-react';

export default function Inventory() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStock, setEditingStock] = useState<{ productId: string; warehouseId: string; value: string } | null>(null);

  function load() {
    Promise.all([api.getProducts(), api.getWarehouses()])
      .then(([p, w]) => {
        setProducts(p);
        setWarehouses(w);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleStockSave() {
    if (!editingStock) return;
    const qty = parseInt(editingStock.value, 10);
    if (isNaN(qty) || qty < 0) return;
    try {
      await api.updateProductStock(editingStock.productId, editingStock.warehouseId, qty);
      setEditingStock(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update stock');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    try {
      await api.deleteProduct(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete product');
    }
  }

  if (error) {
    return (
      <div className="px-6 py-8">
        <div className="bg-white rounded-xl shadow-card p-8 text-center text-rose-600 text-[13.5px]">{error}</div>
      </div>
    );
  }

  const filtered = products?.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-ink-950">Inventory</h1>
          <p className="text-[13.5px] text-ink-500 mt-0.5">{products ? `${products.length} products` : 'Loading…'}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ink-950 text-white text-[13.5px] font-medium hover:bg-ink-800 transition-colors"
        >
          <Plus size={15} /> Add product
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by name or SKU…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-72 px-3 py-2 rounded-lg border border-ink-200 text-[13.5px] mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
      />

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink-100">
              <Th>Product</Th>
              <Th>SKU</Th>
              <Th>Warehouse</Th>
              <Th align="right">On hand</Th>
              <Th align="right">Reorder at</Th>
              <Th align="right">Status</Th>
              <Th align="right"> </Th>
            </tr>
          </thead>
          <tbody>
            {!products &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-ink-50"><td className="px-6 py-4" colSpan={7}><div className="h-4 bg-ink-100 rounded animate-pulse" /></td></tr>
              ))}
            {filtered?.map((p) => {
              const stock = p.stockLevels[0];
              const qty = stock?.quantityOnHand ?? 0;
              const isEditing = editingStock?.productId === p.id;
              const statusInfo = qty === 0
                ? { bg: 'bg-rose-100', text: 'text-rose-600', label: 'Out of stock' }
                : qty <= p.reorderPoint
                ? { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Low stock' }
                : { bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'In stock' };

              return (
                <tr key={p.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/60 transition-colors group">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Package size={14} className="text-blue-600" />
                      </div>
                      <span className="text-[13.5px] font-medium text-ink-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-[12.5px] text-ink-500 font-mono">{p.sku}</td>
                  <td className="px-6 py-3.5 text-[13.5px] text-ink-700">{stock?.warehouse.name ?? '—'}</td>
                  <td className="px-6 py-3.5 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="number"
                          autoFocus
                          value={editingStock.value}
                          onChange={(e) => setEditingStock({ ...editingStock, value: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleStockSave()}
                          className="w-16 px-2 py-1 rounded-md border border-blue-300 text-[13px] text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button onClick={handleStockSave} className="text-[11.5px] font-medium text-blue-600 hover:underline">Save</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => stock && setEditingStock({ productId: p.id, warehouseId: stock.warehouse.id, value: String(qty) })}
                        className="text-[13.5px] text-ink-900 tabular-nums hover:text-blue-600 hover:underline"
                      >
                        {qty}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-[13.5px] text-ink-500 text-right tabular-nums">{p.reorderPoint}</td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={`text-[11.5px] font-medium px-2.5 py-1 rounded-lg ${statusInfo.bg} ${statusInfo.text}`}>{statusInfo.label}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-300 hover:text-rose-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <AddProductModal
          warehouses={warehouses}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddProductModal({ warehouses, onClose, onCreated }: { warehouses: Warehouse[]; onClose: () => void; onCreated: () => void }) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [reorderPoint, setReorderPoint] = useState('10');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!warehouseId) {
      setError('Select a warehouse');
      return;
    }
    setLoading(true);
    try {
      await api.createProduct({
        sku, name, unitPrice,
        reorderPoint: parseInt(reorderPoint, 10) || 0,
        warehouseId,
        initialQuantity: parseInt(initialQuantity, 10) || 0,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-950/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-ink-900">Add product</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU"><input value={sku} onChange={(e) => setSku(e.target.value)} required className="input" /></Field>
            <Field label="Unit price"><input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="9.40" required className="input" /></Field>
          </div>
          <Field label="Product name"><input value={name} onChange={(e) => setName(e.target.value)} required className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reorder point"><input type="number" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="input" /></Field>
            <Field label="Initial quantity"><input type="number" value={initialQuantity} onChange={(e) => setInitialQuantity(e.target.value)} className="input" /></Field>
          </div>
          <Field label="Warehouse">
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input">
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>

          {error && <div className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 text-[12.5px]">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-ink-200 text-ink-700 text-[13.5px] font-medium hover:bg-ink-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-ink-950 text-white text-[13.5px] font-medium hover:bg-ink-800 disabled:opacity-50">
              {loading ? 'Creating…' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-ink-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-6 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide text-${align}`}>{children}</th>;
}
