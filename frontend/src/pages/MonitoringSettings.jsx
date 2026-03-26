import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Filter, MessageSquare } from 'lucide-react';
import { monitoringAPI, responsesAPI } from '../utils/api';

export default function MonitoringSettings() {
    const [chats, setChats] = useState([]);
    const [filters, setFilters] = useState([]);
    const [responses, setResponses] = useState([]);
    const [showAddChat, setShowAddChat] = useState(false);
    const [showAddFilter, setShowAddFilter] = useState(false);
    const [showAddResponse, setShowAddResponse] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [chatsRes, filtersRes, responsesRes] = await Promise.all([
                monitoringAPI.getChats(),
                monitoringAPI.getFilters(),
                responsesAPI.getTemplates(),
            ]);

            setChats(chatsRes.data.chats);
            setFilters(filtersRes.data.filters);
            setResponses(responsesRes.data.templates);
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    };

    const handleAddChat = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await monitoringAPI.addChat({
                session_id: 1, // TODO: получать из контекста
                chat_id: parseInt(formData.get('chat_id')),
                chat_title: formData.get('chat_title'),
                chat_username: formData.get('chat_username'),
            });

            setShowAddChat(false);
            loadData();
        } catch (error) {
            console.error('Ошибка добавления чата:', error);
        }
    };

    const handleAddFilter = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await monitoringAPI.createFilter({
                session_id: 1,
                name: formData.get('name'),
                filter_type: formData.get('filter_type'),
                pattern: formData.get('pattern'),
                case_sensitive: formData.get('case_sensitive') === 'on',
                chat_ids: [],
            });

            setShowAddFilter(false);
            loadData();
        } catch (error) {
            console.error('Ошибка создания фильтра:', error);
        }
    };

    const handleAddResponse = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await responsesAPI.createTemplate({
                session_id: 1,
                name: formData.get('name'),
                response_type: formData.get('response_type'),
                template_text: formData.get('template_text'),
                use_ai: formData.get('use_ai') === 'on',
                use_rag: formData.get('use_rag') === 'on',
                filter_ids: [],
            });

            setShowAddResponse(false);
            loadData();
        } catch (error) {
            console.error('Ошибка создания ответа:', error);
        }
    };

    const handleDeleteChat = async (id) => {
        try {
            await monitoringAPI.removeChat(id);
            loadData();
        } catch (error) {
            console.error('Ошибка удаления чата:', error);
        }
    };

    const handleToggleChat = async (id) => {
        try {
            await monitoringAPI.toggleChat(id);
            loadData();
        } catch (error) {
            console.error('Ошибка переключения чата:', error);
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2 className="page-title">Настройки мониторинга</h2>
                <p className="page-subtitle">Управление чатами, фильтрами и автоответами</p>
            </div>

            {/* Отслеживаемые чаты */}
            <motion.div
                className="card mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3>
                        <MessageSquare size={20} style={{ display: 'inline', marginRight: '8px' }} />
                        Отслеживаемые чаты
                    </h3>
                    <button className="btn btn-primary" onClick={() => setShowAddChat(!showAddChat)}>
                        <Plus size={16} style={{ marginRight: '8px' }} />
                        Добавить чат
                    </button>
                </div>

                {showAddChat && (
                    <form onSubmit={handleAddChat} style={{ marginBottom: '24px', padding: '20px', background: 'var(--bg-darker)', borderRadius: '4px' }}>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">ID чата</label>
                                <input type="number" name="chat_id" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Название</label>
                                <input type="text" name="chat_title" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Username</label>
                                <input type="text" name="chat_username" />
                            </div>
                        </div>
                        <button type="submit" className="btn btn-success">Добавить</button>
                    </form>
                )}

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
                            {chats.map((chat) => (
                                <tr key={chat.id}>
                                    <td>{chat.chat_title}</td>
                                    <td>{chat.chat_id}</td>
                                    <td>{chat.chat_username || '—'}</td>
                                    <td>
                                        {chat.is_active ? (
                                            <span className="badge badge-success">Активен</span>
                                        ) : (
                                            <span className="badge badge-danger">Неактивен</span>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleToggleChat(chat.id)}
                                            style={{ padding: '6px 12px', fontSize: '0.8rem', marginRight: '8px' }}
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

            {/* Фильтры и автоответы в две колонки */}
            <div className="grid grid-2">
                {/* Фильтры */}
                <motion.div
                    className="card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3>
                            <Filter size={20} style={{ display: 'inline', marginRight: '8px' }} />
                            Фильтры
                        </h3>
                        <button className="btn btn-primary" onClick={() => setShowAddFilter(!showAddFilter)}>
                            <Plus size={16} />
                        </button>
                    </div>

                    {showAddFilter && (
                        <form onSubmit={handleAddFilter} style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-darker)', borderRadius: '4px' }}>
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
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" name="case_sensitive" />
                                    <span>Учитывать регистр</span>
                                </label>
                            </div>
                            <button type="submit" className="btn btn-success">Создать</button>
                        </form>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filters.map((filter) => (
                            <div key={filter.id} style={{ padding: '12px', background: 'var(--bg-darker)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div>
                                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{filter.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            <span className="badge badge-info">{filter.filter_type}</span>
                                            <span style={{ marginLeft: '8px' }}>{filter.pattern}</span>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => monitoringAPI.deleteFilter(filter.id).then(loadData)}
                                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Автоответы */}
                <motion.div
                    className="card"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3>Автоответы</h3>
                        <button className="btn btn-primary" onClick={() => setShowAddResponse(!showAddResponse)}>
                            <Plus size={16} />
                        </button>
                    </div>

                    {showAddResponse && (
                        <form onSubmit={handleAddResponse} style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-darker)', borderRadius: '4px' }}>
                            <div className="form-group">
                                <label className="form-label">Название</label>
                                <input type="text" name="name" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Тип</label>
                                <select name="response_type" required>
                                    <option value="template">Шаблон</option>
                                    <option value="ai_generated">AI генерация</option>
                                    <option value="rag">RAG</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Текст</label>
                                <textarea name="template_text" rows="3" required></textarea>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" name="use_ai" />
                                    <span>Использовать AI</span>
                                </label>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" name="use_rag" />
                                    <span>Использовать RAG</span>
                                </label>
                            </div>
                            <button type="submit" className="btn btn-success">Создать</button>
                        </form>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {responses.map((response) => (
                            <div key={response.id} style={{ padding: '12px', background: 'var(--bg-darker)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{response.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            <span className="badge badge-info">{response.response_type}</span>
                                            {response.use_ai && <span className="badge badge-success" style={{ marginLeft: '4px' }}>AI</span>}
                                            {response.use_rag && <span className="badge badge-success" style={{ marginLeft: '4px' }}>RAG</span>}
                                        </div>
                                        <div style={{ fontSize: '0.9rem' }}>{response.template_text?.substring(0, 100)}...</div>
                                    </div>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => responsesAPI.deleteTemplate(response.id).then(loadData)}
                                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                    >
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
