import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://tg-parser-boris.onrender.com/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Прикрепляем JWT ко всем запросам
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('tg_parser_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// При 401 — принудительный выход
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('tg_parser_token');
            localStorage.removeItem('tg_parser_user');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

// Auth (Telegram session management)
export const authAPI = {
    startTelegramAuth: (data) => api.post('/auth/telegram/start', data),
    submitCode: (data) => api.post('/auth/telegram/code', data),
    getStatus: () => api.get('/auth/status'),
    logout: (sessionId) => api.delete(`/auth/telegram/${sessionId}`),
    deleteSession: (sessionId) => api.delete(`/auth/sessions/${sessionId}/permanent`),
    importTData: (formData) => api.post('/auth/telegram/tdata', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 минуты — конвертация может занять время
    }),
    checkHealth: (sessionId) => api.get(`/auth/telegram/${sessionId}/health`),
};

// Login / password management
export const loginAPI = {
    setupNeeded:     ()     => api.get('/login/setup-needed'),
    setup:           (data) => api.post('/login/setup', data),
    changePassword:  (data) => api.post('/login/change-password', data),
    login:           (data) => api.post('/login/password', data),
};

// Bot auth (Telegram deep-link login)
export const botAuthAPI = {
    init:  ()            => api.get('/login/bot/init'),
    check: (state)       => api.get('/login/bot/check', { params: { state } }),
};

// User management
export const usersAPI = {
    list:   ()          => api.get('/login/users'),
    create: (data)      => api.post('/login/users', data),
    remove: (userId)    => api.delete(`/login/users/${userId}`),
};

// Monitoring
export const monitoringAPI = {
    getChats: (sessionId) => api.get('/monitoring/chats', { params: { session_id: sessionId } }),
    addChat: (data) => api.post('/monitoring/chats', data),
    removeChat: (chatId) => api.delete(`/monitoring/chats/${chatId}`),
    toggleChat: (chatId) => api.patch(`/monitoring/chats/${chatId}/toggle`),
    resolveChat: (data) => api.post('/monitoring/resolve-chat', data),

    getFilters: (sessionId) => api.get('/monitoring/filters', { params: { session_id: sessionId } }),
    createFilter: (data) => api.post('/monitoring/filters', data),
    updateFilter: (filterId, data) => api.put(`/monitoring/filters/${filterId}`, data),
    deleteFilter: (filterId) => api.delete(`/monitoring/filters/${filterId}`),
    toggleFilter: (filterId) => api.patch(`/monitoring/filters/${filterId}/toggle`),
};

// Responses
export const responsesAPI = {
    getTemplates: (sessionId) => api.get('/responses/templates', { params: { session_id: sessionId } }),
    createTemplate: (data) => api.post('/responses/templates', data),
    updateTemplate: (responseId, data) => api.put(`/responses/templates/${responseId}`, data),
    deleteTemplate: (responseId) => api.delete(`/responses/templates/${responseId}`),
    getHistory: (sessionId, limit, offset) =>
        api.get('/responses/history', { params: { session_id: sessionId, limit, offset } }),
};

// AI
export const aiAPI = {
    getProviders: () => api.get('/ai/providers'),
    createProvider: (data) => api.post('/ai/providers', data),
    deleteProvider: (providerId) => api.delete(`/ai/providers/${providerId}`),

    uploadDocument: (sessionId, title, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post(`/ai/rag/upload?session_id=${sessionId}&title=${title}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    getDocuments: (sessionId) => api.get('/ai/rag/documents', { params: { session_id: sessionId } }),
    deleteDocument: (documentId) => api.delete(`/ai/rag/documents/${documentId}`),

    generate: (data) => api.post('/ai/generate', data),
};

// Statistics
export const statisticsAPI = {
    getOverview: (sessionId) => api.get('/statistics/overview', { params: { session_id: sessionId } }),
    getMessages: (sessionId, days) =>
        api.get('/statistics/messages', { params: { session_id: sessionId, days } }),
    getResponses: (sessionId, days) =>
        api.get('/statistics/responses', { params: { session_id: sessionId, days } }),
    getTopFilters: (sessionId, limit) =>
        api.get('/statistics/top-filters', { params: { session_id: sessionId, limit } }),
};

// Conversations (семантический поиск по диалогам)
export const conversationsAPI = {
    search: (query, chatId, limit) =>
        api.post('/conversations/search', { query, chat_id: chatId, limit }),
    getMessages: (chatId, limit, offset) =>
        api.get('/conversations/messages', { params: { chat_id: chatId, limit, offset } }),
    indexChat: (chatId, limit) =>
        api.post('/conversations/index', { chat_id: chatId, limit }),
    getStats: () => api.get('/conversations/stats'),
    getContext: (messageId, contextSize) =>
        api.get(`/conversations/context/${messageId}`, { params: { context_size: contextSize } }),
};

// Settings (настройки пользователя)
export const settingsAPI = {
    get: () => api.get('/settings'),
    update: (data) => api.put('/settings', data),
    export: () => api.post('/settings/export'),
    import: (settings) => api.post('/settings/import', settings),
    delete: (key) => api.delete(`/settings/${key}`),
};

// Broadcast
export const broadcastAPI = {
    send:         (data)   => api.post('/broadcast/send', data),
    getHistory:   ()       => api.get('/broadcast/history'),
    getStatus:    (taskId) => api.get(`/broadcast/status/${taskId}`),
    getToday:     ()       => api.get('/broadcast/today'),
    deleteTask:   (taskId) => api.delete(`/broadcast/${taskId}`),
    clearHistory: ()       => api.delete('/broadcast/history'),
};

export default api;

