import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut, getUserEmail } from '../lib/auth';

const navItems = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon },
  { to: '/inventory', label: 'Inventory', icon: BoxIcon },
  { to: '/orders', label: 'Orders', icon: CartIcon },
  { to: '/team', label: 'Team', icon: TeamIcon },
];

export default function Layout() {
  const navigate = useNavigate();
  const email = getUserEmail();
  const initials = email ? email.slice(0, 2).toUpperCase() : 'NR';

  function handleSignOut() {
    signOut();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-ink-50">
      <aside className="w-60 flex-shrink-0 bg-ink-950 flex flex-col">
        <div className="h-16 flex items-center px-6">
          <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center mr-2.5">
            <span className="text-ink-950 font-bold text-sm">N</span>
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">NexusRetail</span>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-ink-800 text-white'
                    : 'text-ink-400 hover:text-ink-100 hover:bg-ink-900'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-ink-800">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ink-400 hover:text-white hover:bg-ink-900 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-ink-700 flex items-center justify-center text-[11px] font-semibold text-ink-200">
              {initials}
            </div>
            <div className="flex-1 text-left overflow-hidden">
              <div className="truncate text-ink-200 text-[13px]">{email}</div>
              <div className="text-[11px] text-ink-500">Sign out</div>
            </div>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function DashboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
function BoxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}
function CartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h2l2.4 12.2a2 2 0 002 1.8h8.4a2 2 0 002-1.7L21 7H6" />
    </svg>
  );
}
function TeamIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.6 2.9-6.5 5.5-6.5s5.5 2.9 5.5 6.5" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M15.2 13.2c2.1.2 4.3 2 4.3 5.8" />
    </svg>
  );
}
