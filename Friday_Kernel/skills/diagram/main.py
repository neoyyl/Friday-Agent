"""图表生成技能 - SVG 流程图/架构图"""
import re
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class DiagramSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="diagram",
            name="图表生成",
            version="1.0.0",
            description="生成流程图、架构图、思维导图等 SVG 图表",
            author="Friday",
            capabilities=["diagram", "chart", "图表", "流程图", "架构图", "思维导图", "flowchart"],
            tags=["creative", "visualization"],
            icon="📐",
        )

    async def handle(self, context: dict) -> SkillResult:
        query = context.get("query", "")
        if not query:
            return create_skill_result("请描述需要生成的图表，例如：'画一个登录流程图' 或 '生成系统架构图'")

        diagram_type = self._detect_type(query)

        if diagram_type == "flowchart":
            return self._generate_flowchart(query)
        elif diagram_type == "mindmap":
            return self._generate_mindmap(query)
        elif diagram_type == "sequence":
            return self._generate_sequence(query)
        elif diagram_type == "architecture":
            return self._generate_architecture(query)
        else:
            return self._generate_generic(query)

    def _detect_type(self, query: str) -> str:
        if any(w in query for w in ["流程", "flowchart", "flow"]):
            return "flowchart"
        if any(w in query for w in ["思维导图", "mindmap", "脑图"]):
            return "mindmap"
        if any(w in query for w in ["时序", "sequence", "序列"]):
            return "sequence"
        if any(w in query for w in ["架构", "architecture", "系统"]):
            return "architecture"
        return "generic"

    def _generate_flowchart(self, query: str) -> SkillResult:
        svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" style="font-family:system-ui">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#666"/></marker></defs>
<rect width="600" height="400" fill="#fafafa" rx="8"/>
<text x="300" y="30" text-anchor="middle" font-size="16" font-weight="bold" fill="#333">流程图</text>
<rect x="225" y="50" width="150" height="40" rx="20" fill="#4f46e5" stroke="none"/><text x="300" y="75" text-anchor="middle" fill="white" font-size="13">开始</text>
<line x1="300" y1="90" x2="300" y2="120" stroke="#666" stroke-width="2" marker-end="url(#arrow)"/>
<rect x="200" y="120" width="200" height="40" rx="4" fill="white" stroke="#4f46e5" stroke-width="2"/><text x="300" y="145" text-anchor="middle" fill="#333" font-size="12">步骤 1</text>
<line x1="300" y1="160" x2="300" y2="190" stroke="#666" stroke-width="2" marker-end="url(#arrow)"/>
<polygon points="300,190 380,220 300,250 220,220" fill="#f59e0b" stroke="none"/><text x="300" y="225" text-anchor="middle" fill="white" font-size="11">判断</text>
<line x1="300" y1="250" x2="300" y2="280" stroke="#666" stroke-width="2" marker-end="url(#arrow)"/>
<text x="310" y="268" font-size="10" fill="#666">是</text>
<rect x="200" y="280" width="200" height="40" rx="4" fill="white" stroke="#10b981" stroke-width="2"/><text x="300" y="305" text-anchor="middle" fill="#333" font-size="12">步骤 2</text>
<line x1="300" y1="320" x2="300" y2="350" stroke="#666" stroke-width="2" marker-end="url(#arrow)"/>
<rect x="225" y="350" width="150" height="40" rx="20" fill="#ef4444" stroke="none"/><text x="300" y="375" text-anchor="middle" fill="white" font-size="13">结束</text>
<line x1="380" y1="220" x2="460" y2="220" stroke="#666" stroke-width="2" marker-end="url(#arrow)"/>
<text x="415" y="213" font-size="10" fill="#666">否</text>
<rect x="460" y="200" width="120" height="40" rx="4" fill="white" stroke="#f59e0b" stroke-width="2"/><text x="520" y="225" text-anchor="middle" fill="#333" font-size="11">处理备选</text>
<line x1="520" y1="240" x2="520" y2="340" stroke="#666" stroke-width="1" stroke-dasharray="4"/><line x1="520" y1="340" x2="375" y2="340" stroke="#666" stroke-width="1" stroke-dasharray="4"/>
</svg>'''
        return create_skill_result(
            f"📐 流程图已生成 (SVG)\n\n"
            f"这是一个通用流程图模板，包含：\n"
            f"- 开始/结束节点（圆角矩形）\n"
            f"- 处理步骤（矩形）\n"
            f"- 判断节点（菱形）\n"
            f"- 连接箭头\n\n"
            f"💡 如需自定义流程，请描述具体的步骤",
            data={"svg": svg, "type": "flowchart"}
        )

    def _generate_mindmap(self, query: str) -> SkillResult:
        topic = re.sub(r"(画|生成|创建|做一个?)\s*(思维导图|mindmap|脑图)\s*", "", query, flags=re.IGNORECASE).strip() or "主题"
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" style="font-family:system-ui">
<rect width="800" height="500" fill="#fafafa" rx="8"/>
<circle cx="400" cy="250" r="50" fill="#4f46e5"/><text x="400" y="255" text-anchor="middle" fill="white" font-size="14" font-weight="bold">{topic[:8]}</text>
<line x1="350" y1="230" x2="200" y2="120" stroke="#94a3b8" stroke-width="2"/>
<circle cx="170" cy="100" r="35" fill="#10b981"/><text x="170" y="105" text-anchor="middle" fill="white" font-size="11">分支 1</text>
<line x1="350" y1="250" x2="150" y2="280" stroke="#94a3b8" stroke-width="2"/>
<circle cx="120" cy="290" r="35" fill="#f59e0b"/><text x="120" y="295" text-anchor="middle" fill="white" font-size="11">分支 2</text>
<line x1="450" y1="230" x2="600" y2="120" stroke="#94a3b8" stroke-width="2"/>
<circle cx="630" cy="100" r="35" fill="#ef4444"/><text x="630" y="105" text-anchor="middle" fill="white" font-size="11">分支 3</text>
<line x1="450" y1="250" x2="650" y2="280" stroke="#94a3b8" stroke-width="2"/>
<circle cx="680" cy="290" r="35" fill="#8b5cf6"/><text x="680" y="295" text-anchor="middle" fill="white" font-size="11">分支 4</text>
<line x1="400" y1="300" x2="400" y2="400" stroke="#94a3b8" stroke-width="2"/>
<circle cx="400" cy="420" r="35" fill="#06b6d4"/><text x="400" y="425" text-anchor="middle" fill="white" font-size="11">分支 5</text>
</svg>'''
        return create_skill_result(
            f"🧠 思维导图已生成: {topic}\n\n"
            f"这是一个思维导图模板，中心主题向外扩展 5 个分支。\n"
            f"💡 如需自定义，请提供具体的分支内容",
            data={"svg": svg, "type": "mindmap", "topic": topic}
        )

    def _generate_sequence(self, query: str) -> SkillResult:
        svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 350" style="font-family:system-ui">
<rect width="600" height="350" fill="#fafafa" rx="8"/>
<text x="300" y="25" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">时序图</text>
<rect x="80" y="40" width="80" height="30" rx="4" fill="#4f46e5"/><text x="120" y="60" text-anchor="middle" fill="white" font-size="11">客户端</text>
<rect x="440" y="40" width="80" height="30" rx="4" fill="#10b981"/><text x="480" y="60" text-anchor="middle" fill="white" font-size="11">服务器</text>
<line x1="120" y1="70" x2="120" y2="320" stroke="#4f46e5" stroke-width="2"/>
<line x1="480" y1="70" x2="480" y2="320" stroke="#10b981" stroke-width="2"/>
<line x1="120" y1="100" x2="470" y2="100" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/><text x="295" y="95" text-anchor="middle" font-size="11" fill="#333">请求</text>
<line x1="480" y1="140" x2="130" y2="140" stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/><text x="295" y="135" text-anchor="middle" font-size="11" fill="#333">响应</text>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#333"/></marker></defs>
</svg>'''
        return create_skill_result(
            f"🔗 时序图已生成\n\n"
            f"这是一个基础时序图模板，展示两个对象之间的消息交互。\n"
            f"💡 如需自定义，请描述具体的交互流程",
            data={"svg": svg, "type": "sequence"}
        )

    def _generate_architecture(self, query: str) -> SkillResult:
        svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 450" style="font-family:system-ui">
<rect width="700" height="450" fill="#fafafa" rx="8"/>
<text x="350" y="25" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">系统架构图</text>
<rect x="250" y="40" width="200" height="50" rx="6" fill="#4f46e5"/><text x="350" y="70" text-anchor="middle" fill="white" font-size="12" font-weight="bold">前端 (React)</text>
<line x1="350" y1="90" x2="350" y2="130" stroke="#666" stroke-width="2" marker-end="url(#arrow2)"/>
<rect x="250" y="130" width="200" height="50" rx="6" fill="#f59e0b"/><text x="350" y="160" text-anchor="middle" fill="white" font-size="12" font-weight="bold">API 网关</text>
<line x1="280" y1="180" x2="150" y2="230" stroke="#666" stroke-width="2" marker-end="url(#arrow2)"/>
<line x1="420" y1="180" x2="550" y2="230" stroke="#666" stroke-width="2" marker-end="url(#arrow2)"/>
<rect x="60" y="230" width="180" height="50" rx="6" fill="#10b981"/><text x="150" y="260" text-anchor="middle" fill="white" font-size="11" font-weight="bold">用户服务</text>
<rect x="460" y="230" width="180" height="50" rx="6" fill="#ef4444"/><text x="550" y="260" text-anchor="middle" fill="white" font-size="11" font-weight="bold">数据服务</text>
<line x1="150" y1="280" x2="150" y2="330" stroke="#666" stroke-width="2" marker-end="url(#arrow2)"/>
<line x1="550" y1="280" x2="550" y2="330" stroke="#666" stroke-width="2" marker-end="url(#arrow2)"/>
<rect x="70" y="330" width="160" height="50" rx="6" fill="#8b5cf6"/><text x="150" y="360" text-anchor="middle" fill="white" font-size="11" font-weight="bold">PostgreSQL</text>
<rect x="470" y="330" width="160" height="50" rx="6" fill="#06b6d4"/><text x="550" y="360" text-anchor="middle" fill="white" font-size="11" font-weight="bold">Redis 缓存</text>
<defs><marker id="arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#666"/></marker></defs>
</svg>'''
        return create_skill_result(
            f"🏗️ 系统架构图已生成\n\n"
            f"这是一个经典三层架构模板：\n"
            f"- 前端层 (React)\n"
            f"- API 网关层\n"
            f"- 服务层 (用户/数据)\n"
            f"- 数据层 (PostgreSQL/Redis)\n\n"
            f"💡 如需自定义，请描述具体的组件和服务",
            data={"svg": svg, "type": "architecture"}
        )

    def _generate_generic(self, query: str) -> SkillResult:
        return create_skill_result(
            "📐 图表生成助手\n\n"
            "支持的图表类型:\n"
            "1. 流程图: '画一个登录流程图'\n"
            "2. 思维导图: '生成 XX 的思维导图'\n"
            "3. 时序图: '画一个 API 调用时序图'\n"
            "4. 架构图: '生成系统架构图'\n\n"
            "每个图表都会生成 SVG 格式，可直接在浏览器中查看。\n"
            "💡 请描述具体的图表需求"
        )
