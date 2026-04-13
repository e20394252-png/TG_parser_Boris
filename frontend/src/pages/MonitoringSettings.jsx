import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Filter, MessageSquare, Link, Search, CheckCircle, XCircle, Loader } from 'lucide-react';
import { monitoringAPI, responsesAPI, authAPI } from '../utils/api';

/* ── Утилита: парсим username прямо на фронте для placeholder ── */
function previewUsername(q) {
    if (!q) return '';
    if (q.includes('t.me/')) return '@' + q.split('t.me/')[1].split('/')[0].split('?')[0];
    if (q.startsWith('@')) return q;
    return '@' + q;
}

export default function MonitoringSettings() {
    const [chats,     setChats]     = useState([]);
    const [filters,   setFilters]   = useState([]);
    const [responses, setResponses] = useState([]);
    const [sessionId, setSessionId] = useState(null);   // ID активной TG-сессии

    /* --- Add-chat state --- */
    const [showAddChat,   setShowAddChat]   = useState(false);
    const [chatQuery,     setChatQuery]     = useState('');     // input от пользователя
    const [resolving,     setResolving]     = useState(false);
    const [resolveError,  setResolveError]  = useState('');
    const [resolvedChat,  setResolvedChat]  = useState(null);   // {chat_id, title, username}
    const [adding,        setAdding]        = useState(false);

    /* --- Filter state --- */
    const [showAddFilter, setShowAddFilter] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [chatsRes, filtersRes, responsesRes, statusRes] = await Promise.all([
                monitoringAPI.getChats(),
                monitoringAPI.getFilters(),
                responsesAPI.getTemplates(),
                authAPI.getStatus(),
            ]);
            setChats(chatsRes.data.chats || []);
            setFilters(filtersRes.data.filters || []);
            setResponses(responsesRes.data.templates || []);

            // Берём первую активную сессию
            const sessions = statusRes.data?.sessions || [];
            const active = sessions.find(s => s.is_active) || sessions[0];
            if (active) setSessionId(active.id);
        } catch (err) {
            console.error('Ошибка загрузки:', err);
        }
    };

    /* ── Резолв чата ── */
    const handleResolve = async (e) => {
        e.preventDefault();
        if (!chatQuery.trim()) return;
        if (!sessionId) {
            setResolveError('Нет активной Telegram-сессии. Авторизуйтесь в разделе «Авторизация ТГ».');
            return;
        }
        setResolving(true);
        setResolveError('');
        setResolvedChat(null);
        try {
            const res = await monitoringAPI.resolveChat({ session_id: sessionId, query: chatQuery.trim() });
            setResolvedChat(res.data);
        } catch (err) {
            setResolveError(err.response?.data?.detail || 'Не удалось найти чат');
        } finally {
            setResolving(false);
        }
    };

    /* ── Добавление чата после резолва ── */
    const handleConfirmAdd = async () => {
        if (!resolvedChat || !sessionId) return;
        setAdding(true);
        try {
            await monitoringAPI.addChat({
                session_id:    sessionId,
                chat_id:       resolvedChat.chat_id,
                chat_title:    resolvedChat.title,
                chat_username: resolvedChat.username,
            });
            setShowAddChat(false);
            setChatQuery('');
            setResolvedChat(null);
            setResolveError('');
            loadData();
        } catch (err) {
            setResolveError(err.response?.data?.detail || 'Ошибка при добавлении чата');
        } finally {
            setAdding(false);
        }
    };

    const resetAddForm = () => {
        setShowAddChat(false);
        setChatQuery('');
        setResolvedChat(null);
        setResolveError('');
    };

    /* ── Действия ── */
    const handleDeleteChat  = async (id) => { try { await monitoringAPI.removeChat(id); loadData(); } catch(e){} };
    const handleToggleChat  = async (id) => { try { await monitoringAPI.toggleChat(id); loadData(); } catch(e){} };

    const handleAddFilter = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            await monitoringAPI.createFilter({
                session_id:     sessionId || 1,
                name:           fd.get('name'),
                filter_type:    fd.get('filter_type'),
                pattern:        fd.get('pattern'),
                case_sensitive: fd.get('case_sensitive') === 'on',
                chat_ids:       [],
            });
            setShowAddFilter(false);
            loadData();
        } catch(e) { console.error(e); }
    };

    /* ─────────────────────────── JSX ─────────────────────────── */
    return (
        <div className="fade-in">
            <div className="page-header">
                <h2 className="page-title">Настройки мониторинга</h2>
                <p className="page-subtitle">Управление чатами, фильтрами и автоответами</p>
            </div>

            {/* ── ОТСЛЕЖИВАЕМЫЕ ЧАТЫ ── */}
            <motion.div className="card mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h3>
                        <MessageSquare size={20} style={{ display: 'inline', marginRight: 8 }} />
                        Отслеживаемые чаты
                    </h3>
                    <button className="btn btn-primary" onClick={() => showAddChat ? resetAddForm() : setShowAddChat(true)}>
                        <Plus size={16} style={{ marginRight: 8 }} />
                        {showAddChat ? 'Отмена' : 'Добавить чат'}
                    </button>
                </div>

                {/* ── Форма добавления ── */}
                <AnimatePresence>
                {showAddChat && (
                    <motion.div
                        key="add-chat-form"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden', marginBottom: 24 }}
                    >
                        <div style={{ padding: '20px 24px', background: 'var(--bg-darker)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Link size={13} /> Вставьте ссылку или @username чата
                            </p>

                            {/* Input row */}
                            <form onSubmit={handleResolve} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                                <input
                                    value={chatQuery}
                                    onChange={e => { setChatQuery(e.target.value); setResolvedChat(null); setResolveError(''); }}
                                    placeholder="https://t.me/sochiworld  или  @sochiworld"
                                    disabled={resolving}
                                    style={{
                                        flex: 1,
                                        background: 'var(--bg-dark)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        padding: '10px 14px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                    }}
                                />
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={resolving || !chatQuery.trim()}
                                    style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', padding: '10px 20px' }}
                                >
                                    {resolving
                                        ? <><Loader size={14} className="spin" /> Поиск...</>
                                        : <><Search size={14} /> Найти</>}
                                </button>
                            </form>

                            {/* Error */}
                            {resolveError && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--neon-pink)', fontSize: '0.85rem', marginBottom: 10 }}>
                                    <XCircle size={15} /> {resolveError}
                                </motion.div>
                            )}

                            {/* Preview card */}
                            {resolvedChat && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        background: 'rgba(0,212,255,.05)',
                                        border: '1px solid rgba(0,212,255,.3)',
                                        borderRadius: 10,
                                        padding: '14px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 12,
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <CheckCircle size={15} color="var(--neon-cyan)" />
                                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{resolvedChat.title}</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {resolvedChat.username || '—'}&nbsp;&nbsp;·&nbsp;&nbsp;ID: {resolvedChat.chat_id}
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleConfirmAdd}
                                        disabled={adding}
                                        style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}
                                    >
                                        {adding
                                            ? <><Loader size={13} className="spin" /> Добавляем...</>
                                            : <><Plus size={13} /> Добавить</>}
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>

                {/* Таблица */}
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Название</th>
                                <th>ID</th>
                                <th>Username</th>
                                <th>Статус</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chats.length === 0 && (
                                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>Нет отслеживаемых чатов</td></tr>
                            )}
                            {chats.map((chat) => (
                                <tr key={chat.id}>
                                    <td>{chat.chat_title}</td>
                                    <td>{chat.chat_id}</td>
                                    <td>{chat.chat_username || '—'}</td>
                                    <td>
                                        {chat.is_active
                                            ? <span className="badge badge-success">Активен</span>
                                            : <span className="badge badge-danger">Неактивен</span>}
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleToggleChat(chat.id)}
                                            style={{ padding: '6px 12px', fontSize: '0.8rem', marginRight: 8 }}
                                        >
                                            {chat.is_active ? 'Выкл' : 'Вкл'}
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => handleDeleteChat(chat.id)}
                                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* ── Фильтры ── */}
            <div className="grid grid-2">
                <motion.div className="card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h3><Filter size={20} style={{ display: 'inline', marginRight: 8 }} />Фильтры</h3>
                        <button className="btn btn-primary" onClick={() => setShowAddFilter(!showAddFilter)}><Plus size={16} /></button>
                    </div>

                    {showAddFilter && (
                        <form onSubmit={handleAddFilter} style={{ marginBottom: 20, padding: 16, background: 'var(--bg-darker)', borderRadius: 4 }}>
                            <div className="form-group">
                                <label className="form-label">Название</label>
                                <input type="text" name="name" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Тип</label>
                                <select name="filter_type" required>
                                    <option value="keyword">Ключевое слово</option>
                                    <option value="regex">Регулярное выражение</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Паттерн</label>
                                <input type="text" name="pattern" required />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input type="checkbox" name="case_sensitive" />
                                    <span>Учитывать регистр</span>
                                </label>
                            </div>
                            <button type="submit" className="btn btn-success">Создать</button>
                        </form>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {filters.map((f) => (
                            <div key={f.id} style={{ padding: 12, background: 'var(--bg-darker)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            <span className="badge badge-info">{f.filter_type}</span>
                                            <span style={{ marginLeft: 8 }}>{f.pattern}</span>
                                        </div>
                                    </div>
                                    <button className="btn btn-danger" onClick={() => monitoringAPI.deleteFilter(f.id).then(loadData)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* ── Автоответы ── */}
                <motion.div className="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                    <h3 style={{ marginBottom: 24 }}>Автоответы</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {responses.map((r) => (
                            <div key={r.id} style={{ padding: 12, background: 'var(--bg-darker)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                            <span className="badge badge-info">{r.response_type}</span>
                                            {r.use_ai  && <span className="badge badge-success" style={{ marginLeft: 4 }}>AI</span>}
                                            {r.use_rag && <span className="badge badge-success" style={{ marginLeft: 4 }}>RAG</span>}
                                        </div>
                                        <div style={{ fontSize: '0.9rem' }}>{r.template_text?.substring(0, 100)}...</div>
                                    </div>
                                    <button className="btn btn-danger" onClick={() => responsesAPI.deleteTemplate(r.id).then(loadData)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
