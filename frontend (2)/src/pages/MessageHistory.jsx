import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, User, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
import { responsesAPI } from '../utils/api';

export default function MessageHistory() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const limit = 50;

    useEffect(() => {
        loadHistory();
    }, [page]);

    const loadHistory = async () => {
        try {
            const response = await responsesAPI.getHistory(null, limit, page * limit);
            setHistory(response.data.history);
            setTotal(response.data.total);
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p className="loading-text">Загрузка истории...</p>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2 className="page-title">История сообщений</h2>
                <p className="page-subtitle">Все обработанные сообщения и отправленные ответы</p>
            </div>

            <motion.div
                className="card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                        Всего записей: {total}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => setPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                            style={{ padding: '8px 16px' }}
                        >
                            ← Назад
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => setPage(page + 1)}
                            disabled={(page + 1) * limit >= total}
                            style={{ padding: '8px 16px' }}
                        >
                            Вперед →
                        </button>
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Время</th>
                                <th>Отправитель</th>
                                <th>Исходное сообщение</th>
                                <th>Ответ</th>
                                <th>Шаблон</th>
                                <th>Статус</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Clock size={14} color="var(--text-muted)" />
                                            <span style={{ fontSize: '0.85rem' }}>
                                                {new Date(item.sent_at).toLocaleString('ru-RU')}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <User size={14} color="var(--neon-cyan)" />
                                            <span>{item.sender_username || `ID: ${item.recipient_id}`}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <MessageSquare size={14} style={{ display: 'inline', marginRight: '6px' }} color="var(--text-muted)" />
                                            {item.original_message || '—'}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.response_text}
                                        </div>
                                    </td>
                                    <td>
                                        {item.response_template_name ? (
                                            <span className="badge badge-info">{item.response_template_name}</span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        {item.success ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--neon-green)' }}>
                                                <CheckCircle size={16} />
                                                <span>Отправлено</span>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--neon-pink)' }}>
                                                <XCircle size={16} />
                                                <span>Ошибка</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {history.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>
                        История пуста
                    </p>
                )}
            </motion.div>
        </div>
    );
}
