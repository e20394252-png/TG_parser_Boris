import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { botAuthAPI } from '../utils/api';

const API_BASE = import.meta.env.VITE_API_URL || 'https://tg-parser-boris.onrender.com/api';

export default function LoginPage() {
    const { login } = useAuth();
    const [error,    setError]    = useState('');
    const [loading,  setLoading]  = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // Bot auth state
    const [botState,       setBotState]       = useState(null);
    const [botStatus,      setBotStatus]      = useState('idle'); // 'idle'|'loading'|'waiting'|'expired'|'error'
    const [botMsg,         setBotMsg]         = useState('');
    const [botFallbackUrl, setBotFallbackUrl] = useState('');  // https://t.me/... запасной вариант
    const pollRef = useRef(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/login/password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Неверный логин или пароль');
            login(data.token, data.user);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Bot auth ──
    const stopPolling = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    // Cleanup on unmount
    useEffect(() => () => stopPolling(), []);

    const handleBotLogin = async () => {
        setBotStatus('loading');
        setBotMsg('');
        setError('');
        stopPolling();
        try {
            const res = await botAuthAPI.init();
            const { state, tg_url, fallback_url } = res.data;
            setBotState(state);
            setBotFallbackUrl(fallback_url || '');
            setBotStatus('waiting');
            setBotMsg('');

            // Пробуем открыть через tg:// (Telegram Desktop/Mobile без браузера)
            window.location.href = tg_url;

            // Start polling every 2s
            const deadline = Date.now() + 10 * 60 * 1000; // 10 min
            pollRef.current = setInterval(async () => {
                if (Date.now() > deadline) {
                    stopPolling();
                    setBotStatus('expired');
                    setBotMsg('Ссылка истекла. Попробуйте ещё раз.');
                    return;
                }
                try {
                    const chk = await botAuthAPI.check(state);
                    const { status: s, token, user } = chk.data;
                    if (s === 'confirmed' && token) {
                        stopPolling();
                        login(token, user);
                    } else if (s === 'expired' || s === 'not_found') {
                        stopPolling();
                        setBotStatus('expired');
                        setBotMsg('Ссылка истекла. Попробуйте ещё раз.');
                    }
                } catch (err) {
                    if (err.response?.status === 403) {
                        stopPolling();
                        setBotStatus('error');
                        setBotMsg('Доступ запрещён. Ваш Telegram ID не в списке разрешённых.');
                    }
                    // other errors — keep polling
                }
            }, 2000);
        } catch (err) {
            setBotStatus('error');
            setBotMsg(err.response?.data?.detail || 'Ошибка соединения с сервером');
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
                <p style={styles.subheading}>Введите данные для входа</p>

                <form onSubmit={handleLogin} style={styles.form}>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Логин"
                        style={{ ...styles.input, marginBottom: 10 }}
                        autoComplete="username"
                        required
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Пароль"
                        style={styles.input}
                        autoComplete="current-password"
                        required
                    />
                    <button type="submit" style={styles.button} disabled={loading}>
                        {loading ? 'Вход...' : 'Войти'}
                    </button>
                </form>

                {error && (
                    <div style={styles.errorBox}>{error}</div>
                )}

                {/* Divider */}
                <div style={styles.divider}>
                    <span style={styles.dividerLine} />
                    <span style={styles.dividerText}>или</span>
                    <span style={styles.dividerLine} />
                </div>

                {/* Telegram Bot Login Button */}
                <button
                    id="telegram-bot-login-btn"
                    onClick={handleBotLogin}
                    disabled={botStatus === 'loading' || botStatus === 'waiting'}
                    style={{
                        ...styles.tgButton,
                        opacity: (botStatus === 'loading' || botStatus === 'waiting') ? 0.75 : 1,
                        cursor: (botStatus === 'loading' || botStatus === 'waiting') ? 'not-allowed' : 'pointer',
                    }}
                >
                    {botStatus === 'loading' && (
                        <span style={styles.spinner} />
                    )}
                    {botStatus === 'waiting' && (
                        <span style={{ ...styles.spinnerTg }} />
                    )}
                    {botStatus !== 'loading' && botStatus !== 'waiting' && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.478c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 14.27l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.626.316z"/>
                        </svg>
                    )}
                    {botStatus === 'waiting'
                        ? 'Ожидаем подтверждения...'
                        : 'Зарегистрироваться через Telegram'
                    }
                </button>

                {/* Bot auth status messages */}
                {botStatus === 'waiting' && (
                    <div style={styles.botInfoBox}>
                        <div>🤖 Открывается <strong>Telegram</strong> — нажмите <strong>Start</strong> и вернитесь.</div>
                        <div style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: 4 }}>Страница обновится автоматически.</div>
                        {botFallbackUrl && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(34,158,217,0.25)' }}>
                                <div style={{ fontSize: '0.78rem', opacity: 0.75, marginBottom: 6 }}>Не открылось? Попробуйте вручную:</div>
                                <a
                                    href={botFallbackUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: '#7dd3fc', fontSize: '0.78rem', wordBreak: 'break-all', textDecoration: 'underline' }}
                                >
                                    Открыть бот в браузере ↗
                                </a>
                                <div style={{ marginTop: 8 }}>
                                    <button
                                        onClick={() => navigator.clipboard?.writeText(botFallbackUrl)}
                                        style={{
                                            fontSize: '0.72rem', padding: '3px 10px',
                                            background: 'rgba(34,158,217,0.2)',
                                            border: '1px solid rgba(34,158,217,0.4)',
                                            borderRadius: 6, color: '#7dd3fc', cursor: 'pointer',
                                        }}
                                    >
                                        📋 Скопировать ссылку
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {(botStatus === 'expired' || botStatus === 'error') && (
                    <div style={styles.errorBox}>{botMsg}</div>
                )}

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
        padding: '16px',
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
        padding: 'clamp(24px, 5vw, 48px) clamp(20px, 5vw, 40px)',
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
        fontSize: '1.75rem', fontWeight: 700,
        margin: '0 0 10px',
        background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    },
    subheading: {
        fontSize: '0.95rem', color: 'rgba(255,255,255,0.45)',
        margin: '0 0 32px', lineHeight: 1.5,
    },
    form: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        marginBottom: 16,
    },
    input: {
        width: '100%',
        padding: '13px 16px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        color: '#fff',
        fontSize: '0.95rem',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s',
    },
    button: {
        marginTop: 14,
        width: '100%',
        padding: '14px',
        background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
        border: 'none',
        borderRadius: 10,
        color: '#fff',
        fontSize: '1rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        letterSpacing: '0.03em',
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
        margin: '16px 0 0', lineHeight: 1.5,
    },

    // ── Telegram bot login additions ──
    divider: {
        display: 'flex', alignItems: 'center', gap: 12,
        margin: '20px 0 16px',
    },
    dividerLine: {
        flex: 1, height: 1,
        background: 'rgba(255,255,255,0.1)',
        display: 'block',
    },
    dividerText: {
        fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)',
        whiteSpace: 'nowrap',
    },
    tgButton: {
        width: '100%',
        padding: '13px 16px',
        background: 'linear-gradient(135deg, #229ED9, #1a7abf)',
        border: 'none',
        borderRadius: 10,
        color: '#fff',
        fontSize: '0.97rem',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        transition: 'opacity 0.2s, transform 0.15s',
        letterSpacing: '0.01em',
        boxShadow: '0 4px 20px rgba(34,158,217,0.35)',
    },
    spinner: {
        display: 'inline-block',
        width: 16, height: 16,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTop: '2px solid #fff',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
    },
    spinnerTg: {
        display: 'inline-block',
        width: 16, height: 16,
        border: '2px solid rgba(255,255,255,0.4)',
        borderTop: '2px solid #fff',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
    },
    botInfoBox: {
        marginTop: 12,
        padding: '12px 14px',
        background: 'rgba(34,158,217,0.12)',
        border: '1px solid rgba(34,158,217,0.35)',
        borderRadius: 10,
        fontSize: '0.875rem',
        color: 'rgba(160,220,255,0.95)',
        lineHeight: 1.55,
        textAlign: 'left',
    },
};
