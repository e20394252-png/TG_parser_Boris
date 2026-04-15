import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Filter, MessageSquare, Link, Search, CheckCircle, XCircle, Loader, Edit2, Zap } from 'lucide-react';
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
    const [editingFilter, setEditingFilter] = useState(null);

    /* --- Response state --- */
    const [showAddResponse, setShowAddResponse] = useState(false);
    const [editingResponse, setEditingResponse] = useState(null);

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

    const handleUpdateFilter = async (e, filterId) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            await monitoringAPI.updateFilter(filterId, {
                session_id:     sessionId || 1,
                name:           fd.get('name'),
                filter_type:    fd.get('filter_type'),
                pattern:        fd.get('pattern'),
                case_sensitive: fd.get('case_sensitive') === 'on',
                chat_ids:       [], 
            });
            setEditingFilter(null);
            loadData();
        } catch(e) { console.error(e); }
    };

    const handleAddResponse = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const selectedFilters = Array.from(fd.getAll('filter_ids')).map(Number);
        try {
            await responsesAPI.createTemplate({
                session_id:     sessionId || 1,
                name:           fd.get('name'),
                response_type:  fd.get('response_type'),
                template_text:  fd.get('template_text'),
                use_ai:         fd.get('use_ai') === 'on',
                use_rag:        fd.get('use_rag') === 'on',
                filter_ids:     selectedFilters,
            });
            setShowAddResponse(false);
            loadData();
        } catch(e) { console.error(e); }
    };

    const handleUpdateResponse = async (e, responseId) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const selectedFilters = Array.from(fd.getAll('filter_ids')).map(Number);
        try {
            await responsesAPI.updateTemplate(responseId, {
                session_id:     sessionId || 1,
                name:           fd.get('name'),
                response_type:  fd.get('response_type'),
                template_text:  fd.get('template_text'),
                use_ai:         fd.get('use_ai') === 'on',
                use_rag:        fd.get('use_rag') === 'on',
                filter_ids:     selectedFilters,
            });
            setEditingResponse(null);
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
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="submit" className="btn btn-success">Создать</button>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddFilter(false)}>Отмена</button>
                            </div>
                        </form>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {filters.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Нет фильтров</div>}
                        {filters.map((f) => (
                            editingFilter === f.id ? (
                                <form key={`edit-filter-${f.id}`} onSubmit={(e) => handleUpdateFilter(e, f.id)} style={{ padding: 16, background: 'var(--bg-darker)', borderRadius: 4, border: '1px solid var(--neon-purple-dim)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Название</label>
                                        <input type="text" name="name" defaultValue={f.name} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Тип</label>
                                        <select name="filter_type" defaultValue={f.filter_type} required>
                                            <option value="keyword">Ключевое слово</option>
                                            <option value="regex">Регулярное выражение</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Паттерн</label>
                                        <input type="text" name="pattern" defaultValue={f.pattern} required />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input type="checkbox" name="case_sensitive" defaultChecked={f.case_sensitive} />
                                            <span>Учитывать регистр</span>
                                        </label>
                                    </div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <button type="submit" className="btn btn-success">Сохранить</button>
                                        <button type="button" className="btn btn-secondary" onClick={() => setEditingFilter(null)}>Отмена</button>
                                    </div>
                                </form>
                            ) : (
                                <div key={f.id} style={{ padding: 12, background: 'var(--bg-darker)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                <span className="badge badge-info">{f.filter_type}</span>
                                                <span style={{ marginLeft: 8 }}>{f.pattern}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-primary" onClick={() => setEditingFilter(f.id)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                                <Edit2 size={12} />
                                            </button>
                                            <button className="btn btn-danger" onClick={() => monitoringAPI.deleteFilter(f.id).then(loadData)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </motion.div>

                {/* ── Автоответы ── */}
                <motion.div className="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h3><Zap size={20} style={{ display: 'inline', marginRight: 8 }} />Автоответы</h3>
                        <button className="btn btn-primary" onClick={() => setShowAddResponse(!showAddResponse)}><Plus size={16} /></button>
                    </div>

                    {showAddResponse && (
                        <form onSubmit={handleAddResponse} style={{ marginBottom: 20, padding: 16, background: 'var(--bg-darker)', borderRadius: 4 }}>
                            <div className="form-group">
                                <label className="form-label">Название</label>
                                <input type="text" name="name" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Тип</label>
                                <select name="response_type" required>
                                    <option value="template">Обычный шаблон</option>
                                    <option value="ai_generated">AI Отвечальщик</option>
                                    <option value="rag">Поиск по базе (RAG)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Текст шаблона</label>
                                <textarea name="template_text" rows="3" style={{ width: '100%', background: 'var(--bg-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px' }}></textarea>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <input type="checkbox" name="use_ai" /> <span>Использовать AI для доработки текста</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input type="checkbox" name="use_rag" /> <span>Использовать базу знаний (RAG)</span>
                                </label>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Привязать к фильтрам</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '150px', overflowY: 'auto', padding: '10px', background: 'var(--bg-dark)', borderRadius: 8 }}>
                                    {filters.length === 0 && <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Нет созданных фильтров</span>}
                                    {filters.map(f => (
                                        <label key={`filter-cb-${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input type="checkbox" name="filter_ids" value={f.id} />
                                            <span>{f.name} <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>({f.pattern})</span></span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="submit" className="btn btn-success">Создать</button>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddResponse(false)}>Отмена</button>
                            </div>
                        </form>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {responses.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Нет автоответов</div>}
                        {responses.map((r) => (
                            editingResponse === r.id ? (
                                <form key={`edit-response-${r.id}`} onSubmit={(e) => handleUpdateResponse(e, r.id)} style={{ padding: 16, background: 'var(--bg-darker)', borderRadius: 4, border: '1px solid var(--neon-purple-dim)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Название</label>
                                        <input type="text" name="name" defaultValue={r.name} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Тип</label>
                                        <select name="response_type" defaultValue={r.response_type} required>
                                            <option value="template">Обычный шаблон</option>
                                            <option value="ai_generated">AI Отвечальщик</option>
                                            <option value="rag">Поиск по базе (RAG)</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Текст шаблона</label>
                                        <textarea name="template_text" defaultValue={r.template_text || ''} rows="3" style={{ width: '100%', background: 'var(--bg-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px' }}></textarea>
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <input type="checkbox" name="use_ai" defaultChecked={r.use_ai} /> <span>Использовать AI</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input type="checkbox" name="use_rag" defaultChecked={r.use_rag} /> <span>Использовать RAG</span>
                                        </label>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Привязать к фильтрам</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '150px', overflowY: 'auto', padding: '10px', background: 'var(--bg-dark)', borderRadius: 8 }}>
                                            {filters.length === 0 && <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Нет созданных фильтров</span>}
                                            {filters.map(f => {
                                                let safeFilters = [];
                                                if (Array.isArray(r.filters)) safeFilters = r.filters;
                                                else if (typeof r.filters === 'string') {
                                                    try { safeFilters = JSON.parse(r.filters); } catch(e){}
                                                }
                                                return (
                                                <label key={`filter-edit-${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <input type="checkbox" name="filter_ids" value={f.id} defaultChecked={safeFilters.some(rf => rf.id === f.id)} />
                                                    <span>{f.name} <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>({f.pattern})</span></span>
                                                </label>
                                            )})}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <button type="submit" className="btn btn-success">Сохранить</button>
                                        <button type="button" className="btn btn-secondary" onClick={() => setEditingResponse(null)}>Отмена</button>
                                    </div>
                                </form>
                            ) : (
                                <div key={r.id} style={{ padding: 12, background: 'var(--bg-darker)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                                <span className="badge badge-info">{r.response_type}</span>
                                                {r.use_ai  && <span className="badge badge-success" style={{ marginLeft: 4 }}>AI</span>}
                                                {r.use_rag && <span className="badge badge-success" style={{ marginLeft: 4 }}>RAG</span>}
                                            </div>
                                            <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>{r.template_text?.substring(0, 100)}{r.template_text?.length > 100 ? '...' : ''}</div>
                                            
                                            {(() => {
                                                let safeFilters = [];
                                                if (Array.isArray(r.filters)) safeFilters = r.filters;
                                                else if (typeof r.filters === 'string') {
                                                    try { safeFilters = JSON.parse(r.filters); } catch(e){}
                                                }
                                                return safeFilters.length > 0 ? (
                                                    <div style={{ fontSize: '0.75rem', marginTop: 8 }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>Триггеры (фильтры): </span>
                                                        {safeFilters.map(f => <span key={f.id} className="badge" style={{background: 'rgba(255,255,255,0.1)', marginRight: 4, display: 'inline-block'}}>{f.name}</span>)}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-primary" onClick={() => setEditingResponse(r.id)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                                <Edit2 size={12} />
                                            </button>
                                            <button className="btn btn-danger" onClick={() => responsesAPI.deleteTemplate(r.id).then(loadData)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
