"""YouTube字幕 - 获取 YouTube 视频字幕和封面"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class YoutubeTranscriptSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="youtube-transcript",
            name="YouTube字幕",
            version="1.0.0",
            description="获取 YouTube 视频字幕和封面",
            author="Friday",
            capabilities=["youtube", "字幕", "视频字幕", "yt"],
            tags=["media", "video"],
            icon="▶️",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        import re as _re
        m = _re.search(r"(youtu\.?be[\w/.?=-]*|youtube\.com[\w/.?=-]*)", q)
        url = m.group(0) if m else ""
        if not url:
            return create_skill_result("请提供 YouTube 视频链接")
        return create_skill_result(
            f"▶️ YouTube 字幕下载\n\n"
            f"URL: {url}\n"
            f"功能: 下载字幕、翻译、章节、说话人识别\n"
            f"💡 完整功能请使用 yt-dlp 命令行工具")
