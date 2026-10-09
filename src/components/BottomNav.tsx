import { Barbell, ForkKnife, House, PersonSimple, Robot, type Icon } from '@phosphor-icons/react';
import { NavLink } from 'react-router-dom';

const TABS: { to: string; label: string; icon: Icon }[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/train', label: 'Train', icon: Barbell },
  { to: '/food', label: 'Food', icon: ForkKnife },
  { to: '/body', label: 'Body', icon: PersonSimple },
  { to: '/chat', label: 'Coach', icon: Robot },
];

export function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 z-20 border-t-2 border-border bg-bg-raised"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around gap-1 px-2 py-1.5">
        {TABS.map(({ to, label, icon: TabIcon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-[11px] font-extrabold transition-colors duration-150 ${
                  isActive
                    ? 'border-accent/40 bg-accent-tint text-accent-text'
                    : 'border-transparent text-text-faint [@media(hover:hover)]:hover:text-text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <TabIcon size={24} weight={isActive ? 'fill' : 'bold'} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
