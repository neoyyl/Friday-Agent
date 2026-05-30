"""编程导师技能 - 代码教学与调试指导"""
import re
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class CodeMentorSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="code-mentor",
            name="编程导师",
            version="1.0.0",
            description="AI 编程教学，代码审查，调试指导",
            author="Friday",
            capabilities=["code", "programming", "编程", "代码", "debug", "调试", "tutorial"],
            tags=["education", "programming"],
            icon="👨‍🏫",
        )

    async def handle(self, context: dict) -> SkillResult:
        query = context.get("query", "")
        if not query:
            return create_skill_result("请描述你的编程问题，例如：'解释 Python 装饰器' 或 '这段代码有什么 bug'")

        intent = self._detect_intent(query)
        lang = self._detect_language(query)

        if intent == "explain":
            return self._handle_explain(query, lang)
        elif intent == "debug":
            return self._handle_debug(query, lang)
        elif intent == "review":
            return self._handle_review(query, lang)
        elif intent == "convert":
            return self._handle_convert(query, lang)
        else:
            return self._handle_general(query, lang)

    def _detect_intent(self, query: str) -> str:
        if any(w in query for w in ["解释", "什么是", "explain", "什么是", "原理"]):
            return "explain"
        if any(w in query for w in ["bug", "错误", "报错", "error", "fix", "修复", "调试"]):
            return "debug"
        if any(w in query for w in ["审查", "review", "优化", "重构", "refactor"]):
            return "review"
        if any(w in query for w in ["转换", "convert", "改成", "翻译成"]):
            return "convert"
        return "general"

    def _detect_language(self, query: str) -> str:
        lang_keywords = {
            "python": ["python", "py", "django", "flask"],
            "javascript": ["javascript", "js", "node", "react", "vue"],
            "typescript": ["typescript", "ts", "nextjs"],
            "java": ["java", "spring"],
            "go": ["golang", "go ", "gin"],
            "rust": ["rust", "cargo"],
            "c++": ["c++", "cpp", "cmake"],
        }
        for lang, keywords in lang_keywords.items():
            if any(kw in query.lower() for kw in keywords):
                return lang
        return "通用"

    def _handle_explain(self, query: str, lang: str) -> SkillResult:
        topic = re.sub(r"(解释|什么是|explain|说明)\s*", "", query, flags=re.IGNORECASE).strip()
        return create_skill_result(
            f"📖 概念讲解: {topic}\n\n"
            f"💡 要深入理解 '{topic}'，建议从以下角度学习:\n"
            f"1. 核心定义与用途\n"
            f"2. 基础语法/用法\n"
            f"3. 常见使用场景\n"
            f"4. 注意事项与陷阱\n"
            f"5. 实际代码示例\n\n"
            f"🔧 编程语言: {lang}\n"
            f"📚 建议查阅官方文档获取最新信息"
        )

    def _handle_debug(self, query: str, lang: str) -> SkillResult:
        return create_skill_result(
            f"🐛 调试指导 ({lang})\n\n"
            f"排查步骤:\n"
            f"1. 阅读完整错误信息和堆栈跟踪\n"
            f"2. 定位出错的行号和文件\n"
            f"3. 检查变量类型和值是否符合预期\n"
            f"4. 使用 print/logging 输出中间状态\n"
            f"5. 搜索类似错误的解决方案\n"
            f"6. 简化代码直到问题消失，再逐步恢复\n\n"
            f"💡 请提供具体的错误信息和相关代码片段，我可以给出更精确的建议"
        )

    def _handle_review(self, query: str, lang: str) -> SkillResult:
        return create_skill_result(
            f"🔍 代码审查 ({lang})\n\n"
            f"审查维度:\n"
            f"✅ 正确性: 逻辑是否正确，边界条件是否处理\n"
            f"✅ 可读性: 命名是否清晰，结构是否合理\n"
            f"✅ 性能: 有无不必要的重复计算或内存泄漏\n"
            f"✅ 安全性: 有无注入、XSS 等安全风险\n"
            f"✅ 测试性: 是否易于编写单元测试\n\n"
            f"💡 请提供需要审查的代码，我会逐项分析"
        )

    def _handle_convert(self, query: str, lang: str) -> SkillResult:
        return create_skill_result(
            f"🔄 代码转换\n\n"
            f"转换步骤:\n"
            f"1. 理解源代码的业务逻辑\n"
            f"2. 识别目标语言的等价语法\n"
            f"3. 处理语言差异（类型系统、错误处理等）\n"
            f"4. 保持功能一致性\n\n"
            f"💡 请指定源语言和目标语言，以及需要转换的代码"
        )

    def _handle_general(self, query: str, lang: str) -> SkillResult:
        return create_skill_result(
            f"👨‍🏫 编程助手 ({lang})\n\n"
            f"我可以帮你:\n"
            f"📖 解释概念: '什么是 {query[:20]}...'\n"
            f"🐛 调试代码: '这段代码报错了...'\n"
            f"🔍 代码审查: '帮我审查这段代码...'\n"
            f"🔄 代码转换: '把这段 Python 转成 JS...'\n"
            f"💡 最佳实践: '{lang} 中如何...'\n\n"
            f"请详细描述你的需求，我会尽力帮助你"
        )
