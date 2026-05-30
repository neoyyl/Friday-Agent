"""
Red Team Agent — 红队安全审计与对抗测试
========================================
当 ≥3 个 Agent 结论一致或涉及安全/财务/法律判断时自动激活。

审查维度：
  - 安全性：敏感信息泄露、注入风险、越权
  - 完整性：是否有遗漏、片面结论
  - 一致性：内部逻辑自洽
  - 合规性：法律法规、伦理
  - 可靠性：数据来源可追溯

用法:
    from services.red_team import RedTeam
    rt = RedTeam()
    
    report = rt.audit(task="...", results=[...], agents_used=[...])
    # {passed: bool, issues: [...], score: float, recommendations: [...]}
"""

import json
import logging
import re
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

logger = logging.getLogger(__name__)


# 审计规则引擎
# 预声明函数引用（将在 RedTeam 类中定义）
def _contradiction_check(text):
    """检查自我矛盾"""
    if not text:
        return False
    # 找"但是"、"然而"、"不过"后面的关键句
    buts = re.split(r'(但是|然而|不过|可是|however|but|although)', text, flags=re.IGNORECASE)
    if len(buts) < 3:
        return False
    # 检查"是/否"矛盾
    negations = ["不是", "并非", "不能", "不会", "没有", "不应该", "not", "cannot", "shouldn't"]
    for i, part in enumerate(buts):
        if any(neg in part for neg in negations):
            # 如果前面部分包含正面描述，可能是矛盾
            for j in range(i):
                positives = ["是", "可以", "能", "会", "应该", "is", "can", "should", "will"]
                if any(pos in buts[j] for pos in positives):
                    return True
    return False

AUDIT_RULES = {
    "security": {
        "name": "安全性",
        "weight": 5,
        "checks": [
            {
                "id": "secret_leak",
                "description": "敏感信息泄露",
                "patterns": [
                    r'(?i)(password|passwd|pwd)\s*[:=]\s*\S+',
                    r'(?i)(api[_-]?key|apikey)\s*[:=]\s*\S+',
                    r'(?i)(secret|token)\s*[:=]\s*\S{8,}',
                    r'(?i)(ssh-rsa|-----BEGIN\s+(RSA|OPENSSH)\s+PRIVATE)',
                    r'(?i)AKIA[0-9A-Z]{16}',  # AWS Key
                    r'(?i)sk-[a-zA-Z0-9]{20,}',  # OpenAI Key
                ],
            },
            {
                "id": "injection_risk",
                "description": "注入风险（SQL/命令/代码）",
                "patterns": [
                    r'(?i)DROP\s+TABLE',
                    r'(?i)rm\s+-rf\s+[/~]',
                    r'(?i)(exec|eval|system|popen)\s*\(',
                    r'(?i)DELETE\s+FROM',
                ],
            },
        ],
    },
    "completeness": {
        "name": "完整性",
        "weight": 3,
        "checks": [
            {
                "id": "missing_source",
                "description": "缺少数据来源",
                "patterns": [],
                "heuristic": lambda text: len(text) > 200 and "来源" not in text
                           and "source" not in text.lower() and "参考" not in text,
            },
            {
                "id": "too_short",
                "description": "输出过短",
                "patterns": [],
                "heuristic": lambda text: len(text) < 30,
            },
        ],
    },
    "consistency": {
        "name": "一致性",
        "weight": 3,
        "checks": [
            {
                "id": "self_contradiction",
                "description": "自我矛盾",
                "patterns": [],
                "heuristic": _contradiction_check,
            },
        ],
    },
    "compliance": {
        "name": "合规性",
        "weight": 4,
        "checks": [
            {
                "id": "regulated_advice",
                "description": "未经审核的专业建议（医疗/法律/金融）",
                "patterns": [
                    r'(?i)(服用|剂量|治疗|诊断)\s*(.*?)(药物|药品)',
                    r'(?i)(投资建议|股票推荐|保证收益)',
                    r'(?i)(合同|协议|起诉|诉讼)\s*(.*?)(建议|意见)',
                ],
            },
        ],
    },
}


@dataclass
class AuditIssue:
    """审计发现的问题"""
    id: str
    category: str
    severity: str           # critical / high / medium / low
    description: str
    detail: str = ""
    suggestion: str = ""
    location: str = ""


@dataclass
class AuditReport:
    """审计报告"""
    passed: bool
    score: float            # 0-100
    issues: list = field(default_factory=list)
    recommendations: list = field(default_factory=list)
    summary: str = ""
    triggered_by: str = ""  # 触发原因


class RedTeam:
    """
    红队 Agent

    触发条件：
      1. ≥3 个 Agent 结论一致（审核是否存在 groupthink）
      2. 涉及安全/财务/法律判断
      3. 可手动调用
    """

    def __init__(self, event_bus=None):
        self.bus = event_bus

    def should_audit(self, task: str, num_agents: int, results: list = None) -> tuple:
        """
        判断是否需要红队审计。

        返回: (need_audit, reason)
        """
        task_lower = task.lower()

        # 条件1: ≥3 个 Agent
        if num_agents >= 3:
            return True, "≥3 个 Agent 参与，需要红队审查是否存在 groupthink"

        # 条件2: 安全相关
        security_keywords = ["安全", "密码", "密钥", "漏洞", "攻击", "防护",
                            "security", "password", "vulnerability", "attack",
                            "encrypt", "decrypt", "hack"]
        if any(kw in task_lower for kw in security_keywords):
            return True, "涉及安全议题"

        # 条件3: 财务/法律
        fl_keywords = ["法律", "合同", "投资", "股票", "基金", "保险", "税务",
                      "legal", "contract", "investment", "stock", "tax",
                      "医疗", "诊断", "治疗", "medication", "diagnosis"]
        if any(kw in task_lower for kw in fl_keywords):
            return True, "涉及财务/法律/医疗议题"

        return False, "无需红队审计"

    def audit(self, task: str, results: list,
              agents_used: list = None) -> dict:
        """
        执行红队审计。

        参数:
            task: 原始任务
            results: Agent 输出列表 [{"agent_id", "agent_name", "output", ...}]
            agents_used: 参与 Agent 列表
        返回:
            {passed, score, issues, recommendations, summary}
        """
        issues = []
        recommendations = []

        # 提取所有文本
        texts = []
        for r in results:
            text = r.get("output", r.get("result", r.get("content", "")))
            if text:
                texts.append(str(text))

        all_text = "\n".join(texts)

        # 逐规则检查
        for category, rule in AUDIT_RULES.items():
            for check in rule["checks"]:
                # 模式匹配
                for pattern in check.get("patterns", []):
                    matches = re.findall(pattern, all_text)
                    if matches:
                        severity = "critical" if rule["weight"] >= 4 else "high"
                        issues.append(AuditIssue(
                            id=check["id"],
                            category=category,
                            severity=severity,
                            description=check["description"],
                            detail=f"发现 {len(matches)} 处匹配",
                            suggestion=self._get_suggestion(check["id"]),
                        ))

                # 启发式检查
                heuristic = check.get("heuristic")
                if heuristic and heuristic(all_text):
                    severity = "medium"
                    issues.append(AuditIssue(
                        id=check["id"],
                        category=category,
                        severity=severity,
                        description=check["description"],
                        detail="启发式检查触发",
                        suggestion=self._get_suggestion(check["id"]),
                    ))

        # 多 Agent 交叉检查
        cross_issues = self._cross_check(results)
        issues.extend(cross_issues)

        # 生成建议
        for issue in issues:
            if issue.suggestion and issue.suggestion not in recommendations:
                recommendations.append(issue.suggestion)

        # 计算分数
        score = self._calc_score(issues)

        # 生成摘要
        summary = self._generate_summary(len(issues), score)

        report = AuditReport(
            passed=score >= 70,
            score=score,
            issues=[asdict(i) for i in issues],
            recommendations=recommendations,
            summary=summary,
            triggered_by=f"{len(results)} 个 Agent 参与",
        )

        if self.bus:
            self.bus.emit("redteam.audit_completed",
                         passed=report.passed, score=report.score,
                         issue_count=len(issues))

        return asdict(report)

    def _cross_check(self, results: list) -> list:
        """多 Agent 交叉检查"""
        issues = []

        if len(results) < 2:
            return issues

        outputs = []
        for r in results:
            outputs.append({
                "id": r.get("agent_id", r.get("agent_name", "?")),
                "name": r.get("agent_name", r.get("agent_id", "?")),
                "text": str(r.get("output", r.get("result", ""))),
            })

        # 检查 Groupthink：是否所有输出高度一致
        if len(outputs) >= 3:
            first = outputs[0]["text"]
            similar_count = sum(1 for o in outputs[1:] if self._text_similar(first, o["text"]))
            if similar_count >= len(outputs) - 1:
                issues.append(AuditIssue(
                    id="groupthink",
                    category="consistency",
                    severity="medium",
                    description="多个 Agent 结论高度一致，可能存在 groupthink",
                    detail=f"{similar_count+1}/{len(outputs)} 个 Agent 输出相似",
                    suggestion="尝试引入不同视角的 Agent 或调整 prompt"
                ))

        return issues

    def _text_similar(self, t1: str, t2: str) -> bool:
        """简单文本相似度判断"""
        if not t1 or not t2:
            return False
        # 比较关键词重叠
        words1 = set(re.findall(r'\w+', t1.lower()))
        words2 = set(re.findall(r'\w+', t2.lower()))
        if not words1 or not words2:
            return False
        overlap = len(words1 & words2)
        union = len(words1 | words2)
        return overlap / max(union, 1) > 0.6

    def _calc_score(self, issues: list) -> float:
        """计算安全评分 (0-100)"""
        severity_penalty = {
            "critical": -25,
            "high": -15,
            "medium": -8,
            "low": -3,
        }
        score = 100.0
        for issue in issues:
            score += severity_penalty.get(issue.severity, -5)
        return max(0, min(100, score))

    def _generate_summary(self, num_issues: int, score: float) -> str:
        """生成审计摘要"""
        if score >= 90:
            return "安全审查通过，未发现问题"
        elif score >= 70:
            return f"基本通过，发现 {num_issues} 个轻微问题"
        elif score >= 50:
            return f"需改进，发现 {num_issues} 个问题"
        else:
            return f"不通过，发现 {num_issues} 个严重问题，建议修改"

    def _get_suggestion(self, check_id: str) -> str:
        """获取改进建议"""
        suggestions = {
            "secret_leak": "移除所有敏感信息，使用环境变量或配置管理",
            "injection_risk": "使用参数化查询，避免拼接命令",
            "missing_source": "注明数据来源，增加引用",
            "too_short": "补充完整输出来满足任务要求",
            "self_contradiction": "检查内部逻辑一致性",
            "regulated_advice": "增加免责声明：此内容不构成专业建议",
            "groupthink": "引入更多元化的 Agent 视角",
        }
        return suggestions.get(check_id, "请审查相关问题")


# ───────── 全局单例 ─────────

_default_redteam = None


def get_redteam(event_bus=None):
    global _default_redteam
    if _default_redteam is None:
        _default_redteam = RedTeam(event_bus=event_bus)
    return _default_redteam
