# Friday Kernel - 技能注册表

> 自动维护：启动时扫描所有技能目录，输出完整清单

---

## 技能目录分布

| 目录 | 路径 | 用途 |
|:-----|:-----|:------|
| 系统技能 | `F:\AITest\.opencode\skills\` | OpenClaw 预装/系统技能 |
| 用户技能 | `C:\Users\31822\.agents\skills\` | `npx skills add` 安装 |
| 自定义技能 | `F:\AITest\skills\` | ClawHub/手动安装 |

---

## 使用原则

1. **先查表，再做事**：收到任务先在技能速查表中找匹配
2. **技能优先**：有专用技能就不手工操作
3. **特化 > 通用**：如果有特化技能（如 baoyu-translate），优先于通用方法
4. **组合使用**：复杂任务可链式调用多个技能

---

## 按使用频率推荐

### 🔥 高频常用
| 技能 | 场景 | 一句话用法 |
|:-----|:-----|:-----------|
| `baoyu-translate` | 翻译 | "翻译这篇文章" |
| `baoyu-format-markdown` | 排版 | "格式化这个md" |
| `baoyu-compress-image` | 压缩图片 | "压缩这张图" |
| `multi-search-engine` | 搜索 | "帮我搜一下..." |
| `deep-research-pro` | 深度研究 | "深入研究XX主题" |
| `baoyu-url-to-markdown` | 网页转MD | "把这个网页存下来" |
| `summarize` | 总结 | "总结这个链接" |

### ⭐ 内容创作
| 技能 | 场景 | 一句话用法 |
|:-----|:-----|:-----------|
| `baoyu-xhs-images` | 小红书卡片 | "做成小红书卡片" |
| `baoyu-infographic` | 信息图 | "做成信息图" |
| `baoyu-diagram` | 图表 | "画个架构图" |
| `baoyu-cover-image` | 封面图 | "生成封面图" |
| `baoyu-slide-deck` | 幻灯片 | "做成幻灯片" |
| `baoyu-comic` | 漫画 | "做成知识漫画" |
| `brainstorming` | 头脑风暴 | "来个头脑风暴" |
| `writing-plans` | 写作大纲 | "帮我列个提纲" |

### 🔬 学术研究
| 技能 | 场景 | 一句话用法 |
|:-----|:-----|:-----------|
| `academic-deep-research` | 深度研究 | "做深度研究" |
| `academic-research` | 论文搜索 | "搜相关论文" |
| `cnki-advanced-search` | 知网检索 | "在知网搜C刊论文" |
| `deep-learning` | 深度阅读 | "深度消化这篇论文" |
| `academic-pre-review-committee` | 论文审稿 | "帮我审这篇论文" |

### 🛠 开发
| 技能 | 场景 | 一句话用法 |
|:-----|:-----|:-----------|
| `code-mentor` | 编程教学 | "教我写XX代码" |
| `requesting-code-review` | 代码审查 | "审查这段代码" |
| `tdd` | 测试驱动 | "用TDD开发" |
| `excel-xlsx` | Excel操作 | "编辑这个Excel" |
| `word-docx` | Word文档 | "编辑这个Word" |
| `powerpoint-pptx` | PPT演示 | "做份PPT" |

### 📤 发布
| 技能 | 场景 | 一句话用法 |
|:-----|:-----|:-----------|
| `baoyu-post-to-x` | 发X/Twitter | "发到X" |
| `baoyu-post-to-wechat` | 发公众号 | "发到公众号" |
| `baoyu-post-to-weibo` | 发微博 | "发到微博" |
| `wechat-mcp` | 发微信消息 | "发微信给XX" |

---

*自动生成日：2026-05-17*
*下次更新：启动时自动扫描*
