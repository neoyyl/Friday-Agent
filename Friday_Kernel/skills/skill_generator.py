"""
Skill Generator — 自然语言 → 技能代码
========================================
用户用自然语言描述需求，系统自动生成完整的可热加载技能。

工作流程:
  1. 用户输入自然语言描述
  2. 解析意图 → 提取技能元数据 (名称、能力、输入/输出)
  3. 生成 skill.json + main.py 代码
  4. 写入 skills/ 目录 
  5. 触发热加载 → 立即可用

两种模式:
  - template: 模板匹配（快速，适用于常见模式）
  - ai: LLM 生成（灵活，适用于任意场景）

用法:
    generator = SkillGenerator()
    result = generator.create_from_description(
        "帮我创建一个英语单词翻译技能，输入英文返回中文解释"
    )
    # → {"success": True, "id": "english-translator", ...}
"""

import asyncio
import json
import logging
import os
import re
import textwrap
import concurrent.futures
from datetime import datetime
from string import Template
from typing import Optional

logger = logging.getLogger("friday.skill.generator")

# ───────── 模板库 ─────────

SKILL_TEMPLATES = {
    "query": {
        "keywords": ["查询", "查", "搜索", "找", "获取", "get", "query", "search", "find"],
        "description": "信息查询技能",
    },
    "transform": {
        "keywords": ["翻译", "转换", "转", "生成", "transform", "convert", "translate"],
        "description": "数据转换技能",
    },
    "notify": {
        "keywords": ["提醒", "通知", "告警", "监控", "notify", "alert", "monitor"],
        "description": "通知提醒技能",
    },
    "calculate": {
        "keywords": ["计算", "算", "统计", "分析", "calculate", "compute", "analyze"],
        "description": "计算分析技能",
    },
}

# Python 技能代码模板
SKILL_CODE_TEMPLATE = Template("""\"\"\"
$description
=================================
由 Friday NL→Code 自动生成
生成时间: $generated_at

能力: $capabilities
\"\"\"

import json
import logging
from typing import Optional

from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result

logger = logging.getLogger("friday.skill.$skill_id")


class $class_name(SkillBase):
    \"\"\"$description\"\"\"

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="$skill_id",
            name="$skill_name",
            version="1.0.0",
            description="$description",
            author="Friday NL→Code",
            capabilities=$capabilities_list,
            tags=$tags_list,
            icon="$icon",
        )

    async def handle(self, context: dict) -> SkillResult:
        \"\"\"
        处理技能调用

        参数:
            context: {"query": str, "params": dict, "speaker": str}
        \"\"\"
        query = context.get("query", "")
        params = context.get("params", {})

        try:
            $handler_body

            return create_skill_result(
                output=result,
                data={"query": query, "result": result},
            )
        except Exception as e:
            logger.error("$skill_id error: %s", e)
            return SkillResult(success=False, error=str(e))
""")

# ───────── 技能生成器 ─────────

class SkillGenerator:
    """自然语言 → 技能代码生成器"""

    def __init__(self, skills_dir: str = None, skill_manager=None):
        self.skills_dir = skills_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "skills"
        )
        self.manager = skill_manager
        self._generated_count = 0

    def create_from_description(self, description: str) -> dict:
        """
        从自然语言描述生成完整技能

        参数:
            description: 自然语言描述，如 "帮我创建一个查天气的技能"

        返回:
            {"success": bool, "id": str, "name": str, "dir": str, "error": str}
        """
        # 1. 提取元数据
        meta = self._extract_metadata(description)
        if not meta:
            return {"success": False, "error": "无法从描述中提取技能元数据"}

        # 2. 生成代码
        code_result = self._generate_code(meta)
        if not code_result.get("success"):
            return code_result

        # 3. 写入文件
        write_result = self._write_skill_files(meta, code_result)
        if not write_result.get("success"):
            return write_result

        # 4. 热加载
        if self.manager:
            load_result = self._hot_load(write_result["dir"])
            if not load_result.get("success"):
                return load_result

        self._generated_count += 1

        return {
            "success": True,
            "id": meta["id"],
            "name": meta["name"],
            "dir": write_result["dir"],
            "description": meta["description"],
            "capabilities": meta["capabilities"],
            "total_generated": self._generated_count,
        }

    # ───────── 元数据提取 ─────────

    def _extract_metadata(self, description: str) -> Optional[dict]:
        """从自然语言提取技能元数据"""
        text = description.strip()
        if not text:
            return None

        # 生成技能 ID
        skill_id = self._generate_id(text)

        # 生成技能名称
        skill_name = self._generate_name(text)

        # 匹配模板
        matched_type = self._match_type(text)

        # 提取能力标签
        capabilities = self._extract_capabilities(text, matched_type)

        # 生成处理函数体
        handler_body = self._generate_handler(text, matched_type)

        # 选择图标
        icon = self._select_icon(matched_type, text)

        return {
            "id": skill_id,
            "name": skill_name,
            "description": text[:120],
            "type": matched_type,
            "capabilities": capabilities,
            "handler_body": handler_body,
            "icon": icon,
            "class_name": self._to_pascal_case(skill_id) + "Skill",
            "tags": [matched_type, "auto-generated"],
        }

    def _generate_id(self, text: str) -> str:
        """从描述生成技能 ID"""
        # 提取有意义的关键词（中文按字符拆分）
        cjk_range = set(range(0x4E00, 0x9FFF + 1)) | set(range(0x3400, 0x4DBF + 1))

        def is_cjk(ch):
            return '\u4e00' <= ch <= '\u9fff'

        # 将文本拆分为字符列表，ASCII 保持连续，CJK 每个字独立
        tokens = []
        current_ascii = []
        for ch in text.strip():
            if is_cjk(ch):
                if current_ascii:
                    tokens.append(''.join(current_ascii))
                    current_ascii = []
                tokens.append(ch)
            elif ch.isspace():
                if current_ascii:
                    tokens.append(''.join(current_ascii))
                    current_ascii = []
            else:
                current_ascii.append(ch)
        if current_ascii:
            tokens.append(''.join(current_ascii))

        # 贪婪合并已知短语（从左到右最长匹配）
        known_phrases = sorted([
            "查快递", "查天气", "天气预报", "备忘录", "待办事项",
            "计算器", "翻译器", "提醒器", "翻译", "计算", "提醒",
            "查询", "搜索", "天气", "日历", "笔记", "待办", "快递",
            "新闻", "音乐", "股票", "邮件",
        ], key=len, reverse=True)

        merged = []
        i = 0
        while i < len(tokens):
            matched = False
            for phrase in known_phrases:
                if ''.join(tokens[i:i+len(phrase)]) == phrase:
                    merged.append(phrase)
                    i += len(phrase)
                    matched = True
                    break
            if not matched:
                merged.append(tokens[i])
                i += 1

        # 跳过停用词
        stop = {"帮我", "创建", "一个", "的", "技能", "写", "生成", "做个", "我要",
                "帮", "我", "一", "个", "为", "你", "来", "去", "这", "那",
                "创", "建", "做", "让", "给", "把", "被", "在", "有", "没",
                "是", "就", "也", "和", "与", "或", "但", "而", "所", "以",
                "能", "会", "要", "可", "该", "应", "需", "得", "着", "了",
                "过", "吧", "吗", "啊", "呢", "呀", "啦", "哦", "嗯", "哈",
                "之", "于", "其", "中", "上", "下", "左", "右", "前", "后",
                "里", "外", "内", "边", "面", "头", "尾", "将", "已", "正",
                "从", "向", "对", "比", "按", "照", "由", "因", "为", "被",
                "把", "让", "叫", "给", "替", "同", "跟", "与", "和", "及",
        }
        filtered = [w for w in merged if w not in stop and len(w) > 0]

        # 过滤掉纯标点
        filtered = [w for w in filtered if not all(ch in '，。、？！；：""''（）【】《》—…' for ch in w)]

        if not filtered:
            # 尝试从原始描述中提取英文或数字
            eng_tokens = re.findall(r'[a-zA-Z0-9_]+', text)
            if eng_tokens:
                base = eng_tokens[0]
            else:
                base = "custom"
        else:
            # 选择第一个有对应英文映射的词（含完整短语匹配）
            base = filtered[0]

        # 转为英文 ID
        id_ = self._to_english_id(base)

        # 确保唯一性
        if self.manager:
            existing = self.manager.get_skill(id_)
            if existing:
                id_ = f"{id_}-{self._generated_count + 1}"

        return id_

    def _to_english_id(self, word: str) -> str:
        """中文/其他字符转英文 ID"""
        # 完整短语优先匹配
        phrase_map = {
            "查快递": "courier", "查天气": "weather",
            "翻译": "translator", "计算": "calculator", "提醒": "reminder",
        }
        if word in phrase_map:
            return phrase_map[word]

        # 常用词映射
        mapping = {
            "天气": "weather", "快递": "courier", "翻译": "translator",
            "计算": "calculator", "提醒": "reminder", "搜索": "searcher",
            "笔记": "notes", "待办": "todo", "日历": "calendar",
            "音乐": "music", "新闻": "news", "股票": "stock",
            "汇率": "exchange", "字典": "dictionary", "百科": "wiki",
            "日期": "date", "时间": "time", "闹钟": "alarm",
            "邮件": "email", "短信": "sms", "电话": "phone",
            "地图": "map", "导航": "navigation", "翻译": "translator",
        }
        if word in mapping:
            return mapping[word]

        # 复合词拆解: 从左侧逐步匹配已知映射
        for i in range(len(word), 1, -1):
            prefix = word[:i]
            if prefix in mapping:
                return mapping[prefix]
            if prefix in {"查", "看", "读", "写", "发", "收"}:
                suffix = word[i:]
                pinyin_map = {"查": "lookup", "看": "view", "读": "reader",
                              "写": "writer", "发": "sender", "收": "receiver"}
                base = pinyin_map[prefix]
                suffix_eng = self._to_english_id(suffix) if suffix else ""
                return f"{base}-{suffix_eng}" if suffix_eng else base

        # 默认：转为小写+连字符
        eng = re.sub(r'[^a-zA-Z0-9]', '-', word.lower())
        return eng if eng else f"skill-{self._generated_count + 1}"

    def _generate_name(self, text: str) -> str:
        """从描述生成技能名称"""
        # 提取 "xxx技能" 或 "xxx工具"
        m = re.search(r'(?:创建|写|生成|做个|搞个)\s*(.+?)(?:技能|工具|应用|程序)', text)
        if m:
            return m.group(1).strip()
        # 取前 6 个字
        for sep in ["的", "，", " ", "。"]:
            parts = text.split(sep)
            if len(parts) > 1:
                base = parts[1] if len(parts[0]) < 3 else parts[0]
                return base[:12]
        return text[:12]

    def _match_type(self, text: str) -> str:
        """匹配技能类型"""
        text_lower = text.lower()
        for ttype, config in SKILL_TEMPLATES.items():
            for kw in config["keywords"]:
                if kw in text_lower or kw in text:
                    return ttype
        return "query"

    def _extract_capabilities(self, text: str, matched_type: str) -> list:
        """提取能力标签"""
        caps = set()
        type_caps = {
            "query": ["query", "search", "lookup"],
            "transform": ["transform", "convert", "format"],
            "notify": ["notify", "alert", "monitor"],
            "calculate": ["calculate", "analyze", "compute"],
        }
        caps.update(type_caps.get(matched_type, ["custom"]))

        # 从描述中提取额外能力
        text_lower = text.lower()
        extra = {
            "翻译": "translate", "天气": "weather", "快递": "tracking",
            "提醒": "reminder", "笔记": "notes", "待办": "todo",
            "搜索": "search", "音乐": "music", "新闻": "news",
        }
        for cn, en in extra.items():
            if cn in text or cn in text_lower:
                caps.add(en)

        return list(caps)

    def _generate_handler(self, text: str, matched_type: str) -> str:
        """生成处理函数体（返回已正确缩进的代码块）"""
        # 检查是否指定了 API
        has_api = any(kw in text for kw in ["API", "接口", "调用", "请求", "http"])

        # 注意: 这些代码会被插入到 async def handle() 的 try: 块中
        # try: 块使用 12 空格缩进 (handle body 为 8 空格)
        indent = "            "  # 12 空格 = try 块内部

        if matched_type == "query":
            if has_api:
                body_lines = [
                    '# 调用外部 API 查询',
                    'api_url = params.get("api_url", "")',
                    'result = f"正在查询: {query}"',
                    'if api_url:',
                    '    result += f" (API: {api_url})"',
                ]
            else:
                body_lines = [
                    '# 处理查询请求',
                    'result = f"收到查询: {query}"',
                    'if params:',
                    '    result += f" 参数: {params}"',
                ]
        elif matched_type == "transform":
            body_lines = [
                '# 数据转换',
                'input_data = query or params.get("input", "")',
                'result = f"转换结果: {input_data}"',
            ]
        elif matched_type == "notify":
            body_lines = [
                '# 通知处理',
                'message = query or params.get("message", "")',
                'level = params.get("level", "info")',
                'result = f"[{level.upper()}] {message}"',
            ]
        else:
            body_lines = [
                '# 通用处理',
                'result = f"处理完成: {query[:100]}" if query else "请输入查询内容"',
            ]

        return "\n".join(indent + line for line in body_lines)

    def _select_icon(self, matched_type: str, text: str) -> str:
        """选择图标"""
        type_icons = {
            "query": "\U0001f50d",
            "transform": "\U0001f504",
            "notify": "\U0001f514",
            "calculate": "\U0001f522",
        }
        # 检查特定关键词
        icon_map = {
            "天气": "\u2600\ufe0f", "快递": "\U0001f69a", "翻译": "\U0001f310",
            "音乐": "\U0001f3b5", "新闻": "\U0001f4f0", "提醒": "\u23f0",
            "笔记": "\U0001f4dd", "日历": "\U0001f4c5", "待办": "\u2611\ufe0f",
        }
        for kw, icon in icon_map.items():
            if kw in text:
                return icon
        return type_icons.get(matched_type, "\U0001f916")

    def _to_pascal_case(self, text: str) -> str:
        """转 PascalCase"""
        parts = text.replace("-", "_").split("_")
        return "".join(p.capitalize() for p in parts)

    # ───────── 代码生成 ─────────

    def _generate_code(self, meta: dict) -> dict:
        """生成技能代码"""
        try:
            # 生成 capabilities 列表字符串
            caps_str = json.dumps(meta["capabilities"], ensure_ascii=False)
            tags_str = json.dumps(meta["tags"], ensure_ascii=False)

            code = SKILL_CODE_TEMPLATE.substitute(
                skill_id=meta["id"],
                skill_name=meta["name"],
                class_name=meta["class_name"],
                description=meta["description"],
                capabilities=caps_str,
                capabilities_list=caps_str,
                tags_list=tags_str,
                icon=meta["icon"],
                handler_body=meta["handler_body"],
                generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            )

            # 生成 skill.json
            manifest = {
                "id": meta["id"],
                "name": meta["name"],
                "version": "1.0.0",
                "description": meta["description"],
                "author": "Friday NL\u2192Code",
                "entry": "main.py",
                "class": meta["class_name"],
                "capabilities": meta["capabilities"],
                "license": "MIT",
                "tags": meta["tags"],
                "icon": meta["icon"],
                "dependencies": [],
            }

            return {
                "success": True,
                "code": code,
                "manifest": manifest,
            }
        except Exception as e:
            return {"success": False, "error": f"代码生成失败: {e}"}

    # ───────── 文件写入 ─────────

    def _write_skill_files(self, meta: dict, code_result: dict) -> dict:
        """将技能文件写入磁盘"""
        skill_dir = os.path.join(self.skills_dir, meta["id"])
        try:
            os.makedirs(skill_dir, exist_ok=True)

            # 写入 main.py
            main_path = os.path.join(skill_dir, "main.py")
            with open(main_path, "w", encoding="utf-8") as f:
                f.write(code_result["code"])

            # 写入 skill.json
            manifest_path = os.path.join(skill_dir, "skill.json")
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(code_result["manifest"], f, ensure_ascii=False, indent=2)

            logger.info("技能文件已写入: %s", skill_dir)
            return {"success": True, "dir": skill_dir}

        except Exception as e:
            return {"success": False, "error": f"写入文件失败: {e}"}

    # ───────── 热加载 ─────────

    def _hot_load(self, skill_dir: str) -> dict:
        """触发热加载（同步版本）"""
        if not self.manager:
            return {"success": True, "note": "无 SkillManager，技能已写入但未加载"}

        try:
            # 检测是否有运行中的事件循环
            try:
                loop = asyncio.get_running_loop()
                # 有运行中的循环 → 用线程提交
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(
                        lambda: asyncio.run(self.manager.load_skill(skill_dir))
                    )
                    skill_id = future.result(timeout=30)
            except RuntimeError:
                # 没有运行中的循环 → 正常创建
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    skill_id = loop.run_until_complete(self.manager.load_skill(skill_dir))
                finally:
                    loop.close()

            if skill_id:
                logger.info("技能已热加载: %s", skill_id)
                return {"success": True, "loaded": True, "id": skill_id}
            else:
                return {"success": False, "error": "热加载失败，请检查技能代码"}

        except Exception as e:
            return {"success": False, "error": f"热加载异常: {e}"}

    async def async_create_from_description(self, description: str) -> dict:
        """
        异步版: 从自然语言描述生成完整技能（适用于已运行事件循环的环境）

        与 create_from_description() 功能相同，但热加载使用 await 而非新事件循环。
        """
        # 1. 提取元数据
        meta = self._extract_metadata(description)
        if not meta:
            return {"success": False, "error": "无法从描述中提取技能元数据"}

        # 2. 生成代码
        code_result = self._generate_code(meta)
        if not code_result.get("success"):
            return code_result

        # 3. 写入文件
        write_result = self._write_skill_files(meta, code_result)
        if not write_result.get("success"):
            return write_result

        # 4. 异步热加载
        if self.manager:
            try:
                skill_id = await self.manager.load_skill(write_result["dir"])
                if not skill_id:
                    return {"success": False, "error": "热加载失败，请检查技能代码"}
            except Exception as e:
                return {"success": False, "error": f"热加载异常: {e}"}

        self._generated_count += 1

        return {
            "success": True,
            "id": meta["id"],
            "name": meta["name"],
            "dir": write_result["dir"],
            "description": meta["description"],
            "capabilities": meta["capabilities"],
            "total_generated": self._generated_count,
        }
