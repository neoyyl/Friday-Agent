# Changelog — Nuwa OS

## [1.0.0] — 2026-05-21 — 🎉 正式版发布

38/38 任务全部完成 · 6 个里程碑全部达成 · 全部测试通过

### Phase 5 — 扩展生态 (6/6)

**5.1 Skill SDK + 模板**
- `SkillBase` 基类：`load/enable/handle/disable/unload` 完整生命周期
- `SkillManifest` 数据类 + `SkillResult` 结果封装
- `safe_handle()` 自动异常捕获 + 执行计时
- 示例技能 `hello_world/` 含 `skill.json` + `main.py`

**5.2 Skill 热加载系统**
- `SkillManager`：动态模块导入 (`importlib.util`)、能力索引、3s 轮询监听
- EventBus 集成（`skill.loaded/called/unloaded` 事件）
- 依赖解析就绪架构

**5.3 技能市场**
- `SkillMarket`：一键安装/卸载/更新技能
- `SemVer`：语义化版本解析、比较、范围匹配（`^1.2.3` / `~1.0.0` / `>=1.0 <2.0`）
- `DependencyResolver`：Kahn 拓扑排序、循环检测
- `install_from_github()`：从 GitHub 仓库直接安装
- 收藏/评分系统（JSON 持久化 + 统计分布）
- 搜索：按关键字/能力/标签多维度筛选

**5.4 NL→Code 技能生成**
- `SkillGenerator`：自然语言 → 元数据提取 → 代码生成 → 文件写入 → 热加载
- 4 种模板模式：query / transform / notify / calculate
- 中文智能分词 + 短语贪婪合并
- 异步版 `async_create_from_description()` 支持运行中事件循环

**5.5 插件 API**
- `PluginBase`：插件基类，`on_register(api)` / `on_unregister()` 生命周期
- `PluginAPI`：事件钩子系统（`on/off/emit`）、服务注册、配置管理
- `PluginRegistry`：插件注册中心、EventBus 集成
- `Sandbox`：路径白名单 + 网络限制（SANDBOX / STANDARD / EXTENDED / FULL）

**5.6 端到端测试**
- `test_e2e_phase5.py`：**14/14 全部通过**
- 场景：Plugin API → PluginRegistry → 沙箱 → NL→Code → 热加载 → 技能调用 → 链式生成 → 授权隔离

### Phase 4 — 拟人化升级 (7/7)

- 情感识别 (`emotion_service.py`)：6 种情绪 + 对话流追踪
- CSS 表情辉光 + 情绪徽章 + 手势姿态动画
- 声纹多说话人 (`voice_service.py`)：注册/识别/管理 Web API
- 永续对话记忆 (`conversation_memory.py`)：Buffer→Recent→Archive 三层 + 自动摘要
- 流式 TTS (`streaming_tts.py`)：edge-tts + 7 种语气 SSML 控制 + barge-in
- `test_e2e_phase4.py`：**20/20 全部通过**

### Phase 3 — 多 Agent 编排 (7/7)

- `agent_orchestrator.py`：Master Agent 智能调度 (direct/chain/parallel/hybrid)
- `agent_registry.py`：21 Agents 注册表
- 红队 Agent (`red_team.py`)：5 维度安全审计
- 调度日志 + 自学习优化
- 结果整合 + 统一输出

### Phase 2 — 自动化引擎 (6/6)

- Cron 任务可视化配置 (APScheduler)
- 条件触发器系统 (EventBus 驱动)
- 工作流 DAG 编排 (链式/分支/重试/降级)
- 智能时机判断 + 执行记录

### Phase 1 — 感知系统 (6/6)

- 窗口/文件感知 (Win32 API)
- Git 分支 + 提交感知
- 项目结构自动扫描
- 感知数据 → LLM Context 注入

### Phase 0 — 基础加固 (6/6)

- OS Layer 模块路径修复
- Nuwa Web UI MVP (Flask + WebSocket)
- 7 状态状态机 (IDLE/WAKING/LISTENING/SPEAKING/WORKING/NOTIFY/SLEEPING)
- 基础语音对话闭环 (VoiceDialog)

---

## [0.6.x] — 2026-05-19 — Phase 4 阶段

### 0.6.0 (2026-05-19)
- Phase 4 全部 7 项完成
- 情感识别、表情动画、声纹、永续记忆、流式 TTS

## [0.5.x] — 2026-05-18 — Phase 3 阶段

### 0.5.0 (2026-05-18)
- Phase 3 全部 7 项完成
- 多 Agent 编排 + 红队审计 + 调度优化

## [0.4.x] — 2026-05-17 — Phase 2 阶段

### 0.4.0 (2026-05-17)
- Phase 2 全部 6 项完成
- 自动化引擎：Cron/Trigger/Workflow/Timing/Logger

## [0.3.x] — 2026-05-15 — Phase 1 阶段

### 0.3.0 (2026-05-15)
- Phase 1 全部 6 项完成
- 感知系统：窗口/Git/项目/聚合器

## [0.2.x] — 2026-05-12 — Phase 0 完成

### 0.2.0 (2026-05-12)
- Phase 0 全部 6 项完成
- Friday Awake 语音唤醒 + 叠加层

## [0.1.0] — 2026-05-10 — 初始版本

- Friday Kernel 初始化
- 基础语音 + 记忆 + 技能框架
