import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, MessageCircle, Send, AlertCircle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { statisticsAPI } from '../utils/api';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [messageData, setMessageData] = useState([]);
    const [responseData, setResponseData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [overview, messages, responses] = await Promise.all([
                statisticsAPI.getOverview(),
                statisticsAPI.getMessages(null, 7),
                statisticsAPI.getResponses(null, 7),
            ]);

            setStats(overview.data);
            setMessageData(messages.data.data);
            setResponseData(responses.data.data);
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p className="loading-text">Загрузка данных...</p>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2 className="page-title">Дашборд</h2>
                <p className="page-subtitle">Статистика и мониторинг в реальном времени</p>
            </div>

            {/* Статистика */}
            <div className="grid grid-4 mb-4">
                <motion.div
                    className="stat-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="stat-label">
                        <Activity size={16} style={{ display: 'inline', marginRight: '8px' }} />
                        Сообщений сегодня
                    </div>
                    <div className="stat-value">{stats?.today?.messages_monitored || 0}</div>
                    <div className="stat-change positive">+{stats?.today?.messages_matched || 0} совпадений</div>
                </motion.div>

                <motion.div
                    className="stat-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="stat-label">
                        <MessageCircle size={16} style={{ display: 'inline', marginRight: '8px' }} />
                        Всего обработано
                    </div>
                    <div className="stat-value">{stats?.total?.total_messages || 0}</div>
                    <div className="stat-change">{stats?.total?.total_matched || 0} совпадений</div>
                </motion.div>

                <motion.div
                    className="stat-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="stat-label">
                        <Send size={16} style={{ display: 'inline', marginRight: '8px' }} />
                        Ответов отправлено
                    </div>
                    <div className="stat-value">{stats?.total?.total_responses || 0}</div>
                    <div className="stat-change positive">Сегодня: {stats?.today?.responses_sent || 0}</div>
                </motion.div>

                <motion.div
                    className="stat-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="stat-label">
                        <AlertCircle size={16} style={{ display: 'inline', marginRight: '8px' }} />
                        Активных чатов
                    </div>
                    <div className="stat-value">{stats?.active_chats || 0}</div>
                    <div className="stat-change">Фильтров: {stats?.active_filters || 0}</div>
                </motion.div>
            </div>

            {/* Графики */}
            <div className="grid grid-2">
                <motion.div
                    className="card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <h3 style={{ marginBottom: '20px' }}>Мониторинг сообщений (7 дней)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={messageData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 255, 0.1)" />
                            <XAxis dataKey="date" stroke="var(--text-muted)" />
                            <YAxis stroke="var(--text-muted)" />
                            <Tooltip
                                contentStyle={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="messages_monitored"
                                stroke="var(--neon-cyan)"
                                strokeWidth={2}
                                dot={{ fill: 'var(--neon-cyan)', r: 4 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="messages_matched"
                                stroke="var(--neon-magenta)"
                                strokeWidth={2}
                                dot={{ fill: 'var(--neon-magenta)', r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </motion.div>

                <motion.div
                    className="card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <h3 style={{ marginBottom: '20px' }}>Отправленные ответы (7 дней)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={responseData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 255, 0.1)" />
                            <XAxis dataKey="date" stroke="var(--text-muted)" />
                            <YAxis stroke="var(--text-muted)" />
                            <Tooltip
                                contentStyle={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                }}
                            />
                            <Bar dataKey="responses_sent" fill="var(--neon-green)" />
                            <Bar dataKey="responses_failed" fill="var(--neon-pink)" />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>
        </div>
    );
}
