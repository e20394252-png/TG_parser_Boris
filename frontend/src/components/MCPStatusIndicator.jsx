import { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import './MCPStatusIndicator.css';

const MCPStatusIndicator = ({ onDetailsClick }) => {
    const [status, setStatus] = useState({
        state: 'checking', // 'online', 'offline', 'degraded', 'checking'
        latency: null,
        error: null,
        lastCheck: null
    });

    const checkMCPStatus = async () => {
        try {
            const response = await fetch('/api/mcp/status');
            const data = await response.json();

            setStatus({
                state: data.status,
                latency: data.latency_ms,
                error: data.error,
                lastCheck: new Date().toISOString()
            });
        } catch (error) {
            setStatus({
                state: 'offline',
                latency: null,
                error: 'Failed to connect to backend',
                lastCheck: new Date().toISOString()
            });
        }
    };

    useEffect(() => {
        // Initial check
        checkMCPStatus();

        // Poll every 10 seconds
        const interval = setInterval(checkMCPStatus, 10000);

        return () => clearInterval(interval);
    }, []);

    const getStatusIcon = () => {
        switch (status.state) {
            case 'online':
                return <CheckCircle size={16} className="status-icon online" />;
            case 'offline':
                return <XCircle size={16} className="status-icon offline" />;
            case 'degraded':
                return <AlertCircle size={16} className="status-icon degraded" />;
            default:
                return <Activity size={16} className="status-icon checking" />;
        }
    };

    const getStatusText = () => {
        switch (status.state) {
            case 'online':
                return `MCP Online${status.latency ? ` (${Math.round(status.latency)}ms)` : ''}`;
            case 'offline':
                return 'MCP Offline';
            case 'degraded':
                return 'MCP Degraded';
            default:
                return 'Checking...';
        }
    };

    const getStatusClass = () => {
        return `mcp-status-indicator ${status.state}`;
    };

    return (
        <div
            className={getStatusClass()}
            onClick={onDetailsClick}
            title={status.error || getStatusText()}
        >
            <div className="status-content">
                {getStatusIcon()}
                <span className="status-text">{getStatusText()}</span>
            </div>
            {status.state === 'online' && (
                <div className="status-pulse"></div>
            )}
        </div>
    );
};

export default MCPStatusIndicator;
