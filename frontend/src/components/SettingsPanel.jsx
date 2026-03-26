import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings as SettingsIcon, Save, Download, Upload } from 'lucide-react';
import { settingsAPI } from '../utils/api';

export default function SettingsPanel({ isOpen, onClose }) {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        try {
            const response = await settingsAPI.get();
            setSettings(response.data.settings);
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (key, value) => {
        try {
            setSaving(true);
            await settingsAPI.update({ key, value });
            setSettings({ ...settings, [key]: value });
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async () => {
        try {
            const response = await settingsAPI.export();
            const blob = new Blob([JSON.stringify(response.data.export, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `telegram-parser-settings-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        } catch (error) {
            console.error('Ошибка экспорта:', error);
        }
    };

    const handleImport = async (event) => {
        try {
            const file = event.target.files[0];
            if (!file) return;

            const text = await file.text();
            const importedSettings = JSON.parse(text);

            await settingsAPI.import({ settings: importedSettings });
            await loadSettings();
        } catch (error) {
            console.error('Ошибка импорта:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {/* Overlay */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="settings-overlay"
                onClick={onClose}
            />

            {/* Panel */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="settings-panel"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="settings-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <SettingsIcon size={24} color="var(--neon-cyan)" />
                        <h2>Настройки</h2>
                    </div>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="settings-content">
                    {loading ? (
                        <div className="loading-container">
                            <div className="spinner"></div>
                            <p>Загрузка настроек...</p>
                        </div>
                    ) : (
                        <>
                            {/* Общие настройки */}
                            <div className="settings-section">
                                <h3>Общие</h3>
                                <div className="settings-group">
                                    <label>
                                        <span>Язык</span>
                                        <select
                                            value={settings.general?.language || 'ru'}
                                            onChange={(e) => handleSave('general', { ...settings.general, language: e.target.value })}
                                        >
                                            <option value="ru">Русский</option>
                                            <option value="en">English</option>
                                        </select>
                                    </label>

                                    <label>
                                        <span>Тема</span>
                                        <select
                                            value={settings.general?.theme || 'dark'}
                                            onChange={(e) => handleSave('general', { ...settings.general, theme: e.target.value })}
                                        >
                                            <option value="dark">Темная</option>
                                            <option value="light">Светлая</option>
                                        </select>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={settings.general?.notifications || false}
                                            onChange={(e) => handleSave('general', { ...settings.general, notifications: e.target.checked })}
                                        />
                                        <span>Уведомления</span>
                                    </label>
                                </div>
                            </div>

                            {/* Telegram */}
                            <div className="settings-section">
                                <h3>Telegram</h3>
                                <div className="settings-group">
                                    <label>
                                        <span>Таймаут подключения (сек)</span>
                                        <input
                                            type="number"
                                            value={settings.telegram?.connection_timeout || 30}
                                            onChange={(e) => handleSave('telegram', { ...settings.telegram, connection_timeout: parseInt(e.target.value) })}
                                        />
                                    </label>

                                    <label>
                                        <span>Попытки переподключения</span>
                                        <input
                                            type="number"
                                            value={settings.telegram?.retry_attempts || 3}
                                            onChange={(e) => handleSave('telegram', { ...settings.telegram, retry_attempts: parseInt(e.target.value) })}
                                        />
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={settings.telegram?.auto_reconnect || false}
                                            onChange={(e) => handleSave('telegram', { ...settings.telegram, auto_reconnect: e.target.checked })}
                                        />
                                        <span>Автопереподключение</span>
                                    </label>
                                </div>
                            </div>

                            {/* AI */}
                            <div className="settings-section">
                                <h3>AI</h3>
                                <div className="settings-group">
                                    <label>
                                        <span>Провайдер по умолчанию</span>
                                        <select
                                            value={settings.ai?.default_provider || 'openai'}
                                            onChange={(e) => handleSave('ai', { ...settings.ai, default_provider: e.target.value })}
                                        >
                                            <option value="openai">OpenAI</option>
                                            <option value="anthropic">Anthropic</option>
                                            <option value="google">Google AI</option>
                                        </select>
                                    </label>

                                    <label>
                                        <span>Max Tokens</span>
                                        <input
                                            type="number"
                                            value={settings.ai?.max_tokens || 1000}
                                            onChange={(e) => handleSave('ai', { ...settings.ai, max_tokens: parseInt(e.target.value) })}
                                        />
                                    </label>

                                    <label>
                                        <span>Temperature</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="2"
                                            value={settings.ai?.temperature || 0.7}
                                            onChange={(e) => handleSave('ai', { ...settings.ai, temperature: parseFloat(e.target.value) })}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* RAG */}
                            <div className="settings-section">
                                <h3>RAG</h3>
                                <div className="settings-group">
                                    <label>
                                        <span>Размер контекста (сообщений)</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={settings.rag?.context_size || 3}
                                            onChange={(e) => handleSave('rag', { ...settings.rag, context_size: parseInt(e.target.value) })}
                                        />
                                    </label>

                                    <label>
                                        <span>Размер чанка</span>
                                        <input
                                            type="number"
                                            value={settings.rag?.chunk_size || 500}
                                            onChange={(e) => handleSave('rag', { ...settings.rag, chunk_size: parseInt(e.target.value) })}
                                        />
                                    </label>

                                    <label>
                                        <span>Перекрытие чанков</span>
                                        <input
                                            type="number"
                                            value={settings.rag?.chunk_overlap || 50}
                                            onChange={(e) => handleSave('rag', { ...settings.rag, chunk_overlap: parseInt(e.target.value) })}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Экспорт/Импорт */}
                            <div className="settings-section">
                                <h3>Резервное копирование</h3>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    <button className="btn btn-primary" onClick={handleExport}>
                                        <Download size={16} style={{ marginRight: '8px' }} />
                                        Экспорт настроек
                                    </button>
                                    <label className="btn btn-success" style={{ cursor: 'pointer', margin: 0 }}>
                                        <Upload size={16} style={{ marginRight: '8px' }} />
                                        Импорт настроек
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={handleImport}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!loading && (
                    <div className="settings-footer">
                        <button className="btn btn-success" onClick={() => onClose()} disabled={saving}>
                            <Save size={16} style={{ marginRight: '8px' }} />
                            {saving ? 'Сохранение...' : 'Готово'}
                        </button>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
