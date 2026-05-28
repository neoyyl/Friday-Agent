var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, ipcMain, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import fs from "fs";
import path from "path";
let dataStore = {
  sessions: [],
  messages: {},
  settings: {
    apiKey: "",
    model: "openai/gpt-4",
    theme: "dark",
    temperature: "0.7",
    maxTokens: "4096"
  }
};
let dataFilePath = null;
function getDataFilePath() {
  if (!dataFilePath) {
    const userDataPath = app.getPath("userData");
    dataFilePath = path.join(userDataPath, "agent-platform-data.json");
  }
  return dataFilePath;
}
function loadData() {
  try {
    const filePath = getDataFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      dataStore = JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}
function saveData() {
  try {
    const filePath = getDataFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(dataStore, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save data:", error);
  }
}
function getAllSessions() {
  return dataStore.sessions;
}
function createSession(id, title) {
  const session = {
    id,
    title,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  dataStore.sessions.unshift(session);
  saveData();
  return session;
}
function updateSession(id, title) {
  const session = dataStore.sessions.find((s) => s.id === id);
  if (session) {
    session.title = title;
    session.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    saveData();
    return session;
  }
  return null;
}
function deleteSession(id) {
  dataStore.sessions = dataStore.sessions.filter((s) => s.id !== id);
  delete dataStore.messages[id];
  saveData();
  return true;
}
function getMessages(sessionId) {
  return dataStore.messages[sessionId] || [];
}
function createMessage(id, sessionId, role, content, toolCalls) {
  if (!dataStore.messages[sessionId]) {
    dataStore.messages[sessionId] = [];
  }
  const message = {
    id,
    session_id: sessionId,
    role,
    content,
    tool_calls: toolCalls || null,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  dataStore.messages[sessionId].push(message);
  saveData();
  return message;
}
function getSettings() {
  return dataStore.settings;
}
function updateSettings(newSettings) {
  dataStore.settings = { ...dataStore.settings, ...newSettings };
  saveData();
  return dataStore.settings;
}
function initializeDatabase() {
  loadData();
}
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
class OpenRouterClient {
  constructor(apiKey, baseUrl = OPENROUTER_API_URL) {
    __publicField(this, "apiKey");
    __publicField(this, "baseUrl");
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  async chat(messages, options = {}) {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://friday.local",
        "X-Title": "Friday"
      },
      body: JSON.stringify({
        model: options.model || "openai/gpt-4",
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        stream: false
      })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(error)}`);
    }
    return response.json();
  }
  async *chatStream(messages, options = {}) {
    var _a;
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://friday.local",
        "X-Title": "Friday"
      },
      body: JSON.stringify({
        model: options.model || "openai/gpt-4",
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        stream: true
      })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(error)}`);
    }
    const reader = (_a = response.body) == null ? void 0 : _a.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            return;
          }
          try {
            const chunk = JSON.parse(data);
            yield chunk;
          } catch (e) {
          }
        }
      }
    }
  }
}
const AVAILABLE_MODELS = [
  { id: "openai/gpt-4", name: "GPT-4", provider: "OpenAI" },
  { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OpenAI" },
  { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic" },
  { id: "anthropic/claude-3-sonnet", name: "Claude 3 Sonnet", provider: "Anthropic" },
  { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku", provider: "Anthropic" },
  { id: "meta-llama/llama-3-70b", name: "Llama 3 70B", provider: "Meta" },
  { id: "meta-llama/llama-3-8b", name: "Llama 3 8B", provider: "Meta" },
  { id: "google/gemini-pro", name: "Gemini Pro", provider: "Google" }
];
const toolRegistry = /* @__PURE__ */ new Map();
function registerTool(tool) {
  toolRegistry.set(tool.id, tool);
}
function getAllTools() {
  return Array.from(toolRegistry.values());
}
function toggleTool(id, enabled) {
  const tool = toolRegistry.get(id);
  if (tool) {
    tool.enabled = enabled;
  }
}
async function executeTool(toolId, params) {
  const tool = toolRegistry.get(toolId);
  if (!tool) {
    return { success: false, error: `工具 ${toolId} 不存在` };
  }
  if (!tool.enabled) {
    return { success: false, error: `工具 ${toolId} 已禁用` };
  }
  try {
    const result = await executeToolById(toolId, params);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "工具执行失败"
    };
  }
}
async function executeToolById(toolId, params) {
  switch (toolId) {
    case "code-executor":
      return executeCode(params.language, params.code);
    case "file-reader":
      return readFile(params.path);
    case "file-writer":
      return writeFile(params.path, params.content);
    case "web-search":
      return webSearch(params.query);
    case "http-request":
      return httpRequest(params.method, params.url, params.body, params.headers);
    case "shell-executor":
      return executeShell(params.command);
    default:
      return { success: false, error: `未知工具: ${toolId}` };
  }
}
async function executeCode(language, code) {
  return {
    success: true,
    output: `[代码执行] 语言: ${language}

代码:
${code}

注意: 安全沙箱尚未实现，此为模拟输出`
  };
}
async function readFile(path2) {
  try {
    return {
      success: true,
      output: `[文件读取] 路径: ${path2}

注意: 安全文件访问尚未实现，此为模拟输出`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "文件读取失败"
    };
  }
}
async function writeFile(path2, content) {
  try {
    return {
      success: true,
      output: `[文件写入] 路径: ${path2}
内容长度: ${content.length}

注意: 安全文件访问尚未实现，此为模拟输出`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "文件写入失败"
    };
  }
}
async function webSearch(query) {
  try {
    return {
      success: true,
      output: `[网络搜索] 查询: ${query}

注意: 网络搜索 API 尚未实现，此为模拟输出`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "网络搜索失败"
    };
  }
}
async function httpRequest(method, url, _body, _headers) {
  try {
    return {
      success: true,
      output: `[HTTP 请求] 方法: ${method}
URL: ${url}

注意: HTTP 请求功能尚未实现，此为模拟输出`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "HTTP 请求失败"
    };
  }
}
async function executeShell(command) {
  try {
    return {
      success: true,
      output: `[Shell 执行] 命令: ${command}

注意: Shell 执行功能尚未实现，此为模拟输出`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Shell 执行失败"
    };
  }
}
const codeExecutorTool = {
  id: "code-executor",
  name: "代码执行",
  description: "执行指定语言的代码片段",
  category: "code",
  parameters: [
    {
      name: "language",
      type: "string",
      description: "编程语言（如 javascript、python、typescript）",
      required: true,
      enum: ["javascript", "python", "typescript", "bash"]
    },
    {
      name: "code",
      type: "string",
      description: "要执行的代码",
      required: true
    }
  ],
  enabled: true
};
const fileReaderTool = {
  id: "file-reader",
  name: "文件读取",
  description: "读取指定路径的文件内容",
  category: "file",
  parameters: [
    {
      name: "path",
      type: "string",
      description: "文件路径",
      required: true
    }
  ],
  enabled: true
};
const fileWriterTool = {
  id: "file-writer",
  name: "文件写入",
  description: "将内容写入指定路径的文件",
  category: "file",
  parameters: [
    {
      name: "path",
      type: "string",
      description: "文件路径",
      required: true
    },
    {
      name: "content",
      type: "string",
      description: "要写入的内容",
      required: true
    }
  ],
  enabled: true
};
const webSearchTool = {
  id: "web-search",
  name: "网络搜索",
  description: "在网络搜索指定内容",
  category: "web",
  parameters: [
    {
      name: "query",
      type: "string",
      description: "搜索关键词",
      required: true
    }
  ],
  enabled: true
};
const httpRequestTool = {
  id: "http-request",
  name: "HTTP 请求",
  description: "发送 HTTP 请求到指定 URL",
  category: "web",
  parameters: [
    {
      name: "method",
      type: "string",
      description: "HTTP 方法（GET、POST、PUT、DELETE）",
      required: true,
      enum: ["GET", "POST", "PUT", "DELETE"]
    },
    {
      name: "url",
      type: "string",
      description: "请求 URL",
      required: true
    },
    {
      name: "body",
      type: "string",
      description: "请求体（JSON 格式）",
      required: false
    },
    {
      name: "headers",
      type: "object",
      description: "请求头",
      required: false
    }
  ],
  enabled: true
};
const shellExecutorTool = {
  id: "shell-executor",
  name: "Shell 执行",
  description: "执行 Shell 命令",
  category: "system",
  parameters: [
    {
      name: "command",
      type: "string",
      description: "要执行的 Shell 命令",
      required: true
    }
  ],
  enabled: true
};
function registerPresetTools() {
  registerTool(codeExecutorTool);
  registerTool(fileReaderTool);
  registerTool(fileWriterTool);
  registerTool(webSearchTool);
  registerTool(httpRequestTool);
  registerTool(shellExecutorTool);
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path$1.dirname(__filename$1);
process.env.APP_ROOT = path$1.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
ipcMain.handle("sessions:list", () => {
  return getAllSessions();
});
ipcMain.handle("sessions:create", (_event, title) => {
  const id = Date.now().toString();
  return createSession(id, title);
});
ipcMain.handle("sessions:delete", (_event, id) => {
  return deleteSession(id);
});
ipcMain.handle("sessions:update", (_event, id, title) => {
  return updateSession(id, title);
});
ipcMain.handle("messages:list", (_event, sessionId) => {
  return getMessages(sessionId);
});
ipcMain.handle(
  "messages:create",
  (_event, sessionId, role, content, toolCalls) => {
    const id = Date.now().toString();
    return createMessage(id, sessionId, role, content, toolCalls);
  }
);
ipcMain.handle("settings:get", () => {
  return getSettings();
});
ipcMain.handle("settings:update", (_event, newSettings) => {
  return updateSettings(newSettings);
});
ipcMain.handle("tools:list", () => {
  return getAllTools();
});
ipcMain.handle("tools:toggle", (_event, toolId, enabled) => {
  toggleTool(toolId, enabled);
  return { success: true };
});
ipcMain.handle("tools:execute", async (_event, toolId, params) => {
  return executeTool(toolId, params);
});
ipcMain.handle(
  "llm:chat",
  async (_event, chatMessages, options) => {
    try {
      const settings = getSettings();
      const apiKey = settings.apiKey;
      if (!apiKey) {
        return {
          role: "assistant",
          content: "请先在设置中配置 OpenRouter API Key。"
        };
      }
      const client = new OpenRouterClient(apiKey);
      const response = await client.chat(
        chatMessages.map((msg) => ({
          role: msg.role,
          content: msg.content
        })),
        {
          model: (options == null ? void 0 : options.model) || settings.model,
          temperature: (options == null ? void 0 : options.temperature) || parseFloat(settings.temperature) || 0.7,
          maxTokens: parseInt(settings.maxTokens) || 4096
        }
      );
      return response.choices[0].message;
    } catch (error) {
      console.error("LLM chat error:", error);
      return {
        role: "assistant",
        content: `错误: ${error instanceof Error ? error.message : "未知错误"}`
      };
    }
  }
);
ipcMain.handle(
  "llm:chatStream",
  async (_event, chatMessages, options) => {
    var _a, _b;
    try {
      const settings = getSettings();
      const apiKey = settings.apiKey;
      if (!apiKey) {
        return {
          role: "assistant",
          content: "请先在设置中配置 OpenRouter API Key。"
        };
      }
      const client = new OpenRouterClient(apiKey);
      let fullContent = "";
      for await (const chunk of client.chatStream(
        chatMessages.map((msg) => ({
          role: msg.role,
          content: msg.content
        })),
        {
          model: (options == null ? void 0 : options.model) || settings.model,
          temperature: (options == null ? void 0 : options.temperature) || parseFloat(settings.temperature) || 0.7,
          maxTokens: parseInt(settings.maxTokens) || 4096
        }
      )) {
        if ((_b = (_a = chunk.choices[0]) == null ? void 0 : _a.delta) == null ? void 0 : _b.content) {
          fullContent += chunk.choices[0].delta.content;
          if (win) {
            win.webContents.send("llm:streamChunk", chunk.choices[0].delta.content);
          }
        }
      }
      if (win) {
        win.webContents.send("llm:streamDone");
      }
      return {
        role: "assistant",
        content: fullContent
      };
    } catch (error) {
      console.error("LLM stream error:", error);
      return {
        role: "assistant",
        content: `错误: ${error instanceof Error ? error.message : "未知错误"}`
      };
    }
  }
);
ipcMain.handle("llm:getModels", () => {
  return AVAILABLE_MODELS;
});
function createWindow() {
  win = new BrowserWindow({
    icon: path$1.join(process.env.VITE_PUBLIC, "Friday.ico"),
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path$1.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  initializeDatabase();
  registerPresetTools();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
