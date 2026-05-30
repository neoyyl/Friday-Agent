"""AI 图片生成技能 - 通过 LLM 生成图片描述和 prompt"""
import re
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class ImageGenSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="image-gen",
            name="AI 图片生成",
            version="1.0.0",
            description="AI 图片生成，支持 prompt 优化和风格建议",
            author="Friday",
            capabilities=["image-gen", "image", "图片", "生成图片", "绘图", "画图"],
            tags=["creative", "image", "ai"],
            icon="🎨",
        )

    async def handle(self, context: dict) -> SkillResult:
        query = context.get("query", "")
        if not query:
            return create_skill_result("请描述想要生成的图片，例如：'生成一只在月光下奔跑的猫'")

        query = re.sub(r"^(生成|画|画一张|创建|制作|帮我画|帮我生成)\s*", "", query, flags=re.IGNORECASE).strip()

        style = self._detect_style(query)
        enhanced_prompt = self._enhance_prompt(query, style)

        result = (
            f"🎨 图片生成 Prompt\n\n"
            f"📝 原始描述: {query}\n"
            f"🎭 检测风格: {style}\n\n"
            f"✨ 优化 Prompt:\n{enhanced_prompt}\n\n"
            f"💡 建议:\n"
            f"- 可在 prompt 中加入 'highly detailed, 8k, professional' 提升质量\n"
            f"- 加入 'cinematic lighting' 可增强光影效果\n"
            f"- 使用 '--ar 16:9' 参数可生成宽屏比例"
        )

        return create_skill_result(result, data={
            "original": query, "enhanced": enhanced_prompt, "style": style
        })

    def _detect_style(self, query: str) -> str:
        style_keywords = {
            "写实": ["写实", "真实", "realistic", "photo", "照片"],
            "动漫": ["动漫", "二次元", "anime", "manga", "漫画"],
            "油画": ["油画", "古典", "oil painting", "classical"],
            "水彩": ["水彩", "watercolor"],
            "3D渲染": ["3d", "渲染", "render", "blender", "octane"],
            "像素": ["像素", "pixel", "8bit", "复古"],
            "极简": ["极简", "简约", "minimal", "clean"],
            "赛博朋克": ["赛博", "cyberpunk", "neon", "霓虹"],
        }
        for style, keywords in style_keywords.items():
            if any(kw in query.lower() for kw in keywords):
                return style
        return "通用"

    def _enhance_prompt(self, query: str, style: str) -> str:
        style_suffixes = {
            "写实": ", photorealistic, highly detailed, 8k, DSLR quality",
            "动漫": ", anime style, vibrant colors, detailed, studio ghibli inspired",
            "油画": ", oil painting style, classical art, rich textures, dramatic lighting",
            "水彩": ", watercolor painting, soft edges, flowing colors, artistic",
            "3D渲染": ", 3D render, octane render, volumetric lighting, detailed",
            "像素": ", pixel art, 8-bit style, retro gaming, nostalgic",
            "极简": ", minimalist, clean design, simple shapes, modern",
            "赛博朋克": ", cyberpunk style, neon lights, futuristic, dark atmosphere",
            "通用": ", highly detailed, professional quality, 8k resolution",
        }
        suffix = style_suffixes.get(style, style_suffixes["通用"])
        return f"{query}{suffix}"
