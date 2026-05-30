#!/usr/bin/env python3
"""
Friday 跨会话记忆管理器 v0.2 (GFCR 升级)
=========================================
记录、存储、回忆每次对话的内容，让 Friday 在下次对话时记得你。

功能：
  - 自动记录每次对话的开始/结束时间、持续时长、命令列表
  - 对话结束时自动生成摘要
  - 下次唤醒时加载最近 3 条记忆作为上下文
  - 跟踪用户偏好（声音、话题倾向、常用命令）
  - 识别反复出现的主题
  - GFCR 模式提取：从成功会话中提取可复用的行为模式

GFCR 四步框架：
  G (Generate)：从会话中提取高质量行为模式
  F (Filter)：过滤低质量或失败的案例
  C (Control)：确保模式覆盖不同类型任务
  R (Replay)：下次遇到类似任务时加载相关模式

存储格式：JSON（可被 OpenCode LLM 读取）
存储位置：memory/conversation_memory.json

作者：Friday Kernel
版本：0.2.0
"""

import os
import json
import time
import datetime
from pathlib import Path
from collections import Counter


class ConversationMemory:
    """
    跨会话记忆管理器
    
    用法：
        memory = ConversationMemory()
        memory.start_session()           # 对话开始时
        memory.record_command("你好")     # 每条命令
        memory.end_session("拜拜")        # 对话结束时
        context = memory.get_context()    # 下次对话开始时获取上下文
    """

    def __init__(self, memory_path=None):
        if memory_path is None:
            memory_path = Path(__file__).parent.parent / "memory" / "conversation_memory.json"
        self.memory_path = Path(memory_path)
        self.memory_path.parent.mkdir(parents=True, exist_ok=True)

        # 当前会话状态
        self.current_session = None
        self.current_commands = []

        # GFCR 模式缓存
        self.pattern_cache = None

        # 加载持久化记忆
        self.data = self._load()

    # ==================== 持久化 ====================

    def _load(self):
        """从 JSON 文件加载记忆"""
        if self.memory_path.exists():
            try:
                with open(self.memory_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                # 确保关键字段存在
                if "sessions" not in data:
                    data["sessions"] = []
                if "user_preferences" not in data:
                    data["user_preferences"] = {}
                if "recent_topics" not in data:
                    data["recent_topics"] = []
                if "last_interaction" not in data:
                    data["last_interaction"] = None
                return data
            except (json.JSONDecodeError, Exception) as e:
                print(f"  ⚠️ 记忆文件损坏，重建: {e}")
                return self._new_data()
        return self._new_data()

    def _new_data(self):
        """创建新的记忆数据结构"""
        return {
            "sessions": [],
            "user_preferences": {
                "tts_voice": "zh-CN-XiaoyiNeural",
                "greeting_style": "normal",
                "known_topics": [],
            },
            "recent_topics": [],
            "last_interaction": None,
            "patterns": [],  # GFCR: 可复用行为模式
        }

    def _save(self):
        """保存记忆到 JSON 文件"""
        try:
            # 保留最近 100 条会话，防止文件无限增长
            if len(self.data["sessions"]) > 100:
                self.data["sessions"] = self.data["sessions"][-100:]

            with open(self.memory_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"  ⚠️ 记忆保存失败: {e}")
            return False

    # ==================== 会话生命周期 ====================

    def start_session(self):
        """开始记录一次新的对话会话"""
        self.current_session = {
            "id": self._generate_session_id(),
            "start_time": self._now_iso(),
            "end_time": None,
            "duration_seconds": 0,
            "summary": "",
            "key_points": [],
            "topics": [],
            "action_items": [],
            "commands": [],
            "end_reason": "",
        }
        self.current_commands = []
        print(f"  🧠 记忆: 新会话 {self.current_session['id']}")
        return self.current_session["id"]

    def record_command(self, command_text):
        """记录当前会话中的一条命令"""
        if self.current_session is None:
            return
        timestamp = self._now_iso()
        self.current_commands.append({
            "timestamp": timestamp,
            "text": command_text,
        })
        self.current_session["commands"].append(command_text)

    def end_session(self, end_reason="timeout"):
        """
        结束当前会话并生成摘要
        
        参数:
            end_reason: 结束原因 — "user_said_goodbye" | "timeout" | "error"
        """
        if self.current_session is None:
            return

        now = self._now_iso()
        self.current_session["end_time"] = now
        self.current_session["end_reason"] = end_reason

        # 计算时长
        try:
            start = datetime.datetime.fromisoformat(self.current_session["start_time"])
            end = datetime.datetime.fromisoformat(now)
            self.current_session["duration_seconds"] = int((end - start).total_seconds())
        except Exception:
            self.current_session["duration_seconds"] = 0

        # 生成摘要
        self._generate_summary()

        # 提取话题
        self._extract_topics()

        # 存入历史
        self.data["sessions"].append(self.current_session)
        self.data["last_interaction"] = now

        # 更新偏好（从命令中学习）
        self._update_preferences()

        # GFCR: 提取可复用模式
        self._extract_patterns()

        # 持久化
        self._save()

        session_id = self.current_session["id"]
        duration = self.current_session["duration_seconds"]
        commands = len(self.current_commands)
        print(f"  🧠 记忆: 会话 {session_id} 已保存 ({duration}s, {commands} 条命令)")
        if self.current_session.get("summary"):
            print(f"  📝 摘要: {self.current_session['summary']}")

        self.current_session = None
        self.current_commands = []

    def _generate_summary(self):
        """基于命令列表生成会话摘要"""
        commands = self.current_commands
        if not commands:
            self.current_session["summary"] = "空会话（无命令）"
            return

        # 提取不同类别的命令
        categories = {
            "greeting": ["你好", "嗨", "hi", "hello", "早上好", "下午好", "晚上好"],
            "goodbye": ["拜拜", "再见", "退出", "休息", "说完了"],
            "system_status": ["状态", "健康", "电脑", "系统"],
            "time_query": ["时间", "几点", "现在"],
            "note_taking": ["记一下", "记住", "记笔记", "帮我记"],
            "knowledge_query": ["关于", "知道什么", "查一下", "搜索"],
            "weather_query": ["天气"],
            "maintenance": ["清理", "维护", "整理"],
        }

        asked_categories = []
        for cmd_entry in commands:
            text = cmd_entry["text"] if isinstance(cmd_entry, dict) else cmd_entry
            text_lower = text.lower()
            for cat, keywords in categories.items():
                if any(kw in text_lower for kw in keywords):
                    if cat not in asked_categories:
                        asked_categories.append(cat)

        # 构建摘要
        command_count = len(commands)
        if command_count == 1:
            summary = f"简短交互: \"{commands[0] if isinstance(commands[0], str) else commands[0]['text']}\""
        else:
            cat_desc = "、".join(asked_categories) if asked_categories else "多种查询"
            summary = f"会话包含 {command_count} 条指令，涉及 {cat_desc}"

        self.current_session["summary"] = summary
        self.current_session["key_points"] = asked_categories
        self.current_session["topics"] = asked_categories

    def _extract_topics(self):
        """从命令中提取话题标签"""
        topics = self.current_session.get("topics", [])
        for topic in topics:
            if topic not in self.data["recent_topics"]:
                self.data["recent_topics"].append(topic)
        # 保持最近 10 个话题
        if len(self.data["recent_topics"]) > 10:
            self.data["recent_topics"] = self.data["recent_topics"][-10:]

    def _update_preferences(self):
        """从当前会话中学习用户偏好"""
        prefs = self.data["user_preferences"]

        # 统计常问话题
        topics = self.current_session.get("topics", [])
        for t in topics:
            if t not in prefs.get("known_topics", []):
                if "known_topics" not in prefs:
                    prefs["known_topics"] = []
                prefs["known_topics"].append(t)

    # ==================== GFCR 模式提取 ====================

    def _extract_patterns(self):
        """GFCR: 从当前会话中提取可复用的行为模式"""
        commands = self.current_commands
        if len(commands) < 2:
            return  # 太短的会话不提取

        cmds = [c["text"] if isinstance(c, dict) else c for c in commands]
        summary = self.current_session.get("summary", "")

        # 识别命令序列中的任务类型
        task_patterns = {
            "search_research": ["搜索", "搜一下", "查", "研究", "调研", "论文", "文献"],
            "code_dev": ["写代码", "改代码", "调试", "编程", "实现", "修复"],
            "content_write": ["写", "翻译", "排版", "格式化", "润色"],
            "system_op": ["状态", "健康", "清理", "维护", "整理"],
            "data_analysis": ["分析", "统计", "对比", "计算"],
            "creative": ["生成", "画图", "设计", "创建"],
        }

        matched_type = None
        for ptype, keywords in task_patterns.items():
            combined = " ".join(cmds)
            if any(kw in combined for kw in keywords):
                matched_type = ptype
                break
        if not matched_type:
            matched_type = "general"

        # GFCR - Filter: 只有摘要不为空的会话才提取模式
        if not summary or summary == "空会话（无命令）":
            return

        # 构建模式
        pattern = {
            "type": matched_type,
            "trigger_commands": cmds[:3],  # 触发该模式的典型命令
            "summary": summary,
            "session_count": 1,
            "last_used": self._now_iso(),
        }

        # GFCR - Control: 检查是否已有同类模式
        existing = None
        for i, p in enumerate(self.data["patterns"]):
            if p.get("type") == matched_type:
                existing = i
                break

        if existing is not None:
            # 更新已有模式
            self.data["patterns"][existing]["session_count"] += 1
            self.data["patterns"][existing]["last_used"] = self._now_iso()
            # GFCR - Filter: 保留最新的 trigger_commands
            self.data["patterns"][existing]["trigger_commands"] = cmds[:3]
        else:
            # GFCR - Control: 最多保留 20 个模式
            if len(self.data["patterns"]) >= 20:
                # 淘汰最久未使用的
                self.data["patterns"].sort(key=lambda p: p.get("last_used", ""))
                self.data["patterns"] = self.data["patterns"][-19:]
            self.data["patterns"].append(pattern)

    def get_patterns(self, max_patterns=5):
        """
        GFCR - Replay: 获取可复用的行为模式
        
        返回频率最高的 N 个模式，供 LLM 参考
        """
        patterns = self.data.get("patterns", [])
        if not patterns:
            return []

        # 按使用频率排序
        sorted_p = sorted(patterns, key=lambda p: p.get("session_count", 0), reverse=True)
        return sorted_p[:max_patterns]

    def get_patterns_text(self, max_patterns=5):
        """获取纯文本格式的模式清单（供注入上下文用）"""
        patterns = self.get_patterns(max_patterns)
        if not patterns:
            return ""

        lines = ["\n📋 可复用行为模式（GFCR）:"]
        for p in patterns:
            ptype = p.get("type", "general")
            count = p.get("session_count", 0)
            triggers = ", ".join(p.get("trigger_commands", [])[:2])
            lines.append(f"  [{ptype}] 已用 {count} 次 | 典型触发: {triggers}")
        return "\n".join(lines)

    # ==================== 上下文获取 ====================

    def get_context(self, max_sessions=3):
        """
        获取跨会话记忆上下文，用于注入到对话提示中
        
        参数:
            max_sessions: 加载最近几次会话
        
        返回:
            dict: 包含近期记忆的结构化上下文
        """
        recent = self.data["sessions"][-max_sessions:] if self.data["sessions"] else []
        patterns = self.get_patterns(5)
        return {
            "total_sessions": len(self.data["sessions"]),
            "recent_sessions": [
                {
                    "time": s.get("start_time", "")[:16],  # 仅保留到分钟
                    "summary": s.get("summary", ""),
                    "duration": f"{s.get('duration_seconds', 0)//60}分{s.get('duration_seconds', 0)%60}秒",
                    "commands": s.get("commands", [])[-3:],  # 仅最近 3 条
                    "end_reason": s.get("end_reason", ""),
                }
                for s in recent
            ],
            "recent_topics": self.data.get("recent_topics", [])[-5:],
            "last_interaction": self.data.get("last_interaction", ""),
            "user_preferences": self.data.get("user_preferences", {}),
            "patterns": patterns,  # GFCR: 可复用模式
        }

    def get_context_text(self, max_sessions=3):
        """
        获取纯文本格式的记忆上下文（用于 TTS/语音场景）
        
        返回:
            str: 格式化的文本摘要
        """
        ctx = self.get_context(max_sessions)
        if ctx["total_sessions"] == 0:
            return "这是我们的第一次对话。"

        lines = [f"我们已经对话过 {ctx['total_sessions']} 次。"]
        if ctx["last_interaction"]:
            lines.append(f"上次对话是 {ctx['last_interaction'][:16]}。")

        for s in ctx["recent_sessions"]:
            if s["summary"]:
                lines.append(f"- {s['time']}: {s['summary']}")

        if ctx["recent_topics"]:
            topics_str = "、".join(ctx["recent_topics"])
            lines.append(f"最近常聊的话题: {topics_str}")

        # GFCR: 追加行为模式
        patterns_text = self.get_patterns_text(3)
        if patterns_text:
            lines.append(patterns_text)

        return "\n".join(lines)

    # ==================== 工具方法 ====================

    def _generate_session_id(self):
        """生成唯一会话ID — 格式: 20260518-001"""
        today_prefix = datetime.date.today().strftime("%Y-%m-%d")  # 匹配 ISO 格式
        # 计算今日已有会话数
        today_count = sum(
            1 for s in self.data["sessions"]
            if s.get("start_time", "").startswith(today_prefix)
        )
        date_compact = datetime.date.today().strftime("%Y%m%d")
        return f"{date_compact}-{today_count + 1:03d}"

    def _now_iso(self):
        """获取当前 ISO 时间"""
        return datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    # ==================== 统计 ====================

    def get_stats(self):
        """获取记忆统计信息"""
        sessions = self.data["sessions"]
        if not sessions:
            return {"total_sessions": 0, "total_commands": 0, "total_duration": "0分钟"}

        total_commands = sum(len(s.get("commands", [])) for s in sessions)
        total_duration = sum(s.get("duration_seconds", 0) for s in sessions)

        return {
            "total_sessions": len(sessions),
            "total_commands": total_commands,
            "total_duration": f"{total_duration // 60}分钟",
            "unique_topics": len(self.data.get("recent_topics", [])),
        }

    def get_last_summary(self):
        """获取最近一次会话的摘要"""
        if not self.data["sessions"]:
            return None
        return self.data["sessions"][-1].get("summary", "")


# ==================== 独立测试 ====================

if __name__ == "__main__":
    print("=" * 50)
    print("  Friday 跨会话记忆测试")
    print("=" * 50)

    memory = ConversationMemory()
    print(f"  历史会话: {len(memory.data['sessions'])} 次")

    # 模拟一次新会话
    print("\n--- 新会话开始 ---")
    memory.start_session()
    memory.record_command("你好")
    memory.record_command("现在几点")
    memory.record_command("电脑状态怎么样")
    memory.record_command("拜拜")
    memory.end_session("user_said_goodbye")

    # 获取上下文
    print("\n--- 记忆上下文 ---")
    print(memory.get_context_text())

    # 统计
    print("\n--- 统计 ---")
    stats = memory.get_stats()
    for k, v in stats.items():
        print(f"  {k}: {v}")
