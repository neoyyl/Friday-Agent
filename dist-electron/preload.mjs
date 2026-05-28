"use strict";
const electron = require("electron");
const sessionsAPI = {
  list: () => electron.ipcRenderer.invoke("sessions:list"),
  create: (title) => electron.ipcRenderer.invoke("sessions:create", title),
  delete: (id) => electron.ipcRenderer.invoke("sessions:delete", id),
  update: (id, title) => electron.ipcRenderer.invoke("sessions:update", id, title)
};
const messagesAPI = {
  list: (sessionId) => electron.ipcRenderer.invoke("messages:list", sessionId),
  create: (sessionId, role, content, toolCalls) => electron.ipcRenderer.invoke("messages:create", sessionId, role, content, toolCalls)
};
const toolsAPI = {
  list: () => electron.ipcRenderer.invoke("tools:list"),
  toggle: (toolId, enabled) => electron.ipcRenderer.invoke("tools:toggle", toolId, enabled),
  getConfig: (toolId) => electron.ipcRenderer.invoke("tools:getConfig", toolId),
  updateConfig: (toolId, config) => electron.ipcRenderer.invoke("tools:updateConfig", toolId, config)
};
const llmAPI = {
  chat: (messages, options) => electron.ipcRenderer.invoke("llm:chat", messages, options),
  chatStream: (messages, options) => electron.ipcRenderer.invoke("llm:chatStream", messages, options),
  getModels: () => electron.ipcRenderer.invoke("llm:getModels"),
  onStreamChunk: (callback) => {
    const handler = (_event, chunk) => callback(chunk);
    electron.ipcRenderer.on("llm:streamChunk", handler);
    return () => electron.ipcRenderer.removeListener("llm:streamChunk", handler);
  },
  onStreamDone: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("llm:streamDone", handler);
    return () => electron.ipcRenderer.removeListener("llm:streamDone", handler);
  }
};
const settingsAPI = {
  get: () => electron.ipcRenderer.invoke("settings:get"),
  update: (settings) => electron.ipcRenderer.invoke("settings:update", settings)
};
const ipcAPI = {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", {
  sessions: sessionsAPI,
  messages: messagesAPI,
  tools: toolsAPI,
  llm: llmAPI,
  settings: settingsAPI,
  ipc: ipcAPI
});
electron.contextBridge.exposeInMainWorld("ipcRenderer", ipcAPI);
