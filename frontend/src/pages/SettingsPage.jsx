import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Settings, Eye, Save, CheckCircle, Download, Upload } from 'lucide-react';
import { settingsAPI } from '../utils/api';

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
    const [settings,    setSettings]    = useState(DEFAULT_SETTINGS);
    const [visibility,  setVisibility]  = useState(DEFAULT_MENU_VISIBILITY);
    const [loading,     setLoading]     = useState(true);
    const [savingKey,   setSavingKey]   = useState(null);   // key being saved
    const [savedKey,    setSavedKey]    = useState(null);
    const [menuSaving,  setMenuSaving]  = useState(false);
    const [menuSaved,   setMenuSaved]   = useState(false);
    const importRef = useRef();

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
    }, []);

    const handleSave = async (key, newVal) => {
        setSavingKey(key);
        try {
            await settingsAPI.update({ key, value: newVal });
            setSettings(prev => ({ ...prev, [key]: newVal }));
            setSavedKey(key);
            setTimeout(() => setSavedKey(null), 2000);
        } catch (e) {
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

            </div>
        </div>
    );
}
