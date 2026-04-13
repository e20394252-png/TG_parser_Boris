import { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Lock, User, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { loginAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function SetupPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirm,  setConfirm]  = useState('');
    const [showPw,   setShowPw]   = useState(false);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState('');
    const [done,     setDone]     = useState(false);

    const handle = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirm) {
            setError('Пароли не совпадают');
            return;
        }
        if (password.length < 8) {
            setError('Пароль должен быть не менее 8 символов');
            return;
        }

        setLoading(true);
        try {
            const res = await loginAPI.setup({ username: username.trim(), password });
            setDone(true);
            setTimeout(() => login(res.data.token, res.data.user), 1200);
        } catch (err) {
            setError(err.response?.data?.detail || 'Ошибка при создании пользователя');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Ambient blobs */}
            <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'var(--neon-cyan)', filter:'blur(140px)', opacity:.06, top:-100, right:-100, pointerEvents:'none' }} />
            <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'var(--neon-purple)', filter:'blur(140px)', opacity:.07, bottom:-100, left:-100, pointerEvents:'none' }} />

            <motion.div
                initial={{ opacity:0, y:30 }}
                animate={{ opacity:1, y:0 }}
                transition={{ duration:.5 }}
                style={{
                    width: '100%', maxWidth: 440,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 16,
                    padding: '40px 36px',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Top accent line */}
                <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg, var(--neon-cyan), var(--neon-purple))' }} />

                {/* Logo */}
                <div style={{ textAlign:'center', marginBottom:28 }}>
                    <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:8 }}>
                        <Activity size={28} color="var(--neon-cyan)" style={{ filter:'drop-shadow(0 0 8px var(--neon-cyan))' }} />
                        <span style={{ fontFamily:'var(--font-heading)', fontSize:'1.4rem', letterSpacing:3, color:'var(--text-primary)' }}>TELEGRAM</span>
                    </div>
                    <div style={{ fontSize:'0.7rem', letterSpacing:4, color:'var(--text-muted)', textTransform:'uppercase' }}>PARSER</div>
                </div>

                {done ? (
                    <motion.div
                        initial={{ opacity:0, scale:.8 }}
                        animate={{ opacity:1, scale:1 }}
                        style={{ textAlign:'center', padding: '20px 0' }}
                    >
                        <CheckCircle size={56} color="var(--neon-green)" style={{ marginBottom:16, filter:'drop-shadow(0 0 12px var(--neon-green))' }} />
                        <div style={{ fontSize:'1.2rem', fontWeight:700, color:'var(--neon-green)', marginBottom:6 }}>Готово!</div>
                        <div style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>Входим в систему…</div>
                    </motion.div>
                ) : (
                    <>
                        <div style={{ marginBottom:24, textAlign:'center' }}>
                            <h2 style={{ fontSize:'1.15rem', fontWeight:800, color:'var(--text-primary)', marginBottom:6, fontFamily:'var(--font-heading)', letterSpacing:1 }}>
                                Первоначальная настройка
                            </h2>
                            <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', lineHeight:1.6 }}>
                                Создайте учётную запись администратора для входа в систему
                            </p>
                        </div>

                        {error && (
                            <div style={{
                                background:'rgba(255,0,128,.1)', border:'1px solid var(--neon-pink)',
                                borderRadius:8, padding:'10px 14px', marginBottom:16,
                                color:'var(--neon-pink)', fontSize:'0.85rem',
                            }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handle} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                            {/* Username */}
                            <div>
                                <label style={{ display:'block', fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:6, fontWeight:600 }}>
                                    Логин
                                </label>
                                <div style={{ position:'relative' }}>
                                    <User size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        placeholder="admin"
                                        required
                                        autoFocus
                                        style={{
                                            width:'100%', paddingLeft:38,
                                            background:'var(--bg-darker)', border:'1px solid var(--border-color)',
                                            borderRadius:8, padding:'12px 12px 12px 38px',
                                            color:'var(--text-primary)', fontSize:'0.95rem',
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label style={{ display:'block', fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:6, fontWeight:600 }}>
                                    Пароль <span style={{ color:'var(--text-muted)', fontWeight:400 }}>(минимум 8 символов)</span>
                                </label>
                                <div style={{ position:'relative' }}>
                                    <Lock size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
                                    <input
                                        type={showPw ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        style={{
                                            width:'100%',
                                            background:'var(--bg-darker)', border:'1px solid var(--border-color)',
                                            borderRadius:8, padding:'12px 40px 12px 38px',
                                            color:'var(--text-primary)', fontSize:'0.95rem',
                                        }}
                                    />
                                    <button type="button" onClick={() => setShowPw(v => !v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}>
                                        {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm */}
                            <div>
                                <label style={{ display:'block', fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:6, fontWeight:600 }}>
                                    Подтверждение пароля
                                </label>
                                <div style={{ position:'relative' }}>
                                    <Lock size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
                                    <input
                                        type={showPw ? 'text' : 'password'}
                                        value={confirm}
                                        onChange={e => setConfirm(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        style={{
                                            width:'100%',
                                            background:'var(--bg-darker)', border:'1px solid var(--border-color)',
                                            borderRadius:8, padding:'12px 12px 12px 38px',
                                            color:'var(--text-primary)', fontSize:'0.95rem',
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Password strength indicator */}
                            {password && (
                                <div style={{ display:'flex', gap:4 }}>
                                    {[...Array(4)].map((_, i) => {
                                        const strength = password.length >= 16 ? 4 : password.length >= 12 ? 3 : password.length >= 8 ? 2 : 1;
                                        const colors = ['var(--neon-pink)','var(--yellow, #f0c040)','var(--neon-cyan)','var(--neon-green)'];
                                        return <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i < strength ? colors[strength-1] : 'var(--border-color)', transition:'all .3s' }} />;
                                    })}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    marginTop:4,
                                    padding:'14px',
                                    background: loading ? 'rgba(0,255,255,.1)' : 'linear-gradient(135deg, rgba(0,255,255,.15), rgba(157,0,255,.15))',
                                    border:'1px solid var(--neon-cyan)',
                                    borderRadius:8,
                                    color:'var(--neon-cyan)',
                                    fontSize:'0.95rem',
                                    fontWeight:700,
                                    letterSpacing:1,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    transition:'all .2s',
                                }}
                            >
                                {loading ? 'Создание…' : 'Создать аккаунт и войти'}
                            </button>
                        </form>
                    </>
                )}
            </motion.div>
        </div>
    );
}
