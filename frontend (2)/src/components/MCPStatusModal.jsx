import { useState } from 'react';
import { X, Server, Zap, Database, Clock } from 'lucide-react';
import './MCPStatusModal.css';

const MCPStatusModal = ({ isOpen, onClose }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/mcp/health');
            const data = await response.json();
            setDetails(data);
        } catch (error) {
            setDetails({
                status: 'offline',
                error: 'Failed to fetch MCP details'
            });
        } finally {
            setLoading(false);
        }
    };

    useState(() => {
        if (isOpen) {
            fetchDetails();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="mcp-modal-overlay" onClick={onClose}>
            <div className="mcp-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="mcp-modal-header">
                    <h2>
                        <Server size={24} />
                        MCP Server Status
                    </h2>
                    <button className="close-button" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="mcp-modal-body">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Loading MCP details...</p>
                        </div>
                    ) : details ? (
                        <>
                            <div className="detail-section">
                                <div className="detail-item">
                                    <Server size={18} />
                                    <div>
                                        <label>Server URL</label>
                                        <value>{details.server_url || 'http://localhost:8000'}</value>
                                    </div>
                                </div>

                                <div className="detail-item">
                                    <Zap size={18} />
                                    <div>
                                        <label>Status</label>
                                        <value className={`status-badge ${details.status}`}>
                                            {details.status.toUpperCase()}
                                        </value>
                                    </div>
                                </div>

                                {details.latency_ms && (
                                    <div className="detail-item">
                                        <Clock size={18} />
                                        <div>
                                            <label>Latency</label>
                                            <value>{Math.round(details.latency_ms)}ms</value>
                                        </div>
                                    </div>
                                )}

                                <div className="detail-item">
                                    <Clock size={18} />
                                    <div>
                                        <label>Last Check</label>
                                        <value>
                                            {details.last_check
                                                ? new Date(details.last_check).toLocaleString('ru-RU')
                                                : 'N/A'
                                            }
                                        </value>
                                    </div>
                                </div>
                            </div>

                            {details.available_tools && details.available_tools.length > 0 && (
                                <div className="tools-section">
                                    <h3>
                                        <Database size={18} />
                                        Available Tools ({details.available_tools.length})
                                    </h3>
                                    <div className="tools-list">
                                        {details.available_tools.map((tool, index) => (
                                            <div key={index} className="tool-item">
                                                {tool}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {details.available_resources && details.available_resources.length > 0 && (
                                <div className="resources-section">
                                    <h3>
                                        <Database size={18} />
                                        Available Resources ({details.available_resources.length})
                                    </h3>
                                    <div className="resources-list">
                                        {details.available_resources.map((resource, index) => (
                                            <div key={index} className="resource-item">
                                                {resource}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {details.error && (
                                <div className="error-section">
                                    <p className="error-message">{details.error}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="empty-state">
                            <p>No details available</p>
                        </div>
                    )}
                </div>

                <div className="mcp-modal-footer">
                    <button className="btn-secondary" onClick={fetchDetails}>
                        Refresh
                    </button>
                    <button className="btn-primary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MCPStatusModal;
