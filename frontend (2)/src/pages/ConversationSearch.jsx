import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, MessageCircle, User, Calendar, TrendingUp } from 'lucide-react';
import { conversationsAPI } from '../utils/api';

export default function ConversationSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedChat, setSelectedChat] = useState(null);
    const [contextMessages, setContextMessages] = useState([]);
    const [stats, setStats] = useState(null);

    // Загрузка статистики при монтировании
    useState(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const response = await conversationsAPI.getStats();
            setStats(response.data.stats);
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        try {
            setLoading(true);
            const response = await conversationsAPI.search(query, selectedChat, 20);
            setResults(response.data.results);
        } catch (error) {
            console.error('Ошибка поиска:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadContext = async (messageId) => {
        try {
            const response = await conversationsAPI.getContext(messageId, 5);
            setContextMessages(response.data.context);
        } catch (error) {
            console.error('Ошибка загрузки контекста:', error);
        }
    };

    return (
        <div className="page-container">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="page-header"
            >
                <div>
                    <h1 className="neon-glow">
                        <Search className="inline-icon" />
                        Семантический поиск по диалогам
                    </h1>
                    <p className="page-subtitle">
                        Поиск по смыслам, а не по ключевым словам
                    </p>
                </div>
            </motion.div>

            {/* Статистика */}
            {stats && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="stats-grid"
                    style={{ marginBottom: '24px' }}
                >
                    <div className="stat-card">
                        <MessageCircle className="stat-icon" />
                        <div>
                            <div className="stat-value">{stats.total_messages.toLocaleString()}</div>
                            <div className="stat-label">Всего сообщений</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <TrendingUp className="stat-icon" />
                        <div>
                            <div className="stat-value">{stats.total_indexed.toLocaleString()}</div>
                            <div className="stat-label">Проиндексировано</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <User className="stat-icon" />
                        <div>
                            <div className="stat-value">{stats.chats_count}</div>
                            <div className="stat-label">Чатов</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <Filter className="stat-icon" />
                        <div>
                            <div className="stat-value">{stats.index_coverage}%</div>
                            <div className="stat-label">Покрытие индекса</div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Форма поиска */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card"
            >
                <form onSubmit={handleSearch} className="search-form">
                    <div className="form-group">
                        <label>
                            <Search size={18} />
                            Поисковый запрос
                        </label>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Например: обсуждение проекта, планы на выходные..."
                            className="input-field"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>
                                <Filter size={18} />
                                Фильтр по чату (опционально)
                            </label>
                            <input
                                type="number"
                                value={selectedChat || ''}
                                onChange={(e) => setSelectedChat(e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="ID чата"
                                className="input-field"
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? (
                            <>
                                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                                Поиск...
                            </>
                        ) : (
                            <>
                                <Search size={16} />
                                Найти
                            </>
                        )}
                    </button>
                </form>
            </motion.div>

            {/* Результаты поиска */}
            {results.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="results-container"
                >
                    <h2 className="section-title">
                        Найдено результатов: {results.length}
                    </h2>

                    <div className="results-list">
                        {results.map((result, index) => (
                            <motion.div
                                key={result.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="result-card"
                                onClick={() => loadContext(result.id)}
                            >
                                <div className="result-header">
                                    <div className="result-sender">
                                        <User size={16} />
                                        {result.sender}
                                        {result.is_outgoing && <span className="badge">Вы</span>}
                                    </div>
                                    <div className="result-meta">
                                        <Calendar size={14} />
                                        {new Date(result.date).toLocaleString('ru-RU')}
                                    </div>
                                </div>

                                <div className="result-message">
                                    {result.message}
                                </div>

                                <div className="result-similarity">
                                    Релевантность: {(result.similarity * 100).toFixed(1)}%
                                </div>

                                {result.context && (
                                    <details className="result-context">
                                        <summary>Показать контекст</summary>
                                        <pre>{result.context}</pre>
                                    </details>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Контекст сообщения */}
            {contextMessages.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="context-modal"
                    onClick={() => setContextMessages([])}
                >
                    <div className="context-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Контекст диалога</h3>
                        <div className="context-messages">
                            {contextMessages.map((msg) => (
                                <div key={msg.id} className={`context-message ${msg.is_outgoing ? 'outgoing' : 'incoming'}`}>
                                    <div className="context-sender">{msg.sender}</div>
                                    <div className="context-text">{msg.text}</div>
                                    <div className="context-time">
                                        {new Date(msg.date).toLocaleTimeString('ru-RU')}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="btn btn-secondary" onClick={() => setContextMessages([])}>
                            Закрыть
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Пустое состояние */}
            {!loading && results.length === 0 && query && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="empty-state"
                >
                    <Search size={48} color="var(--neon-cyan)" />
                    <h3>Ничего не найдено</h3>
                    <p>Попробуйте изменить запрос или убрать фильтры</p>
                </motion.div>
            )}
        </div>
    );
}
