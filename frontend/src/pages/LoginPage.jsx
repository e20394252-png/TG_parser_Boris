import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'https://tg-parser-boris.onrender.com/api';
const BOT_NAME = import.meta.env.VITE_TELEGRAM_BOT_NAME || '';

export default function LoginPage() {
    const { login } = useAuth();
    const [error,   setError]   = useState('');
    const [loading, setLoading] = useState(false);
    const [botName, setBotName] = useState(BOT_NAME);
    const [usePassword, setUsePassword] = useState(false);
    const [password, setPassword] = useState('');
    const widgetRef = useRef(null);

    // Получаем имя бота с бэкенда (если не задано в env)
    useEffect(() => {
        if (botName) return;
        fetch(`${API_BASE}/login/config`)
            .then(r => r.json())
            .then(d => { if (d.bot_name) setBotName(d.bot_name); })
            .catch(() => {});
    }, [botName]);

    // Вставляем виджет как только botName известен
    useEffect(() => {
        if (!botName || !widgetRef.current || usePassword) return;

        // Очищаем предыдущий виджет
        widgetRef.current.innerHTML = '';

        // Глобальная функция-callback для виджета
        window.onTelegramAuth = async (tgUser) => {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`${API_BASE}/login/telegram`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tgUser),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Ошибка авторизации');
                login(data.token, data.user);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        // Создаём тег <script> для виджета
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', botName);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '8');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        script.async = true;
        widgetRef.current.appendChild(script);

        return () => { delete window.onTelegramAuth; };
    }, [botName, login, usePassword]);

    const handlePasswordLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/login/password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Неверный пароль');
            login(data.token, data.user);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.root}>
            {/* Анимированный фон */}
            <div style={styles.bg}>
                <div style={styles.bgOrb1} />
                <div style={styles.bgOrb2} />
                <div style={styles.bgOrb3} />
            </div>

            <div style={styles.card}>
                {/* Лого */}
                <div style={styles.logo}>
                    <div style={styles.logoIcon}>⚡</div>
                    <div>
                        <div style={styles.logoTitle}>TELEGRAM</div>
                        <div style={styles.logoSub}>PARSER</div>
                    </div>
                </div>

                <h1 style={styles.heading}>Добро пожаловать</h1>
                <p style={styles.subheading}>
                    {usePassword ? 'Введите пароль для входа' : 'Войдите через Telegram, чтобы получить доступ к сервису'}
                </p>

                {/* Виджет или Пароль */}
                <div style={styles.widgetWrap}>
                    {usePassword ? (
                        <form onSubmit={handlePasswordLogin} style={{ width: '100%' }}>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Введите пароль"
                                style={styles.input}
                            />
                            <button type="submit" style={styles.button} disabled={loading}>
                                {loading ? 'Вход...' : 'Войти'}
                            </button>
                        </form>
                    ) : !botName ? (
                        <div style={styles.noBot}>
                            ⚠️ Имя бота не задано.<br />
                            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                Установите <code>VITE_TELEGRAM_BOT_NAME</code> в env Render.
                            </span>
                        </div>
                    ) : loading ? (
                        <div style={styles.loadingText}>Проверяем данные...</div>
                    ) : (
                        <div ref={widgetRef} style={{ display: 'flex', justifyContent: 'center' }} />
                    )}
                </div>

                {/* Ошибка */}
                {error && (
                    <div style={styles.errorBox}>
                        {error}
                    </div>
                )}

                <div style={{ marginTop: 10 }}>
                    <button 
                        onClick={() => setUsePassword(!usePassword)} 
                        style={styles.linkButton}
                    >
                        {usePassword ? 'Войти через Telegram' : 'Войти по паролю'}
                    </button>
                </div>

                <p style={styles.hint}>
                    🔒 Доступ разрешён только для авторизованных пользователей
                </p>
            </div>
        </div>
    );
}

/* ──────────────── Стили ────────────────── */
const styles = {
    root: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0e1a',
        fontFamily: "'Inter', 'Outfit', sans-serif",
        position: 'relative',
        overflow: 'hidden',
    },
    bg: {
        position: 'absolute', inset: 0, pointerEvents: 'none',
    },
    bgOrb1: {
        position: 'absolute', top: '-20%', left: '-10%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)',
        animation: 'pulse 6s ease-in-out infinite',
    },
    bgOrb2: {
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,0,128,0.1) 0%, transparent 70%)',
        animation: 'pulse 8s ease-in-out infinite reverse',
    },
    bgOrb3: {
        position: 'absolute', top: '40%', left: '50%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        transform: 'translate(-50%, -50%)',
    },
    card: {
        position: 'relative', zIndex: 1,
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 420,
        textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
    },
    logo: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 12, marginBottom: 32,
    },
    logoIcon: {
        width: 48, height: 48, borderRadius: 12,
        background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24,
    },
    logoTitle: {
        fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.1em',
        color: '#fff', lineHeight: 1,
    },
    logoSub: {
        fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.25em',
        color: 'rgba(0,212,255,0.8)', marginTop: 2,
    },
    heading: {
        fontSize: '1.75rem', fontWeight: 700, color: '#fff',
        margin: '0 0 10px',
        background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    },
    subheading: {
        fontSize: '0.95rem', color: 'rgba(255,255,255,0.45)',
        margin: '0 0 32px', lineHeight: 1.5,
    },
    widgetWrap: {
        minHeight: 56, display: 'flex', alignItems: 'center',
        justifyContent: 'center', marginBottom: 20,
    },
    noBot: {
        padding: '16px 20px',
        background: 'rgba(255, 165, 0, 0.08)',
        border: '1px solid rgba(255, 165, 0, 0.3)',
        borderRadius: 10, fontSize: '0.9rem',
        color: 'rgba(255, 165, 0, 0.85)',
        lineHeight: 1.6,
    },
    loadingText: {
        color: 'rgba(0,212,255,0.8)', fontSize: '0.9rem',
        animation: 'pulse 1.5s ease-in-out infinite',
    },
    errorBox: {
        padding: '12px 16px',
        background: 'rgba(255,0,80,0.1)',
        border: '1px solid rgba(255,0,80,0.3)',
        borderRadius: 10, fontSize: '0.875rem',
        color: 'rgba(255,80,120,1)',
        marginBottom: 16, lineHeight: 1.5,
    },
    hint: {
        fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)',
        margin: '8px 0 0', lineHeight: 1.5,
    },
};
