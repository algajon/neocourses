import { create } from 'zustand';
import { User, UserRole, UserSession } from '../lib/types';
import { loadUsers, saveUsers } from '../lib/storage';
import { hashPassword, verifyPassword, generateSalt } from '../lib/auth';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type AuthStore = {
  session: UserSession | null;
  users: User[];

  // Initialise — seeds default admin if no users exist
  init: () => Promise<void>;

  login: (username: string, password: string) => Promise<'ok' | 'invalid'>;
  logout: () => void;

  // Admin-only mutations
  createUser: (username: string, password: string, role: UserRole) => Promise<'ok' | 'exists'>;
  updateUserRole: (userId: string, role: UserRole) => void;
  deleteUser: (userId: string) => void;

  // Any authenticated user can change their own password
  changePassword: (userId: string, newPassword: string) => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  users: [],

  init: async () => {
    const stored = loadUsers();
    const seeded: User[] = [...stored];

    if (stored.length === 0) {
      // Seed default admin on first launch
      const salt = await generateSalt();
      const passwordHash = await hashPassword('admin', salt);
      seeded.push({
        id: newId(),
        schemaVersion: 1,
        username: 'admin',
        passwordHash,
        salt,
        role: 'admin',
        createdAt: new Date().toISOString(),
      });
    }

    // Always ensure a demo trainee account exists
    if (!seeded.some(u => u.username === 'trainee')) {
      const salt = await generateSalt();
      const passwordHash = await hashPassword('trainee', salt);
      seeded.push({
        id: newId(),
        schemaVersion: 1,
        username: 'trainee',
        passwordHash,
        salt,
        role: 'trainee',
        createdAt: new Date().toISOString(),
      });
    }

    if (seeded.length !== stored.length) saveUsers(seeded);
    set({ users: seeded });
  },

  login: async (username, password) => {
    const users = loadUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return 'invalid';
    const ok = await verifyPassword(password, user.salt, user.passwordHash);
    if (!ok) return 'invalid';
    set({
      session: { userId: user.id, username: user.username, role: user.role },
      users,
    });
    return 'ok';
  },

  logout: () => set({ session: null }),

  createUser: async (username, password, role) => {
    const users = loadUsers();
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return 'exists';
    }
    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const user: User = {
      id: newId(),
      schemaVersion: 1,
      username,
      passwordHash,
      salt,
      role,
      createdAt: new Date().toISOString(),
    };
    const updated = [...users, user];
    saveUsers(updated);
    set({ users: updated });
    return 'ok';
  },

  updateUserRole: (userId, role) => {
    const updated = get().users.map(u => u.id === userId ? { ...u, role } : u);
    saveUsers(updated);
    set({ users: updated });
  },

  deleteUser: (userId) => {
    const updated = get().users.filter(u => u.id !== userId);
    saveUsers(updated);
    set({ users: updated });
  },

  changePassword: async (userId, newPassword) => {
    const users = get().users;
    const salt = await generateSalt();
    const passwordHash = await hashPassword(newPassword, salt);
    const updated = users.map(u =>
      u.id === userId ? { ...u, passwordHash, salt } : u
    );
    saveUsers(updated);
    set({ users: updated });
  },
}));
