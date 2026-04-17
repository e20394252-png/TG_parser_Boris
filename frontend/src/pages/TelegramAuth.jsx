import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Key, Lock, CheckCircle, FolderOpen, Upload, AlertTriangle } from 'lucide-react';
import { authAPI, settingsAPI } from '../utils/api';

/* ── Стили для drag-and-drop зоны ── */
const dropZoneBase = {
    border: '2px dashed rgba(0,212,255,0.35)',
    borderRadius: 12,
    padding: '36px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'rgba(0,212,255,0.03)',
};
const dropZoneActive = {
    ...dropZoneBase,
    border: '2px dashed var(--neon-cyan)',
    background: 'rgba(0,212,255,0.08)',
};

/* ── Вкладки ── */
const TAB_SMS   = 'sms';
const TAB_TDATA = 'tdata';

export default function TelegramAuth() {
    const [tab, setTab] = useState(TAB_SMS);
    const [tdataEnabled, setTdataEnabled] = useState(false);

    // SMS flow
    const [step, setStep] = useState('phone'); // 'phone' | 'code' | 'success'
    const [sessions, setSessions] = useState([]);
    const [formData, setFormData] = useState({
        phone_number: '',
        api_id: '',
        api_hash: '',
        code: '',
        password: '',
    });

    // TData flow
    const [tdataFile, setTdataFile] = useState(null);
    // api_id и api_hash берутся из ENV на сервере — пользователю не нужно вводить
    const [tdataStatus, setTdataStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
    const [tdataMessage, setTdataMessage] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Загружаем сессии и настройку tdata_enabled
    useEffect(() => {
        loadSessions();
        settingsAPI.get().then(res => {
            const telegram = res.data?.settings?.telegram;
            if (telegram && typeof telegram === 'object') {
                setTdataEnabled(!!telegram.tdata_enabled);
            }
        }).catch(() => {});
    }, []);

    const loadSessions = async () => {
        try {
            const response = await authAPI.getStatus();
            setSessions(response.data.sessions);
        } catch (err) {
            console.error('Ошибка загрузки сессий:', err);
        }
    };

    // ─── SMS flow handlers ───

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
            if (response.data.success) setStep('code');
        } catch (err) {
            setError(err.response?.data?.detail || 'Ошибка при отправке кода');
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
                setTimeout(() => {
                    setStep('phone');
                    setFormData({ phone_number: '', api_id: '', api_hash: '', code: '', password: '' });
                }, 3000);
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Ошибка при подтверждении кода');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async (sessionId) => {
        try {
            await authAPI.logout(sessionId);
            loadSessions();
        } catch (err) {
            console.error('Ошибка при выходе:', err);
        }
    };

    // ─── TData flow handlers ───

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.name.endsWith('.zip')) {
            setTdataFile(f);
            setTdataMessage('');
        } else {
            setTdataMessage('Пожалуйста, загрузите .zip архив');
        }
    }, []);

    const handleFileSelect = (e) => {
        const f = e.target.files?.[0];
        if (f) {
            setTdataFile(f);
            setTdataMessage('');
        }
    };

    const handleTDataImport = async (e) => {
        e.preventDefault();
        if (!tdataFile) { setTdataMessage('Выберите ZIP файл с TData'); return; }

        setTdataStatus('uploading');
        setTdataMessage('Загрузка и конвертация... Это может занять 30–60 секунд.');

        try {
            const fd = new FormData();
            fd.append('file', tdataFile);

            const response = await authAPI.importTData(fd);

            if (response.data.success) {
                setTdataStatus('success');
                setTdataMessage(response.data.message);
                loadSessions();
                setTimeout(() => {
                    setTdataStatus('idle');
                    setTdataFile(null);
                    setTdataMessage('');
                }, 4000);
            }
        } catch (err) {
            setTdataStatus('error');
            setTdataMessage(err.response?.data?.detail || 'Ошибка при импорте TData');
        }
    };

    // ─────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2 className="page-title">Авторизация Telegram</h2>
                <p className="page-subtitle">Подключение вашего Telegram аккаунта</p>
            </div>

            <div className="grid grid-2">
                {/* Левая колонка: форма */}
                <motion.div
                    className="card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    {/* Вкладки — только если tdata включено */}
                    {tdataEnabled && (
                        <div style={{
                            display: 'flex',
                            gap: 0,
                            marginBottom: 24,
                            background: 'rgba(255,255,255,0.04)',
                            borderRadius: 10,
                            padding: 4,
                        }}>
                            {[
                                { key: TAB_SMS,   label: '📱 По номеру' },
                                { key: TAB_TDATA, label: '📂 TData' },
                            ].map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => { setTab(t.key); setError(''); setTdataMessage(''); }}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        border: 'none',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.88rem',
                                        transition: 'all 0.2s',
                                        background: tab === t.key ? 'var(--neon-cyan)' : 'transparent',
                                        color: tab === t.key ? '#000' : 'var(--text-muted)',
                                    }}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {/* ─── SMS TAB ─── */}
                        {tab === TAB_SMS && (
                            <motion.div key="sms"
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
                            >
                                <h3 style={{ marginBottom: 24 }}>
                                    {step === 'phone'   && 'Шаг 1: Введите данные'}
                                    {step === 'code'    && 'Шаг 2: Подтвердите код'}
                                    {step === 'success' && 'Успешно!'}
                                </h3>

                                {error && <ErrorBox>{error}</ErrorBox>}

                                {step === 'phone' && (
                                    <form onSubmit={handleStartAuth}>
                                        <div className="form-group">
                                            <label className="form-label">
                                                <Phone size={16} style={{ display: 'inline', marginRight: 8 }} />
                                                Номер телефона
                                            </label>
                                            <input type="tel" placeholder="+79001234567"
                                                value={formData.phone_number}
                                                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                                                required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">
                                                <Key size={16} style={{ display: 'inline', marginRight: 8 }} />
                                                API ID
                                            </label>
                                            <input type="text" placeholder="Получите на my.telegram.org"
                                                value={formData.api_id}
                                                onChange={e => setFormData({ ...formData, api_id: e.target.value })}
                                                required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">
                                                <Lock size={16} style={{ display: 'inline', marginRight: 8 }} />
                                                API Hash
                                            </label>
                                            <input type="text" placeholder="Получите на my.telegram.org"
                                                value={formData.api_hash}
                                                onChange={e => setFormData({ ...formData, api_hash: e.target.value })}
                                                required />
                                        </div>
                                        <button type="submit" className="btn btn-primary"
                                            disabled={loading} style={{ width: '100%' }}>
                                            {loading ? 'Отправка...' : 'Отправить код'}
                                        </button>
                                    </form>
                                )}

                                {step === 'code' && (
                                    <form onSubmit={handleSubmitCode}>
                                        <div className="form-group">
                                            <label className="form-label">Код из Telegram</label>
                                            <input type="text" placeholder="12345"
                                                value={formData.code}
                                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                                required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Пароль 2FA (если есть)</label>
                                            <input type="password" placeholder="Оставьте пустым если нет"
                                                value={formData.password}
                                                onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                        </div>
                                        <button type="submit" className="btn btn-success"
                                            disabled={loading} style={{ width: '100%' }}>
                                            {loading ? 'Проверка...' : 'Подтвердить'}
                                        </button>
                                    </form>
                                )}

                                {step === 'success' && (
                                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                        <CheckCircle size={64} color="var(--neon-green)" style={{ marginBottom: 20 }} />
                                        <h3 style={{ color: 'var(--neon-green)' }}>Авторизация успешна!</h3>
                                        <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>Ваш аккаунт подключен</p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ─── TDATA TAB ─── */}
                        {tab === TAB_TDATA && tdataEnabled && (
                            <motion.div key="tdata"
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
                            >
                                <h3 style={{ marginBottom: 8 }}>Импорт из TData</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
                                    Загрузите ZIP-архив с папкой <code style={{ background: 'var(--bg-darker)', padding: '1px 6px', borderRadius: 4 }}>tdata</code> из Telegram Desktop
                                </p>

                                {/* Статусы */}
                                {tdataStatus === 'success' && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                                            background: 'rgba(0,255,128,0.08)', border: '1px solid var(--neon-green)',
                                            borderRadius: 10, marginBottom: 16, color: 'var(--neon-green)', fontSize: '0.9rem' }}>
                                        <CheckCircle size={18} /> {tdataMessage}
                                    </motion.div>
                                )}
                                {tdataStatus === 'error' && (
                                    <ErrorBox>{tdataMessage}</ErrorBox>
                                )}
                                {tdataStatus === 'uploading' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                                        background: 'rgba(0,212,255,0.08)', border: '1px solid var(--neon-cyan)',
                                        borderRadius: 10, marginBottom: 16, color: 'var(--neon-cyan)', fontSize: '0.85rem' }}>
                                        <div className="spinner" style={{ width: 16, height: 16, flexShrink: 0 }} />
                                        {tdataMessage}
                                    </div>
                                )}

                                <form onSubmit={handleTDataImport}>
                                    {/* Drag-and-drop зона */}
                                    <div
                                        style={dragActive ? dropZoneActive : dropZoneBase}
                                        onDragEnter={handleDrag}
                                        onDragLeave={handleDrag}
                                        onDragOver={handleDrag}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input ref={fileInputRef} type="file" accept=".zip"
                                            style={{ display: 'none' }} onChange={handleFileSelect} />
                                        {tdataFile ? (
                                            <div>
                                                <FolderOpen size={32} color="var(--neon-cyan)" style={{ marginBottom: 8 }} />
                                                <div style={{ fontWeight: 600, color: 'var(--neon-cyan)' }}>{tdataFile.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                    {(tdataFile.size / 1024 / 1024).toFixed(1)} MB · нажмите чтобы изменить
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <Upload size={32} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                                                <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                    Перетащите ZIP сюда или нажмите для выбора
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                                                    Файл tdata.zip · максимум 100 MB
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* API ID и Hash берутся из ENV сервера автоматически */}

                                    <button type="submit" className="btn btn-primary"
                                        disabled={tdataStatus === 'uploading' || !tdataFile}
                                        style={{ width: '100%', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        {tdataStatus === 'uploading'
                                            ? <><div className="spinner" style={{ width: 15, height: 15 }} /> Конвертация...</>
                                            : <><FolderOpen size={16} /> Импортировать TData</>}
                                    </button>
                                </form>

                                {/* Предупреждение */}
                                <div style={{ marginTop: 16, padding: '10px 14px',
                                    background: 'rgba(255,165,0,0.07)', border: '1px solid rgba(255,165,0,0.35)',
                                    borderRadius: 8, fontSize: '0.82rem', color: 'rgba(255,165,0,0.9)',
                                    display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                                    <span>TData содержит полный доступ к аккаунту. Загружайте файлы только с доверенных устройств.</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Правая колонка */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* Активные сессии */}
                    <motion.div className="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                        <h3 style={{ marginBottom: 24 }}>Активные сессии</h3>
                        {sessions.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
                                Нет активных сессий
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {sessions.map(session => (
                                    <div key={session.id} style={{
                                        padding: 16,
                                        background: 'var(--bg-darker)',
                                        border: `1px solid ${session.is_active ? 'var(--neon-green)' : 'var(--border-color)'}`,
                                        borderRadius: 4,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                                    {session.phone_number}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                    {session.is_active
                                                        ? <span className="badge badge-success">Активна</span>
                                                        : <span className="badge badge-danger">Неактивна</span>}
                                                </div>
                                            </div>
                                            <button className="btn btn-danger" onClick={() => handleLogout(session.id)}
                                                style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                                                Выйти
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    {/* Инструкция */}
                    <motion.div className="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                        <h3 style={{ marginBottom: 8, color: 'var(--neon-cyan)' }}>
                            {tab === TAB_TDATA ? '📂 Как создать TData архив' : '🔑 Как получить API ID и API Hash'}
                        </h3>

                        {tab === TAB_SMS && (
                            <>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
                                    Эти данные нужны для подключения аккаунта. Получить их можно бесплатно на официальном сайте Telegram.
                                </p>
                                <ol className="auth-guide-steps">
                                    <li><span className="auth-guide-num">1</span>
                                        <div>Откройте{' '}<a href="https://my.telegram.org" target="_blank" rel="noreferrer"
                                            style={{ color: 'var(--neon-cyan)', textDecoration: 'none', fontWeight: 600 }}>
                                            my.telegram.org ↗</a>{' '}в браузере</div></li>
                                    <li><span className="auth-guide-num">2</span>
                                        <div>Введите свой <b>номер телефона</b> и код подтверждения из Telegram</div></li>
                                    <li><span className="auth-guide-num">3</span>
                                        <div>Нажмите <b>«API development tools»</b></div></li>
                                    <li><span className="auth-guide-num">4</span>
                                        <div>Заполните форму: придумайте любое <b>название</b> и <b>короткое имя</b> приложения
                                            (например <code style={{ background: 'var(--bg-darker)', padding: '1px 6px', borderRadius: 4 }}>myparser</code>),
                                            нажмите <b>«Create application»</b></div></li>
                                    <li><span className="auth-guide-num">5</span>
                                        <div>Скопируйте <b>App api_id</b> (число) и <b>App api_hash</b> (строка из 32 символов)
                                            и вставьте их в форму слева</div></li>
                                </ol>
                            </>
                        )}

                        {tab === TAB_TDATA && (
                            <>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
                                    Папка tdata находится в директории Telegram Desktop. Её нужно заархивировать в .zip.
                                </p>
                                <ol className="auth-guide-steps">
                                    <li><span className="auth-guide-num">1</span>
                                        <div>Откройте папку Telegram Desktop:
                                            <code style={{ display: 'block', marginTop: 4, background: 'var(--bg-darker)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem' }}>
                                                %APPDATA%\Telegram Desktop\tdata
                                            </code>
                                        </div></li>
                                    <li><span className="auth-guide-num">2</span>
                                        <div>Скопируйте всю папку <b>tdata</b> в отдельное место</div></li>
                                    <li><span className="auth-guide-num">3</span>
                                        <div>Выделите содержимое папки → правая кнопка → <b>«Сжать в ZIP»</b></div></li>
                                    <li><span className="auth-guide-num">4</span>
                                        <div>Загрузите полученный .zip в форму слева и нажмите <b>«Импортировать TData»</b></div></li>
                                </ol>
                            </>
                        )}

                        <div style={{ marginTop: 16, padding: '12px 14px',
                            background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.4)',
                            borderRadius: 6, fontSize: '0.85rem', color: 'rgba(255,165,0,0.9)',
                            display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <span style={{ flexShrink: 0 }}>⚠️</span>
                            <span>Никому не передавайте API Hash и session string — это равносильно полному доступу к аккаунту.</span>
                        </div>
                    </motion.div>

                </div>
            </div>
        </div>
    );
}

/* ── Вспомогательный компонент ── */
function ErrorBox({ children }) {
    return (
        <div style={{
            padding: 12, background: 'rgba(255,0,128,0.1)',
            border: '1px solid var(--neon-pink)', borderRadius: 4,
            marginBottom: 20, color: 'var(--neon-pink)',
        }}>
            {children}
        </div>
    );
}
