import {
  CreditCard,
  LayoutDashboard,
  Radar,
  Settings,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router';
import { useT, type MessageKey } from '../i18n';

interface Tab {
  to: string;
  label: MessageKey;
  icon: LucideIcon;
}

const TABS: readonly Tab[] = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/cards', label: 'nav.cards', icon: CreditCard },
  { to: '/import', label: 'nav.import', icon: Upload },
  { to: '/sub-radar', label: 'nav.subRadar.short', icon: Radar },
  { to: '/settings', label: 'nav.settings', icon: Settings },
];

export function TabBar() {
  const t = useT();
  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] transition-colors ${
                  isActive ? 'font-semibold text-fg' : 'font-medium text-muted hover:text-fg'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                      isActive ? 'bg-accent-soft' : ''
                    }`}
                  >
                    <Icon aria-hidden="true" size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                  </span>
                  <span className="max-w-full truncate">{t(label)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
