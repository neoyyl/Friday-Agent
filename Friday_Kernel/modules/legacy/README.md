# Legacy 模块 — 废弃声明

此目录中的模块是 Phase-0 ~ Phase-2 的遗留代码。

## 仍在使用中的文件（不可删，但应逐步迁移）

| 文件 | 用途 | 被谁引用 |
|------|------|---------|
| `friday_voice.py` | 旧语音引擎 | cli.py |
| `voiceprint_gate.py` | 旧声纹门控 | cli.py |
| `friday_listener.py` | 旧语音监听 | cli.py |
| `knowledge_engine.py` | 旧知识引擎 | cli.py |
| `friday_notifier.py` | 旧通知模块 | cli.py / nuwa.py |
| `friday_awake.py` | 旧唤醒模块 | nuwa.py (扫描)、friday_tui.py |
| `os_layer.py` | 旧系统层 | friday_tui.py (子进程) |

## 依赖支持（被上述文件引用，不可单独删）

- `friday_knowledge.py` — 被 friday_voice.py、knowledge_engine.py 引用
- `system_monitor.py` — 被 friday_voice.py、friday_awake.py、os_layer.py 引用
- `local_llm.py` — 被 knowledge_engine.py 引用
- `voice_manager.py` — 被 test_voice.py、friday_voice_enhanced.py 引用

## 独立脚本（可删）

- `test_voice.py` — 旧测试脚本，功能已被 scripts/test/ 覆盖
