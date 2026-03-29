import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Key, Lock, CheckCircle, XCircle } from 'lucide-react';
import { authAPI } from '../utils/api';

export default function TelegramAuth() {
    const [step, setStep] = useState('phone'); // 'phone', 'code', 'success'
    const [sessions, setSessions] = useState([]);
    const [formData, setFormData] = useState({
        phone_number: '',
        api_id: '',
        api_hash: '',
        code: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            const response = await authAPI.getStatus();
            setSessions(response.data.sessions);
        } catch (error) {
            console.error('Ошибка загрузки сессий:', error);
        }
    };

    const handleStartAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authAPI.startTelegramAuth({
                phone_number: formData.phone_number,
                api_id: formData.api_id,
                api_hash: formData.api_hash,
            });

            if (response.data.success) {
                setStep('code');
            }
        } catch (error) {
            setError(error.response?.data?.detail || 'Ошибка при отправке кода');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitCode = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authAPI.submitCode({
                phone_number: formData.phone_number,
                code: formData.code,
                password: formData.password || null,
            });

            if (response.data.success) {
                setStep('success');
                loadSessions();
                // Сброс формы
                setTimeout(() => {
                    setStep('phone');
                    setFormData({
                        phone_number: '',
                        api_id: '',
                        api_hash: '',
                        code: '',
                        password: '',
                    });
                }, 3000);
            }
        } catch (error) {
            setError(error.response?.data?.detail || 'Ошибка при подтверждении кода');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async (sessionId) => {
        try {
            await authAPI.logout(sessionId);
            loadSessions();
        } catch (error) {
            console.error('Ошибка при выходе:', error);
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2 className="page-title">Авторизация Telegram</h2>
                <p className="page-subtitle">Подключение вашего Telegram аккаунта</p>
            </div>

            <div className="grid grid-2">
                {/* Форма авторизации */}
                <motion.div
                    className="card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h3 style={{ marginBottom: '24px' }}>
                        {step === 'phone' && 'Шаг 1: Введите данные'}
                        {step === 'code' && 'Шаг 2: Подтвердите код'}
                        {step === 'success' && 'Успешно!'}
                    </h3>

                    {error && (
                        <div style={{
                            padding: '12px',
                            background: 'rgba(255, 0, 128, 0.1)',
                            border: '1px solid var(--neon-pink)',
                            borderRadius: '4px',
                            marginBottom: '20px',
                            color: 'var(--neon-pink)',
                        }}>
                            {error}
                        </div>
                    )}

                    {step === 'phone' && (
                        <form onSubmit={handleStartAuth}>
                            <div className="form-group">
                                <label className="form-label">
                                    <Phone size={16} style={{ display: 'inline', marginRight: '8px' }} />
                                    Номер телефона
                                </label>
                                <input
                                    type="tel"
                                    placeholder="+79001234567"
                                    value={formData.phone_number}
                                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    <Key size={16} style={{ display: 'inline', marginRight: '8px' }} />
                                    API ID
                                </label>
                                <input
                                    type="text"
                                    placeholder="Получите на my.telegram.org"
                                    value={formData.api_id}
                                    onChange={(e) => setFormData({ ...formData, api_id: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    <Lock size={16} style={{ display: 'inline', marginRight: '8px' }} />
                                    API Hash
                                </label>
                                <input
                                    type="text"
                                    placeholder="Получите на my.telegram.org"
                                    value={formData.api_hash}
                                    onChange={(e) => setFormData({ ...formData, api_hash: e.target.value })}
                                    required
                                />
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                                {loading ? 'Отправка...' : 'Отправить код'}
                            </button>
                        </form>
                    )}

                    {step === 'code' && (
                        <form onSubmit={handleSubmitCode}>
                            <div className="form-group">
                                <label className="form-label">Код из Telegram</label>
                                <input
                                    type="text"
                                    placeholder="12345"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Пароль 2FA (если есть)</label>
                                <input
                                    type="password"
                                    placeholder="Оставьте пустым если нет"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            <button type="submit" className="btn btn-success" disabled={loading} style={{ width: '100%' }}>
                                {loading ? 'Проверка...' : 'Подтвердить'}
                            </button>
                        </form>
                    )}

                    {step === 'success' && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <CheckCircle size={64} color="var(--neon-green)" style={{ marginBottom: '20px' }} />
                            <h3 style={{ color: 'var(--neon-green)' }}>Авторизация успешна!</h3>
                            <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>
                                Ваш аккаунт подключен
                            </p>
                        </div>
                    )}
                </motion.div>

                {/* Активные сессии */}
                <motion.div
                    className="card"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h3 style={{ marginBottom: '24px' }}>Активные сессии</h3>

                    {sessions.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                            Нет активных сессий
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    style={{
                                        padding: '16px',
                                        background: 'var(--bg-darker)',
                                        border: `1px solid ${session.is_active ? 'var(--neon-green)' : 'var(--border-color)'}`,
                                        borderRadius: '4px',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                                {session.phone_number}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                {session.is_active ? (
                                                    <span className="badge badge-success">Активна</span>
                                                ) : (
                                                    <span className="badge badge-danger">Неактивна</span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => handleLogout(session.id)}
                                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                        >
                                            Выйти
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
