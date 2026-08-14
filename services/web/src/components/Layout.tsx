import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut, getUserEmail, isSuperAdmin } from '../lib/auth';
import { LayoutGrid, Package, ShoppingCart, Users, ChevronDown, ShieldCheck } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/team', label: 'Team', icon: Users },
];

export default function Layout() {
  const navigate = useNavigate();
  const email = getUserEmail();
  const initials = email ? email.slice(0, 2).toUpperCase() : 'NR';
  const showAdminLink = isSuperAdmin();

  function handleSignOut() {
    signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="bg-gradient-to-r from-nav-from to-nav-to">
        <div className="max-w-7xl mx-auto px-6 flex items-center h-16">
          <div className="flex items-center gap-2 mr-8">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="text-white font-semibold text-[15px]">NexusRetail</span>
          </div>

          <nav className="flex items-center gap-1 flex-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13.5px] font-medium transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {showAdminLink ? (
            <a href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 mr-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-[12.5px] font-medium text-white/90">
              <ShieldCheck size={14} />
              Platform admin
            </a>
          ) : null}

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full pl-1.5 pr-3 py-1.5"
          >
            <div className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center text-[10px] font-semibold text-white">
              {initials}
            </div>
            <span className="text-[12.5px] text-white/90">{email?.split('@')[0]}</span>
            <ChevronDown size={13} className="text-white/70" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
