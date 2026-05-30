"""智能翻译技能 - 使用免费翻译 API"""
import urllib.request
import urllib.parse
import json
import re
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class TranslateSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="translate",
            name="智能翻译",
            version="1.0.0",
            description="多语言互译，支持自动语言检测",
            author="Friday",
            capabilities=["translate", "translation", "翻译", "互译", "language"],
            tags=["utility", "language"],
            icon="🌐",
        )

    async def handle(self, context: dict) -> SkillResult:
        query = context.get("query", "")
        text, target_lang = self._parse_query(query)

        if not text:
            return create_skill_result("请提供需要翻译的文本，例如：'翻译 hello' 或 '将你好翻译成英文'")

        try:
            result_text = await self._translate(text, target_lang)
            return create_skill_result(result_text, data={"text": text, "target": target_lang})
        except Exception as e:
            return create_skill_result(f"翻译失败: {e}", data={"error": str(e)})

    def _parse_query(self, query: str) -> tuple:
        target_lang = "en"
        text = query

        lang_map = {
            "英文": "en", "英语": "en", "english": "en",
            "中文": "zh", "汉语": "zh", "chinese": "zh",
            "日文": "ja", "日语": "ja", "japanese": "ja",
            "韩文": "ko", "韩语": "ko", "korean": "ko",
            "法文": "fr", "法语": "fr", "french": "fr",
            "德文": "de", "德语": "de", "german": "de",
            "俄文": "ru", "俄语": "ru", "russian": "ru",
        }

        patterns = [
            (r"翻译成(.+?)[:：]\s*(.+)", 2, 1),
            (r"将.+?翻译成(.+?)\s+(.+)", 2, 1),
            (r"翻译\s+(.+)", 1, None),
        ]

        for pat, text_group, lang_group in patterns:
            m = re.search(pat, query, re.IGNORECASE)
            if m:
                text = m.group(text_group).strip()
                if lang_group:
                    lang_word = m.group(lang_group).strip().lower()
                    target_lang = lang_map.get(lang_word, lang_word[:2])
                break

        if text == query and not re.search(r"[\u4e00-\u9fff]", query):
            has_cjk = bool(re.search(r"[\u4e00-\u9fff]", query))
            target_lang = "zh" if has_cjk else "en"

        return text, target_lang

    async def _translate(self, text: str, target_lang: str) -> str:
        is_chinese = bool(re.search(r"[\u4e00-\u9fff]", text))
        src_lang = "zh" if is_chinese else "en"
        if src_lang == target_lang:
            target_lang = "en" if src_lang == "zh" else "zh"

        api_url = "https://api.mymemory.translated.net/get"
        params = urllib.parse.urlencode({
            "q": text,
            "langpair": f"{src_lang}|{target_lang}",
        })
        url = f"{api_url}?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "Friday/1.0"})

        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        if data.get("responseStatus") == 200:
            translated = data["responseData"]["translatedText"]
            return f"🌐 {src_lang} → {target_lang}\n\n原文: {text}\n译文: {translated}"
        else:
            raise Exception(f"API 返回错误: {data.get('responseStatus')}")
