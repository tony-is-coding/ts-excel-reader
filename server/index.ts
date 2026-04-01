import express from 'express';
import multer from 'multer';
import cors from 'cors';
import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const name = file.originalname.toLowerCase();
    if (allowed.some(a => name.endsWith(a))) cb(null, true);
    else cb(new Error('Only Excel and CSV files are allowed'));
  }
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN || '',
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
});

// ── Disk session paths ────────────────────────────────────────────────────────
const SESSIONS_DIR = path.join(process.cwd(), 'sessions');
fs.mkdirSync(SESSIONS_DIR, { recursive: true });

function sessionDir(id: string) { return path.join(SESSIONS_DIR, id); }
function metaPath(id: string)    { return path.join(sessionDir(id), 'meta.json'); }
function dataDir(id: string)     { return path.join(sessionDir(id), 'data'); }
function dataPath(id: string, fileId: string) { return path.join(dataDir(id), `${fileId}.json`); }
function historyPath(id: string) { return path.join(sessionDir(id), 'history.json'); }
function logsDir(id: string)     { return path.join(sessionDir(id), 'logs'); }

// ── Types ─────────────────────────────────────────────────────────────────────
interface FileMeta {
  id: string;
  name: string;
  size: number;
  sheets: string[];
}

interface SessionMeta {
  id: string;
  createdAt: string;
  files: FileMeta[];
}

interface FileData {
  sheets: Record<string, Record<string, unknown>[]>;
  columns: Record<string, string[]>;
}

// In-memory cache: sessionId -> Map<fileId, FileData>
const sessionCache = new Map<string, Map<string, FileData>>();

// ── Disk helpers ──────────────────────────────────────────────────────────────
function readMeta(id: string): SessionMeta | null {
  try { return JSON.parse(fs.readFileSync(metaPath(id), 'utf8')); }
  catch { return null; }
}

function writeMeta(meta: SessionMeta) {
  fs.mkdirSync(sessionDir(meta.id), { recursive: true });
  fs.writeFileSync(metaPath(meta.id), JSON.stringify(meta, null, 2));
}

function readHistory(id: string): Anthropic.MessageParam[] {
  try { return JSON.parse(fs.readFileSync(historyPath(id), 'utf8')); }
  catch { return []; }
}

function writeHistory(id: string, messages: Anthropic.MessageParam[]) {
  fs.writeFileSync(historyPath(id), JSON.stringify(messages, null, 2));
}

function logLLMCall(id: string, data: unknown) {
  fs.mkdirSync(logsDir(id), { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(logsDir(id), `${ts}.json`), JSON.stringify(data, null, 2));
}

function loadFileData(sessionId: string, fileId: string): FileData | null {
  // Check cache first
  const cached = sessionCache.get(sessionId)?.get(fileId);
  if (cached) return cached;
  try {
    const raw = JSON.parse(fs.readFileSync(dataPath(sessionId, fileId), 'utf8')) as FileData;
    if (!sessionCache.has(sessionId)) sessionCache.set(sessionId, new Map());
    sessionCache.get(sessionId)!.set(fileId, raw);
    return raw;
  } catch { return null; }
}

function loadAllFileData(sessionId: string): Map<string, FileData> {
  const meta = readMeta(sessionId);
  if (!meta) return new Map();
  const result = new Map<string, FileData>();
  for (const f of meta.files) {
    const d = loadFileData(sessionId, f.id);
    if (d) result.set(f.id, d);
  }
  return result;
}

// ── Excel parsing ─────────────────────────────────────────────────────────────
function parseExcel(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets: Record<string, Record<string, unknown>[]> = {};
  const columns: Record<string, string[]> = {};
  workbook.SheetNames.forEach(name => {
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: null }) as Record<string, unknown>[];
    sheets[name] = data;
    if (data.length > 0) columns[name] = Object.keys(data[0]);
  });
  return { sheets, columns, sheetNames: workbook.SheetNames };
}

// ── Data summary for prompt ───────────────────────────────────────────────────
function generateDataSummary(sessionId: string): string {
  const meta = readMeta(sessionId);
  if (!meta) return '';
  let summary = '';
  for (const fileMeta of meta.files) {
    const fd = loadFileData(sessionId, fileMeta.id);
    if (!fd) continue;
    summary += `\n【文件】${fileMeta.name}\n`;
    summary += `可用工作表: ${Object.keys(fd.sheets).join(', ')}\n`;
    for (const [sheetName, rows] of Object.entries(fd.sheets)) {
      const cols = fd.columns[sheetName] || [];
      summary += `  工作表 "${sheetName}": ${rows.length} 行, 列: ${cols.join(', ')}\n`;
      if (rows.length > 0) summary += `  示例(第1行): ${JSON.stringify(rows[0])}\n`;
    }
  }
  return summary;
}

// ── Tool definitions ──────────────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: 'get_sheet_info',
    description: '获取指定工作表的列信息和前几行示例数据',
    input_schema: {
      type: 'object' as const,
      properties: {
        sheet_name: { type: 'string', description: '工作表名称' },
        sample_rows: { type: 'number', description: '返回示例行数，默认5' }
      },
      required: ['sheet_name']
    }
  },
  {
    name: 'query_data',
    description: '查询工作表数据，支持过滤、排序和限制返回行数',
    input_schema: {
      type: 'object' as const,
      properties: {
        sheet_name: { type: 'string', description: '工作表名称' },
        filters: {
          type: 'array',
          description: '过滤条件列表',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains'] },
              value: {}
            },
            required: ['column', 'operator', 'value']
          }
        },
        sort_by: { type: 'string' },
        sort_order: { type: 'string', enum: ['asc', 'desc'] },
        limit: { type: 'number', description: '返回行数上限，默认20，最大100' }
      },
      required: ['sheet_name']
    }
  },
  {
    name: 'aggregate_data',
    description: '对工作表数据进行聚合统计，支持求和、平均、计数、最大最小值和分组统计',
    input_schema: {
      type: 'object' as const,
      properties: {
        sheet_name: { type: 'string' },
        operation: { type: 'string', enum: ['sum', 'avg', 'count', 'min', 'max', 'group_by'] },
        column: { type: 'string' },
        group_by_column: { type: 'string' },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains'] },
              value: {}
            },
            required: ['column', 'operator', 'value']
          }
        }
      },
      required: ['sheet_name', 'operation', 'column']
    }
  }
];

// ── Tool execution ────────────────────────────────────────────────────────────
function applyFilters(rows: Record<string, unknown>[], filters: Array<{ column: string; operator: string; value: unknown }>) {
  return rows.filter(row => filters.every(f => {
    const val = row[f.column];
    switch (f.operator) {
      case 'eq': return val == f.value;
      case 'ne': return val != f.value;
      case 'gt': return (val as number) > (f.value as number);
      case 'lt': return (val as number) < (f.value as number);
      case 'gte': return (val as number) >= (f.value as number);
      case 'lte': return (val as number) <= (f.value as number);
      case 'contains': return String(val).includes(String(f.value));
      default: return true;
    }
  }));
}

function findSheet(sessionId: string, sheetName: string): { rows: Record<string, unknown>[]; cols: string[] } | { error: string } {
  const allData = loadAllFileData(sessionId);
  for (const fd of allData.values()) {
    if (fd.sheets[sheetName]) {
      return { rows: fd.sheets[sheetName], cols: fd.columns[sheetName] || [] };
    }
  }
  return { error: `工作表 "${sheetName}" 不存在` };
}

function executeTool(toolName: string, toolInput: Record<string, unknown>, sessionId: string): unknown {
  if (toolName === 'get_sheet_info') {
    const found = findSheet(sessionId, toolInput.sheet_name as string);
    if ('error' in found) return found;
    return {
      sheet_name: toolInput.sheet_name,
      row_count: found.rows.length,
      columns: found.cols,
      sample_data: found.rows.slice(0, (toolInput.sample_rows as number) || 5)
    };
  }

  if (toolName === 'query_data') {
    const found = findSheet(sessionId, toolInput.sheet_name as string);
    if ('error' in found) return found;
    let result = applyFilters(found.rows, (toolInput.filters as any[]) || []);
    if (toolInput.sort_by) {
      const col = toolInput.sort_by as string;
      const desc = toolInput.sort_order === 'desc';
      result.sort((a, b) => {
        const av = a[col], bv = b[col];
        if (av == null) return 1; if (bv == null) return -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return desc ? -cmp : cmp;
      });
    }
    const limit = Math.min((toolInput.limit as number) || 20, 100);
    return { sheet_name: toolInput.sheet_name, total_matched: result.length, returned: Math.min(result.length, limit), columns: found.cols, rows: result.slice(0, limit) };
  }

  if (toolName === 'aggregate_data') {
    const found = findSheet(sessionId, toolInput.sheet_name as string);
    if ('error' in found) return found;
    let rows = applyFilters(found.rows, (toolInput.filters as any[]) || []);
    const col = toolInput.column as string;
    const op = toolInput.operation as string;
    if (op === 'count') return { operation: 'count', column: col, result: rows.length };
    if (op === 'group_by') {
      const groupCol = toolInput.group_by_column as string;
      if (!groupCol) return { error: 'group_by 需要 group_by_column' };
      const groups: Record<string, { count: number; sum: number; values: number[] }> = {};
      for (const row of rows) {
        const key = String(row[groupCol] ?? '(空)');
        if (!groups[key]) groups[key] = { count: 0, sum: 0, values: [] };
        groups[key].count++;
        const v = Number(row[col]);
        if (!isNaN(v)) { groups[key].sum += v; groups[key].values.push(v); }
      }
      return { operation: 'group_by', group_by: groupCol, column: col, result: Object.entries(groups).map(([k, g]) => ({ [groupCol]: k, count: g.count, sum: g.sum, avg: g.values.length ? g.sum / g.values.length : null })) };
    }
    const nums = rows.map(r => Number(r[col])).filter(v => !isNaN(v));
    if (!nums.length) return { error: `列 "${col}" 没有有效数值` };
    let result: number;
    switch (op) {
      case 'sum': result = nums.reduce((a, b) => a + b, 0); break;
      case 'avg': result = nums.reduce((a, b) => a + b, 0) / nums.length; break;
      case 'min': result = Math.min(...nums); break;
      case 'max': result = Math.max(...nums); break;
      default: return { error: `未知操作: ${op}` };
    }
    return { operation: op, column: col, result, count: nums.length };
  }

  return { error: `未知工具: ${toolName}` };
}

// ── API: Create session ───────────────────────────────────────────────────────
app.post('/api/session/create', (req, res) => {
  const id = Math.random().toString(36).substring(2, 15);
  const meta: SessionMeta = { id, createdAt: new Date().toISOString(), files: [] };
  writeMeta(meta);
  fs.mkdirSync(dataDir(id), { recursive: true });
  res.json({ sessionId: id });
});

// ── API: Upload file to session ───────────────────────────────────────────────
app.post('/api/session/:id/upload', upload.single('file'), (req, res) => {
  try {
    const sessionId = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let meta = readMeta(sessionId);
    if (!meta) {
      // Auto-create session if it doesn't exist
      meta = { id: sessionId, createdAt: new Date().toISOString(), files: [] };
      fs.mkdirSync(dataDir(sessionId), { recursive: true });
    }

    const fileId = Math.random().toString(36).substring(2, 15);
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const { sheets, columns, sheetNames } = parseExcel(req.file.buffer);

    // Write file data to disk
    const fileData: FileData = { sheets, columns };
    fs.writeFileSync(dataPath(sessionId, fileId), JSON.stringify(fileData));

    // Update cache
    if (!sessionCache.has(sessionId)) sessionCache.set(sessionId, new Map());
    sessionCache.get(sessionId)!.set(fileId, fileData);

    // Update meta
    const fileMeta: FileMeta = { id: fileId, name: fileName, size: req.file.size, sheets: sheetNames };
    meta.files.push(fileMeta);
    writeMeta(meta);

    const sheetInfo = sheetNames.map(name => ({
      name,
      columns: columns[name] || [],
      rowCount: sheets[name]?.length || 0,
    }));

    res.json({ fileId, file: fileMeta, sheets: sheetInfo });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to parse file' });
  }
});

// ── API: Legacy upload (creates new session) ──────────────────────────────────
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const sessionId = Math.random().toString(36).substring(2, 15);
    const fileId = Math.random().toString(36).substring(2, 15);
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const { sheets, columns, sheetNames } = parseExcel(req.file.buffer);

    const fileData: FileData = { sheets, columns };
    const meta: SessionMeta = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      files: [{ id: fileId, name: fileName, size: req.file.size, sheets: sheetNames }]
    };

    fs.mkdirSync(dataDir(sessionId), { recursive: true });
    fs.writeFileSync(dataPath(sessionId, fileId), JSON.stringify(fileData));
    writeMeta(meta);

    if (!sessionCache.has(sessionId)) sessionCache.set(sessionId, new Map());
    sessionCache.get(sessionId)!.set(fileId, fileData);

    const sheetInfo = sheetNames.map(name => ({
      name,
      columns: columns[name] || [],
      rowCount: sheets[name]?.length || 0,
    }));

    res.json({
      sessionId,
      file: { id: fileId, name: fileName, size: req.file.size, sheets: sheetNames },
      sheets: sheetInfo,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to parse file' });
  }
});

// ── API: Query ────────────────────────────────────────────────────────────────
app.post('/api/query', async (req, res) => {
  const { sessionId, question } = req.body;
  if (!sessionId || !question) return res.status(400).json({ error: 'Missing sessionId or question' });

  const meta = readMeta(sessionId);
  if (!meta) return res.status(404).json({ error: 'Session not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type: string, data: unknown) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const dataSummary = generateDataSummary(sessionId);

    // Load conversation history from disk
    const history = readHistory(sessionId);

    // Build messages: system context as first user message, then history, then current question
    const systemMsg = `你是一个 Excel 数据分析助手。

**重要规则：**
1. 每次调用工具前，必须先用1-2句话说明你要查询什么以及为什么需要这个数据
2. 避免重复查询已经获取过的数据，如果已有数据则直接使用
3. 当已有足够数据时，直接给出答案，不要继续调用工具
4. 最多调用5次工具，超过后必须基于已有数据给出答案

**可用文件数据：**
${dataSummary}`;

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: systemMsg },
      { role: 'assistant', content: '好的，我已了解文件结构，请问有什么需要分析的？' },
      ...history,
      { role: 'user', content: question },
    ];

    let iteration = 0;
    const maxIterations = 8;
    let finalAnswer = '';
    const logData: { question: string; iterations: unknown[]; totalInputTokens: number; totalOutputTokens: number } = {
      question, iterations: [], totalInputTokens: 0, totalOutputTokens: 0
    };

    while (iteration < maxIterations) {
      iteration++;
      sendEvent('agent_step', { iteration, status: 'thinking' });

      const stream = anthropic.messages.stream({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 4096,
        tools,
        messages,
      });

      stream.on('text', (text: string) => {
        sendEvent('text_delta', { iteration, text });
      });

      const response = await stream.finalMessage();

      const textBlocks = response.content.filter(b => b.type === 'text');
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const textContent = textBlocks.map(b => (b as Anthropic.TextBlock).text).join('\n');

      if (response.usage) {
        logData.totalInputTokens += response.usage.input_tokens;
        logData.totalOutputTokens += response.usage.output_tokens;
      }

      sendEvent('agent_response', {
        iteration,
        output: textContent,
        tool_calls: toolUseBlocks.map(b => ({ name: (b as Anthropic.ToolUseBlock).name, input: (b as Anthropic.ToolUseBlock).input })),
        usage: response.usage ? { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens } : undefined,
      });

      if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        finalAnswer = textContent || '分析完成';
        sendEvent('final_result', { content: finalAnswer, result: null });
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      const iterLog: unknown[] = [];

      for (const block of toolUseBlocks) {
        const tb = block as Anthropic.ToolUseBlock;
        const toolResult = executeTool(tb.name, tb.input as Record<string, unknown>, sessionId);

        sendEvent('tool_result', { iteration, tool_name: tb.name, tool_input: tb.input, result: toolResult });
        toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: JSON.stringify(toolResult) });
        iterLog.push({ tool: tb.name, input: tb.input, resultSummary: typeof toolResult === 'object' && toolResult !== null && 'total_matched' in toolResult ? `${(toolResult as any).total_matched} rows` : 'done' });
      }

      logData.iterations.push({ iteration, text: textContent, tools: iterLog });
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }

    // Persist conversation history (append user question + final answer)
    const updatedHistory: Anthropic.MessageParam[] = [
      ...history,
      { role: 'user', content: question },
      { role: 'assistant', content: finalAnswer || '分析完成' },
    ];
    writeHistory(sessionId, updatedHistory);

    // Log this LLM call
    logLLMCall(sessionId, { ...logData, timestamp: new Date().toISOString(), finalAnswer });

    res.end();
  } catch (error) {
    console.error('Query error:', error);
    sendEvent('error', { message: error instanceof Error ? error.message : 'Query failed' });
    res.end();
  }
});

// ── API: Get session info ─────────────────────────────────────────────────────
app.get('/api/session/:id', (req, res) => {
  const meta = readMeta(req.params.id);
  if (!meta) return res.status(404).json({ error: 'Session not found' });

  const filesWithSheets = meta.files.map(f => {
    const fd = loadFileData(req.params.id, f.id);
    return {
      ...f,
      sheetInfo: f.sheets.map(name => ({
        name,
        columns: fd?.columns[name] || [],
        rowCount: fd?.sheets[name]?.length || 0,
      }))
    };
  });

  // Also return conversation history
  const history = readHistory(req.params.id);

  res.json({ ...meta, filesWithSheets, history });
});

// ── API: List all sessions ───────────────────────────────────────────────────
app.get('/api/sessions', (req, res) => {
  try {
    const sessionDirs = fs.readdirSync(SESSIONS_DIR)
      .filter(name => {
        const stat = fs.statSync(path.join(SESSIONS_DIR, name));
        return stat.isDirectory() && fs.existsSync(metaPath(name));
      });

    const sessions = sessionDirs
      .map(id => {
        const meta = readMeta(id);
        if (!meta) return null;
        return {
          id,
          createdAt: meta.createdAt,
          fileCount: meta.files.length,
          fileName: meta.files[0]?.name || 'Unknown',
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime());

    res.json({ sessions });
  } catch (error) {
    res.json({ sessions: [] });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Excel Query Agent backend running on port ${PORT}`);
  console.log(`Sessions dir: ${SESSIONS_DIR}`);
  console.log(`API Key: ${process.env.ANTHROPIC_AUTH_TOKEN ? 'configured' : 'NOT SET'}`);
});
