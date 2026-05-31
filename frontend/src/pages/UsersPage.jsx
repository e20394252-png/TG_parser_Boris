import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Trash2, Shield, ShieldCheck } from 'lucide-react';
import { usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function UsersPage() {
    const { isAdmin } = useAuth();
    const [users,       setUsers]       = useState([]);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [userError,   setUserError]   = useState('');
    const [userSaving,  setUserSaving]  = useState(false);
    const [deletingId,  setDeletingId]  = useState(null);
    const [loading,     setLoading]     = useState(true);

    const loadUsers = () =>
        usersAPI.list()
            .then(r => { setUsers(r.data.users); setLoading(false); })
            .catch(() => setLoading(false));

    useEffect(() => { loadUsers(); }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setUserError('');
        if (newPassword.length < 8) { setUserError('Пароль — минимум 8 символов'); return; }
        setUserSaving(true);
        try {
            await usersAPI.create({ username: newUsername.trim(), password: newPassword });
            setNewUsername(''); setNewPassword('');
            await loadUsers();
        } catch (err) {
            setUserError(err.response?.data?.detail || 'Ошибка при создании пользователя');
        } finally {
            setUserSaving(false);
        }
    };

    const handleDeleteUser = async (uid) => {
        if (!window.confirm('Удалить пользователя?')) return;
        setDeletingId(uid);
        try {
            await usersAPI.remove(uid);
            await loadUsers();
        } catch (err) {
            alert(err.response?.data?.detail || 'Ошибка удаления');
        } finally {
            setDeletingId(null);
        }
    };

    if (!isAdmin) {
        return (
            <div className="page-container fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Shield size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
                    <p style={{ fontSize: '1.1rem' }}>Доступ только для администраторов</p>
                </div>
            </div>
        );
    }

    if (loading) return <div className="loading-container"><div className="spinner" /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Users size={24} /> Пользователи
                </h2>
                <p className="page-subtitle">Управление пользователями системы</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ── Статистика ── */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <motion.div
                        className="card"
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        style={{ flex: 1, minWidth: 180, padding: '20px 24px' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Users size={22} color="var(--neon-cyan)" />
                            </div>
                            <div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>{users.length}</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Всего пользователей</div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        className="card"
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                        style={{ flex: 1, minWidth: 180, padding: '20px 24px' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: 'rgba(0,255,128,0.1)', border: '1px solid rgba(0,255,128,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <ShieldCheck size={22} color="var(--neon-green)" />
                            </div>
                            <div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {users.filter(u => u.role === 'admin').length}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Администраторов</div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* ── Список пользователей ── */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h3 style={{ margin: '0 0 16px', color: 'var(--neon-cyan)', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Список пользователей
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {users.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Нет пользователей</p>}
                        {users.map(u => (
                            <motion.div
                                key={u.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: 'var(--bg-darker)',
                                    border: `1px solid ${u.role === 'admin' ? 'rgba(0,212,255,0.2)' : 'var(--border-color)'}`,
                                    borderRadius: 10, padding: '12px 16px',
                                    transition: 'border-color 0.2s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10,
                                        background: u.role === 'admin' ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.06)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        {u.role === 'admin'
                                            ? <ShieldCheck size={18} color="var(--neon-cyan)" />
                                            : <Users size={18} color="var(--text-muted)" />}
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.username}</span>
                                            <span style={{
                                                fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                                                background: u.role === 'admin' ? 'rgba(0,212,255,.15)' : 'rgba(255,255,255,.07)',
                                                color: u.role === 'admin' ? 'var(--neon-cyan)' : 'var(--text-muted)',
                                                border: `1px solid ${u.role === 'admin' ? 'rgba(0,212,255,.4)' : 'rgba(255,255,255,.1)'}`,
                                            }}>{u.role || 'user'}</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                            {u.last_login ? `Последний вход: ${new Date(u.last_login).toLocaleDateString('ru')}` : 'Ещё не входил'}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    disabled={deletingId === u.id || u.role === 'admin'}
                                    title={u.role === 'admin' ? 'Нельзя удалить admin' : 'Удалить'}
                                    style={{
                                        background: u.role === 'admin' ? 'transparent' : 'rgba(255,0,128,.1)',
                                        border: `1px solid ${u.role === 'admin' ? 'transparent' : 'var(--neon-pink)'}`,
                                        borderRadius: 8, padding: '7px 12px',
                                        cursor: u.role === 'admin' ? 'not-allowed' : 'pointer',
                                        color: u.role === 'admin' ? 'var(--text-muted)' : 'var(--neon-pink)',
                                        display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem',
                                        opacity: u.role === 'admin' ? 0.4 : 1,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <Trash2 size={13} /> {deletingId === u.id ? '...' : 'Удалить'}
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* ── Добавить пользователя ── */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <h3 style={{ margin: '0 0 16px', color: 'var(--neon-cyan)', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Добавить пользователя
                    </h3>

                    {userError && (
                        <div style={{
                            background: 'rgba(255,0,128,.1)', border: '1px solid var(--neon-pink)',
                            borderRadius: 8, padding: '10px 14px', color: 'var(--neon-pink)',
                            fontSize: '0.85rem', marginBottom: 16,
                        }}>
                            {userError}
                        </div>
                    )}

                    <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 6 }}>Логин</label>
                            <input
                                value={newUsername}
                                onChange={e => setNewUsername(e.target.value)}
                                placeholder="username"
                                required
                                style={{
                                    width: '100%', background: 'var(--bg-darker)',
                                    border: '1px solid var(--border-color)', borderRadius: 8,
                                    padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.9rem',
                                }}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 6 }}>Пароль (мин. 8 символов)</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                style={{
                                    width: '100%', background: 'var(--bg-darker)',
                                    border: '1px solid var(--border-color)', borderRadius: 8,
                                    padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.9rem',
                                }}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={userSaving}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', padding: '10px 20px' }}>
                            {userSaving
                                ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Создаём...</>
                                : <><UserPlus size={15} /> Создать</>}
                        </button>
                    </form>
                </motion.div>

            </div>
        </div>
    );
}
