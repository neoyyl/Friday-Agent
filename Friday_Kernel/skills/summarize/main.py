"""内容摘要技能 - 文本提取与摘要"""
import urllib.request
import re
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class SummarizeSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="summarize",
            name="内容摘要",
            version="1.0.0",
            description="对网页、文档、文本进行智能摘要提取",
            author="Friday",
            capabilities=["summarize", "summary", "摘要", "总结", "提炼"],
            tags=["utility", "text", "nlp"],
            icon="📝",
        )

    async def handle(self, context: dict) -> SkillResult:
        query = context.get("query", "")
        if not query:
            return create_skill_result("请提供需要摘要的文本或 URL")

        url_match = re.search(r"https?://\S+", query)
        if url_match:
            return await self._summarize_url(url_match.group(0))
        else:
            return self._summarize_text(query)

    async def _summarize_url(self, url: str) -> SkillResult:
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8", errors="replace")

            text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"\s+", " ", text).strip()

            if len(text) > 3000:
                text = text[:3000]

            summary = self._extract_summary(text)
            return create_skill_result(
                f"📄 URL: {url}\n\n📝 摘要:\n{summary}\n\n📊 原文长度: {len(text)} 字符",
                data={"url": url, "summary": summary, "original_length": len(text)}
            )
        except Exception as e:
            return create_skill_result(f"URL 摘要失败: {e}")

    def _summarize_text(self, text: str) -> SkillResult:
        summary = self._extract_summary(text)
        return create_skill_result(
            f"📝 摘要:\n{summary}\n\n📊 原文: {len(text)} 字符 → 摘要: {len(summary)} 字符",
            data={"summary": summary, "original_length": len(text)}
        )

    def _extract_summary(self, text: str) -> str:
        sentences = re.split(r"[。！？.!?]+", text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

        if len(sentences) <= 3:
            return "。".join(sentences) + "。"

        scored = []
        words = set(text.lower().split())
        for s in sentences:
            s_words = set(s.lower().split())
            overlap = len(s_words & words)
            position_bonus = 1.5 if scored == [] else 1.0
            scored.append((s, overlap * position_bonus))

        scored.sort(key=lambda x: x[1], reverse=True)
        top = sorted(scored[:max(3, len(sentences) // 3)], key=lambda x: scored.index(x))

        return "。".join(s for s, _ in top) + "。"
