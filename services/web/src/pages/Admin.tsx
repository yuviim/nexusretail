import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Tenant } from '../lib/api';
import { Building2, Users, Package, ShoppingCart } from 'lucide-react';

export default function Admin() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getTenants().then(setTenants).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="border-b border-slate-800 px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
            <Building2 size={16} className="text-slate-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-semibold text-white">Platform admin</h1>
              <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                Super admin
              </span>
            </div>
            <p className="text-[12.5px] text-slate-400 mt-0.5">Cross-tenant oversight — not visible to tenant users</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-5 py-3.5 text-[13.5px] text-rose-300 mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          <SummaryCard label="Total tenants" value={tenants ? String(tenants.length) : null} />
          <SummaryCard label="Total users" value={tenants ? String(tenants.reduce((s, t) => s + t._count.users, 0)) : null} />
          <SummaryCard label="Total orders" value={tenants ? String(tenants.reduce((s, t) => s + t._count.orders, 0)) : null} />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-[13.5px] font-semibold text-white">Tenant overview</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <Th>Organization</Th>
                <Th>Created</Th>
                <Th align="right">Users</Th>
                <Th align="right">Products</Th>
                <Th align="right">Orders</Th>
              </tr>
            </thead>
            <tbody>
              {!tenants &&
                Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800 last:border-0">
                    <td className="px-6 py-4" colSpan={5}>
                      <div className="h-4 w-full bg-slate-800 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}
              {tenants?.map((t) => (
                <tr key={t.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-[10.5px] font-semibold text-slate-300">
                        {t.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[13.5px] font-medium text-white">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-[12.5px] text-slate-400">
                    {new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-3.5 text-[13px] text-slate-200 text-right tabular-nums">{t._count.users}</td>
                  <td className="px-6 py-3.5 text-[13px] text-slate-200 text-right tabular-nums">{t._count.products}</td>
                  <td className="px-6 py-3.5 text-[13px] text-slate-200 text-right tabular-nums">{t._count.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-[12px] text-slate-400 font-medium">{label}</p>
      {value === null ? (
        <div className="h-7 w-12 mt-1.5 bg-slate-800 rounded animate-pulse" />
      ) : (
        <p className="text-[24px] font-bold text-white mt-0.5">{value}</p>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-${align}`}>
      {children}
    </th>
  );
}
