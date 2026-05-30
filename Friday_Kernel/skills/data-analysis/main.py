"""数据分析技能 - CSV/JSON 数据处理"""
import os
import csv
import json
import re
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class DataAnalysisSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="data-analysis",
            name="数据分析",
            version="1.0.0",
            description="数据分析与可视化，支持 CSV/JSON 数据处理",
            author="Friday",
            capabilities=["data", "analysis", "数据", "分析", "chart", "图表", "csv", "excel"],
            tags=["utility", "data"],
            icon="📊",
        )

    async def handle(self, context: dict) -> SkillResult:
        query = context.get("query", "")
        params = context.get("params", {})
        file_path = params.get("file_path") or self._extract_path(query)

        if file_path and os.path.exists(file_path):
            return await self._analyze_file(file_path, query)
        else:
            return self._provide_guide(query)

    def _extract_path(self, query: str) -> str:
        m = re.search(r"[A-Za-z]:\\[^\s\"']+|/[^\s\"']+", query)
        return m.group(0) if m else ""

    async def _analyze_file(self, file_path: str, query: str) -> SkillResult:
        ext = os.path.splitext(file_path)[1].lower()
        try:
            if ext == ".csv":
                return self._analyze_csv(file_path)
            elif ext == ".json":
                return self._analyze_json(file_path)
            elif ext in (".xlsx", ".xls"):
                return create_skill_result("Excel 分析需要 openpyxl，请运行: pip install openpyxl")
            else:
                return create_skill_result(f"不支持的文件格式: {ext}")
        except Exception as e:
            return create_skill_result(f"分析失败: {e}")

    def _analyze_csv(self, file_path: str) -> SkillResult:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            rows = list(reader)

        if not rows:
            return create_skill_result("CSV 文件为空")

        headers = rows[0] if rows else []
        data_rows = rows[1:] if len(rows) > 1 else []
        numeric_cols = []

        for i, h in enumerate(headers):
            try:
                for row in data_rows[:10]:
                    if row[i]:
                        float(row[i].replace(",", ""))
                numeric_cols.append(i)
            except (ValueError, IndexError):
                pass

        lines = [f"📊 CSV 分析: {os.path.basename(file_path)}\n"]
        lines.append(f"📏 行数: {len(data_rows)} | 列数: {len(headers)}")
        lines.append(f"📋 列名: {', '.join(headers)}\n")

        for col_idx in numeric_cols[:5]:
            values = []
            for row in data_rows:
                try:
                    v = float(row[col_idx].replace(",", ""))
                    values.append(v)
                except (ValueError, IndexError):
                    pass
            if values:
                h = headers[col_idx]
                lines.append(f"  {h}: min={min(values):.2f} max={max(values):.2f} avg={sum(values)/len(values):.2f}")

        return create_skill_result("\n".join(lines), data={"rows": len(data_rows), "cols": len(headers)})

    def _analyze_json(self, file_path: str) -> SkillResult:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            data = json.load(f)

        if isinstance(data, list):
            return create_skill_result(
                f"📊 JSON 分析: {os.path.basename(file_path)}\n"
                f"📏 数组长度: {len(data)}\n"
                f"📋 类型: Array of {type(data[0]).__name__ if data else 'empty'}"
            )
        elif isinstance(data, dict):
            return create_skill_result(
                f"📊 JSON 分析: {os.path.basename(file_path)}\n"
                f"📏 顶层键: {len(data)}\n"
                f"📋 键列表: {', '.join(list(data.keys())[:20])}"
            )
        return create_skill_result(f"JSON 类型: {type(data).__name__}")

    def _provide_guide(self, query: str) -> SkillResult:
        return create_skill_result(
            "📊 数据分析助手\n\n"
            "支持的操作:\n"
            "1. 分析 CSV 文件: '分析 data.csv'\n"
            "2. 分析 JSON 文件: '分析 data.json'\n"
            "3. 提供文件路径，我会自动检测格式并分析\n\n"
            "分析内容包括:\n"
            "- 数据概览（行列数、字段名）\n"
            "- 数值列统计（最小/最大/平均）\n"
            "- 数据类型检测\n\n"
            "💡 请提供数据文件的完整路径"
        )
