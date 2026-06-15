import { useState } from 'react';
import { User, UserRole, SavedCourse, QuizAttempt, ModelTier } from '../../lib/types';
import { useAuthStore } from '../../store/useAuthStore';
import { useEnrollmentStore } from '../../store/useEnrollmentStore';
import { useQuizStore } from '../../store/useQuizStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { StatusMessage } from '../../components/StatusMessage/StatusMessage';
import { DevicePairingPanel } from '../../components/DevicePairingPanel/DevicePairingPanel';
import { makeError } from '../../lib/errors';
import styles from './AdminDashboard.module.css';

type Tab = 'overview' | 'courses' | 'users' | 'analytics' | 'devices' | 'settings';

type ProviderId = 'openai' | 'deepseek' | 'qwen' | 'dgx' | 'custom';

// All providers are OpenAI-compatible; the Rust layer appends /v1/chat/completions
// to the base URL. Qwen's DashScope compatible endpoint lives under /compatible-mode,
// so the base stops there (→ /compatible-mode/v1/chat/completions). The DGX base
// must NOT include /v1 for the same reason. `apiKey`, when present, pre-fills the key
// on selection (used for the fixed-token on-prem cluster).
const MODEL_PROVIDERS: { id: ProviderId; label: string; baseUrl: string; model: string; models: string; keyHint: string; apiKey?: string }[] = [
  { id: 'openai',   label: 'OpenAI',                baseUrl: 'https://api.openai.com',                              model: 'gpt-4o-mini',              models: 'gpt-4o-mini, gpt-4o',              keyHint: 'platform.openai.com',
    apiKey: import.meta.env.VITE_OPENAI_API_KEY },
  { id: 'deepseek', label: 'DeepSeek',              baseUrl: 'https://api.deepseek.com',                            model: 'deepseek-chat',            models: 'deepseek-chat, deepseek-reasoner', keyHint: 'platform.deepseek.com' },
  { id: 'qwen',     label: 'Qwen (DashScope)',      baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode', model: 'qwen-plus',                models: 'qwen-plus, qwen-turbo, qwen-max',  keyHint: 'dashscope.console.aliyun.com' },
  { id: 'dgx',      label: 'DGX Spark (on-prem)',   baseUrl: 'http://192.168.1.50:8000',                            model: 'Qwen/Qwen2.5-72B-Instruct', models: 'Qwen/Qwen2.5-72B-Instruct (fixed)', keyHint: 'Adversign office LAN or VPN',
    apiKey: import.meta.env.VITE_DGX_API_KEY },
  { id: 'custom',   label: 'Custom / other',        baseUrl: '',                                                    model: '',                         models: 'any OpenAI-compatible model',      keyHint: 'your provider' },
];

function detectProvider(baseUrl: string): ProviderId {
  const norm = baseUrl.trim().replace(/\/$/, '');
  const match = MODEL_PROVIDERS.find(p => p.id !== 'custom' && p.baseUrl === norm);
  return match ? match.id : 'custom';
}

type Props = {
  courses: SavedCourse[];
  onPublishToggle: (courseId: string) => void;
  onDeleteCourse: (courseId: string) => void;
};

function RingChart({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth="7"/>
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.16,1,0.3,1)' }}
      />
    </svg>
  );
}

export function AdminDashboard({ courses, onPublishToggle, onDeleteCourse }: Props) {
  const { users, createUser, updateUserRole, deleteUser } = useAuthStore();
  const { enrollments } = useEnrollmentStore();
  const { settings, updateSettings } = useSettingsStore();
  const [tab, setTab] = useState<Tab>('overview');

  // Create user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('trainee');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [creating, setCreating] = useState(false);

  // Settings form
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [provider, setProvider] = useState<ProviderId>(() => detectProvider(settings.baseUrl));
  const [tier, setTier] = useState<ModelTier>(settings.tier ?? 'heavy');
  const [settingsSaved, setSettingsSaved] = useState(false);

  const activeProvider = MODEL_PROVIDERS.find(p => p.id === provider) ?? MODEL_PROVIDERS[0];

  function handleProviderChange(id: ProviderId) {
    setProvider(id);
    const p = MODEL_PROVIDERS.find(x => x.id === id);
    if (p && id !== 'custom') {
      setBaseUrl(p.baseUrl);
      setModel(p.model);
      if (p.apiKey) setApiKey(p.apiKey);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;
    setCreateError('');
    setCreateSuccess('');
    setCreating(true);
    const result = await createUser(newUsername.trim(), newPassword, newRole);
    setCreating(false);
    if (result === 'exists') {
      setCreateError('A user with that username already exists.');
    } else {
      setCreateSuccess(`User "${newUsername.trim()}" created.`);
      setNewUsername('');
      setNewPassword('');
      setNewRole('trainee');
    }
  }

  function handleDeleteUser(user: User) {
    if (window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) {
      deleteUser(user.id);
    }
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    updateSettings({ apiKey, baseUrl, model, tier });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  const publishedCount = courses.filter(c => c.published).length;
  const draftCount = courses.length - publishedCount;
  const traineeCount = users.filter(u => u.role === 'trainee').length;
  const editorCount = users.filter(u => u.role === 'editor').length;
  const publishedPct = courses.length > 0 ? Math.round((publishedCount / courses.length) * 100) : 0;
  const traineePct = users.length > 0 ? Math.round((traineeCount / users.length) * 100) : 0;
  const totalEnrollments = enrollments.length;
  const completedEnrollments = enrollments.filter(e => e.completed).length;
  const completionPct = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

  const ROLE_COLORS: Record<UserRole, string> = {
    admin: '#ef4444',
    editor: '#f97316',
    trainee: '#e5ff00',
  };

  const TAB_LABELS: Record<Tab, string> = {
    overview:  'Overview',
    courses:   'Courses',
    users:     'Users',
    analytics: 'Analytics',
    devices:   'Devices',
    settings:  'Settings',
  };

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Admin Panel</h1>
          <p className={styles.headerSubtitle}>Manage users, courses, and platform settings</p>
        </div>
        <div className={styles.tabs} role="tablist">
          {(['overview', 'courses', 'users', 'analytics', 'devices', 'settings'] as Tab[]).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className={styles.overviewGrid}>
            <div className={styles.statCard}>
              <div className={styles.statRing}>
                <RingChart pct={traineePct} color="#e5ff00" />
                <span className={styles.statRingNum}>{traineeCount}</span>
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{users.length}</span>
                <span className={styles.statLabel}>Total users</span>
                <div className={styles.statBreakdown}>
                  <span style={{ color: ROLE_COLORS.trainee }}>{traineeCount} trainees</span>
                  <span style={{ color: ROLE_COLORS.editor }}>{editorCount} editors</span>
                  <span style={{ color: ROLE_COLORS.admin }}>{users.filter(u => u.role === 'admin').length} admins</span>
                </div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statRing}>
                <RingChart pct={publishedPct} color="#10b981" />
                <span className={styles.statRingNum}>{publishedCount}</span>
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{courses.length}</span>
                <span className={styles.statLabel}>Total courses</span>
                <div className={styles.statBreakdown}>
                  <span style={{ color: '#10b981' }}>{publishedCount} published</span>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>{draftCount} drafts</span>
                </div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statRing}>
                <RingChart pct={completionPct} color="#e5ff00" />
                <span className={styles.statRingNum}>{completedEnrollments}</span>
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{totalEnrollments}</span>
                <span className={styles.statLabel}>Enrollments</span>
                <div className={styles.statBreakdown}>
                  <span style={{ color: 'var(--color-accent)' }}>{completedEnrollments} completed</span>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>{totalEnrollments - completedEnrollments} in progress</span>
                </div>
              </div>
            </div>

            {/* Recent courses */}
            <div className={styles.recentSection}>
              <h3 className={styles.sectionTitle}>Recent courses</h3>
              {courses.length === 0 ? (
                <p className={styles.emptyNote}>No courses yet. Go to Import & Generate to create the first one.</p>
              ) : (
                <div className={styles.recentList}>
                  {courses.slice(-6).reverse().map(course => (
                    <div key={course.id} className={styles.recentItem}>
                      <div className={styles.recentDot} style={{ background: course.published ? '#10b981' : 'var(--color-border)' }} />
                      <div className={styles.recentInfo}>
                        <span className={styles.recentTitle}>{course.topic}</span>
                        <span className={styles.recentMeta}>{course.level} · {new Date(course.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <span className={`${styles.statusPill} ${course.published ? styles.statusPublished : styles.statusDraft}`}>
                        {course.published ? 'Published' : 'Draft'}
                      </span>
                      <button
                        className={styles.quickToggle}
                        onClick={() => onPublishToggle(course.id)}
                      >
                        {course.published ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Courses ── */}
        {tab === 'courses' && (
          <div className={styles.tableSection}>
            <div className={styles.tableMeta}>
              <h3 className={styles.sectionTitle}>All courses ({courses.length})</h3>
            </div>
            {courses.length === 0 ? (
              <div className={styles.emptyBox}>
                <p>No courses created yet.</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Title</th>
                    <th className={styles.th}>Level</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.th}>Updated</th>
                    <th className={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map(course => (
                    <tr key={course.id} className={styles.tr}>
                      <td className={styles.td}>
                        <span className={styles.cellTitle}>{course.topic}</span>
                        {course.audience && <span className={styles.cellSub}>{course.audience}</span>}
                      </td>
                      <td className={styles.td}>
                        <span className={styles.levelBadge} style={{ '--lc': course.level === 'beginner' ? '#16a34a' : course.level === 'intermediate' ? '#d97706' : '#dc2626' } as React.CSSProperties}>
                          {course.level}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <span className={`${styles.statusPill} ${course.published ? styles.statusPublished : styles.statusDraft}`}>
                          {course.published ? '● Published' : '○ Draft'}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.dateCell}>{new Date(course.updatedAt).toLocaleDateString()}</span>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.actionRow}>
                          <button className={styles.publishBtn} onClick={() => onPublishToggle(course.id)}>
                            {course.published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => { if (window.confirm('Delete this course?')) onDeleteCourse(course.id); }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Users ── */}
        {tab === 'users' && (
          <div className={styles.usersPanel}>
            {/* Create user */}
            <div className={styles.createCard}>
              <h3 className={styles.sectionTitle}>Create new user</h3>
              <form className={styles.createForm} onSubmit={handleCreateUser}>
                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label htmlFor="new-username" className={styles.fieldLabel}>Username</label>
                    <input
                      id="new-username"
                      type="text"
                      className={styles.input}
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      placeholder="username"
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="new-password" className={styles.fieldLabel}>Password</label>
                    <input
                      id="new-password"
                      type="password"
                      className={styles.input}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className={styles.field} style={{ maxWidth: 160 }}>
                    <label htmlFor="new-role" className={styles.fieldLabel}>Role</label>
                    <select
                      id="new-role"
                      className={styles.select}
                      value={newRole}
                      onChange={e => setNewRole(e.target.value as UserRole)}
                    >
                      <option value="trainee">Trainee</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className={styles.createBtn}
                    disabled={creating || !newUsername.trim() || !newPassword}
                  >
                    {creating ? 'Creating…' : '+ Create'}
                  </button>
                </div>
                <StatusMessage
                  error={createError ? makeError('AUTH_USER_EXISTS', createError) : null}
                  success={createSuccess || null}
                />
              </form>
            </div>

            {/* Users table */}
            <div className={styles.tableSection}>
              <div className={styles.tableMeta}>
                <h3 className={styles.sectionTitle}>All users ({users.length})</h3>
              </div>
              {users.length === 0 ? (
                <div className={styles.emptyBox}><p>No users yet.</p></div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>User</th>
                      <th className={styles.th}>Role</th>
                      <th className={styles.th}>Joined</th>
                      <th className={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className={styles.tr}>
                        <td className={styles.td}>
                          <div className={styles.userCell}>
                            <div className={styles.userAvatar} style={{ background: ROLE_COLORS[user.role] }}>
                              {user.username[0].toUpperCase()}
                            </div>
                            <span className={styles.cellTitle}>{user.username}</span>
                          </div>
                        </td>
                        <td className={styles.td}>
                          <select
                            className={styles.roleSelect}
                            value={user.role}
                            onChange={e => updateUserRole(user.id, e.target.value as UserRole)}
                            style={{ borderColor: ROLE_COLORS[user.role] + '44' }}
                            aria-label={`Role for ${user.username}`}
                          >
                            <option value="trainee">Trainee</option>
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className={styles.td}>
                          <span className={styles.dateCell}>{new Date(user.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td className={styles.td}>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteUser(user)}
                            aria-label={`Delete ${user.username}`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Analytics ── */}
        {tab === 'analytics' && <AnalyticsPanel />}

        {/* ── Devices ── */}
        {tab === 'devices' && (
          <div className={styles.settingsPanel}>
            <DevicePairingPanel />
          </div>
        )}

        {/* ── Settings ── */}
        {tab === 'settings' && (
          <div className={styles.settingsPanel}>
            <div className={styles.createCard}>
              <h3 className={styles.sectionTitle}>Model & API settings</h3>
              <form className={styles.createForm} onSubmit={handleSaveSettings}>
                <div className={styles.field}>
                  <label htmlFor="provider" className={styles.fieldLabel}>Provider</label>
                  <select
                    id="provider"
                    className={styles.select}
                    value={provider}
                    onChange={e => handleProviderChange(e.target.value as ProviderId)}
                  >
                    {MODEL_PROVIDERS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="api-key" className={styles.fieldLabel}>API Key</label>
                  <input
                    id="api-key"
                    type="password"
                    className={styles.input}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-…"
                    autoComplete="off"
                  />
                  <span className={styles.fieldHint}>Get a key from {activeProvider.keyHint}.</span>
                </div>
                <div className={styles.field}>
                  <label htmlFor="base-url" className={styles.fieldLabel}>Base URL</label>
                  <input
                    id="base-url"
                    type="text"
                    className={styles.input}
                    value={baseUrl}
                    onChange={e => { setBaseUrl(e.target.value); setProvider(detectProvider(e.target.value)); }}
                    placeholder="https://api.openai.com"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="model-name" className={styles.fieldLabel}>Model</label>
                  <input
                    id="model-name"
                    type="text"
                    className={styles.input}
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder={activeProvider.model || 'model-name'}
                  />
                  <span className={styles.fieldHint}>e.g. {activeProvider.models}</span>
                </div>
                {provider === 'dgx' && (
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Compute tier</label>
                    <div className={styles.tierToggle}>
                      <button
                        type="button"
                        className={`${styles.tierBtn} ${tier === 'fast' ? styles.tierBtnActive : ''}`}
                        onClick={() => setTier('fast')}
                      >
                        Fast
                        <span className={styles.tierSub}>4B · quick, simple tasks</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.tierBtn} ${tier === 'heavy' ? styles.tierBtnActive : ''}`}
                        onClick={() => setTier('heavy')}
                      >
                        Heavy
                        <span className={styles.tierSub}>30B · richer generation</span>
                      </button>
                    </div>
                    <span className={styles.fieldHint}>Sets the X-LLM-Tier header on the DGX cluster. Hosted providers ignore it.</span>
                  </div>
                )}
                <div className={styles.settingsActions}>
                  <button type="submit" className={styles.createBtn}>
                    {settingsSaved ? 'Saved' : 'Save settings'}
                  </button>
                  {settingsSaved && (
                    <span className={styles.savedNote}>Settings saved successfully.</span>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function AnalyticsPanel() {
  const attempts = useQuizStore(s => s.attempts);
  const [traineeFilter, setTraineeFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const trainees = Array.from(new Set(attempts.map(a => a.username))).sort();
  const coursesList = Array.from(new Set(attempts.map(a => a.courseTopic))).sort();

  const filtered = attempts
    .filter(a => traineeFilter === 'all' || a.username === traineeFilter)
    .filter(a => courseFilter === 'all' || a.courseTopic === courseFilter)
    .slice()
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt));

  const total = filtered.length;
  const passes = filtered.filter(a => a.passed).length;
  const passRate = total > 0 ? Math.round((passes / total) * 100) : 0;
  const avgScore = total > 0 ? Math.round(filtered.reduce((s, a) => s + a.percentage, 0) / total) : 0;

  return (
    <div className={styles.analyticsPanel}>
      {/* Summary cards */}
      <div className={styles.overviewGrid}>
        <div className={styles.statCard}>
          <div className={styles.statRing}>
            <RingChart pct={total > 0 ? 100 : 0} color="#0ea5e9" />
            <span className={styles.statRingNum}>{total}</span>
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{total}</span>
            <span className={styles.statLabel}>Quiz attempts</span>
            <div className={styles.statBreakdown}>
              <span style={{ color: 'var(--color-text-tertiary)' }}>{trainees.length} trainee{trainees.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statRing}>
            <RingChart pct={passRate} color="#10b981" />
            <span className={styles.statRingNum}>{passRate}%</span>
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{passes}</span>
            <span className={styles.statLabel}>Passed</span>
            <div className={styles.statBreakdown}>
              <span style={{ color: '#10b981' }}>{passes} passed</span>
              <span style={{ color: '#ef4444' }}>{total - passes} failed</span>
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statRing}>
            <RingChart pct={avgScore} color="#e5ff00" />
            <span className={styles.statRingNum}>{avgScore}%</span>
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{avgScore}%</span>
            <span className={styles.statLabel}>Average score</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.analyticsFilters}>
        <select className={styles.roleSelect} value={traineeFilter} onChange={e => setTraineeFilter(e.target.value)} aria-label="Filter by trainee">
          <option value="all">All trainees</option>
          {trainees.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={styles.roleSelect} value={courseFilter} onChange={e => setCourseFilter(e.target.value)} aria-label="Filter by course">
          <option value="all">All courses</option>
          {coursesList.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Attempts table */}
      <div className={styles.tableSection}>
        <div className={styles.tableMeta}>
          <h3 className={styles.sectionTitle}>Quiz results ({filtered.length})</h3>
        </div>
        {filtered.length === 0 ? (
          <div className={styles.emptyBox}>
            <p>No quiz attempts recorded yet. Results appear here once trainees submit chapter quizzes.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Trainee</th>
                <th className={styles.th}>Course</th>
                <th className={styles.th}>Chapter</th>
                <th className={styles.th}>Score</th>
                <th className={styles.th}>Result</th>
                <th className={styles.th}>Date</th>
                <th className={styles.th}>Answers</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(att => (
                <AttemptRow
                  key={att.id}
                  attempt={att}
                  expanded={expanded === att.id}
                  onToggle={() => setExpanded(expanded === att.id ? null : att.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AttemptRow({ attempt, expanded, onToggle }: { attempt: QuizAttempt; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={styles.tr}>
        <td className={styles.td}><span className={styles.cellTitle}>{attempt.username}</span></td>
        <td className={styles.td}><span className={styles.cellSub}>{attempt.courseTopic}</span></td>
        <td className={styles.td}><span className={styles.cellSub}>{attempt.chapterName}</span></td>
        <td className={styles.td}>
          <span className={styles.cellTitle}>{attempt.score}/{attempt.total}</span>
          <span className={styles.cellSub}>{attempt.percentage}%</span>
        </td>
        <td className={styles.td}>
          <span className={`${styles.statusPill} ${attempt.passed ? styles.statusPublished : styles.statusDraft}`}>
            {attempt.passed ? '● Passed' : '○ Failed'}
          </span>
        </td>
        <td className={styles.td}>
          <span className={styles.dateCell}>{new Date(attempt.takenAt).toLocaleString()}</span>
        </td>
        <td className={styles.td}>
          <button className={styles.publishBtn} onClick={onToggle}>
            {expanded ? 'Hide' : 'Review'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td className={styles.td} colSpan={7}>
            <div className={styles.answerReview}>
              {attempt.answers.map((ans, i) => {
                const correct = ans.selectedIndex === ans.correctIndex;
                const unanswered = ans.selectedIndex < 0;
                return (
                  <div key={ans.questionId} className={styles.answerCard}>
                    <p className={styles.answerQuestion}>
                      <span className={styles.answerNum}>Q{i + 1}</span>
                      {ans.question}
                    </p>
                    <div className={styles.answerOptions}>
                      {ans.options.map((opt, oi) => {
                        const isCorrect = oi === ans.correctIndex;
                        const isChosen = oi === ans.selectedIndex;
                        return (
                          <div
                            key={oi}
                            className={`${styles.answerOpt}
                              ${isCorrect ? styles.answerOptCorrect : ''}
                              ${isChosen && !isCorrect ? styles.answerOptWrong : ''}`}
                          >
                            <span className={styles.answerOptText}>{opt}</span>
                            {isCorrect && <span className={styles.answerTag}>Correct</span>}
                            {isChosen && !isCorrect && <span className={styles.answerTag}>Chosen</span>}
                            {isChosen && isCorrect && <span className={styles.answerTag}>Chosen</span>}
                          </div>
                        );
                      })}
                    </div>
                    <p className={styles.answerVerdict}>
                      {unanswered
                        ? 'Left unanswered'
                        : correct
                          ? 'Answered correctly'
                          : 'Answered incorrectly'}
                    </p>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
