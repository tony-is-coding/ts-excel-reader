export interface ExcelFile {
  id: string;
  name: string;
  size: number;
  sheets: string[];
  uploadedAt: Date;
}

export interface SheetInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
}

export interface ColumnInfo {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
  sampleValues: (string | number | null)[];
}

export interface AgentStep {
  id: string;
  type: 'thinking' | 'llm_response' | 'tool_call';
  iteration: number;
  status: 'running' | 'done' | 'error';
  startTime?: number;   // Date.now() when step started
  duration?: number;    // ms elapsed when step completed
  // LLM response
  llmText?: string;
  streamingText?: string; // live text_delta accumulation for this round
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
  // Tool call result
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  thinkingDuration?: number; // ms from the associated thinking step
  usage?: { input_tokens: number; output_tokens: number };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  code?: string;
  result?: QueryResult;
  steps?: AgentStep[];
  status?: 'pending' | 'streaming' | 'complete' | 'error';
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated?: boolean;
}

export interface Session {
  id: string;
  files: ExcelFile[];
  sheets: SheetInfo[];
  messages: Message[];
  status: 'idle' | 'uploading' | 'ready' | 'querying' | 'error';
}

export interface AppState {
  session: Session;
  showCode: boolean;
  theme: 'dark';
}