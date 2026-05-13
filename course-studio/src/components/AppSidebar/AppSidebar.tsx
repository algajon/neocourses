import { UserSession, UserRole } from '../../lib/types';
import styles from './AppSidebar.module.css';

export type AppView = 'import' | 'admin' | 'catalog' | 'my-learning';
export type Theme = 'white' | 'dark';

type NavItem = {
  id: AppView;
  label: string;
  icon: JSX.Element;
  roles: UserRole[];
  badge?: string;
};

const NAV: NavItem[] = [
  {
    id: 'import',
    label: 'Import & Generate',
    roles: ['editor', 'admin'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'admin',
    label: 'Admin Panel',
    roles: ['admin'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2.5 14c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'catalog',
    label: 'Course Catalog',
    roles: ['trainee'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 3h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'my-learning',
    label: 'My Learning',
    roles: ['trainee'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 4.5v3.75l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const THEMES: { id: Theme; label: string; color: string }[] = [
  { id: 'white', label: 'Light', color: '#ffffff' },
  { id: 'dark',  label: 'Dark',  color: '#09090c' },
];

const ROLE_LABELS: Record<string, string> = {
  admin:   'Administrator',
  editor:  'Editor',
  trainee: 'Trainee',
};

type Props = {
  session: UserSession;
  currentView: AppView;
  onViewChange: (v: AppView) => void;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onLogout: () => void;
};

export function AppSidebar({ session, currentView, onViewChange, theme, onThemeChange, onLogout }: Props) {
  const visibleNav = NAV.filter(item => (item.roles as string[]).includes(session.role));

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoText}>
          <span className={styles.logoName}>neo<span className={styles.logoAccent}>Courses</span></span>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav} aria-label="Main navigation">
        <p className={styles.navSection}>Workspace</p>
        {visibleNav.map(item => (
          <button
            key={item.id}
            className={`${styles.navItem} ${currentView === item.id ? styles.navItemActive : ''}`}
            onClick={() => onViewChange(item.id)}
            aria-current={currentView === item.id ? 'page' : undefined}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
            {item.badge && currentView !== item.id && (
              <span className={styles.navBadge}>{item.badge}</span>
            )}
            {currentView === item.id && <span className={styles.navPip} />}
          </button>
        ))}
      </nav>

      <div className={styles.spacer} />

      {/* Theme switcher */}
      <div className={styles.themeSection}>
        <p className={styles.navSection}>Appearance</p>
        <div className={styles.themeRow}>
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`${styles.themeBtn} ${theme === t.id ? styles.themeBtnActive : ''}`}
              onClick={() => onThemeChange(t.id)}
              aria-pressed={theme === t.id}
              title={t.label}
            >
              <span
                className={styles.themeSwatch}
                style={{ background: t.color, border: t.id === 'white' ? '1px solid rgba(255,255,255,0.15)' : 'none' }}
              />
              <span className={styles.themeLabel}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* User */}
      <div className={styles.userSection}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>{session.username[0].toUpperCase()}</div>
          <div className={styles.userText}>
            <span className={styles.userName}>{session.username}</span>
            <span className={styles.userRole}>{ROLE_LABELS[session.role] ?? session.role}</span>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={onLogout} aria-label="Sign out" title="Sign out">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5.5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.5M9.5 10l3-3-3-3M12.5 7H5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
