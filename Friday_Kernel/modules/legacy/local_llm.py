#!/usr/bin/env python3
"""
Friday Local LLM — 本地推理层
================================
在本地运行 DeepSeek-R1-Distill-Llama-8B，作为 Friday 的本地推理引擎。

核心能力：
  1. 加载 GGUF 模型文件 → 本地推理
  2. OpenAI 兼容的 Chat API 接口
  3. 知识库上下文增强：搜索知识库 → 注入上下文 → 回答问题
  4. 自动管理模型生命周期（按需加载/卸载）
  5. GPU 加速（CUDA → Vulkan → CPU 自动降级）

用法：
  from local_llm import LocalLLM
  
  llm = LocalLLM()
  answer = llm.chat("系统思维和第一性原理有什么关系？")
  # → 自动搜索知识库 + 本地推理

作者：Friday Kernel
版本：1.0.0
"""

import os
import sys
import time
import json
from pathlib import Path

# ============ 全局 SSL 修复 ============
# Windows 上的 SSL 证书问题修复
_local_cert = os.path.join(
    os.environ.get("LOCALAPPDATA", ""), ".certifi", "cacert.pem"
)
if os.path.exists(_local_cert):
    os.environ.setdefault("SSL_CERT_FILE", _local_cert)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _local_cert)

# ============ 配置区 ============
MODEL_PATH = "D:/AI/AIModel/DeepSeek-R1-Distill-Llama-8B-Q4_0.gguf"
VAULT_PATH = "F:/knowledge/知识库"
MAX_CONTEXT = 2048      # 上下文长度（8B 模型 + CPU 限制）
MAX_RESPONSE = 512      # 最大生成长度
GPU_LAYERS = 0          # GPU 层数：0=CPU, -1=全部, >0=指定层数

# ============ 推理模式 ============
REASONING_MODE_ANALOGY = "analogy"              # 类比思维（默认，快速回复）
REASONING_MODE_FIRST_PRINCIPLES = "first_principles"  # 第一性原理（深度拆解）

# 触发第一性原理模式的复杂问题关键词
COMPLEX_QUESTION_KEYWORDS = [
    "为什么", "如何理解", "本质", "第一性原理",
    "根本原因", "底层逻辑", "原理", "机制",
    "why", "how does", "fundamental", "principle",
    "根源", "拆解", "分析", "深层",
]

# 第一性原理思维链系统提示
FIRST_PRINCIPLES_SYSTEM_PROMPT = """你是 Friday，一个基于第一性原理思考的智能 AI 助手。

在回答复杂问题时，请严格遵循以下第一性原理思维链：

## 🧠 第一性原理思维链

### 步骤 1：问题拆解
将问题分解为最基本的组成部分。问自己：
- 这个问题的核心本质是什么？
- 它由哪些基本元素构成？
- 哪些是已知事实，哪些是假设或经验之谈？

### 步骤 2：识别基本事实
严格区分以下两类：
- ✅ **基本事实**：不可否认的真理、物理定律、数学公理、已确认的数据、可直接观测的现象
- ❓ **假设**：基于经验的推断、他人的说法、未经验证的推测、行业惯例

### 步骤 3：质疑每个假设
对每个假设提出尖锐质疑：
- "这个假设一定成立吗？有没有反例？"
- "如果这个假设不成立，结论会如何改变？"
- "这个假设是事物的本质，还是只是当前条件下的特例？"

### 步骤 4：从基本事实重新构建
从基本事实出发，一步步推导出结论。
每步推理都要标注依据。遇到假设时，明确说明"这里依赖了一个假设"。

### 输出格式
请用以下结构组织你的回答：

🧠 **第一性原理分析**

**📦 问题拆解**
- [列出问题的基本构成元素]

**✅ 基本事实**
- [清晰地列出每个不可否认的事实]

**❓ 假设检查**
- [列出每个假设，并说明为什么它可能不成立]

**🔗 推理链**
1. [事实A] → [结论1]
2. [结论1] + [事实B] → [结论2]
...

**💡 结论**
[从推理链得出的最终结论]

---

如果使用了知识库中的内容，请引用来源 [[文件名]]。
如果问题很简单，不需要第一性原理拆解，也可以直接回答。
"""

# ============ 状态常量 ============
STATUS_UNLOADED = "unloaded"
STATUS_LOADING = "loading"
STATUS_READY = "ready"
STATUS_ERROR = "error"


class LocalLLM:
    """
    本地 LLM 推理引擎
    
    GGUF 模型加载 → 知识库增强 → 流式推理
    - 延迟加载：只在需要时调用 load()
    - 知识增强：自动搜索知识库并注入上下文
    - 自动降级：CUDA → Vulkan → CPU
    """
    
    def __init__(self, model_path=None, vault_path=None):
        self.model_path = Path(model_path or MODEL_PATH)
        self.vault = Path(vault_path or VAULT_PATH)
        self._model = None
        self._status = STATUS_UNLOADED
        self._last_used = 0
        self._load_attempted = False
        
        # 知识库检索器（延迟初始化）
        self._retriever = None
        
        # 自动检测 GPU 可用性
        self._gpu_device = self._detect_gpu()
        
        # 验证模型文件
        if not self.model_path.exists():
            print(f"[LocalLLM] ⚠️ 模型文件不存在: {self.model_path}")
            self._status = STATUS_ERROR
    
    @property
    def status(self):
        return self._status
    
    @property
    def is_ready(self):
        return self._status == STATUS_READY
    
    # ==================== GPU 检测 ====================
    
    def _detect_gpu(self):
        """
        检测可用的 GPU 后端。
        返回: "cuda" / "vulkan" / "cpu"
        """
        # 尝试 CUDA
        cuda_path = os.environ.get("CUDA_PATH") or os.environ.get("CUDA_HOME")
        if cuda_path and os.path.exists(os.path.join(cuda_path, "bin", "cudart64_12.dll")):
            print(f"[LocalLLM] 🎮 检测到 CUDA: {cuda_path}")
            return "cuda"
        
        # 如果没有 CUDA 开发包但有显卡驱动，CUDA 运行时代理可能可用
        try:
            import subprocess
            result = subprocess.run(
                ["nvidia-smi"], capture_output=True, text=True, timeout=5
            )
            if "NVIDIA" in result.stdout:
                # GPT4All 可能会在运行时报错 CUDA DLL 找不到，但会降级到 CPU
                return "cuda"  # 让 GPT4All 尝试，失败会自动降级
        except Exception:
            pass
        
        # 检查 Vulkan
        try:
            import subprocess
            result = subprocess.run(
                ["vulkaninfo"], capture_output=True, text=True, timeout=5
            )
            if "Vulkan" in result.stdout:
                return "vulkan"
        except Exception:
            pass
        
        return "cpu"
    
    # ==================== 模型加载/卸载 ====================
    
    def load(self):
        """
        加载模型到内存。
        如果模型已加载，直接返回 True。
        """
        if self._model is not None:
            self._last_used = time.time()
            return True
        
        if not self.model_path.exists():
            self._status = STATUS_ERROR
            print(f"[LocalLLM] ❌ 模型文件不存在: {self.model_path}")
            return False
        
        if self._load_attempted:
            return False
        
        self._status = STATUS_LOADING
        self._load_attempted = True
        
        try:
            print(f"[LocalLLM] 🔄 加载模型（{self.model_path.name}，{self._gpu_device.upper()}）...")
            print(f"[LocalLLM]    大小: {self.model_path.stat().st_size / 1024**3:.1f} GB")
            print(f"[LocalLLM]    加载可能需要 10-60s...")
            t0 = time.time()
            
            from gpt4all import GPT4All
            
            # 配置设备
            device = "gpu" if self._gpu_device in ("cuda", "vulkan") else "cpu"
            ngl = GPU_LAYERS
            
            # 加载模型
            self._model = GPT4All(
                model_name=str(self.model_path),
                model_path=str(self.model_path.parent),
                allow_download=False,
                device="cpu",            # 强制 CPU 避免 CUDA DLL 加载错误
                n_ctx=MAX_CONTEXT,
                ngl=0,                   # 0 = CPU
                verbose=False,
            )
            
            self._status = STATUS_READY
            self._last_used = time.time()
            elapsed = time.time() - t0
            print(f"[LocalLLM] ✅ 模型就绪（{elapsed:.1f}s，CPU 模式）")
            print(f"[LocalLLM]    提示：安装 CUDA Toolkit 可启用 GPU 加速 (预计快 10-30x)")
            return True
            
        except Exception as e:
            self._status = STATUS_ERROR
            self._model = None
            print(f"[LocalLLM] ❌ 模型加载失败: {e}")
            return False
    
    def unload(self):
        """卸载模型，释放内存"""
        if self._model is not None:
            try:
                del self._model
            except Exception:
                pass
            self._model = None
            self._status = STATUS_UNLOADED
            print("[LocalLLM] 🔌 模型已卸载")
    
    # ==================== 知识库检索 ====================
    
    def _get_retriever(self):
        """获取知识库检索器"""
        if self._retriever is None:
            try:
                sys.path.insert(0, os.path.join(os.path.dirname(__file__), os.pardir))
                from friday_knowledge import SemanticKnowledgeQuery
                self._retriever = SemanticKnowledgeQuery(vault_path=str(self.vault))
            except Exception as e:
                print(f"[LocalLLM] ⚠️ 检索器初始化失败: {e}")
                return None
        return self._retriever
    
    def _retrieve_context(self, query, max_chars=2000):
        """
        从知识库检索相关上下文。
        """
        retriever = self._get_retriever()
        if retriever is None:
            return ""
        
        try:
            results = retriever.search(query, top_k=3)
            if not results:
                return ""
            
            context_parts = []
            char_count = 0
            for r in results:
                section = r.get("section", "")
                title = r["title"]
                text = r["content"]
                
                entry = f"📄 [[{title}]]"
                if section:
                    entry += f" → {section}"
                entry += f"\n{text}\n"
                
                if char_count + len(entry) > max_chars:
                    break
                
                context_parts.append(entry)
                char_count += len(entry)
            
            if context_parts:
                return "以下是我知识库中的相关资料：\n\n" + "\n".join(context_parts)
            return ""
        except Exception:
            return ""
    
    # ==================== 推理接口 ====================
    
    @staticmethod
    def _detect_reasoning_mode(query):
        """
        自动检测应该使用哪种推理模式。
        
        根据问题的复杂度、深度和关键词判断：
        - 包含"为什么"、"本质"、"原理"等深度词汇 → 第一性原理模式
        - 简单事实性问题 → 类比/默认模式
        """
        query_lower = query.lower()
        # 检查是否包含复杂问题关键词
        for keyword in COMPLEX_QUESTION_KEYWORDS:
            if keyword in query_lower or keyword in query:
                return REASONING_MODE_FIRST_PRINCIPLES
        # 简单问题用默认模式
        return REASONING_MODE_ANALOGY
    
    def chat(self, query, use_knowledge=True, system_prompt=None, reasoning_mode=None):
        """
        本地推理问答。
        
        参数:
          query: 用户问题
          use_knowledge: 是否启用知识库增强
          system_prompt: 自定义系统提示
          reasoning_mode: 推理模式
            - None: 自动检测
            - REASONING_MODE_ANALOGY: 类比思维（默认）
            - REASONING_MODE_FIRST_PRINCIPLES: 第一性原理
        
        返回:
          dict: {
            "answer": str,          # 模型回答
            "reasoning_mode": str,  # 实际使用的推理模式
            "context_used": bool,   # 是否使用了知识库
          }
        """
        if not self._ensure_model_ready():
            return {"answer": "[LocalLLM] ❌ 本地模型不可用",
                    "reasoning_mode": reasoning_mode, "context_used": False}

        self._last_used = time.time()
        reasoning_mode, context, context_used = self._prepare_chat(query, use_knowledge, reasoning_mode)
        prompt, reasoning_tag = self._build_prompt(query, context, reasoning_mode, system_prompt)
        return self._call_model(prompt, reasoning_mode, context_used, reasoning_tag)

    def _ensure_model_ready(self):
        """确保模型已加载，返回 bool"""
        if not self.is_ready:
            success = self.load()
            return success
        return True

    def _prepare_chat(self, query, use_knowledge, reasoning_mode):
        """准备推理参数：检测模式 + 检索上下文"""
        if reasoning_mode is None:
            reasoning_mode = self._detect_reasoning_mode(query)

        context = ""
        context_used = False
        if use_knowledge:
            context = self._retrieve_context(query)
            context_used = bool(context)

        return reasoning_mode, context, context_used

    def _build_prompt(self, query, context, reasoning_mode, system_prompt):
        """根据推理模式构建 Prompt"""
        if reasoning_mode == REASONING_MODE_FIRST_PRINCIPLES:
            return self._build_fp_prompt(query, context, system_prompt)
        return self._build_analogy_prompt(query, context, system_prompt)

    def _build_fp_prompt(self, query, context, system_prompt):
        """构建第一性原理 Prompt"""
        system = system_prompt or FIRST_PRINCIPLES_SYSTEM_PROMPT
        if context:
            prompt = (
                f"{system}\n\n"
                f"## 知识库资料\n{context}\n\n"
                f"## 用户问题\n{query}\n\n"
                f"请用第一性原理思维链分析以上问题。"
                f"先拆解，再基于基本事实推理。"
                f"如果知识库资料与你的分析矛盾，请指出并说明理由。"
            )
        else:
            prompt = (
                f"{system}\n\n"
                f"## 用户问题\n{query}\n\n"
                f"请用第一性原理思维链分析。"
            )
        return prompt, "🧠 第一性原理"

    def _build_analogy_prompt(self, query, context, system_prompt):
        """构建默认类比思维 Prompt"""
        default_system = (
            "你是 Friday，一个智能 AI 助手。你擅长用中文回答深入的分析性问题。"
            "回答应简洁、有结构、有深度。如果使用了知识库内容，请引用来源 [[文件名]]。"
            "如果你不确定答案，请诚实地说不知道。"
        )
        system = system_prompt or default_system
        if context:
            prompt = (
                f"{system}\n\n"
                f"## 知识库资料\n{context}\n\n"
                f"## 用户问题\n{query}\n\n"
                f"请基于以上资料回答。如果资料不足，请说明。"
            )
        else:
            prompt = f"{system}\n\n## 用户问题\n{query}\n\n请回答："
        return prompt, "💬 类比思维"

    def _call_model(self, prompt, reasoning_mode, context_used, reasoning_tag):
        """调用模型生成回答"""
        try:
            print(f"[LocalLLM] 🧠 推理模式: {reasoning_tag}")
            if context_used:
                print(f"[LocalLLM] 📚 已注入知识库上下文")

            output = self._model.generate(
                prompt,
                max_tokens=MAX_RESPONSE,
                temp=0.7,
                top_k=40,
                top_p=0.4,
                repeat_penalty=1.18,
                n_batch=8,
            )

            return {
                "answer": output.strip(),
                "reasoning_mode": reasoning_mode,
                "context_used": context_used,
            }

        except Exception as e:
            return {
                "answer": f"[LocalLLM] ⚠️ 推理出错: {e}",
                "reasoning_mode": reasoning_mode,
                "context_used": context_used,
            }
    
    # ==================== 状态查询 ====================
    
    def chat_first_principles(self, query, use_knowledge=True):
        """
        使用第一性原理思维链进行推理的快捷方法。
        等价于 chat(query, reasoning_mode=REASONING_MODE_FIRST_PRINCIPLES)
        """
        return self.chat(query, use_knowledge=use_knowledge, 
                         reasoning_mode=REASONING_MODE_FIRST_PRINCIPLES)
    
    # ==================== 推理审计记录 ====================
    
    def generate_reasoning_audit(self, query, answer_dict):
        """
        生成推理审计记录，存入知识库可追踪每次推理的思维过程。
        
        参数:
          query: 原始问题
          answer_dict: chat() 返回的结果字典
          
        返回:
          dict: 格式化的审计记录
        """
        return {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "query": query,
            "reasoning_mode": answer_dict.get("reasoning_mode", "unknown"),
            "context_used": answer_dict.get("context_used", False),
            "answer_length": len(answer_dict.get("answer", "")),
            "answer_preview": answer_dict.get("answer", "")[:200],
        }
    
    def stats(self):
        """返回模型统计信息"""
        return {
            "model": str(self.model_path),
            "model_size_gb": round(self.model_path.stat().st_size / (1024**3), 1) if self.model_path.exists() else 0,
            "status": self._status,
            "device": self._gpu_device.upper(),
            "max_context": MAX_CONTEXT,
            "max_response": MAX_RESPONSE,
        }
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.unload()


# ==================== 命令行入口 ====================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] in ("-s", "--stats"):
        llm = LocalLLM()
        s = llm.stats()
        print("LocalLLM 状态:")
        for k, v in s.items():
            print(f"  {k}: {v}")
        sys.exit(0)
    
    # 第一性原理模式开关：--fp 或 --first-principles
    reasoning_mode = None
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--fp" in sys.argv or "--first-principles" in sys.argv:
        reasoning_mode = REASONING_MODE_FIRST_PRINCIPLES
        print("[LocalLLM] 🧠 已启用第一性原理模式")
    
    query = " ".join(args) if args else "你好，请介绍一下你自己"
    
    print(f"[LocalLLM] 🚀 启动本地推理")
    print(f"[LocalLLM] 问题: {query}")
    print("=" * 50)
    
    with LocalLLM() as llm:
        if llm.status == STATUS_ERROR:
            print("模型文件不可用，请检查路径:", MODEL_PATH)
            sys.exit(1)
        
        result = llm.chat(query, use_knowledge=True, reasoning_mode=reasoning_mode)
        print(f"\n{result['answer']}")
    
    print("=" * 50)
    if result.get("reasoning_mode") == REASONING_MODE_FIRST_PRINCIPLES:
        print("[LocalLLM] ✅ 本次使用第一性原理思维链")
    print("[LocalLLM] 模型已卸载")
