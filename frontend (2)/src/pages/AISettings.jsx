import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Upload, Brain, Zap } from 'lucide-react';
import { aiAPI } from '../utils/api';

export default function AISettings() {
    const [providers, setProviders] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [showAddProvider, setShowAddProvider] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadTitle, setUploadTitle] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [providersRes, documentsRes] = await Promise.all([
                aiAPI.getProviders(),
                aiAPI.getDocuments(),
            ]);

            setProviders(providersRes.data.providers);
            setDocuments(documentsRes.data.documents);
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    };

    const handleAddProvider = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await aiAPI.createProvider({
                name: formData.get('name'),
                provider_type: formData.get('provider_type'),
                api_key: formData.get('api_key'),
                model_name: formData.get('model_name'),
                max_tokens: parseInt(formData.get('max_tokens')),
                temperature: parseFloat(formData.get('temperature')),
                priority: parseInt(formData.get('priority')),
            });

            setShowAddProvider(false);
            loadData();
        } catch (error) {
            console.error('Ошибка добавления провайдера:', error);
        }
    };

    const handleUploadDocument = async (e) => {
        e.preventDefault();

        if (!uploadFile) return;

        try {
            await aiAPI.uploadDocument(1, uploadTitle, uploadFile);
            setUploadFile(null);
            setUploadTitle('');
            loadData();
        } catch (error) {
            console.error('Ошибка загрузки документа:', error);
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2 className="page-title">AI & RAG настройки</h2>
                <p className="page-subtitle">Управление AI провайдерами и базой знаний</p>
            </div>

            <div className="grid grid-2">
                {/* AI Провайдеры */}
                <motion.div
                    className="card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3>
                            <Brain size={20} style={{ display: 'inline', marginRight: '8px' }} />
                            AI Провайдеры (MTP)
                        </h3>
                        <button className="btn btn-primary" onClick={() => setShowAddProvider(!showAddProvider)}>
                            <Plus size={16} style={{ marginRight: '8px' }} />
                            Добавить
                        </button>
                    </div>

                    {showAddProvider && (
                        <form onSubmit={handleAddProvider} style={{ marginBottom: '24px', padding: '20px', background: 'var(--bg-darker)', borderRadius: '4px' }}>
                            <div className="form-group">
                                <label className="form-label">Название</label>
                                <input type="text" name="name" required />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Тип провайдера</label>
                                    <select name="provider_type" required>
                                        <option value="openai">OpenAI</option>
                                        <option value="anthropic">Anthropic</option>
                                        <option value="google">Google AI</option>
                                        <option value="local">Локальная модель</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Модель</label>
                                    <input type="text" name="model_name" placeholder="gpt-4-turbo-preview" required />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">API Key</label>
                                <input type="password" name="api_key" placeholder="Оставьте пустым для использования глобального" />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Max Tokens</label>
                                    <input type="number" name="max_tokens" defaultValue="1000" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Temperature</label>
                                    <input type="number" step="0.1" name="temperature" defaultValue="0.7" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Приоритет</label>
                                    <input type="number" name="priority" defaultValue="0" required />
                                </div>
                            </div>

                            <button type="submit" className="btn btn-success">Добавить провайдер</button>
                        </form>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {providers.map((provider) => (
                            <div
                                key={provider.id}
                                style={{
                                    padding: '16px',
                                    background: 'var(--bg-darker)',
                                    border: `1px solid ${provider.is_active ? 'var(--neon-cyan)' : 'var(--border-color)'}`,
                                    borderRadius: '4px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{provider.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            <span className="badge badge-info">{provider.provider_type}</span>
                                            <span style={{ marginLeft: '8px' }}>{provider.model_name}</span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            Tokens: {provider.max_tokens} | Temp: {provider.temperature} | Priority: {provider.priority}
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => aiAPI.deleteProvider(provider.id).then(loadData)}
                                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* RAG Документы */}
                <motion.div
                    className="card"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3>
                            <Zap size={20} style={{ display: 'inline', marginRight: '8px' }} />
                            RAG База знаний
                        </h3>
                    </div>

                    <form onSubmit={handleUploadDocument} style={{ marginBottom: '24px', padding: '20px', background: 'var(--bg-darker)', borderRadius: '4px' }}>
                        <div className="form-group">
                            <label className="form-label">Название документа</label>
                            <input
                                type="text"
                                value={uploadTitle}
                                onChange={(e) => setUploadTitle(e.target.value)}
                                placeholder="Инструкция по продукту"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                <Upload size={16} style={{ display: 'inline', marginRight: '8px' }} />
                                Файл (.txt)
                            </label>
                            <input
                                type="file"
                                accept=".txt"
                                onChange={(e) => setUploadFile(e.target.files[0])}
                                required
                                style={{ padding: '8px' }}
                            />
                        </div>

                        <button type="submit" className="btn btn-success" disabled={!uploadFile}>
                            Загрузить и индексировать
                        </button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {documents.map((doc) => (
                            <div
                                key={doc.id}
                                style={{
                                    padding: '16px',
                                    background: 'var(--bg-darker)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{doc.title}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            <span className="badge badge-info">{doc.document_type}</span>
                                            <span style={{ marginLeft: '8px' }}>{doc.content_length} символов</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                            Загружен: {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => aiAPI.deleteDocument(doc.id).then(loadData)}
                                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {documents.length === 0 && (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                            Нет загруженных документов
                        </p>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
