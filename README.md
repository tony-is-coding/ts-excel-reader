# Excel Query Agent

基于 Claude API 的智能 Excel 数据分析助手。

## 功能特性

- **自然语言查询**: 用中文提问，自动生成 SQL 查询
- **多文件支持**: 一次会话可上传多个 Excel/CSV 文件
- **实时推理展示**: 查看每一步的思考过程
- **会话持久化**: 历史对话和数据自动保存
- **Token 追踪**: 记录每次 API 调用的 token 使用量

## 技术栈

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express
- **AI**: Claude API (Anthropic SDK)

## 快速开始

### 安装依赖

\`\`\`bash
npm install
\`\`\`

### 配置环境变量

复制 \`.env.example\` 为 \`.env\` 并填入你的 API key:

\`\`\`bash
ANTHROPIC_AUTH_TOKEN=your_api_key_here
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-6
\`\`\`

### 启动开发服务器

\`\`\`bash
# 启动前端 (port 5173)
npm run dev

# 启动后端 (port 3001)
npm run server
\`\`\`

## 使用方法

1. 打开浏览器访问 http://localhost:5173
2. 上传 Excel 或 CSV 文件
3. 用自然语言提问，例如：
   - "查询2024年非流动资产的金额"
   - "统计各科目期末余额合计"
   - "对比2024和2025年资产变化"

## 项目结构

\`\`\`
├── src/                 # 前端代码
│   ├── components/      # React 组件
│   ├── hooks/           # 自定义 hooks
│   ├── types/           # TypeScript 类型
│   └── styles/          # CSS 样式
├── server/              # 后端代码
│   └── index.ts         # Express 服务器
├── sessions/            # 会话数据（运行时生成）
└── test_datas/          # 测试数据文件
\`\`\`

## API 端点

- \`POST /api/upload\` - 上传文件
- \`POST /api/query\` - 执行查询
- \`POST /api/session/create\` - 创建新会话
- \`POST /api/session/:id/upload\` - 向会话添加文件
- \`GET /api/session/:id\` - 获取会话信息

## 开发计划

- [ ] 支持更多文件格式（Google Sheets）
- [ ] 添加图表可视化
- [ ] 支持导出查询结果
- [ ] 添加用户认证
- [ ] 优化大文件处理性能

## License

MIT