import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Auth
export const authAPI = {
    startTelegramAuth: (data) => api.post('/auth/telegram/start', data),
    submitCode: (data) => api.post('/auth/telegram/code', data),
    getStatus: () => api.get('/auth/status'),
    logout: (sessionId) => api.delete(`/auth/telegram/${sessionId}`),
};

// Monitoring
export const monitoringAPI = {
    getChats: (sessionId) => api.get('/monitoring/chats', { params: { session_id: sessionId } }),
    addChat: (data) => api.post('/monitoring/chats', data),
    removeChat: (chatId) => api.delete(`/monitoring/chats/${chatId}`),
    toggleChat: (chatId) => api.patch(`/monitoring/chats/${chatId}/toggle`),

    getFilters: (sessionId) => api.get('/monitoring/filters', { params: { session_id: sessionId } }),
    createFilter: (data) => api.post('/monitoring/filters', data),
    deleteFilter: (filterId) => api.delete(`/monitoring/filters/${filterId}`),
    toggleFilter: (filterId) => api.patch(`/monitoring/filters/${filterId}/toggle`),
};

// Responses
export const responsesAPI = {
    getTemplates: (sessionId) => api.get('/responses/templates', { params: { session_id: sessionId } }),
    createTemplate: (data) => api.post('/responses/templates', data),
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

export default api;

