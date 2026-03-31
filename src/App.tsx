import React, { useState, useRef, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { ChatUI } from './components/ChatUI';
import { Sidebar } from './components/Sidebar';
import { useSession } from './hooks/useSession';
import './styles/globals.css';

const App: React.FC = () => {
  const { session, uploadFile, sendMessage, clearSession } = useSession();
  const [showCode, setShowCode] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - startX.current;
      const next = Math.max(180, Math.min(480, startWidth.current + delta));
      setSidebarWidth(next);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">
            <span className="title-icon">◈</span>
            Excel Query Agent
          </h1>
          <span className="app-subtitle">自然语言查询 Excel 数据</span>
        </div>
        <div className="header-right">
          <button
            className={`toggle-btn ${showCode ? 'active' : ''}`}
            onClick={() => setShowCode(!showCode)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span>{showCode ? '隐藏代码' : '显示代码'}</span>
          </button>
        </div>
      </header>

      <main className="app-main">
        {session.files.length > 0 && (
          <>
            <div style={{ width: sidebarWidth, flexShrink: 0, height: '100%', overflow: 'hidden' }}>
              <Sidebar
                files={session.files}
                sheets={session.sheets}
                onClear={clearSession}
                onAddFile={uploadFile}
              />
            </div>
            <div className="divider" onMouseDown={onDividerMouseDown} />
          </>
        )}
        <div className="main-content">
          {session.status === 'idle' || session.status === 'uploading' ? (
            <div className="upload-view">
              <div className="upload-intro">
                <h2>上传 Excel 文件</h2>
                <p>支持 .xlsx, .xls, .csv 格式，最大 50MB</p>
              </div>
              <FileUpload
                onUpload={uploadFile}
                disabled={session.status === 'uploading'}
              />
            </div>
          ) : (
            <ChatUI
              messages={session.messages}
              onSendMessage={sendMessage}
              showCode={showCode}
              disabled={session.status === 'querying'}
            />
          )}
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <span className="powered-by">Powered by Claude Agent SDK</span>
          <span className="separator">·</span>
          <span className="session-status">
            {session.status === 'idle' && '等待上传'}
            {session.status === 'uploading' && '解析中...'}
            {session.status === 'ready' && '就绪'}
            {session.status === 'querying' && '查询中...'}
            {session.status === 'error' && '出错'}
          </span>
        </div>
      </footer>

      <style>{`
        .app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          background: var(--bg-primary);
        }

        .app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          animation: fadeIn 0.5s ease forwards;
        }

        .header-left {
          display: flex;
          align-items: baseline;
          gap: var(--space-4);
        }

        .app-title {
          font-family: var(--font-display);
          font-size: var(--text-xl);
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .title-icon {
          color: var(--accent);
          font-size: var(--text-lg);
        }

        .app-subtitle {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .toggle-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: transparent;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .toggle-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--border-light);
        }

        .toggle-btn.active {
          background: var(--accent);
          border-color: var(--accent);
          color: var(--bg-primary);
        }

        .app-main {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .divider {
          width: 5px;
          background: transparent;
          cursor: col-resize;
          flex-shrink: 0;
          position: relative;
          transition: background 0.15s;
        }

        .divider::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 1px;
          height: 40px;
          background: var(--border);
          border-radius: 1px;
          transition: background 0.15s, height 0.15s;
        }

        .divider:hover::after {
          background: var(--accent-dim);
          height: 60px;
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .upload-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-8);
          padding: var(--space-8);
          max-width: 600px;
          margin: 0 auto;
          width: 100%;
          animation: slideUp 0.5s ease forwards;
        }

        .upload-intro {
          text-align: center;
        }

        .upload-intro h2 {
          font-family: var(--font-display);
          font-size: var(--text-2xl);
          font-weight: 500;
          color: var(--text-primary);
          margin: 0 0 var(--space-2);
        }

        .upload-intro p {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        .app-footer {
          padding: var(--space-3) var(--space-6);
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
        }

        .footer-content {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .separator {
          color: var(--border-light);
        }

        .session-status {
          color: var(--accent);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .app-header {
            padding: var(--space-3) var(--space-4);
          }

          .header-left {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-1);
          }

          .app-subtitle {
            display: none;
          }

          .app-main {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            border-left: none;
            border-top: 1px solid var(--border);
          }
        }
      `}</style>
    </div>
  );
};

export default App;