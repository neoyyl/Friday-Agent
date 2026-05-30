# Nuwa OS v1.0 — 快速开始

> **桌面 AI 伴侣操作系统**
> 38 项任务完成 · 6 阶段全通过 · Skill 生态就绪

---

## 系统要求

- **操作系统**: Windows 10/11 (64-bit)
- **Python**: 3.10+
- **依赖**: 见 `requirements.txt`
- **硬盘**: 约 500MB（含语音模型）
- **推荐**: 16GB+ RAM, 支持 CUDA 的 GPU (可选)

---

## 一键启动

```bash
# 方式 1: 双击启动脚本
F:\AITest\Friday_Kernel\start_nuwa.bat

# 方式 2: 命令行指定端口
python scripts\load_kernel.py --web --web-port 5000
```

首次运行会自动检测并安装依赖。

---

## 系统架构

```
Nuwa OS v1.0
├── Phase 0: Kernel + Web UI + 状态机 + 语音对话        6/6
├── Phase 1: 感知系统 (窗口/Git/项目/聚合器)             6/6
├── Phase 2: 自动化引擎 (Cron/Trigger/Workflow/Logger)   6/6
├── Phase 3: 多 Agent (编排/链式/并行/红队/自学习)       7/7
├── Phase 4: 拟人化 (情感/声纹/永续记忆/流式TTS)         7/7
└── Phase 5: 扩展生态 (SDK/热加载/市场/NL→Code/Plugin)   6/6
总计: 38/38 ✅
```

---

## 快速指令

| 指令 | 作用 |
|------|------|
| `加载星期五内核` | 启动时运行所有初始化 |
| `发微信 [消息] 给 [联系人]` | 发送微信消息 |
| `执行一遍任务清单` | 运行每日任务 |
| `系统健康` | 完整系统健康检查 |
| `创建技能 [描述]` | NL→Code 自动生成技能 |
| `安装技能 [路径/GitHub]` | 从市场安装新技能 |
| `搜索技能 [关键字]` | 搜索可用技能包 |

---

## Agent 指令

```
@研究 @编程 @写作 @学术 @生活 @记忆 @法律 @财务
@营销 @数据 @哲学 @健康 @心理 @教育 @投资
@健身 @美食 @摄影 @音乐
```

---

## Skill 开发

```python
from skills.skill_base import SkillBase, SkillManifest, SkillResult

class MySkill(SkillBase):
    @property
    def manifest(self):
        return SkillManifest(id="my-skill", name="My Skill", version="1.0.0")

    async def handle(self, context):
        query = context.get("query", "")
        return SkillResult(success=True, output=f"Hello: {query}")
```

将技能放入 `skills/{skill_id}/` 目录，系统自动热加载。

---

## 关键路径

| 项目 | 路径 |
|------|------|
| 内核根目录 | `F:\AITest\Friday_Kernel` |
| Web UI | `http://localhost:5000` |
| 技能目录 | `F:\AITest\Friday_Kernel\skills\` |
| 市场数据 | `skills/.market/` |
| 配置 | `kernel.json` |
| 启动脚本 | `start_nuwa.bat` |
| 手册 | `CHANGELOG.md` |

---

## 测试验证

```bash
# 运行各阶段测试
python temp/test_phase5.py        # 9/9  ✅
python temp/test_e2e_phase5.py    # 14/14 ✅
python temp/test_nuwa_v1_release.py  # 17/17 ✅
```

---

*Nuwa OS v1.0.0 — 2026-05-21*
