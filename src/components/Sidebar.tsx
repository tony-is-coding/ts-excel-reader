import React, { useState, useRef } from 'react';
import { ExcelFile, SheetInfo } from '../types';

interface SidebarProps {
  files: ExcelFile[];
  sheets: SheetInfo[];
  onClear: () => void;
  onAddFile: (file: File) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  string:  { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', label: 'STR'  },
  number:  { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80', label: 'NUM'  },
  date:    { bg: 'rgba(168,85,247,0.15)',  text: '#c084fc', label: 'DATE' },
  boolean: { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', label: 'BOOL' },
  mixed:   { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', label: 'MIX'  },
};

export const Sidebar: React.FC<SidebarProps> = ({ files, sheets, onClear, onAddFile }) => {
  const [activeSheet, setActiveSheet] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (files.length === 0) return null;

  const current = sheets[activeSheet];
  const allCols = current?.columns ?? [];

  const handleAddFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { onAddFile(file); e.target.value = ''; }
  };

  return (
    <aside className="sidebar">
      {/* File list */}
      <div className="sidebar-header">
        <div className="files-list">
          {files.map((file, idx) => (
            <div key={file.id} className="file-row">
              <div className="file-icon">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="file-info">
                <div className="file-name" title={file.name}>{file.name}</div>
                <div className="file-meta">
                  <span>{formatFileSize(file.size)}</span>
                  <span className="meta-dot">·</span>
                  <span>{file.sheets.length} 个工作表</span>
                </div>
              </div>
              {idx === 0 && (
                <button className="clear-btn" onClick={onClear} title="清除会话">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleAddFile} />
        <button className="add-file-btn" onClick={() => fileInputRef.current?.click()}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          添加文件
        </button>
      </div>

      <div className="sidebar-body">
        {/* Sheet selector */}
        <div className="section">
          <div className="section-label">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            工作表
          </div>
          <div className="select-wrapper">
            <select
              className="sheet-select"
              value={activeSheet}
              onChange={e => setActiveSheet(Number(e.target.value))}
            >
              {sheets.map((sheet, i) => (
                <option key={i} value={i}>
                  {sheet.name}（{sheet.rowCount.toLocaleString()} 行）
                </option>
              ))}
            </select>
            <svg className="select-arrow" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Column schema */}
        {current && (
          <div className="section schema-section">
            <div className="section-label">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="9" x2="20" y2="9" />
                <line x1="4" y1="15" x2="20" y2="15" />
                <line x1="10" y1="3" x2="8" y2="21" />
                <line x1="16" y1="3" x2="14" y2="21" />
              </svg>
              列结构
              <span className="col-count">{allCols.length}</span>
            </div>
            <ul className="column-list">
              {allCols.map((col, i) => {
                const t = TYPE_COLORS[col.type] ?? TYPE_COLORS.mixed;
                return (
                  <li key={i} className="column-row">
                    <span className="col-index">{i + 1}</span>
                    <span className="col-name" title={col.name}>{col.name}</span>
                    <span className="col-badge" style={{ background: t.bg, color: t.text }}>{t.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <style>{`
        .sidebar {
          width: 100%; height: 100%;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column; overflow: hidden;
        }

        .sidebar-header {
          padding: 12px 12px 8px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          display: flex; flex-direction: column; gap: 8px;
        }

        .files-list { display: flex; flex-direction: column; gap: 6px; }

        .file-row { display: flex; align-items: flex-start; gap: 8px; }

        .file-icon {
          width: 26px; height: 26px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.2);
          border-radius: 5px; color: var(--accent);
        }

        .file-info { flex: 1; min-width: 0; }

        .file-name {
          font-size: 11px; font-weight: 600; color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4;
        }

        .file-meta {
          display: flex; align-items: center; gap: 4px;
          font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); margin-top: 1px;
        }

        .meta-dot { opacity: 0.4; }

        .clear-btn {
          width: 22px; height: 22px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: transparent; border: 1px solid transparent; border-radius: 4px;
          color: var(--text-muted); cursor: pointer; transition: all 0.15s;
        }
        .clear-btn:hover { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #f87171; }

        .add-file-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 10px; background: transparent;
          border: 1px dashed var(--border); border-radius: 6px;
          color: var(--text-muted); font-family: var(--font-mono); font-size: 11px;
          cursor: pointer; transition: all 0.15s; width: 100%; justify-content: center;
        }
        .add-file-btn:hover { border-color: var(--accent); color: var(--accent); }

        .sidebar-body {
          flex: 1; overflow-y: auto; padding: 12px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .sidebar-body::-webkit-scrollbar { width: 4px; }
        .sidebar-body::-webkit-scrollbar-track { background: transparent; }
        .sidebar-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

        .section { display: flex; flex-direction: column; gap: 8px; }

        .section-label {
          display: flex; align-items: center; gap: 5px;
          font-family: var(--font-mono); font-size: 10px; font-weight: 600;
          color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em;
        }

        .col-count {
          margin-left: auto; background: var(--bg-elevated); color: var(--text-muted);
          font-size: 10px; padding: 1px 5px; border-radius: 10px; border: 1px solid var(--border);
        }

        .select-wrapper { position: relative; }

        .sheet-select {
          width: 100%; padding: 7px 28px 7px 10px;
          background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px;
          color: var(--text-primary); font-family: var(--font-mono); font-size: 12px;
          cursor: pointer; appearance: none; transition: border-color 0.15s;
        }
        .sheet-select:focus { outline: none; border-color: var(--accent-dim); }
        .sheet-select option { background: var(--bg-secondary); }

        .select-arrow {
          position: absolute; right: 9px; top: 50%; transform: translateY(-50%);
          color: var(--text-muted); pointer-events: none;
        }

        .schema-section { flex: 1; min-height: 0; }

        .column-list {
          list-style: none; padding: 0; margin: 0;
          display: flex; flex-direction: column; gap: 2px;
        }

        .column-row {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 8px; border-radius: 5px; transition: background 0.1s;
        }
        .column-row:hover { background: var(--bg-elevated); }

        .col-index {
          font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);
          width: 16px; text-align: right; flex-shrink: 0; opacity: 0.5;
        }

        .col-name {
          flex: 1; font-family: var(--font-mono); font-size: 12px; color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
        }

        .col-badge {
          flex-shrink: 0; font-family: var(--font-mono); font-size: 9px;
          font-weight: 700; letter-spacing: 0.05em; padding: 2px 5px; border-radius: 3px;
        }
      `}</style>
    </aside>
  );
};
