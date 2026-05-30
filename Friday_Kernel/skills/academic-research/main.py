"""学术论文搜索 - 使用 OpenAlex API 搜索学术论文，获取引用链和摘要"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class AcademicResearchSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="academic-research",
            name="学术论文搜索",
            version="1.0.0",
            description="使用 OpenAlex API 搜索学术论文，获取引用链和摘要",
            author="Friday",
            capabilities=["academic", "paper", "论文", "学术", "搜索论文", "citation"],
            tags=["research", "academic"],
            icon="📚",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        if not q:
            return create_skill_result("请提供搜索关键词，如：搜索 Python 相关论文")
        import urllib.request, urllib.parse, json as _json
        url = f"https://api.openalex.org/works?search={urllib.parse.quote(q)}&per_page=5"
        req = urllib.request.Request(url, headers={"User-Agent": "Friday/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = _json.loads(r.read())
        results = data.get("results", [])
        if not results:
            return create_skill_result(f"未找到 '{q}' 相关论文")
        lines = [f"📚 学术搜索: {q}\n"]
        for i, w in enumerate(results[:5], 1):
            title = w.get("title", "?")
            year = w.get("publication_year", "?")
            cited = w.get("cited_by_count", 0)
            doi = w.get("doi", "")
            lines.append(f"{i}. [{year}] {title}")
            lines.append(f"   引用: {cited} | DOI: {doi or 'N/A'}\n")
        return create_skill_result("\n".join(lines), data={"results": len(results)})
