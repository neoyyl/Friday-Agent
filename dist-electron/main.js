var j = Object.defineProperty;
var q = (t, e, r) => e in t ? j(t, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) : t[e] = r;
var w = (t, e, r) => q(t, typeof e != "symbol" ? e + "" : e, r);
import { app as y, ipcMain as i, BrowserWindow as v } from "electron";
import { fileURLToPath as U } from "node:url";
import l from "node:path";
import g from "fs";
import R from "path";
let o = {
  sessions: [],
  messages: {},
  settings: {
    apiKey: "",
    model: "openai/gpt-4",
    theme: "dark",
    temperature: "0.7",
    maxTokens: "4096"
  }
}, P = null;
function A() {
  if (!P) {
    const t = y.getPath("userData");
    P = R.join(t, "agent-platform-data.json");
  }
  return P;
}
function C() {
  try {
    const t = A();
    if (g.existsSync(t)) {
      const e = g.readFileSync(t, "utf-8");
      o = JSON.parse(e);
    }
  } catch (t) {
    console.error("Failed to load data:", t);
  }
}
function T() {
  try {
    const t = A(), e = R.dirname(t);
    g.existsSync(e) || g.mkdirSync(e, { recursive: !0 }), g.writeFileSync(t, JSON.stringify(o, null, 2), "utf-8");
  } catch (t) {
    console.error("Failed to save data:", t);
  }
}
function F() {
  return o.sessions;
}
function N(t, e) {
  const r = {
    id: t,
    title: e,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  return o.sessions.unshift(r), T(), r;
}
function K(t, e) {
  const r = o.sessions.find((n) => n.id === t);
  return r ? (r.title = e, r.updated_at = (/* @__PURE__ */ new Date()).toISOString(), T(), r) : null;
}
function M(t) {
  return o.sessions = o.sessions.filter((e) => e.id !== t), delete o.messages[t], T(), !0;
}
function H(t) {
  return o.messages[t] || [];
}
function B(t, e, r, n, s) {
  o.messages[e] || (o.messages[e] = []);
  const a = {
    id: t,
    session_id: e,
    role: r,
    content: n,
    tool_calls: s || null,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  return o.messages[e].push(a), T(), a;
}
function _() {
  return o.settings;
}
function V(t) {
  return o.settings = { ...o.settings, ...t }, T(), o.settings;
}
function G() {
  C();
}
const J = "https://openrouter.ai/api/v1/chat/completions";
class x {
  constructor(e, r = J) {
    w(this, "apiKey");
    w(this, "baseUrl");
    this.apiKey = e, this.baseUrl = r;
  }
  async chat(e, r = {}) {
    const n = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://friday.local",
        "X-Title": "Friday"
      },
      body: JSON.stringify({
        model: r.model || "openai/gpt-4",
        messages: e,
        temperature: r.temperature || 0.7,
        max_tokens: r.maxTokens || 4096,
        stream: !1
      })
    });
    if (!n.ok) {
      const s = await n.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${n.status} - ${JSON.stringify(s)}`);
    }
    return n.json();
  }
  async *chatStream(e, r = {}) {
    var d;
    const n = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://friday.local",
        "X-Title": "Friday"
      },
      body: JSON.stringify({
        model: r.model || "openai/gpt-4",
        messages: e,
        temperature: r.temperature || 0.7,
        max_tokens: r.maxTokens || 4096,
        stream: !0
      })
    });
    if (!n.ok) {
      const p = await n.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${n.status} - ${JSON.stringify(p)}`);
    }
    const s = (d = n.body) == null ? void 0 : d.getReader();
    if (!s)
      throw new Error("Response body is not readable");
    const a = new TextDecoder();
    let u = "";
    for (; ; ) {
      const { done: p, value: h } = await s.read();
      if (p) break;
      u += a.decode(h, { stream: !0 });
      const f = u.split(`
`);
      u = f.pop() || "";
      for (const L of f) {
        const E = L.trim();
        if (E.startsWith("data: ")) {
          const O = E.slice(6);
          if (O === "[DONE]")
            return;
          try {
            yield JSON.parse(O);
          } catch {
          }
        }
      }
    }
  }
}
const W = [
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
], S = /* @__PURE__ */ new Map();
function m(t) {
  S.set(t.id, t);
}
function z() {
  return Array.from(S.values());
}
function X(t, e) {
  const r = S.get(t);
  r && (r.enabled = e);
}
async function Q(t, e) {
  const r = S.get(t);
  if (!r)
    return { success: !1, error: `工具 ${t} 不存在` };
  if (!r.enabled)
    return { success: !1, error: `工具 ${t} 已禁用` };
  try {
    return await Y(t, e);
  } catch (n) {
    return {
      success: !1,
      error: n instanceof Error ? n.message : "工具执行失败"
    };
  }
}
async function Y(t, e) {
  switch (t) {
    case "code-executor":
      return Z(e.language, e.code);
    case "file-reader":
      return ee(e.path);
    case "file-writer":
      return te(e.path, e.content);
    case "web-search":
      return re(e.query);
    case "http-request":
      return ne(e.method, e.url, e.body, e.headers);
    case "shell-executor":
      return se(e.command);
    default:
      return { success: !1, error: `未知工具: ${t}` };
  }
}
async function Z(t, e) {
  return {
    success: !0,
    output: `[代码执行] 语言: ${t}

代码:
${e}

注意: 安全沙箱尚未实现，此为模拟输出`
  };
}
async function ee(t) {
  try {
    return {
      success: !0,
      output: `[文件读取] 路径: ${t}

注意: 安全文件访问尚未实现，此为模拟输出`
    };
  } catch (e) {
    return {
      success: !1,
      error: e instanceof Error ? e.message : "文件读取失败"
    };
  }
}
async function te(t, e) {
  try {
    return {
      success: !0,
      output: `[文件写入] 路径: ${t}
内容长度: ${e.length}

注意: 安全文件访问尚未实现，此为模拟输出`
    };
  } catch (r) {
    return {
      success: !1,
      error: r instanceof Error ? r.message : "文件写入失败"
    };
  }
}
async function re(t) {
  try {
    return {
      success: !0,
      output: `[网络搜索] 查询: ${t}

注意: 网络搜索 API 尚未实现，此为模拟输出`
    };
  } catch (e) {
    return {
      success: !1,
      error: e instanceof Error ? e.message : "网络搜索失败"
    };
  }
}
async function ne(t, e, r, n) {
  try {
    return {
      success: !0,
      output: `[HTTP 请求] 方法: ${t}
URL: ${e}

注意: HTTP 请求功能尚未实现，此为模拟输出`
    };
  } catch (s) {
    return {
      success: !1,
      error: s instanceof Error ? s.message : "HTTP 请求失败"
    };
  }
}
async function se(t) {
  try {
    return {
      success: !0,
      output: `[Shell 执行] 命令: ${t}

注意: Shell 执行功能尚未实现，此为模拟输出`
    };
  } catch (e) {
    return {
      success: !1,
      error: e instanceof Error ? e.message : "Shell 执行失败"
    };
  }
}
const ae = {
  id: "code-executor",
  name: "代码执行",
  description: "执行指定语言的代码片段",
  category: "code",
  parameters: [
    {
      name: "language",
      type: "string",
      description: "编程语言（如 javascript、python、typescript）",
      required: !0,
      enum: ["javascript", "python", "typescript", "bash"]
    },
    {
      name: "code",
      type: "string",
      description: "要执行的代码",
      required: !0
    }
  ],
  enabled: !0
}, oe = {
  id: "file-reader",
  name: "文件读取",
  description: "读取指定路径的文件内容",
  category: "file",
  parameters: [
    {
      name: "path",
      type: "string",
      description: "文件路径",
      required: !0
    }
  ],
  enabled: !0
}, ie = {
  id: "file-writer",
  name: "文件写入",
  description: "将内容写入指定路径的文件",
  category: "file",
  parameters: [
    {
      name: "path",
      type: "string",
      description: "文件路径",
      required: !0
    },
    {
      name: "content",
      type: "string",
      description: "要写入的内容",
      required: !0
    }
  ],
  enabled: !0
}, ce = {
  id: "web-search",
  name: "网络搜索",
  description: "在网络搜索指定内容",
  category: "web",
  parameters: [
    {
      name: "query",
      type: "string",
      description: "搜索关键词",
      required: !0
    }
  ],
  enabled: !0
}, le = {
  id: "http-request",
  name: "HTTP 请求",
  description: "发送 HTTP 请求到指定 URL",
  category: "web",
  parameters: [
    {
      name: "method",
      type: "string",
      description: "HTTP 方法（GET、POST、PUT、DELETE）",
      required: !0,
      enum: ["GET", "POST", "PUT", "DELETE"]
    },
    {
      name: "url",
      type: "string",
      description: "请求 URL",
      required: !0
    },
    {
      name: "body",
      type: "string",
      description: "请求体（JSON 格式）",
      required: !1
    },
    {
      name: "headers",
      type: "object",
      description: "请求头",
      required: !1
    }
  ],
  enabled: !0
}, ue = {
  id: "shell-executor",
  name: "Shell 执行",
  description: "执行 Shell 命令",
  category: "system",
  parameters: [
    {
      name: "command",
      type: "string",
      description: "要执行的 Shell 命令",
      required: !0
    }
  ],
  enabled: !0
};
function de() {
  m(ae), m(oe), m(ie), m(ce), m(le), m(ue);
}
const pe = U(import.meta.url), D = l.dirname(pe);
process.env.APP_ROOT = l.join(D, "..");
const b = process.env.VITE_DEV_SERVER_URL, Se = l.join(process.env.APP_ROOT, "dist-electron"), $ = l.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = b ? l.join(process.env.APP_ROOT, "public") : $;
let c;
i.handle("sessions:list", () => F());
i.handle("sessions:create", (t, e) => {
  const r = Date.now().toString();
  return N(r, e);
});
i.handle("sessions:delete", (t, e) => M(e));
i.handle("sessions:update", (t, e, r) => K(e, r));
i.handle("messages:list", (t, e) => H(e));
i.handle(
  "messages:create",
  (t, e, r, n, s) => {
    const a = Date.now().toString();
    return B(a, e, r, n, s);
  }
);
i.handle("settings:get", () => _());
i.handle("settings:update", (t, e) => V(e));
i.handle("tools:list", () => z());
i.handle("tools:toggle", (t, e, r) => (X(e, r), { success: !0 }));
i.handle("tools:execute", async (t, e, r) => Q(e, r));
i.handle(
  "llm:chat",
  async (t, e, r) => {
    try {
      const n = _(), s = n.apiKey;
      return s ? (await new x(s).chat(
        e.map((d) => ({
          role: d.role,
          content: d.content
        })),
        {
          model: (r == null ? void 0 : r.model) || n.model,
          temperature: (r == null ? void 0 : r.temperature) || parseFloat(n.temperature) || 0.7,
          maxTokens: parseInt(n.maxTokens) || 4096
        }
      )).choices[0].message : {
        role: "assistant",
        content: "请先在设置中配置 OpenRouter API Key。"
      };
    } catch (n) {
      return console.error("LLM chat error:", n), {
        role: "assistant",
        content: `错误: ${n instanceof Error ? n.message : "未知错误"}`
      };
    }
  }
);
i.handle(
  "llm:chatStream",
  async (t, e, r) => {
    var n, s;
    try {
      const a = _(), u = a.apiKey;
      if (!u)
        return {
          role: "assistant",
          content: "请先在设置中配置 OpenRouter API Key。"
        };
      const d = new x(u);
      let p = "";
      for await (const h of d.chatStream(
        e.map((f) => ({
          role: f.role,
          content: f.content
        })),
        {
          model: (r == null ? void 0 : r.model) || a.model,
          temperature: (r == null ? void 0 : r.temperature) || parseFloat(a.temperature) || 0.7,
          maxTokens: parseInt(a.maxTokens) || 4096
        }
      ))
        (s = (n = h.choices[0]) == null ? void 0 : n.delta) != null && s.content && (p += h.choices[0].delta.content, c && c.webContents.send("llm:streamChunk", h.choices[0].delta.content));
      return c && c.webContents.send("llm:streamDone"), {
        role: "assistant",
        content: p
      };
    } catch (a) {
      return console.error("LLM stream error:", a), {
        role: "assistant",
        content: `错误: ${a instanceof Error ? a.message : "未知错误"}`
      };
    }
  }
);
i.handle("llm:getModels", () => W);
function I() {
  c = new v({
    icon: l.join(process.env.VITE_PUBLIC, "Friday.ico"),
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: l.join(D, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), c.webContents.on("did-finish-load", () => {
    c == null || c.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), b ? c.loadURL(b) : c.loadFile(l.join($, "index.html"));
}
y.on("window-all-closed", () => {
  process.platform !== "darwin" && (y.quit(), c = null);
});
y.on("activate", () => {
  v.getAllWindows().length === 0 && I();
});
y.whenReady().then(() => {
  G(), de(), I();
});
export {
  Se as MAIN_DIST,
  $ as RENDERER_DIST,
  b as VITE_DEV_SERVER_URL
};
