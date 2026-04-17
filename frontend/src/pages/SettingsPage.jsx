import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Settings, Eye, EyeOff, Save, CheckCircle, Download, Upload, Lock, Users, UserPlus, Trash2 } from 'lucide-react';
import { settingsAPI, loginAPI, usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

/* ── Конфиг пунктов меню ── */
export const NAV_ITEMS_CONFIG = [
    { key: 'dashboard',       label: 'Дашборд',        fixed: true  },
    { key: 'auth',            label: 'Авторизация ТГ', fixed: false },
    { key: 'monitoring',      label: 'Мониторинг',     fixed: false },
    { key: 'ai-settings',     label: 'AI & RAG',       fixed: false },
    { key: 'message-history', label: 'История',        fixed: false },
    { key: 'conversations',   label: 'Поиск',          fixed: false },
    { key: 'broadcast',       label: 'Рассылка',       fixed: false },
    { key: 'guide',           label: 'Инструкция',     fixed: false },
];

export const DEFAULT_MENU_VISIBILITY = {
    dashboard:         true,
    auth:              true,
    monitoring:        true,
    'ai-settings':     false,
    'message-history': true,
    conversations:     false,
    broadcast:         true,
    guide:             true,
};

const DEFAULT_SETTINGS = {
    general:    { language: 'ru', theme: 'dark', notifications: true },
    telegram:   { connection_timeout: 30, retry_attempts: 3, auto_reconnect: true },
    ai:         { default_provider: 'openai', max_tokens: 1000, temperature: 0.7 },
    rag:        { context_size: 3, chunk_size: 500, chunk_overlap: 50 },
    monitoring: { check_interval: 5, max_messages_per_hour: 100 },
};

export default function SettingsPage() {
    const { isAdmin } = useAuth();
    const [settings,    setSettings]    = useState(DEFAULT_SETTINGS);
    const [visibility,  setVisibility]  = useState(DEFAULT_MENU_VISIBILITY);
    const [loading,     setLoading]     = useState(true);
    const [savingKey,   setSavingKey]   = useState(null);   // key being saved
    const [savedKey,    setSavedKey]    = useState(null);
    const [saveError,   setSaveError]   = useState('');
    const [menuSaving,  setMenuSaving]  = useState(false);
    const [menuSaved,   setMenuSaved]   = useState(false);
    const importRef = useRef();

    // Change password state
    const [pwCurrent, setPwCurrent] = useState('');
    const [pwNew,     setPwNew]     = useState('');
    const [pwConfirm, setPwConfirm] = useState('');
    const [pwShowCur, setPwShowCur] = useState(false);
    const [pwShowNew, setPwShowNew] = useState(false);
    const [pwSaving,  setPwSaving]  = useState(false);
    const [pwError,   setPwError]   = useState('');
    const [pwOk,      setPwOk]      = useState(false);

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwError('');
        setPwOk(false);
        if (pwNew !== pwConfirm) { setPwError('Пароли не совпадают'); return; }
        if (pwNew.length < 8)    { setPwError('Новый пароль — минимум 8 символов'); return; }
        setPwSaving(true);
        try {
            await loginAPI.changePassword({ current_password: pwCurrent, new_password: pwNew });
            setPwOk(true);
            setPwCurrent(''); setPwNew(''); setPwConfirm('');
            setTimeout(() => setPwOk(false), 3000);
        } catch (err) {
            setPwError(err.response?.data?.detail || 'Ошибка при смене пароля');
        } finally {
            setPwSaving(false);
        }
    };

    // User management state
    const [users,       setUsers]       = useState([]);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [userError,   setUserError]   = useState('');
    const [userSaving,  setUserSaving]  = useState(false);
    const [deletingId,  setDeletingId]  = useState(null);

    const loadUsers = () => usersAPI.list().then(r => setUsers(r.data.users)).catch(() => {});

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

    useEffect(() => {
        settingsAPI.get()
            .then(res => {
                const s = res.data?.settings || {};
                setSettings({ ...DEFAULT_SETTINGS, ...s });
                const mv = s.menu_visibility;
                if (mv && typeof mv === 'object') {
                    setVisibility({ ...DEFAULT_MENU_VISIBILITY, ...mv });
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
        loadUsers();
    }, []);

    const handleSave = async (key, newVal) => {
        setSavingKey(key);
        setSaveError('');
        try {
            await settingsAPI.update({ key, value: newVal });
            setSettings(prev => ({ ...prev, [key]: newVal }));
            setSavedKey(key);
            setTimeout(() => setSavedKey(null), 2000);
        } catch (e) {
            const msg = e.response?.data?.detail || e.message || 'Неизвестная ошибка';
            setSaveError(`Ошибка сохранения [${key}]: ${msg}`);
            console.error('Ошибка сохранения:', e);
        } finally {
            setSavingKey(null);
        }
    };

    const handleExport = async () => {
        try {
            const res = await settingsAPI.export();
            const blob = new Blob([JSON.stringify(res.data.export, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `settings-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        } catch (e) { console.error(e); }
    };

    const handleImport = async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            await settingsAPI.import({ settings: JSON.parse(text) });
            window.location.reload();
        } catch (e) { console.error(e); }
    };

    const toggleMenu = (key) => {
        setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
        setMenuSaved(false);
    };

    const saveMenu = async () => {
        setMenuSaving(true);
        try {
            await settingsAPI.update({ key: 'menu_visibility', value: visibility });
            setMenuSaved(true);
            setTimeout(() => window.location.reload(), 700);
        } catch (e) { console.error(e); }
        finally { setMenuSaving(false); }
    };

    const SectionHeader = ({ title }) => (
        <h3 style={{ margin: '0 0 16px', color: 'var(--neon-cyan)', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {title}
        </h3>
    );

    const FieldRow = ({ label, children }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', minWidth: 180 }}>{label}</span>
            {children}
        </div>
    );

    const inputStyle = {
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: '0.9rem',
        outline: 'none', width: 160, boxSizing: 'border-box',
    };

    const SaveHint = ({ k }) => savedKey === k
        ? <CheckCircle size={14} color="var(--neon-green)" style={{ marginLeft: 6 }} />
        : (savingKey === k ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>...</span> : null);

    if (loading) return <div className="loading-container"><div className="spinner" /></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Settings size={24} /> Настройки
                </h2>
                <p className="page-subtitle">Параметры системы и персонализация интерфейса</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ── Ошибка сохранения (диагностика) ── */}
                {saveError && (
                    <div style={{
                        padding: '12px 16px', background: 'rgba(255,0,128,0.1)',
                        border: '1px solid var(--neon-pink)', borderRadius: 10,
                        color: 'var(--neon-pink)', fontSize: '0.85rem',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <span>⚠️ {saveError}</span>
                        <button onClick={() => setSaveError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neon-pink)', fontSize: '1rem' }}>✕</button>
                    </div>
                )}

                {/* ── Общие ── */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <SectionHeader title="Общие" />
                    <FieldRow label="Язык">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <select style={inputStyle} value={settings.general?.language || 'ru'}
                                onChange={e => handleSave('general', { ...settings.general, language: e.target.value })}>
                                <option value="ru">Русский</option>
                                <option value="en">English</option>
                            </select>
                            <SaveHint k="general" />
                        </div>
                    </FieldRow>
                    <FieldRow label="Тема">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <select style={inputStyle} value={settings.general?.theme || 'dark'}
                                onChange={e => handleSave('general', { ...settings.general, theme: e.target.value })}>
                                <option value="dark">Тёмная</option>
                                <option value="light">Светлая</option>
                            </select>
                            <SaveHint k="general" />
                        </div>
                    </FieldRow>
                    <FieldRow label="Уведомления">
                        <input type="checkbox" checked={settings.general?.notifications || false}
                            onChange={e => handleSave('general', { ...settings.general, notifications: e.target.checked })} />
                    </FieldRow>
                </motion.div>

                {/* ── Telegram ── */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <SectionHeader title="Telegram" />
                    <FieldRow label="Таймаут подключения (сек)">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" style={inputStyle} value={settings.telegram?.connection_timeout || 30}
                                onChange={e => handleSave('telegram', { ...settings.telegram, connection_timeout: parseInt(e.target.value) })} />
                            <SaveHint k="telegram" />
                        </div>
                    </FieldRow>
                    <FieldRow label="Попытки переподключения">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" style={inputStyle} value={settings.telegram?.retry_attempts || 3}
                                onChange={e => handleSave('telegram', { ...settings.telegram, retry_attempts: parseInt(e.target.value) })} />
                            <SaveHint k="telegram" />
                        </div>
                    </FieldRow>
                    <FieldRow label="Автопереподключение">
                        <input type="checkbox" checked={settings.telegram?.auto_reconnect || false}
                            onChange={e => handleSave('telegram', { ...settings.telegram, auto_reconnect: e.target.checked })} />
                    </FieldRow>
                    <FieldRow label="Подключение через TData">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                                onClick={() => {
                                    const next = { ...settings.telegram, tdata_enabled: !settings.telegram?.tdata_enabled };
                                    // optimistic update — сразу меняем локальный стейт
                                    setSettings(prev => ({ ...prev, telegram: next }));
                                    handleSave('telegram', next);
                                }}
                                style={{
                                    position: 'relative', width: 40, height: 22, cursor: 'pointer',
                                    background: settings.telegram?.tdata_enabled ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.15)',
                                    borderRadius: 11, transition: 'background 0.2s', flexShrink: 0,
                                }}
                            >
                                <div style={{
                                    position: 'absolute', top: 3,
                                    left: settings.telegram?.tdata_enabled ? 21 : 3,
                                    width: 16, height: 16, borderRadius: '50%',
                                    background: '#fff', transition: 'left 0.2s',
                                }} />
                            </div>
                            <SaveHint k="telegram" />
                        </div>
                    </FieldRow>
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(0,212,255,0.05)',
                        border: '1px solid rgba(0,212,255,0.15)', borderRadius: 8,
                        fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {settings.telegram?.tdata_enabled
                            ? '✅ TData включён — перейдите на страницу «Авторизация ТГ» чтобы увидеть вкладку «📂 TData»'
                            : 'Включите, чтобы отобразить вкладку «📂 TData» на странице авторизации Telegram'}
                    </div>
                </motion.div>

                {/* ── AI ── */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <SectionHeader title="AI" />
                    <FieldRow label="Провайдер по умолчанию">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <select style={inputStyle} value={settings.ai?.default_provider || 'openai'}
                                onChange={e => handleSave('ai', { ...settings.ai, default_provider: e.target.value })}>
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="google">Google AI</option>
                            </select>
                            <SaveHint k="ai" />
                        </div>
                    </FieldRow>
                    <FieldRow label="Max Tokens">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" style={inputStyle} value={settings.ai?.max_tokens || 1000}
                                onChange={e => handleSave('ai', { ...settings.ai, max_tokens: parseInt(e.target.value) })} />
                            <SaveHint k="ai" />
                        </div>
                    </FieldRow>
                    <FieldRow label="Temperature">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" step="0.1" min="0" max="2" style={inputStyle} value={settings.ai?.temperature || 0.7}
                                onChange={e => handleSave('ai', { ...settings.ai, temperature: parseFloat(e.target.value) })} />
                            <SaveHint k="ai" />
                        </div>
                    </FieldRow>
                </motion.div>

                {/* ── RAG ── */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <SectionHeader title="RAG" />
                    <FieldRow label="Размер контекста (сообщений)">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" min="1" max="10" style={inputStyle} value={settings.rag?.context_size || 3}
                                onChange={e => handleSave('rag', { ...settings.rag, context_size: parseInt(e.target.value) })} />
                            <SaveHint k="rag" />
                        </div>
                    </FieldRow>
                    <FieldRow label="Размер чанка">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" style={inputStyle} value={settings.rag?.chunk_size || 500}
                                onChange={e => handleSave('rag', { ...settings.rag, chunk_size: parseInt(e.target.value) })} />
                            <SaveHint k="rag" />
                        </div>
                    </FieldRow>
                    <FieldRow label="Перекрытие чанков">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" style={inputStyle} value={settings.rag?.chunk_overlap || 50}
                                onChange={e => handleSave('rag', { ...settings.rag, chunk_overlap: parseInt(e.target.value) })} />
                            <SaveHint k="rag" />
                        </div>
                    </FieldRow>
                </motion.div>

                {/* ── Резервное копирование ── */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <SectionHeader title="Резервное копирование" />
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                        <button className="btn btn-primary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Download size={16} /> Экспорт настроек
                        </button>
                        <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                            <Upload size={16} /> Импорт настроек
                            <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                        </label>
                    </div>
                </motion.div>

                {/* ── Видимость меню ── */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <SectionHeader title="Видимость пунктов меню" />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
                        Скрывайте неиспользуемые разделы. Настройки сохраняются за аккаунтом.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {NAV_ITEMS_CONFIG.map(item => (
                            <label key={item.key} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px',
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid ${visibility[item.key] ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.07)'}`,
                                borderRadius: 10, cursor: item.fixed ? 'not-allowed' : 'pointer',
                                opacity: item.fixed ? 0.55 : 1, transition: 'all 0.2s',
                            }} onClick={() => !item.fixed && toggleMenu(item.key)}>
                                <span style={{ fontWeight: 500, color: visibility[item.key] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                    {item.label}
                                    {item.fixed && <span style={{ fontSize: '0.72rem', marginLeft: 8, color: 'var(--text-muted)' }}>(всегда)</span>}
                                </span>
                                <div style={{
                                    position: 'relative', width: 40, height: 22,
                                    background: (item.fixed || visibility[item.key]) ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.15)',
                                    borderRadius: 11, transition: 'background 0.2s', flexShrink: 0,
                                }}>
                                    <div style={{
                                        position: 'absolute', top: 3,
                                        left: (item.fixed || visibility[item.key]) ? 21 : 3,
                                        width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                                    }} />
                                </div>
                            </label>
                        ))}
                    </div>
                    <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button className="btn btn-primary" onClick={saveMenu} disabled={menuSaving}
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {menuSaving
                                ? <><div className="spinner" style={{ width: 15, height: 15 }} /> Сохраняем...</>
                                : <><Save size={15} /> Сохранить меню</>}
                        </button>
                        {menuSaved && (
                            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                style={{ color: 'var(--neon-green)', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.88rem' }}>
                                <CheckCircle size={14} /> Применяется...
                            </motion.span>
                        )}
                    </div>
                </motion.div>

                {/* ── Пользователи (только admin) ── */}
                {isAdmin && (
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <SectionHeader title="Пользователи" />

                    {/* Список */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                        {users.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Нет пользователей</p>}
                        {users.map(u => (

                            <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.username}</span>
                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                                            background: u.role === 'admin' ? 'rgba(0,212,255,.15)' : 'rgba(255,255,255,.07)',
                                            color: u.role === 'admin' ? 'var(--neon-cyan)' : 'var(--text-muted)',
                                            border: `1px solid ${u.role === 'admin' ? 'rgba(0,212,255,.4)' : 'rgba(255,255,255,.1)'}`,
                                        }}>{u.role || 'user'}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {u.last_login ? `Последний вход: ${new Date(u.last_login).toLocaleDateString('ru')}` : 'Ещё не входил'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    disabled={deletingId === u.id || u.role === 'admin'}
                                    title={u.role === 'admin' ? 'Нельзя удалить admin' : 'Удалить'}
                                    style={{ background: u.role === 'admin' ? 'transparent' : 'rgba(255,0,128,.1)', border: `1px solid ${u.role === 'admin' ? 'transparent' : 'var(--neon-pink)'}`, borderRadius: 6, padding: '6px 10px', cursor: u.role === 'admin' ? 'not-allowed' : 'pointer', color: u.role === 'admin' ? 'var(--text-muted)' : 'var(--neon-pink)', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', opacity: u.role === 'admin' ? 0.4 : 1 }}
                                >
                                    <Trash2 size={13} /> {deletingId === u.id ? '...' : 'Удалить'}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Создать нового */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12, fontWeight: 600 }}>
                            <UserPlus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                            Добавить пользователя
                        </p>
                        {userError && (
                            <div style={{ background: 'rgba(255,0,128,.1)', border: '1px solid var(--neon-pink)', borderRadius: 8, padding: '8px 12px', color: 'var(--neon-pink)', fontSize: '0.82rem', marginBottom: 10 }}>
                                {userError}
                            </div>
                        )}
                        <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1, minWidth: 140 }}>
                                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 5 }}>Логин</label>
                                <input
                                    value={newUsername}
                                    onChange={e => setNewUsername(e.target.value)}
                                    placeholder="username"
                                    required
                                    style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: 140 }}>
                                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 5 }}>Пароль (мин. 8)</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={userSaving}
                                style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', padding: '9px 18px' }}>
                                {userSaving ? <><div className="spinner" style={{ width: 13, height: 13 }} /> Создаём...</> : <><UserPlus size={14} /> Создать</>}
                            </button>
                        </form>
                    </div>
                </motion.div>
                )}

                {/* ── Смена пароля ── */}
                <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <SectionHeader title="Смена пароля" />
                    <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {pwError && (
                            <div style={{ background: 'rgba(255,0,128,.1)', border: '1px solid var(--neon-pink)', borderRadius: 8, padding: '10px 14px', color: 'var(--neon-pink)', fontSize: '0.85rem' }}>
                                {pwError}
                            </div>
                        )}
                        {pwOk && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                style={{ background: 'rgba(0,255,128,.1)', border: '1px solid var(--neon-green)', borderRadius: 8, padding: '10px 14px', color: 'var(--neon-green)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircle size={15} /> Пароль успешно изменён
                            </motion.div>
                        )}

                        {[{
                            label: 'Текущий пароль', val: pwCurrent, set: setPwCurrent, show: pwShowCur, setShow: setPwShowCur,
                        }, {
                            label: 'Новый пароль', val: pwNew, set: setPwNew, show: pwShowNew, setShow: setPwShowNew,
                        }, {
                            label: 'Подтверждение нового пароля', val: pwConfirm, set: setPwConfirm, show: pwShowNew, setShow: setPwShowNew,
                        }].map(({ label, val, set, show, setShow }) => (
                            <div key={label}>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>{label}</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type={show ? 'text' : 'password'}
                                        value={val}
                                        onChange={e => set(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        style={{ width: '100%', background: 'var(--bg-darker)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 36px 10px 36px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                                    />
                                    <button type="button" onClick={() => setShow(v => !v)}
                                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                                        {show ? <EyeOff size={15}/> : <Eye size={15}/>}
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                            <button type="submit" className="btn btn-primary" disabled={pwSaving}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {pwSaving
                                    ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Сохраняем...</>
                                    : <><Lock size={14} /> Сменить пароль</>}
                            </button>
                        </div>
                    </form>
                </motion.div>

            </div>
        </div>
    );
}
