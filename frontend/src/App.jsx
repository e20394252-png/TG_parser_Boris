import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, MessageSquare, Settings as SettingsIcon, Brain, BarChart3, Search, Bot, Send, BookOpen, LogOut, Users } from 'lucide-react';
import './App.css';

/* Импорт Orbitron-шрифта для Nexus-бейджа */
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700&display=swap';
if (!document.head.querySelector('[href*="Orbitron"]')) document.head.appendChild(fontLink);

import { AuthProvider, useAuth } from './context/AuthContext';
import { settingsAPI, loginAPI } from './utils/api';

import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import Dashboard from './pages/Dashboard';
import TelegramAuth from './pages/TelegramAuth';
import MonitoringSettings from './pages/MonitoringSettings';
import AISettings from './pages/AISettings';
import MessageHistory from './pages/MessageHistory';
import ConversationSearch from './pages/ConversationSearch';
import Broadcast from './pages/Broadcast';
import Guide from './pages/Guide';
import UsersPage from './pages/UsersPage';
import SettingsPage, { DEFAULT_MENU_VISIBILITY } from './pages/SettingsPage';

import MCPStatusIndicator from './components/MCPStatusIndicator';
import MCPStatusModal from './components/MCPStatusModal';

/* Все пункты меню c маппингом icon/path/component */
const ALL_NAV = [
    { key: 'dashboard',       path: '/',               icon: BarChart3,      label: 'Дашборд',         el: <Dashboard /> },
    { key: 'auth',            path: '/auth',            icon: Bot,            label: 'Авторизация ТГ',  el: <TelegramAuth /> },
    { key: 'monitoring',      path: '/monitoring',      icon: MessageSquare,  label: 'Мониторинг',      el: <MonitoringSettings /> },
    { key: 'ai-settings',     path: '/ai-settings',     icon: Brain,          label: 'AI & RAG',        el: <AISettings /> },
    { key: 'message-history', path: '/message-history', icon: MessageSquare,  label: 'История',         el: <MessageHistory /> },
    { key: 'conversations',   path: '/conversations',   icon: Search,         label: 'Поиск',           el: <ConversationSearch /> },
    { key: 'broadcast',       path: '/broadcast',       icon: Send,           label: 'Рассылка',        el: <Broadcast /> },
    { key: 'users',           path: '/users',           icon: Users,          label: 'Пользователи',    el: <UsersPage />, adminOnly: true },
    { key: 'guide',           path: '/guide',           icon: BookOpen,       label: 'Инструкция',      el: <Guide /> },
];

function AppContent() {
    const location = useLocation();
    const { user, logout, isAdmin } = useAuth();
    const [mcpModalOpen, setMcpModalOpen] = useState(false);
    const [menuVisibility, setMenuVisibility] = useState(DEFAULT_MENU_VISIBILITY);

    useEffect(() => {
        settingsAPI.get()
            .then(res => {
                const mv = res.data?.settings?.menu_visibility;
                if (mv && typeof mv === 'object') {
                    setMenuVisibility({ ...DEFAULT_MENU_VISIBILITY, ...mv });
                }
            })
            .catch(() => {});
    }, []);

    const visibleNav = ALL_NAV.filter(item => {
        if (item.adminOnly && !isAdmin) return false;
        return menuVisibility[item.key] !== false;
    });
    const isActive = (path) => location.pathname === path;

    return (
        <div className="app">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <a
                        href="https://telegram-parser-frontend.onrender.com/"
                        style={{ textDecoration: 'none', color: 'inherit' }}
                        title="На главную"
                    >
                        <div className="logo">
                            <Activity className="logo-icon" />
                            <div>
                                <h1>TELEGRAM</h1>
                                <div className="sidebar-subtitle">PARSER</div>
                                <div style={{
                                    fontFamily: "'Orbitron', sans-serif",
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.18em',
                                    color: 'var(--neon-cyan)',
                                    textShadow: '0 0 8px var(--neon-cyan)',
                                    marginTop: 2,
                                    opacity: 0.85,
                                }}>NEXUS</div>
                            </div>
                        </div>
                    </a>
                </div>

                <nav className="nav-items">
                    {visibleNav.map(item => (
                        <Link key={item.key} to={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`}>
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {user?.photo_url && (
                        <img src={user.photo_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : (user?.username || 'Пользователь')}
                        </div>
                        {user?.username && user?.first_name && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{user.username}</div>
                        )}
                    </div>
                    <button onClick={logout} title="Выйти" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
                        <LogOut size={16} />
                    </button>
                </div>

                <div className="sidebar-footer">
                    <MCPStatusIndicator onDetailsClick={() => setMcpModalOpen(true)} />
                    <Link to="/settings" className={`settings-button ${isActive('/settings') ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                        <SettingsIcon size={20} />
                        <span>Настройки</span>
                    </Link>
                </div>
            </aside>

            <main className="main-content">
                <Routes>
                    {ALL_NAV.map(item => (
                        <Route key={item.key} path={item.path} element={item.el} />
                    ))}
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </main>

            <MCPStatusModal isOpen={mcpModalOpen} onClose={() => setMcpModalOpen(false)} />
        </div>
    );
}

function AuthGate() {
    const { isAuthenticated } = useAuth();
    const [setupNeeded, setSetupNeeded] = useState(null); // null = checking

    useEffect(() => {
        if (isAuthenticated) return;
        loginAPI.setupNeeded()
            .then(res => setSetupNeeded(res.data.needed))
            .catch(() => setSetupNeeded(false));
    }, [isAuthenticated]);

    if (isAuthenticated)      return <AppContent />;
    if (setupNeeded === null)  return null; // моментальная проверка
    if (setupNeeded)           return <SetupPage />;
    return <LoginPage />;
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <AuthGate />
            </Router>
        </AuthProvider>
    );
}

export default App;
