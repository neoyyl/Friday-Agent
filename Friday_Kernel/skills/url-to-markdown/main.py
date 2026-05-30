"""网页转Markdown - 将任意网页 URL 转为 Markdown"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class UrlToMarkdownSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="url-to-markdown",
            name="网页转Markdown",
            version="1.0.0",
            description="将任意网页 URL 转为 Markdown",
            author="Friday",
            capabilities=["url-md", "网页转md", "保存网页", "webclip"],
            tags=["utility", "conversion"],
            icon="🔗",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        import re as _re, urllib.request
        m = _re.search(r"https?://\S+", q)
        if not m:
            return create_skill_result("请提供要转换的网页 URL")
        url = m.group(0)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as r:
                html = r.read().decode("utf-8", errors="replace")
            text = _re.sub(r"<script[^>]*>.*?</script>", "", html, flags=_re.DOTALL)
            text = _re.sub(r"<style[^>]*>.*?</style>", "", text, flags=_re.DOTALL)
            text = _re.sub(r"<[^>]+>", " ", text)
            text = _re.sub(r"\s+", " ", text).strip()[:2000]
            return create_skill_result(f"🔗 网页内容 ({url}):\n\n{text[:500]}...", data={"url": url, "length": len(text)})
        except Exception as e:
            return create_skill_result(f"转换失败: {e}")
