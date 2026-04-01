import { useState, useCallback, useRef } from 'react';
import { ExcelFile, SheetInfo, Message, Session, AgentStep } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 15);

const initialSession: Session = {
  id: generateId(),
  files: [],
  sheets: [],
  messages: [],
  status: 'idle',
};

export function useSession() {
  const [session, setSession] = useState<Session>(initialSession);
  const sessionIdRef = useRef<string | null>(null);

  // Load an existing session from the server
  const loadSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      if (!response.ok) throw new Error('Session not found');

      const data = await response.json();
      sessionIdRef.current = sessionId;

      const files: ExcelFile[] = data.files.map((f: any) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        sheets: f.sheets,
        uploadedAt: new Date(data.createdAt),
      }));

      const sheets: SheetInfo[] = data.filesWithSheets.flatMap((f: any) =>
        f.sheetInfo.map((s: any) => ({
          name: s.name,
          columns: s.columns.map((c: string) => ({
            name: c,
            type: 'mixed' as const,
            sampleValues: [],
          })),
          rowCount: s.rowCount,
        }))
      );

      const messages: Message[] = (data.history || []).map((msg: any, idx: number) => ({
        id: `${sessionId}-${idx}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(),
        status: 'complete' as const,
      }));

      setSession({
        id: sessionId,
        files,
        sheets,
        messages,
        status: 'ready',
      });
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }, []);

  // Create a new session on the server and reset local state
  const createSession = useCallback(async (): Promise<string> => {
    const res = await fetch('/api/session/create', { method: 'POST' });
    const data = await res.json();
    sessionIdRef.current = data.sessionId;
    setSession(prev => ({ ...prev, id: data.sessionId, files: [], sheets: [], messages: [], status: 'idle' }));
    return data.sessionId;
  }, []);

  const uploadFile = useCallback(async (file: File): Promise<void> => {
    setSession(prev => ({ ...prev, status: 'uploading' }));

    try {
      // Create session on first upload
      let sid = sessionIdRef.current;
      if (!sid) {
        const res = await fetch('/api/session/create', { method: 'POST' });
        const d = await res.json();
        sid = d.sessionId;
        sessionIdRef.current = sid;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/session/${sid}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();

      const excelFile: ExcelFile = {
        id: data.file.id,
        name: data.file.name,
        size: data.file.size,
        sheets: data.file.sheets,
        uploadedAt: new Date(),
      };

      const sheets: SheetInfo[] = data.sheets.map((s: any) => ({
        name: s.name,
        columns: s.columns.map((c: string) => ({
          name: c,
          type: 'mixed' as const,
          sampleValues: [],
        })),
        rowCount: s.rowCount,
      }));

      setSession(prev => {
        const isFirst = prev.files.length === 0;
        const allSheets = isFirst ? sheets : [...prev.sheets, ...sheets];
        const systemMsg: Message = {
          id: generateId(),
          role: 'system',
          content: `已上传 ${file.name}，包含 ${sheets.length} 个工作表 (${sheets.map(s => s.name).join(', ')})，共 ${sheets.reduce((a, s) => a + s.rowCount, 0)} 行数据。`,
          timestamp: new Date(),
          status: 'complete',
        };
        return {
          ...prev,
          id: sid!,
          files: [...prev.files, excelFile],
          sheets: allSheets,
          status: 'ready',
          messages: [...prev.messages, systemMsg],
        };
      });
    } catch (error) {
      setSession(prev => ({
        ...prev,
        status: 'error',
        messages: [
          ...prev.messages,
          {
            id: generateId(),
            role: 'system',
            content: `上传失败: ${error instanceof Error ? error.message : '未知错误'}`,
            timestamp: new Date(),
            status: 'error',
          },
        ],
      }));
    }
  }, []);

  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!sessionIdRef.current) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'complete',
    };

    const assistantMessageId = generateId();
    const pendingAssistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'streaming',
    };

    setSession(prev => ({
      ...prev,
      status: 'querying',
      messages: [...prev.messages, userMessage, pendingAssistantMessage],
    }));

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current, question: content }),
      });

      if (!response.ok) throw new Error('Query failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalResult = null;
      let finalContent = '';
      let currentEventType = '';
      let buffer = '';
      let hasError = false;
      const steps: AgentStep[] = [];
      let lastThinkingDuration: number | undefined;
      let lastUsage: { input_tokens: number; output_tokens: number } | undefined;

      const pushSteps = () => {
        setSession(prev => ({
          ...prev,
          messages: prev.messages.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, steps: [...steps], status: 'streaming' }
              : msg
          ),
        }));
      };

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (currentEventType === 'text_delta') {
                  const lastThinkingIdx = steps.map((s, i) => ({ s, i }))
                    .filter(({ s }) => s.type === 'thinking' && s.status === 'running')
                    .pop()?.i ?? -1;
                  if (lastThinkingIdx >= 0) {
                    steps[lastThinkingIdx] = {
                      ...steps[lastThinkingIdx],
                      streamingText: (steps[lastThinkingIdx].streamingText || '') + data.text,
                    };
                    pushSteps();
                  }
                }

                if (currentEventType === 'agent_step') {
                  for (let i = steps.length - 1; i >= 0; i--) {
                    if (steps[i].type === 'thinking' && steps[i].status === 'running') {
                      steps[i].status = 'done';
                      steps[i].duration = steps[i].startTime != null ? Date.now() - steps[i].startTime! : undefined;
                      break;
                    }
                  }
                  steps.push({
                    id: generateId(),
                    type: 'thinking',
                    iteration: data.iteration,
                    status: 'running',
                    startTime: Date.now(),
                    streamingText: '',
                  });
                  pushSteps();
                }

                if (currentEventType === 'agent_response') {
                  let capturedText = '';
                  lastThinkingDuration = undefined;
                  for (let i = steps.length - 1; i >= 0; i--) {
                    if (steps[i].type === 'thinking' && steps[i].status === 'running') {
                      capturedText = steps[i].streamingText || '';
                      steps[i].status = 'done';
                      steps[i].duration = steps[i].startTime != null ? Date.now() - steps[i].startTime! : undefined;
                      lastThinkingDuration = steps[i].duration;
                      steps[i].streamingText = undefined;
                      break;
                    }
                  }
                  lastUsage = data.usage || undefined;

                  steps.push({
                    id: generateId(),
                    type: 'llm_response',
                    iteration: data.iteration,
                    status: 'done',
                    llmText: capturedText || data.output || '',
                    toolCalls: data.tool_calls || [],
                  });
                  pushSteps();
                }

                if (currentEventType === 'tool_result') {
                  steps.push({
                    id: generateId(),
                    type: 'tool_call',
                    iteration: data.iteration,
                    status: 'done',
                    toolName: data.tool_name,
                    toolInput: data.tool_input,
                    toolResult: data.result,
                    thinkingDuration: lastThinkingDuration,
                    usage: lastUsage,
                  });
                  lastThinkingDuration = undefined;
                  lastUsage = undefined;
                  pushSteps();
                }

                if (currentEventType === 'final_result') {
                  finalResult = data.result || null;
                  finalContent = data.content || '';
                }

                if (currentEventType === 'error') {
                  hasError = true;
                  finalContent = `查询出错: ${data.message}`;
                }
              } catch (e) {
                // ignore incomplete chunks
              }
            }
          }
        }
      }

      setSession(prev => ({
        ...prev,
        status: 'ready',
        messages: prev.messages.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: finalContent || '查询完成',
                result: finalResult,
                steps: [...steps],
                status: hasError ? 'error' : 'complete',
              }
            : msg
        ),
      }));
    } catch (error) {
      setSession(prev => ({
        ...prev,
        status: 'ready',
        messages: prev.messages.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `查询失败: ${error instanceof Error ? error.message : '未知错误'}`,
                status: 'error',
              }
            : msg
        ),
      }));
    }
  }, []);

  const clearSession = useCallback(() => {
    sessionIdRef.current = null;
    setSession(initialSession);
  }, []);

  return {
    session,
    uploadFile,
    sendMessage,
    clearSession,
    createSession,
    loadSession,
  };
}
