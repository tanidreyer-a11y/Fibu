import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/train', label: 'Train', icon: TrainIcon },
  { to: '/food', label: 'Food', icon: FoodIcon },
  { to: '/body', label: 'Body', icon: BodyIcon },
  { to: '/chat', label: 'Coach', icon: ChatIcon },
];

export function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 z-20 border-t border-border-soft bg-bg/90 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150 ease-[var(--ease-out)] ${
                  isActive ? 'text-accent' : 'text-text-faint hover:text-text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon active={isActive} />
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

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9h12v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrainIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M2 12h3M19 12h3M6 8v8M18 8v8M6 12h12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BodyIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <circle cx="12" cy="5" r="2.3" />
      <path d="M12 7.5v5.5M8 10l4 1 4-1M9 21l3-8 3 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M4 5h16v11H8l-4 4V5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10h8M8 13h5" strokeLinecap="round" />
    </svg>
  );
}

function FoodIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M6 3v7a2 2 0 0 0 2 2v9M6 3v7M9 3v7M18 3c-2 0-3 2-3 5s1 4 3 4M18 3v18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
