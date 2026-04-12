import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';
import { settingsAPI } from '../utils/api';

/* ── Список пунктов меню, которые можно скрывать ── */
export const NAV_ITEMS_CONFIG = [
    { key: 'dashboard',      label: 'Дашборд',        fixed: true  },
    { key: 'auth',           label: 'Авторизация ТГ', fixed: false },
    { key: 'monitoring',     label: 'Мониторинг',     fixed: false },
    { key: 'ai-settings',   label: 'AI & RAG',        fixed: false },
    { key: 'message-history',label: 'История',        fixed: false },
    { key: 'conversations',  label: 'Поиск',          fixed: false },
    { key: 'broadcast',      label: 'Рассылка',       fixed: false },
    { key: 'guide',          label: 'Инструкция',     fixed: false },
];

export const DEFAULT_MENU_VISIBILITY = {
    dashboard:        true,
    auth:             true,
    monitoring:       true,
    'ai-settings':    false,
    'message-history':true,
    conversations:    false,
    broadcast:        true,
    guide:            true,
};

export default function SettingsPage() {
    const [visibility, setVisibility]   = useState(DEFAULT_MENU_VISIBILITY);
    const [loading,    setLoading]      = useState(true);
    const [saving,     setSaving]       = useState(false);
    const [saved,      setSaved]        = useState(false);

    useEffect(() => {
        settingsAPI.get()
            .then(res => {
                const mv = res.data?.settings?.menu_visibility;
                if (mv && typeof mv === 'object') {
                    setVisibility({ ...DEFAULT_MENU_VISIBILITY, ...mv });
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const toggle = (key) => {
        setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
        setSaved(false);
    };

    const save = async () => {
        setSaving(true);
        try {
            await settingsAPI.update({ key: 'menu_visibility', value: visibility });
            setSaved(true);
            // перезагружаем страницу чтобы меню обновилось
            setTimeout(() => window.location.reload(), 800);
        } catch (e) {
            console.error('Ошибка сохранения', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Settings size={24} />
                        Настройки
                    </h2>
                    <p className="page-subtitle">Персонализация интерфейса</p>
                </div>
            </div>

            {/* ── Видимость пунктов меню ── */}
            <motion.div
                className="card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ marginBottom: 24 }}
            >
                <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Eye size={18} color="var(--neon-cyan)" />
                    Видимость пунктов меню
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 20 }}>
                    Включайте и отключайте разделы. Изменения применяются после сохранения.
                </p>

                {loading ? (
                    <div className="loading-container" style={{ minHeight: 100 }}>
                        <div className="spinner" />
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {NAV_ITEMS_CONFIG.map(item => (
                            <label
                                key={item.key}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '14px 18px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${visibility[item.key] ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                    borderRadius: 10,
                                    cursor: item.fixed ? 'not-allowed' : 'pointer',
                                    opacity: item.fixed ? 0.6 : 1,
                                    transition: 'all 0.2s',
                                }}
                                onClick={() => !item.fixed && toggle(item.key)}
                            >
                                <span style={{
                                    fontWeight: 500,
                                    color: visibility[item.key] ? 'var(--text-primary)' : 'var(--text-muted)',
                                }}>
                                    {item.label}
                                    {item.fixed && (
                                        <span style={{ fontSize: '0.75rem', marginLeft: 8, color: 'var(--text-muted)' }}>
                                            (всегда видимо)
                                        </span>
                                    )}
                                </span>

                                {/* Toggle switch */}
                                <div style={{
                                    position: 'relative',
                                    width: 44, height: 24,
                                    background: (item.fixed || visibility[item.key])
                                        ? 'var(--neon-cyan)'
                                        : 'rgba(255,255,255,0.15)',
                                    borderRadius: 12,
                                    transition: 'background 0.2s',
                                    flexShrink: 0,
                                }}>
                                    <div style={{
                                        position: 'absolute',
                                        top: 3,
                                        left: (item.fixed || visibility[item.key]) ? 23 : 3,
                                        width: 18, height: 18,
                                        borderRadius: '50%',
                                        background: '#fff',
                                        transition: 'left 0.2s',
                                    }} />
                                </div>
                            </label>
                        ))}
                    </div>
                )}

                <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        className="btn btn-primary"
                        onClick={save}
                        disabled={saving || loading}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        {saving
                            ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Сохраняем...</>
                            : <><Save size={16} /> Сохранить</>
                        }
                    </button>
                    {saved && (
                        <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            style={{ color: 'var(--neon-green)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}
                        >
                            <CheckCircle size={16} /> Сохранено!
                        </motion.span>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
