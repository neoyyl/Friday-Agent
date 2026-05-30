"""Edge TTS 语音合成技能"""
import asyncio
import os
import tempfile
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class TTSEdgeSkill(SkillBase):

    VOICES = {
        "zh": "zh-CN-XiaoxiaoNeural",
        "en": "en-US-JennyNeural",
        "ja": "ja-JP-NanamiNeural",
        "ko": "ko-KR-SunHiNeural",
        "fr": "fr-FR-DeniseNeural",
        "de": "de-DE-KatjaNeural",
    }

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="tts-edge",
            name="语音合成",
            version="1.0.0",
            description="使用 Edge TTS 将文本转为自然语音",
            author="Friday",
            capabilities=["tts", "voice", "speech", "语音", "朗读", "语音合成"],
            tags=["utility", "voice", "tts"],
            icon="🔊",
        )

    async def handle(self, context: dict) -> SkillResult:
        query = context.get("query", "")
        if not query:
            return create_skill_result("请提供要朗读的文本")

        text, voice = self._parse_query(query)

        try:
            output_path = await self._synthesize(text, voice)
            return create_skill_result(
                f"🔊 语音已生成: {output_path}",
                data={"path": output_path, "voice": voice, "text": text}
            )
        except ImportError:
            return create_skill_result("edge-tts 未安装，请运行: pip install edge-tts")
        except Exception as e:
            return create_skill_result(f"语音合成失败: {e}", data={"error": str(e)})

    def _parse_query(self, query: str) -> tuple:
        voice = self.VOICES.get("zh")
        text = query

        import re
        m = re.search(r"(用|使用)\s*(英文|中文|日文|韩文|法文|德文|英语|中文)\s*(朗读|说|念)\s*(.+)", query)
        if m:
            lang_key = {"英文": "en", "英语": "en", "中文": "zh", "日文": "ja", "日语": "ja",
                        "韩文": "ko", "韩语": "ko", "法文": "fr", "法语": "fr", "德文": "de", "德语": "de"}
            lang = lang_key.get(m.group(2), "zh")
            voice = self.VOICES.get(lang, self.VOICES["zh"])
            text = m.group(4).strip()
        else:
            has_cjk = bool(re.search(r"[\u4e00-\u9fff]", query))
            if not has_cjk:
                voice = self.VOICES["en"]

        return text, voice

    async def _synthesize(self, text: str, voice: str) -> str:
        import edge_tts
        output_dir = os.path.join(tempfile.gettempdir(), "friday-tts")
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"tts_{hash(text) & 0xFFFF:04x}.mp3")

        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
        return output_path
