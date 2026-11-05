import { CreditCard, LayoutDashboard, Plus, Radar, Settings, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { useT, type MessageKey } from '../i18n';
import { AddSheet } from './AddSheet';

interface Tab {
  to: string;
  label: MessageKey;
  icon: LucideIcon;
}

const LEFT: readonly Tab[] = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/cards', label: 'nav.cards', icon: CreditCard },
];
const RIGHT: readonly Tab[] = [
  { to: '/sub-radar', label: 'nav.subRadar.short', icon: Radar },
  { to: '/settings', label: 'nav.settings', icon: Settings },
];

/**
 * A floating pill with four tabs and a round "+" in the middle (D21). The "+" holds
 * what the user adds: a bank statement (import) or a single entry.
 */
export function TabBar() {
  const t = useT();
  const [adding, setAdding] = useState(false);

  const tab = ({ to, label, icon: Icon }: Tab) => (
    <li key={to}>
      <NavLink
        to={to}
        end={to === '/'}
        aria-label={t(label)}
        className={({ isActive }) =>
          `flex h-12 items-center justify-center gap-2 rounded-full transition-colors ${
            isActive
              ? 'bg-nav-active px-4 text-nav-active-fg'
              : 'w-12 text-nav-muted hover:text-nav-fg'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon aria-hidden="true" size={21} strokeWidth={isActive ? 2.25 : 1.75} />
            {isActive && <span className="text-sm font-semibold">{t(label)}</span>}
          </>
        )}
      </NavLink>
    </li>
  );

  return (
    <>
      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-md"
      >
        <ul className="flex h-16 items-center justify-between rounded-full bg-nav px-2 shadow-(--nav-shadow)">
          {LEFT.map(tab)}
          <li>
            <button
              type="button"
              aria-label={t('nav.add')}
              aria-haspopup="dialog"
              onClick={() => setAdding(true)}
              className="flex size-12 items-center justify-center rounded-full bg-nav-add text-nav-add-fg transition-transform active:scale-95"
            >
              <Plus aria-hidden="true" size={24} strokeWidth={2.5} />
            </button>
          </li>
          {RIGHT.map(tab)}
        </ul>
      </nav>
      {adding && <AddSheet onClose={() => setAdding(false)} />}
    </>
  );
}
