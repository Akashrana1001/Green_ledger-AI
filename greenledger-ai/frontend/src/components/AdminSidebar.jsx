import { Link, useLocation } from 'react-router-dom';
import MI from './MI';

/**
 * Single source of truth for the Admin left sidebar.
 *
 * All admin pages (Dashboard, Questionnaire, War Room, Actionable Plans,
 * Scope 3 Network) import and render this component to keep the navigation
 * order, labels, icons, and active-state styling consistent.
 */
export const ADMIN_NAV = [
  { icon: 'grid_view',            label: 'Overview',         to: '/admin/dashboard' },
  { icon: 'verified_user',        label: 'Compliance',       to: '/admin/questionnaire' },
  { icon: 'assessment',           label: 'AI War Room',      to: '/admin/war-room' },
  { icon: 'lightbulb',            label: 'Actionable Plans', to: '/admin/war-room/actionable-plans' },
  { icon: 'hub',                  label: 'Scope 3 Network',  to: '/admin/scope3' },
];

const isActive = (pathname, to) => {
  if (to === '/admin/dashboard')  return pathname === '/admin/dashboard';
  if (to === '/admin/war-room')   return pathname === '/admin/war-room';
  return pathname.startsWith(to);
};

const AdminSidebarLinks = () => {
  const { pathname } = useLocation();
  return (
    <>
      {ADMIN_NAV.map(({ icon, label, to }) => {
        const active = isActive(pathname, to);
        return (
          <Link
            key={label}
            to={to}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
              active
                ? 'text-emerald-400 bg-emerald-950/20 border-r-2 border-emerald-500 font-medium'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
          >
            <MI icon={icon} className="text-xl" />
            {label}
          </Link>
        );
      })}
    </>
  );
};

/**
 * Default-export sidebar wrapper. Pages with extra sections (e.g. category
 * jump-links in ActionablePlans) can render <AdminSidebarLinks /> directly
 * inside their own <aside> element instead of using this default shell.
 */
const AdminSidebar = ({ footer = null }) => (
  <aside className="fixed top-16 left-0 bottom-0 w-64 bg-[#050505] border-r border-white/10 z-40 hidden md:flex flex-col">
    <nav className="flex-1 p-3 pt-4 space-y-1 overflow-y-auto">
      <AdminSidebarLinks />
    </nav>
    {footer && (
      <div className="p-4 border-t border-white/10">
        {footer}
      </div>
    )}
  </aside>
);

export { AdminSidebarLinks };
export default AdminSidebar;
