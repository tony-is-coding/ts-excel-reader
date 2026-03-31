import React, { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'python' }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple syntax highlighting for Python
  const highlightCode = (code: string): string => {
    return code
      .replace(/(#.*$)/gm, '<span class="comment">$1</span>')
      .replace(/\b(import|from|as|def|return|if|else|elif|for|in|while|with|try|except|finally|class|lambda|yield|raise|pass|break|continue|and|or|not|in|is|None|True|False)\b/g, '<span class="keyword">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>')
      .replace(/(['"]{3}[\s\S]*?['"]{3}|['"][^'"]*['"])/g, '<span class="string">$1</span>')
      .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '<span class="function">$1</span>(');
  };

  return (
    <div className={`code-block ${expanded ? 'expanded' : ''}`}>
      <div className="code-header" onClick={() => setExpanded(!expanded)}>
        <div className="code-meta">
          <span className="code-language">{language}</span>
          <span className="code-label">生成的查询代码</span>
        </div>
        <div className="code-actions">
          <button
            className="action-btn copy-btn"
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            title="复制代码"
          >
            {copied ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <span className="expand-indicator">
            {expanded ? '−' : '+'}
          </span>
        </div>
      </div>

      {expanded && (
        <pre className="code-content">
          <code dangerouslySetInnerHTML={{ __html: highlightCode(code) }} />
        </pre>
      )}

      <style>{`
        .code-block {
          margin-top: var(--space-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: #1e1e24;
        }

        .code-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-2) var(--space-3);
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          user-select: none;
        }

        .code-block:not(.expanded) .code-header {
          border-bottom: none;
        }

        .code-meta {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .code-language {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          padding: var(--space-1) var(--space-2);
          background: var(--bg-elevated);
          border-radius: var(--radius-sm);
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .code-label {
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .code-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .action-btn:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
          border-color: var(--border-light);
        }

        .expand-indicator {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: var(--text-lg);
          color: var(--text-muted);
        }

        .code-content {
          margin: 0;
          padding: var(--space-4);
          overflow-x: auto;
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          line-height: 1.6;
          color: #abb2bf;
        }

        .code-content code {
          display: block;
          white-space: pre;
        }

        /* Syntax highlighting colors */
        .code-content :global(.keyword) {
          color: #c678dd;
        }

        .code-content :global(.string) {
          color: #98c379;
        }

        .code-content :global(.number) {
          color: #d19a66;
        }

        .code-content :global(.comment) {
          color: #5c6370;
          font-style: italic;
        }

        .code-content :global(.function) {
          color: #61afef;
        }
      `}</style>
    </div>
  );
};