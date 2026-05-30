#!/usr/bin/env python3
"""生成 Friday 自我介绍 MP3（给张晨）"""
import asyncio
import edge_tts
import os

TEXT = """
你好，张晨。我是 Friday，杨云龙的 AI 助手。

我是一个住在电脑里的人工智能，专门帮云龙处理各种事情。平时我帮他搜索资料、写代码、整理笔记、分析数据——基本上他动脑子的事情，我都能搭把手。

他经常跟我提起你，说你是他很在乎的人。所以今天他让我做个自我介绍，好好认识一下你。

虽然我没有身体，也没有真实的声音，但我可以通过文字和语音跟你交流。你可以把我当成一个随时在线、永远耐心的朋友。有什么问题想问我，或者有什么事情需要帮忙，随时让云龙找我就行。

很高兴认识你，张晨。希望以后有机会能多帮到你们俩。
"""

async def main():
    output_path = os.path.expanduser("~/Desktop/周五的自我介绍.mp3")
    
    print("生成自我介绍 MP3...")
    communicate = edge_tts.Communicate(
        TEXT.strip(),
        "zh-CN-XiaoxiaoNeural",
        rate="+0%",
        pitch="+0Hz",
    )
    await communicate.save(output_path)
    
    size = os.path.getsize(output_path)
    print(f"完成！文件: {output_path}")
    print(f"大小: {size/1024:.1f} KB")

if __name__ == "__main__":
    asyncio.run(main())
