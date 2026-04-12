import { useState, useEffect, useRef } from 'react';
import {
    Send, Users, Clock, CheckCircle, XCircle,
    AlertCircle, Loader, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import { broadcastAPI } from '../utils/api';

/* ──────────────────────────────────────────────
   Helpers
─────────────────────────────────────────────── */
function parseRecipients(raw) {
    return raw
        .split(/[\n,;]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
            // Если уже начинается с @ или + (телефон) — оставляем
            if (s.startsWith('@') || s.startsWith('+')) return s;
            // Иначе — это никнейм без @, добавляем
            return '@' + s;
        });
}

function StatusBadge({ status }) {
    const map = {
        running: { color: 'var(--neon-cyan)',    label: 'Отправляется' },
        done:    { color: 'var(--neon-green)',   label: 'Завершено'    },
        failed:  { color: 'var(--neon-pink)',    label: 'Ошибка'       },
        pending: { color: 'var(--text-muted)',   label: 'В очереди'    },
    };
    const { color, label } = map[status] || map.pending;
    return (
        <span style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 12,
            fontSize: '0.78rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color,
            border: `1px solid ${color}`,
            background: `${color}22`,
        }}>
            {label}
        </span>
    );
}

/* ──────────────────────────────────────────────
   Task history row
─────────────────────────────────────────────── */
function TaskRow({ task, onDelete }) {
    const [open, setOpen] = useState(false);
    const [detail, setDetail] = useState(null);
    const [deleting, setDeleting] = useState(false);

    async function loadDetail() {
        if (detail) { setOpen(o => !o); return; }
        try {
            const { data } = await broadcastAPI.getStatus(task.id);
            setDetail(data);
            setOpen(true);
        } catch { /* ignore */ }
    }

    async function handleDelete(e) {
        e.stopPropagation();
        if (!window.confirm('Удалить эту рассылку из истории?')) return;
        setDeleting(true);
        try {
            await broadcastAPI.deleteTask(task.id);
            onDelete(task.id);
        } catch {
            setDeleting(false);
        }
    }

    const pct = task.total_count > 0
        ? Math.round(((task.sent_count || 0) / task.total_count) * 100)
        : 0;

    return (
        <div className="broadcast-task-row" style={{ opacity: deleting ? 0.5 : 1 }}>
            <div className="broadcast-task-header" onClick={loadDetail}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <StatusBadge status={task.status} />
                    <span className="broadcast-task-text" title={task.message_text}>
                        {task.message_text}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(task.created_at).toLocaleString('ru')}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--neon-green)', fontSize: '0.9rem' }}>✓{task.sent_count || 0}</span>
                        <span style={{ color: 'var(--neon-pink)',  fontSize: '0.9rem' }}>✗{task.failed_count || 0}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>/{task.total_count}</span>
                    </div>
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        title="Удалить"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neon-pink)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            <div className="broadcast-progress-bg">
                <div className="broadcast-progress-fill" style={{ width: `${pct}%` }} />
            </div>

            {/* Detail */}
            {open && detail && (
                <div className="broadcast-detail">
                    {detail.results.map((r, i) => (
                        <div key={i} className="broadcast-result-item">
                            {r.success
                                ? <CheckCircle size={14} color="var(--neon-green)" />
                                : <XCircle    size={14} color="var(--neon-pink)"  />
                            }
                            <span style={{ flex: 1 }}>{r.recipient}</span>
                            {r.error && (
                                <span style={{ color: 'var(--neon-pink)', fontSize: '0.8rem' }}>{r.error}</span>
                            )}
                        </div>
                    ))}
                    {detail.results.length === 0 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Нет данных</span>
                    )}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────────────────────────
   Main page
─────────────────────────────────────────────── */
export default function Broadcast() {
    const [text, setText]         = useState('');
    const [recipients, setRecs]   = useState('');
    const [delay, setDelay]       = useState(5);
    const [sending, setSending]   = useState(false);
    const [result, setResult]     = useState(null);   // { type: 'success'|'error', msg }
    const [tasks, setTasks]       = useState([]);
    const [loadingTasks, setLT]   = useState(true);
    const pollRef                 = useRef(null);
    const textareaRef             = useRef(null);

    const parsedList = parseRecipients(recipients);

    // ── Load history
    async function loadHistory() {
        try {
            const { data } = await broadcastAPI.getHistory();
            setTasks(data.tasks || []);
        } catch {
            setTasks([]);
        } finally {
            setLT(false);
        }
    }

    useEffect(() => {
        loadHistory();
        return () => clearInterval(pollRef.current);
    }, []);

    // ── Send broadcast
    async function handleSend() {
        if (!text.trim()) { setResult({ type: 'error', msg: 'Введите текст сообщения' }); return; }
        if (parsedList.length === 0) { setResult({ type: 'error', msg: 'Добавьте хотя бы одного получателя' }); return; }

        setSending(true);
        setResult(null);

        try {
            const { data } = await broadcastAPI.send({
                text,
                recipients: parsedList,
                delay_seconds: delay,
            });

            setResult({ type: 'success', msg: `Рассылка #${data.task_id} запущена для ${data.total} получателей` });

            // Poll for updates
            await loadHistory();
            pollRef.current = setInterval(loadHistory, 4000);
            setTimeout(() => clearInterval(pollRef.current), 120_000);

        } catch (e) {
            const msg = e.response?.data?.detail || e.message || 'Ошибка запроса';
            setResult({ type: 'error', msg });
        } finally {
            setSending(false);
        }
    }

    async function deleteOne(taskId) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
    }

    async function clearAll() {
        if (!window.confirm(`Удалить всю историю рассылок (${tasks.length} записей)?`)) return;
        try {
            await broadcastAPI.clearHistory();
            setTasks([]);
        } catch (e) {
            console.error(e);
        }
    }

    function clearForm() {
        setText('');
        setRecs('');
        setResult(null);
    }

    /* ── Render */
    return (
        <div className="broadcast-page">
            {/* Header */}
            <div className="page-header">
                <h1 className="page-title" style={{
                    background: 'linear-gradient(135deg, var(--neon-cyan), var(--neon-magenta))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                }}>
                    📨 Рассылка
                </h1>
                <p className="page-subtitle">
                    Массовая отправка сообщений через активную Telegram-сессию
                </p>
            </div>

            <div className="broadcast-layout">

                {/* ── Left: compose form */}
                <div className="broadcast-form-card card">
                    <h2 className="card-section-title">
                        <Send size={18} style={{ marginRight: 8 }} />
                        Новая рассылка
                    </h2>

                    {/* Alert */}
                    {result && (
                        <div className={`broadcast-alert broadcast-alert--${result.type}`}>
                            {result.type === 'success'
                                ? <CheckCircle size={16} />
                                : <AlertCircle size={16} />
                            }
                            <span>{result.msg}</span>
                        </div>
                    )}

                    {/* Text */}
                    <div className="form-group">
                        <label className="form-label">
                            Текст сообщения
                            <span style={{ color: 'var(--neon-pink)', marginLeft: 4 }}>*</span>
                        </label>

                        {/* ── Format toolbar */}
                        <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                            {[
                                { label: 'B',    title: 'Жирный (Ctrl+B)',          before: '*',  after: '*',  style: { fontWeight: 800 } },
                                { label: 'I',    title: 'Курсив (Ctrl+I)',           before: '_',  after: '_',  style: { fontStyle: 'italic' } },
                                { label: 'U',    title: 'Подчёркнутый',             before: '__', after: '__', style: { textDecoration: 'underline' } },
                                { label: 'S',    title: 'Зачёркнутый',             before: '~',  after: '~',  style: { textDecoration: 'line-through' } },
                                { label: '<>',   title: 'Моноширинный (код)',       before: '`',  after: '`',  style: { fontFamily: 'monospace' } },
                                { label: '```',  title: 'Блок кода',                before: '```\n', after: '\n```', style: { fontFamily: 'monospace', fontSize: '0.78rem' } },
                                { label: '||',   title: 'Спойлер',                 before: '||', after: '||', style: {} },
                            ].map(btn => (
                                <button
                                    key={btn.label}
                                    type="button"
                                    title={btn.title}
                                    onClick={() => {
                                        const el = textareaRef.current;
                                        if (!el) return;
                                        const start = el.selectionStart;
                                        const end   = el.selectionEnd;
                                        const sel   = text.substring(start, end);
                                        const newVal = text.substring(0, start) + btn.before + sel + btn.after + text.substring(end);
                                        setText(newVal);
                                        requestAnimationFrame(() => {
                                            el.focus();
                                            el.setSelectionRange(start + btn.before.length, end + btn.before.length);
                                        });
                                    }}
                                    style={{
                                        background: 'rgba(255,255,255,0.07)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: 7, color: 'var(--text-primary)',
                                        cursor: 'pointer', padding: '4px 10px',
                                        fontSize: '0.82rem', lineHeight: 1.4,
                                        ...btn.style,
                                    }}
                                >{btn.label}</button>
                            ))}
                        </div>

                        <textarea
                            ref={textareaRef}
                            className="broadcast-textarea"
                            rows={7}
                            placeholder="Введите текст, который будет отправлен каждому получателю..."
                            value={text}
                            onChange={e => setText(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Поддерживается Telegram Markdown (*жирный*, _курсив_, ~зачёрк.~, ||спойлер||)
                            </span>
                            <span className="broadcast-char-count">{text.length} символов</span>
                        </div>
                    </div>

                    {/* Recipients */}
                    <div className="form-group">
                        <label className="form-label">
                            <Users size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            Список для рассылки
                            <span style={{ color: 'var(--neon-pink)', marginLeft: 4 }}>*</span>
                        </label>
                        <textarea
                            className="broadcast-textarea broadcast-textarea--recipients"
                            rows={8}
                            placeholder={
                                "@username\nt.me/username\nhttps://t.me/another_user\n\nКаждый с новой строки (или через запятую)"
                            }
                            value={recipients}
                            onChange={e => setRecs(e.target.value)}
                        />
                        {parsedList.length > 0 && (
                            <div className="broadcast-recipients-count">
                                <Users size={13} />
                                Распознано: <strong>{parsedList.length}</strong> получателей
                            </div>
                        )}
                    </div>

                    {/* Delay */}
                    <div className="form-group">
                        <label className="form-label">
                            <Clock size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            Задержка между отправками (сек)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <input
                                type="range"
                                min={3} max={60} step={1}
                                value={delay}
                                onChange={e => setDelay(Number(e.target.value))}
                                className="broadcast-range"
                            />
                            <span className="broadcast-range-val">{delay}с</span>
                        </div>

                        {/* Recommendation table */}
                        <div style={{
                            marginTop: 12, padding: '12px 14px',
                            background: 'rgba(0,212,255,0.05)',
                            border: '1px solid rgba(0,212,255,0.18)',
                            borderRadius: 10, fontSize: '0.82rem',
                        }}>
                            <div style={{ fontWeight: 600, color: 'var(--neon-cyan)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                💡 Рекомендации по задержке
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {[
                                        ['Знакомые / друзья',      '5–10 сек', 'var(--neon-green)'],
                                        ['Чужие аккаунты',         '10–30 сек', '#f0c040'],
                                        ['Большой список (100+)',  '30–60 сек', 'var(--neon-pink)'],
                                    ].map(([label, range, color]) => (
                                        <tr key={label}>
                                            <td style={{ padding: '3px 0', color: 'var(--text-muted)' }}>{label}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, color }}>{range}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                ⚠️ Слишком частые отправки могут привести к временной блокировке аккаунта Telegram.
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                        <button
                            className="btn btn-primary broadcast-send-btn"
                            onClick={handleSend}
                            disabled={sending}
                        >
                            {sending
                                ? <><Loader size={16} className="spin" /> Запускаю...</>
                                : <><Send size={16} /> Отправить рассылку</>
                            }
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={clearForm}
                            title="Очистить форму"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                {/* ── Right: history */}
                <div className="broadcast-history-card card">
                    <h2 className="card-section-title">
                        История рассылок
                    </h2>

                    {loadingTasks ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                            <Loader size={24} className="spin" style={{ color: 'var(--neon-cyan)' }} />
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <Send size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                            <h3>Нет рассылок</h3>
                            <p>Запустите вашу первую рассылку слева</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                                <button
                                    className="btn btn-ghost"
                                    onClick={clearAll}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--neon-pink)', fontSize: '0.85rem' }}
                                    title="Очистить всю историю"
                                >
                                    <Trash2 size={14} /> Очистить всё
                                </button>
                            </div>
                            <div className="broadcast-tasks-list">
                                {tasks.map(t => <TaskRow key={t.id} task={t} onDelete={deleteOne} />)}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
