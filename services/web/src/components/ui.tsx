export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    placed: { bg: 'bg-ink-100', text: 'text-ink-600', label: 'Placed' },
    stock_reserved: { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Stock reserved' },
    payment: { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Payment' },
    fulfilled: { bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Fulfilled' },
  };
  const s = map[status] ?? { bg: 'bg-ink-100', text: 'text-ink-600', label: status };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

export function StockBadge({ qty, reorderPoint }: { qty: number; reorderPoint: number }) {
  if (qty === 0)
    return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-medium bg-rose-100 text-rose-600">Out of stock</span>;
  if (qty <= reorderPoint)
    return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-medium bg-amber-100 text-amber-600">Low stock</span>;
  return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-medium bg-emerald-100 text-emerald-600">In stock</span>;
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-ink-100 shadow-card ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-[19px] font-semibold text-ink-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-ink-100 rounded-md ${className}`} />;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card className="p-8 text-center">
      <p className="text-[14px] text-rose-600 font-medium">{message}</p>
      <p className="text-[13px] text-ink-500 mt-1">Try refreshing the page</p>
    </Card>
  );
}
