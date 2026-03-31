import React, { useState, useRef, useEffect } from 'react';
import type { AgentStep } from '../types';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Step detail renderer ──────────────────────────────────────────────────────
const StepDetail: React.FC<{ step: AgentStep }> = ({ step }) => {
  const [expanded, setExpanded] = useState(step.type === 'llm_response');

  const formatTime = (ts?: number) =>
    ts ? new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  if (step.type === 'thinking') {
    // Only show live streaming bubble while thinking; hide the green status block
    if (!step.streamingText) return null;
    return (
      <div className="round-reasoning-bubble">
        <div className="round-reasoning-text">{step.streamingText}</div>
      </div>
    );
  }

  if (step.type === 'llm_response') {
    const hasTools = step.toolCalls && step.toolCalls.length > 0;
    // Only render the reasoning bubble for intermediate rounds; skip the LLM header block entirely
    if (!step.llmText || !hasTools) return null;
    return (
      <div className="round-reasoning-bubble">
        <div className="round-reasoning-text">{step.llmText}</div>
        <div className="round-reasoning-time">{formatTime(step.startTime)}</div>
      </div>
    );
  }

  if (step.type === 'tool_call') {
    const result = step.toolResult as Record<string, unknown> | null;
    const isError = result?.error;
    const rowCount = (result as { total_matched?: number; rows?: unknown[] } | null)?.total_matched
      ?? (result as { rows?: unknown[] } | null)?.rows?.length;
    const durationLabel = step.thinkingDuration !== undefined
      ? (step.thinkingDuration < 1000 ? `${step.thinkingDuration}ms` : `${(step.thinkingDuration / 1000).toFixed(1)}s`)
      : '';

    return (
      <div className={`step step--tool-exec ${isError ? 'step--tool-error' : ''}`}>
        <div className="step-header" onClick={() => setExpanded(e => !e)}>
          {isError
            ? <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            : <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          }
          <span>
            {durationLabel && <span className="step-time">{durationLabel} · </span>}
            执行工具 <code className="tool-name">{step.toolName}</code>
            {isError
              ? <span className="step-tag step-tag--error">错误</span>
              : rowCount !== undefined
                ? <span className="step-tag step-tag--ok">{rowCount} 行</span>
                : <span className="step-tag step-tag--ok">完成</span>
            }
          </span>
          <svg className={`chevron ${expanded ? 'chevron--open' : ''}`} viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
        {expanded && (
          <div className="step-body">
            {step.usage && (
              <div className="step-usage">
                <span>输入 {step.usage.input_tokens.toLocaleString()} tokens</span>
                <span className="usage-sep">·</span>
                <span>输出 {step.usage.output_tokens.toLocaleString()} tokens</span>
              </div>
            )}
            {step.toolInput && (
              <div className="step-section">
                <div className="step-section-label">输入参数</div>
                <pre className="step-pre">{JSON.stringify(step.toolInput, null, 2)}</pre>
              </div>
            )}
            <div className="step-section">
              <div className="step-section-label">返回结果</div>
              <pre className="step-pre">{JSON.stringify(step.toolResult, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

// ── User bubble ───────────────────────────────────────────────────────────────
const UserBubble: React.FC<{ message: Message }> = ({ message }) => (
  <div className="msg-row msg-row--user">
    <div className="avatar avatar--user">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
    <div className="bubble bubble--user">
      <div className="bubble-text">{message.content}</div>
      <div className="bubble-time">
        {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  </div>
);

// ── Assistant bubble ──────────────────────────────────────────────────────────
const AssistantBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';
  const steps = message.steps || [];

  return (
    <div className="msg-row msg-row--agent">
      <div className="avatar avatar--agent">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      <div className="agent-content">
        {/* Structured steps */}
        {steps.length > 0 && (
          <div className="steps-list">
            {steps.map(step => <StepDetail key={step.id} step={step} />)}
          </div>
        )}

        {/* Final answer */}
        {message.content && (
          <div className={`bubble bubble--agent ${isError ? 'bubble--error' : ''}`}>
            <div className="bubble-text markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
            <div className="bubble-time">
              {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isStreaming && !message.content && steps.length === 0 && (
          <div className="typing-indicator"><span /><span /><span /></div>
        )}
      </div>
    </div>
  );
};

// ── System notice ─────────────────────────────────────────────────────────────
const SystemNotice: React.FC<{ message: Message }> = ({ message }) => (
  <div className="system-notice">
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
    <span>{message.content}</span>
  </div>
);

// ── Main ChatUI ───────────────────────────────────────────────────────────────
interface ChatUIProps {
  messages: Message[];
  onSendMessage: (content: string) => Promise<void>;
  showCode: boolean;
  disabled?: boolean;
}

export const ChatUI: React.FC<ChatUIProps> = ({ messages, onSendMessage, disabled }) => {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || isSending || disabled) return;
    const content = input.trim();
    setInput('');
    setIsSending(true);
    await onSendMessage(content);
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const suggestions = ['查询2024年非流动资产的金额', '统计各科目期末余额合计', '对比2024和2025年资产变化'];

  return (
    <div className="chat-ui">
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2">
                <circle cx="24" cy="24" r="20" />
                <path d="M16 28s2 4 8 4 8-4 8-4" />
                <circle cx="18" cy="20" r="2" fill="currentColor" />
                <circle cx="30" cy="20" r="2" fill="currentColor" />
              </svg>
            </div>
            <p className="empty-title">上传文件后开始提问</p>
            <div className="suggestions">
              {suggestions.map((s, i) => (
                <button key={i} className="suggestion-chip" onClick={() => setInput(s)} disabled={disabled}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => {
              if (msg.role === 'user') return <UserBubble key={msg.id} message={msg} />;
              if (msg.role === 'system') return <SystemNotice key={msg.id} message={msg} />;
              return <AssistantBubble key={msg.id} message={msg} />;
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="input-bar">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入查询问题..."
          disabled={disabled || isSending}
          rows={1}
          className="chat-input"
        />
        <button className="send-btn" onClick={handleSubmit} disabled={!input.trim() || isSending || disabled}>
          {isSending
            ? <svg className="spin" viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="28 56" strokeLinecap="round" /></svg>
            : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          }
        </button>
      </div>

      <style>{`
        .chat-ui { display: flex; flex-direction: column; height: 100%; background: var(--bg-primary); }

        .messages-area {
          flex: 1; overflow-y: auto; padding: 20px 24px;
          display: flex; flex-direction: column; gap: 8px;
        }

        /* Empty state */
        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 48px 24px; color: var(--text-muted); }
        .empty-icon { opacity: 0.3; }
        .empty-title { font-size: var(--text-base); color: var(--text-secondary); }
        .suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 480px; }
        .suggestion-chip { font-family: var(--font-mono); font-size: 12px; padding: 6px 12px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 20px; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
        .suggestion-chip:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
        .suggestion-chip:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Rows */
        .msg-row { display: flex; align-items: flex-start; gap: 8px; animation: slideUp 0.2s ease forwards; }
        .msg-row--user { flex-direction: row-reverse; }

        /* Avatars */
        .avatar { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .avatar--user { background: var(--accent); color: #fff; }
        .avatar--agent { background: var(--bg-elevated); color: var(--text-secondary); border: 1px solid var(--border); }

        /* Bubbles */
        .bubble { max-width: 72%; padding: 10px 14px; border-radius: var(--radius-xl); }
        .bubble--user { background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
        .bubble--agent { background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border); border-bottom-left-radius: 4px; box-shadow: var(--shadow-sm); }
        .bubble--error { background: #fff0f0; border-color: #fca5a5; color: var(--error); }
        .bubble-text { font-size: var(--text-sm); line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
        .bubble-time { font-family: var(--font-mono); font-size: 10px; opacity: 0.5; margin-top: 4px; text-align: right; }

        /* Agent content */
        .agent-content { display: flex; flex-direction: column; gap: 4px; width: 85%; min-width: 0; }

        /* Steps list */
        .steps-list { display: flex; flex-direction: column; gap: 3px; }

        /* Individual step */
        .step {
          font-family: var(--font-mono);
          font-size: 11.5px;
          border-radius: 8px;
          border: 1px solid transparent;
          overflow: hidden;
        }
        .step-header {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 10px; cursor: pointer;
          user-select: none;
        }
        .step-header:hover { filter: brightness(0.97); }
        .step-header span { flex: 1; }

        /* Thinking step */
        .step--thinking { background: #f0f9ff; border-color: #bae6fd; color: #0369a1; }
        .step--running  { background: #eff6ff; border-color: #bfdbfe; color: #2563eb; }
        .step--done     { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
        .step--error    { background: #fff1f2; border-color: #fecdd3; color: #be123c; }

        /* LLM step */
        .step--llm { background: #fafaf9; border-color: #e7e5e4; color: #44403c; }

        /* Tool execution step — gray */
        .step--tool-exec { background: #f3f4f6; border-color: #d1d5db; color: #374151; }
        .step--tool-error { background: #fff1f2; border-color: #fecdd3; color: #be123c; }

        .step-spinner {
          width: 10px; height: 10px; flex-shrink: 0;
          border: 1.5px solid currentColor; border-top-color: transparent;
          border-radius: 50%; animation: spin 0.8s linear infinite;
        }

        .step-time {
          font-size: 10px; opacity: 0.6; margin-right: 6px; font-variant-numeric: tabular-nums;
        }

        .step-tag {
          display: inline-block; font-size: 10px; padding: 1px 6px;
          border-radius: 10px; margin-left: 6px; font-weight: 600;
        }
        .step-tag--tool { background: #dbeafe; color: #1d4ed8; }
        .step-tag--ok   { background: #dcfce7; color: #166534; }
        .step-tag--error{ background: #fee2e2; color: #991b1b; }

        .chevron { transition: transform 0.2s; flex-shrink: 0; }
        .chevron--open { transform: rotate(180deg); }

        .tool-name { font-weight: 600; }

        /* Step round wrapper */
        .step-round { display: flex; flex-direction: column; gap: 4px; }

        /* Per-round reasoning white bubble */
        .round-reasoning-bubble {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
          padding: 10px 14px; font-size: 13px; line-height: 1.6;
          color: #374151; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .round-reasoning-text { white-space: pre-wrap; word-break: break-word; }
        .round-reasoning-time { font-family: var(--font-mono); font-size: 10px; color: #9ca3af; text-align: right; margin-top: 4px; }

        /* Always-visible thinking text in llm_response */
        .step-thinking-inline { padding: 0 10px 8px; display: flex; flex-direction: column; gap: 3px; }

        /* Token usage line inside tool step */
        .step-usage { font-family: var(--font-mono); font-size: 10px; color: #6b7280; display: flex; gap: 4px; padding: 2px 0 4px; }
        .usage-sep { opacity: 0.4; }

        /* Expandable body */
        .step-body { padding: 0 10px 8px; display: flex; flex-direction: column; gap: 6px; }
        .step-section { display: flex; flex-direction: column; gap: 3px; }
        .step-section-label { font-size: 10px; font-weight: 600; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; }
        .step-pre {
          font-family: var(--font-mono); font-size: 11px; line-height: 1.5;
          background: rgba(0,0,0,0.04); border-radius: 4px; padding: 6px 8px;
          overflow-x: auto; white-space: pre-wrap; word-break: break-all;
          max-height: 200px; overflow-y: auto;
          border: 1px solid rgba(0,0,0,0.06);
        }

        /* Typing indicator */
        .typing-indicator { display: flex; gap: 4px; padding: 10px 14px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-xl); border-bottom-left-radius: 4px; width: fit-content; }
        .typing-indicator span { width: 7px; height: 7px; background: var(--text-muted); border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

        /* System notice */
        .system-notice { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); padding: 6px 12px; background: var(--bg-tertiary); border-radius: 20px; width: fit-content; margin: 4px auto; border: 1px solid var(--border); }

        /* Markdown rendering */
        .markdown-body { font-size: var(--text-sm); line-height: 1.7; }
        .markdown-body h1,.markdown-body h2,.markdown-body h3 { font-weight: 600; margin: 8px 0 4px; line-height: 1.3; }
        .markdown-body h1 { font-size: 1.1em; }
        .markdown-body h2 { font-size: 1em; }
        .markdown-body h3 { font-size: 0.95em; }
        .markdown-body p { margin: 3px 0; }
        .markdown-body ul,.markdown-body ol { padding-left: 18px; margin: 4px 0; }
        .markdown-body li { margin: 2px 0; }
        .markdown-body li > p { margin: 0; }
        .markdown-body strong { font-weight: 600; }
        .markdown-body em { font-style: italic; }
        .markdown-body code { font-family: var(--font-mono); font-size: 0.88em; background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; }
        .markdown-body pre { background: rgba(0,0,0,0.05); border-radius: 6px; padding: 10px 12px; overflow-x: auto; margin: 8px 0; }
        .markdown-body pre code { background: none; padding: 0; }
        .markdown-body table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 0.88em; display: block; overflow-x: auto; }
        .markdown-body th,.markdown-body td { border: 1px solid var(--border); padding: 6px 12px; text-align: left; white-space: nowrap; }
        .markdown-body th { background: var(--bg-tertiary); font-weight: 600; color: var(--text-primary); }
        .markdown-body hr { border: none; border-top: 1px solid var(--border); margin: 10px 0; }
        .markdown-body blockquote { border-left: 3px solid var(--accent); padding-left: 10px; color: var(--text-secondary); margin: 6px 0; }

        /* Input bar */
        .input-bar { display: flex; align-items: flex-end; gap: 10px; padding: 14px 20px; background: var(--bg-secondary); border-top: 1px solid var(--border); }
        .chat-input { flex: 1; font-family: var(--font-display); font-size: var(--text-sm); padding: 10px 14px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius-lg); color: var(--text-primary); resize: none; min-height: 42px; max-height: 120px; line-height: 1.5; transition: border-color 0.15s; }
        .chat-input:focus { outline: none; border-color: var(--accent); }
        .chat-input::placeholder { color: var(--text-muted); }
        .chat-input:disabled { opacity: 0.5; }
        .send-btn { width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; background: var(--accent); border: none; border-radius: var(--radius-lg); color: #fff; cursor: pointer; flex-shrink: 0; transition: background 0.15s, transform 0.1s; }
        .send-btn:hover:not(:disabled) { background: var(--accent-bright); transform: scale(1.04); }
        .send-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .send-btn .spin { animation: spin 0.9s linear infinite; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
};
