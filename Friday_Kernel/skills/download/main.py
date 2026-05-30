"""资源下载技能"""
import os
import subprocess
import re
import tempfile
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class DownloadSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="download",
            name="资源下载",
            version="1.0.0",
            description="下载网页资源、视频、音频、文件",
            author="Friday",
            capabilities=["download", "下载", "video-download", "fetch"],
            tags=["utility", "download"],
            icon="📥",
        )

    async def handle(self, context: dict) -> SkillResult:
        query = context.get("query", "")
        url = self._extract_url(query)
        if not url:
            return create_skill_result("请提供下载链接，例如：'下载 https://example.com/file.mp4'")

        download_dir = context.get("params", {}).get("output_dir") or os.path.join(
            tempfile.gettempdir(), "friday-downloads"
        )
        os.makedirs(download_dir, exist_ok=True)

        try:
            if self._is_video_url(url):
                return await self._download_video(url, download_dir)
            else:
                return await self._download_file(url, download_dir)
        except Exception as e:
            return create_skill_result(f"下载失败: {e}", data={"error": str(e), "url": url})

    def _extract_url(self, query: str) -> str:
        m = re.search(r"https?://\S+", query)
        return m.group(0) if m else ""

    def _is_video_url(self, url: str) -> bool:
        video_patterns = [r"youtube\.com", r"youtu\.be", r"bilibili\.com", r"tiktok\.com",
                          r"instagram\.com", r"twitter\.com", r"x\.com", r"\.(mp4|mkv|avi|m3u8)"]
        return any(re.search(p, url, re.IGNORECASE) for p in video_patterns)

    async def _download_video(self, url: str, output_dir: str) -> SkillResult:
        try:
            result = subprocess.run(
                ["yt-dlp", "-f", "best", "-o", os.path.join(output_dir, "%(title)s.%(ext)s"), url],
                capture_output=True, text=True, timeout=300
            )
            if result.returncode == 0:
                return create_skill_result(f"✅ 视频下载完成\n目录: {output_dir}", data={"dir": output_dir})
            else:
                return create_skill_result(f"yt-dlp 错误: {result.stderr[:500]}")
        except FileNotFoundError:
            return create_skill_result("yt-dlp 未安装，请运行: pip install yt-dlp")

    async def _download_file(self, url: str, output_dir: str) -> SkillResult:
        import urllib.request
        try:
            filename = url.split("/")[-1].split("?")[0] or "download"
            output_path = os.path.join(output_dir, filename)
            urllib.request.urlretrieve(url, output_path)
            size = os.path.getsize(output_path)
            return create_skill_result(
                f"✅ 下载完成: {filename}\n大小: {size / 1024:.1f} KB\n路径: {output_path}",
                data={"path": output_path, "size": size}
            )
        except Exception as e:
            return create_skill_result(f"文件下载失败: {e}")
