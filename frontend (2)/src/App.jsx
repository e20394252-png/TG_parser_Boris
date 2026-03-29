import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, MessageSquare, Settings as SettingsIcon, Brain, BarChart3, Search, Bot } from 'lucide-react';
import './App.css';

import Dashboard from './pages/Dashboard';
import SettingsPanel from './components/SettingsPanel';
import TelegramAuth from './pages/TelegramAuth';
import MonitoringSettings from './pages/MonitoringSettings';
import AISettings from './pages/AISettings';
import MessageHistory from './pages/MessageHistory';
import ConversationSearch from './pages/ConversationSearch';
import MCPStatusIndicator from './components/MCPStatusIndicator';
import MCPStatusModal from './components/MCPStatusModal';

function AppContent() {
    const location = useLocation();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [mcpModalOpen, setMcpModalOpen] = useState(false);

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <div className="app">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="logo">
                        <Activity className="logo-icon" />
                        <div>
                            <h1>TELEGRAM</h1>
                            <div className="sidebar-subtitle">PARSER</div>
                        </div>
                    </div>
                </div>

                <nav className="nav-items">
                    <Link to="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
                        <BarChart3 size={20} />
                        <span>Дашборд</span>
                    </Link>
                    <Link to="/auth" className={`nav-item ${isActive('/auth') ? 'active' : ''}`}>
                        <Bot size={20} />
                        <span>Telegram</span>
                    </Link>
                    <Link to="/monitoring" className={`nav-item ${isActive('/monitoring') ? 'active' : ''}`}>
                        <MessageSquare size={20} />
                        <span>Мониторинг</span>
                    </Link>
                    <Link to="/ai-settings" className={`nav-item ${isActive('/ai-settings') ? 'active' : ''}`}>
                        <Brain size={20} />
                        <span>AI & RAG</span>
                    </Link>
                    <Link to="/message-history" className={`nav-item ${isActive('/message-history') ? 'active' : ''}`}>
                        <MessageSquare size={20} />
                        <span>История</span>
                    </Link>
                    <Link to="/conversations" className={`nav-item ${isActive('/conversations') ? 'active' : ''}`}>
                        <Search size={20} />
                        <span>Поиск</span>
                    </Link>
                </nav>

                <div className="sidebar-footer">
                    <MCPStatusIndicator onDetailsClick={() => setMcpModalOpen(true)} />

                    <button
                        className="settings-button"
                        onClick={() => setSettingsOpen(true)}
                        title="Настройки"
                    >
                        <SettingsIcon size={20} />
                        <span>Настройки</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/auth" element={<TelegramAuth />} />
                    <Route path="/monitoring" element={<MonitoringSettings />} />
                    <Route path="/ai-settings" element={<AISettings />} />
                    <Route path="/message-history" element={<MessageHistory />} />
                    <Route path="/conversations" element={<ConversationSearch />} />
                </Routes>
            </main>

            {/* Modals */}
            <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <MCPStatusModal isOpen={mcpModalOpen} onClose={() => setMcpModalOpen(false)} />
        </div>
    );
}

function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}

export default App;
