import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const TOKEN_KEY = 'tg_parser_token';
const USER_KEY  = 'tg_parser_user';

export function AuthProvider({ children }) {
    const [token, setToken]   = useState(() => localStorage.getItem(TOKEN_KEY));
    const [user,  setUser]    = useState(() => {
        try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
        catch { return null; }
    });

    const isAuthenticated = Boolean(token && user);

    // Извлекаем роль из JWT payload
    const role    = (() => {
        if (!token) return null;
        try { return JSON.parse(atob(token.split('.')[1])).role || 'user'; }
        catch { return 'user'; }
    })();
    const isAdmin = role === 'admin';

    const login = useCallback((newToken, userData) => {
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
    }, []);

    // Проверяем срок действия токена при загрузке
    useEffect(() => {
        if (!token) return;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.exp && payload.exp * 1000 < Date.now()) {
                logout();
            }
        } catch {
            logout();
        }
    }, [token, logout]);

    return (
        <AuthContext.Provider value={{ token, user, isAuthenticated, role, isAdmin, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
