import React, { useState, useCallback, useRef } from 'react';

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(f =>
      f.name.endsWith('.xlsx') ||
      f.name.endsWith('.xls') ||
      f.name.endsWith('.csv')
    );

    if (validFile) {
      setIsProcessing(true);
      await onUpload(validFile);
      setIsProcessing(false);
    }
  }, [onUpload]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true);
      await onUpload(file);
      setIsProcessing(false);
    }
  }, [onUpload]);

  const handleClick = () => {
    if (!disabled && !isProcessing) {
      inputRef.current?.click();
    }
  };

  return (
    <div
      className={`upload-zone ${isDragging ? 'dragging' : ''} ${disabled || isProcessing ? 'disabled' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <div className="upload-icon">
        {isProcessing ? (
          <svg className="spinner" viewBox="0 0 24 24" width="48" height="48">
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="31.4 31.4"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        )}
      </div>

      <div className="upload-text">
        {isProcessing ? (
          <span className="processing">正在解析文件...</span>
        ) : isDragging ? (
          <span className="highlight">放开以上传</span>
        ) : (
          <>
            <span className="primary">拖放 Excel 文件至此处</span>
            <span className="secondary">或点击选择文件 · 支持 .xlsx, .xls, .csv</span>
          </>
        )}
      </div>

      <style>{`
        .upload-zone {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
          padding: var(--space-10) var(--space-6);
          border: 2px dashed var(--border-light);
          border-radius: var(--radius-xl);
          background: var(--bg-secondary);
          cursor: pointer;
          transition: all var(--transition-base);
          overflow: hidden;
        }

        .upload-zone::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, var(--accent-dim) 0%, transparent 70%);
          opacity: 0;
          transition: opacity var(--transition-base);
        }

        .upload-zone:hover:not(.disabled) {
          border-color: var(--accent-dim);
          background: var(--bg-tertiary);
        }

        .upload-zone:hover:not(.disabled)::before {
          opacity: 0.1;
        }

        .upload-zone.dragging {
          border-color: var(--accent);
          border-style: solid;
          background: var(--bg-tertiary);
        }

        .upload-zone.dragging::before {
          opacity: 0.15;
        }

        .upload-zone.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .upload-icon {
          position: relative;
          z-index: 1;
          color: var(--text-muted);
          transition: color var(--transition-base), transform var(--transition-base);
        }

        .upload-zone:hover:not(.disabled) .upload-icon {
          color: var(--accent);
          transform: translateY(-2px);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .upload-text {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          text-align: center;
        }

        .upload-text .primary {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 500;
          color: var(--text-primary);
        }

        .upload-text .secondary {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-muted);
          letter-spacing: 0.02em;
        }

        .upload-text .highlight {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--accent);
        }

        .upload-text .processing {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          color: var(--accent);
        }
      `}</style>
    </div>
  );
};