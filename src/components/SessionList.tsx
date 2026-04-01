import React, { useState, useEffect } from 'react';
import { SessionListItem } from '../types';

interface SessionListProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  currentSessionId,
  onSelectSession,
  onNewSession,
}) => {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, [currentSessionId]);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="session-list">
      <div className="session-list-header">
        <h3>会话历史</h3>
        <button className="new-session-btn" onClick={onNewSession} title="新建会话">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="session-loading">加载中...</div>
      ) : sessions.length === 0 ? (
        <div className="no-sessions">暂无历史会话</div>
      ) : (
        <div className="sessions">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="session-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="session-info">
                <div className="session-name">{session.fileName}</div>
                <div className="session-meta">
                  <span>{formatDate(session.createdAt)}</span>
                  {session.fileCount > 1 && (
                    <>
                      <span className="meta-dot">·</span>
                      <span>{session.fileCount} 个文件</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .session-list {
          width: 220px;
          height: 100%;
          background: var(--bg-tertiary);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .session-list-header {
          padding: 12px 12px 10px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .session-list-header h3 {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          font-family: var(--font-display);
        }

        .new-session-btn {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 5px;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s;
        }

        .new-session-btn:hover {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }

        .session-loading,
        .no-sessions {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .sessions {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .sessions::-webkit-scrollbar {
          width: 4px;
        }

        .sessions::-webkit-scrollbar-track {
          background: transparent;
        }

        .sessions::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 2px;
        }

        .session-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
          margin-bottom: 4px;
        }

        .session-item:hover {
          background: var(--bg-secondary);
        }

        .session-item.active {
          background: var(--bg-secondary);
          border: 1px solid var(--accent-dim);
        }

        .session-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 5px;
          color: var(--accent);
          flex-shrink: 0;
        }

        .session-info {
          flex: 1;
          min-width: 0;
        }

        .session-name {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.4;
        }

        .session-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .meta-dot {
          opacity: 0.4;
        }
      `}</style>
    </div>
  );
};