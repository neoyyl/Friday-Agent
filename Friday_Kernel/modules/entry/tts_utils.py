"""
TTS 回复构建工具（无状态纯函数）
====================================
从 friday_all 提取，供所有入口文件共用。
"""


def build_tts_response(result: dict, original_query: str) -> str:
    """构建 TTS 语音回复（精简版，最大 280 字符或前 3 句）"""
    if result["type"] == "answer" and result.get("sources"):
        text = result["text"]
        return truncate_tts(text, max_chars=280, max_sentences=3)

    if result["type"] == "knowledge":
        if result["source_count"] > 0:
            source_names = [s.split("(")[0].strip() for s in result["sources"][:2]]
            return f"在知识库中找到 {result['source_count']} 条相关信息，来自 {'和'.join(source_names)}"
        else:
            return f"知识库里没有找到关于 {original_query} 的信息"

    return result.get("text", "")


def truncate_tts(text: str, max_chars=280, max_sentences=3) -> str:
    """智能截断 TTS 文本，不在句子中间截断"""
    if len(text) <= max_chars:
        return text

    boundaries = []
    for i, ch in enumerate(text):
        if ch in "。？！!?\n" and i + 1 < len(text):
            if ch == "\n" and i + 1 < len(text) and text[i + 1] == "\n":
                boundaries.append(i + 2)
            elif ch in "。？！!?":
                boundaries.append(i + 1)
        elif ch == "\n" and i + 1 < len(text) and text[i + 1] == "\n":
            boundaries.append(i + 2)

    if len(boundaries) >= max_sentences:
        cut = boundaries[max_sentences - 1]
        if cut <= max_chars:
            return text[:cut]

    for b in reversed(boundaries):
        if b <= max_chars:
            return text[:b]

    return text[:max_chars].rstrip("，、, ") + "…"
