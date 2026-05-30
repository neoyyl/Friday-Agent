"""
Skill Marketplace — 技能市场
=================================
Friday OS 技能分发与管理中心。

功能:
  1. 版本管理 — SemVer 解析、比较、依赖范围匹配
  2. 依赖解析 — 拓扑排序、循环检测、自动安装依赖
  3. 一键安装 — 从本地目录 / GitHub / 注册表安装技能
  4. 一键更新 — 检测新版本、平滑升级
  5. 搜索发现 — 按名称/能力/标签搜索已注册技能包
  6. 收藏/评分 — 用户偏好保存、评分排序

集成:
  - SkillManager: 安装后自动加载，卸载后自动删除
  - SkillService: 通过 SkillService 暴露给 Web API
  - EventBus: skill.market.installed / updated / uninstalled 事件
  - 数据存储: {skills_dir}/.market/registry.json + ratings.json + favorites.json

用法:
    market = SkillMarket(skills_dir="./skills", manager=skill_manager)
    market.install("./downloads/weather-skill")     # 从本地安装
    market.install_from_github("user/repo")          # 从 GitHub 安装
    market.search("天气")                             # 搜索
    market.update("weather")                         # 更新
    market.rate("weather", 5, "非常好用！")            # 评分
"""

import asyncio
import concurrent.futures
import json
import logging
import os
import re
import shutil
import tempfile
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional

from skills.manifest import load_manifest_from_file, MANIFEST_FILENAME

logger = logging.getLogger("friday.skill.market")

# ───────── SemVer 工具 ─────────

SEMVER_RE = re.compile(r'^(\d+)\.(\d+)\.(\d+)(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$')


@dataclass(frozen=True)
class SemVer:
    """语义化版本号"""
    major: int
    minor: int
    patch: int
    pre_release: str = ""
    build: str = ""

    @classmethod
    def parse(cls, version: str) -> Optional["SemVer"]:
        """解析版本字符串"""
        m = SEMVER_RE.match(version.strip())
        if not m:
            return None
        return cls(
            major=int(m.group(1)),
            minor=int(m.group(2)),
            patch=int(m.group(3)),
            pre_release=m.group(4) or "",
            build=m.group(5) or "",
        )

    def __str__(self) -> str:
        v = f"{self.major}.{self.minor}.{self.patch}"
        if self.pre_release:
            v += self.pre_release
        if self.build:
            v += self.build
        return v

    def __lt__(self, other: "SemVer") -> bool:
        """版本比较（忽略 build 元数据）"""
        if self.major != other.major:
            return self.major < other.major
        if self.minor != other.minor:
            return self.minor < other.minor
        if self.patch != other.patch:
            return self.patch < other.patch
        # 有 pre-release 的版本更小
        if self.pre_release and not other.pre_release:
            return True
        if not self.pre_release and other.pre_release:
            return False
        return self.pre_release < other.pre_release

    def __le__(self, other):
        return self < other or self == other

    def __gt__(self, other):
        return not (self <= other)

    def __ge__(self, other):
        return not (self < other)

    def satisfies(self, range_spec: str) -> bool:
        """
        检查版本是否满足范围表达式

        支持格式:
          "1.2.3"           — 精确版本
          ">=1.2.3"         — 大于等于
          ">1.2.3"          — 大于
          "<=1.2.3"         — 小于等于
          "<1.2.3"          — 小于
          ">=1.2.3 <2.0.0"  — 范围（空格分隔的与条件）
          "^1.2.3"          — 兼容版本（^1.2.3 = >=1.2.3 <2.0.0）
          "~1.2.3"          — 近似版本（~1.2.3 = >=1.2.3 <1.3.0）
          "*"               — 任意版本
        """
        range_spec = range_spec.strip()
        if range_spec == "*":
            return True

        # 空格分隔的多个条件（AND）
        parts = range_spec.split()
        if len(parts) > 1:
            return all(self.satisfies(p) for p in parts)

        # 操作符解析
        operators = [
            (">=", self.__ge__), (">", self.__gt__),
            ("<=", self.__le__), ("<", self.__lt__),
            ("=", lambda o: self == o),
        ]
        for op, fn in operators:
            if range_spec.startswith(op):
                ver = SemVer.parse(range_spec[len(op):].strip())
                if ver:
                    return fn(ver)
                return False

        # ^1.2.3 → >=1.2.3 <2.0.0
        if range_spec.startswith("^"):
            ver = SemVer.parse(range_spec[1:])
            if not ver:
                return False
            return self >= ver and self.major == ver.major

        # ~1.2.3 → >=1.2.3 <1.3.0
        if range_spec.startswith("~"):
            ver = SemVer.parse(range_spec[1:])
            if not ver:
                return False
            return self >= ver and self.major == ver.major and self.minor == ver.minor

        # 精确版本
        ver = SemVer.parse(range_spec)
        if ver:
            return self == ver
        return False


# ───────── 依赖解析 ─────────

class DependencyResolver:
    """
    依赖解析器 — 拓扑排序 + 循环检测

    用法:
        resolver = DependencyResolver()
        resolver.add("A", ["B", "C"])
        resolver.add("B", ["D"])
        resolver.add("C", ["D"])
        order = resolver.resolve()  # → ["D", "B", "C", "A"]
    """

    def __init__(self):
        self._dependencies: dict[str, list[str]] = {}

    def add(self, skill_id: str, dependencies: list[str]):
        """添加技能的依赖关系"""
        self._dependencies[skill_id] = list(dependencies)

    def resolve(self) -> list[str]:
        """
        解析依赖顺序（拓扑排序）

        返回: 安装顺序列表（依赖先于依赖者）

        抛出: ValueError 如果存在循环依赖
        """
        # 构建完整的节点集
        all_nodes = set(self._dependencies.keys())
        for deps in self._dependencies.values():
            all_nodes.update(deps)

        # Kahn 算法
        in_degree = {node: 0 for node in all_nodes}
        adj = defaultdict(list)

        for skill_id, deps in self._dependencies.items():
            for dep in deps:
                if dep in all_nodes:
                    adj[dep].append(skill_id)
                    in_degree[skill_id] = in_degree.get(skill_id, 0) + 1

        # 从入度为 0 的节点开始
        queue = deque([n for n, d in in_degree.items() if d == 0])
        result = []

        while queue:
            node = queue.popleft()
            result.append(node)
            for neighbor in adj[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(result) != len(all_nodes):
            cycle_nodes = set(all_nodes) - set(result)
            raise ValueError(f"检测到循环依赖，涉及节点: {cycle_nodes}")

        return result


# ───────── 数据模型 ─────────

@dataclass
class MarketPackage:
    """
    市场包 — 注册在技能市场中的技能包元数据

    扩展 skill.json 清单，添加市场专用字段。
    """
    id: str
    name: str
    version: str
    description: str = ""
    author: str = ""
    capabilities: list = field(default_factory=list)
    tags: list = field(default_factory=list)
    icon: str = "🔌"
    license: str = "MIT"
    homepage: str = ""
    dependencies: list = field(default_factory=list)

    # 市场字段
    source: str = ""           # "local" | "github" | "registry"
    source_url: str = ""       # GitHub URL 或本地路径
    downloads: int = 0
    installed_at: str = ""
    updated_at: str = ""
    min_friday_version: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "capabilities": self.capabilities,
            "tags": self.tags,
            "icon": self.icon,
            "license": self.license,
            "homepage": self.homepage,
            "dependencies": self.dependencies,
            "source": self.source,
            "source_url": self.source_url,
            "downloads": self.downloads,
            "installed_at": self.installed_at,
            "updated_at": self.updated_at,
            "min_friday_version": self.min_friday_version,
        }

    @classmethod
    def from_manifest(cls, manifest, source: str = "local",
                      source_url: str = "") -> "MarketPackage":
        """从 SkillManifestFile 创建市场包"""
        return cls(
            id=manifest.id,
            name=manifest.name,
            version=manifest.version,
            description=manifest.description,
            author=manifest.author,
            capabilities=manifest.capabilities,
            tags=manifest.tags,
            icon=manifest.icon,
            license=manifest.license,
            homepage=manifest.homepage,
            dependencies=manifest.dependencies,
            source=source,
            source_url=source_url,
            min_friday_version=manifest.min_friday_version or "",
        )


# ───────── 技能市场 ─────────

class SkillMarket:
    """
    技能市场 — Friday OS 技能的分发与管理

    职责:
      - 安装/卸载/更新技能
      - 依赖解析 + 自动安装依赖
      - 搜索发现的技能包
      - 记录安装历史和统计
      - 收藏与评分系统
    """

    def __init__(self, skills_dir: str = None, manager=None, event_bus=None):
        self.skills_dir = skills_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "skills"
        )
        self.manager = manager
        self.event_bus = event_bus

        # 市场数据目录 (.market/)
        self._market_dir = os.path.join(self.skills_dir, ".market")
        self._registry_path = os.path.join(self._market_dir, "registry.json")
        self._ratings_path = os.path.join(self._market_dir, "ratings.json")
        self._favorites_path = os.path.join(self._market_dir, "favorites.json")

        # 内存缓存
        self._registry: dict[str, MarketPackage] = {}   # id -> package
        self._ratings: dict[str, list] = {}              # id -> [(user, score, comment, time)]
        self._favorites: set[str] = set()                # {skill_id, ...}

    # ───────── 初始化 ─────────

    def initialize(self):
        """初始化市场数据（加载持久化数据）"""
        os.makedirs(self._market_dir, exist_ok=True)
        self._load_registry()
        self._load_ratings()
        self._load_favorites()
        # 扫描已安装技能
        self._scan_installed()
        logger.info("SkillMarket 初始化完成: %d 已注册, %d 已评分, %d 收藏",
                     len(self._registry), len(self._ratings), len(self._favorites))

    # ───────── 异步辅助 ─────────

    @staticmethod
    def _run_async(coro):
        """
        运行异步协程（兼容有/无运行中事件循环）

        在 asyncio.run() 上下文内外均可使用。
        """
        try:
            loop = asyncio.get_running_loop()
            # 已有运行中的循环 → 用线程提交
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result(timeout=60)
        except RuntimeError:
            # 无运行中的循环 → 直接创建
            return asyncio.run(coro)

    def _run_manager_load(self, path: str) -> Optional[str]:
        """同步包装: 加载技能"""
        return self._run_async(self.manager.load_skill(path))

    def _run_manager_unload(self, skill_id: str) -> bool:
        """同步包装: 卸载技能"""
        result = self._run_async(self.manager.unload_skill(skill_id))
        return result if result is not None else False

    def _load_registry(self):
        """加载注册表"""
        if os.path.isfile(self._registry_path):
            try:
                with open(self._registry_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data:
                    pkg = MarketPackage(**item)
                    self._registry[pkg.id] = pkg
            except Exception as e:
                logger.warning("加载注册表失败: %s", e)

    def _save_registry(self):
        """保存注册表"""
        try:
            os.makedirs(self._market_dir, exist_ok=True)
            data = [pkg.to_dict() for pkg in self._registry.values()]
            with open(self._registry_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("保存注册表失败: %s", e)

    def _load_ratings(self):
        """加载评分数据"""
        if os.path.isfile(self._ratings_path):
            try:
                with open(self._ratings_path, "r", encoding="utf-8") as f:
                    self._ratings = json.load(f)
            except Exception as e:
                logger.warning("加载评分数据失败: %s", e)

    def _save_ratings(self):
        """保存评分数据"""
        try:
            os.makedirs(self._market_dir, exist_ok=True)
            with open(self._ratings_path, "w", encoding="utf-8") as f:
                json.dump(self._ratings, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("保存评分失败: %s", e)

    def _load_favorites(self):
        """加载收藏数据"""
        if os.path.isfile(self._favorites_path):
            try:
                with open(self._favorites_path, "r", encoding="utf-8") as f:
                    self._favorites = set(json.load(f))
            except Exception as e:
                logger.warning("加载收藏失败: %s", e)

    def _save_favorites(self):
        """保存收藏数据"""
        try:
            os.makedirs(self._market_dir, exist_ok=True)
            with open(self._favorites_path, "w", encoding="utf-8") as f:
                json.dump(list(self._favorites), f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("保存收藏失败: %s", e)

    def _scan_installed(self):
        """扫描已安装的技能并注册到市场"""
        if not os.path.isdir(self.skills_dir):
            return

        for entry in os.scandir(self.skills_dir):
            if entry.is_dir() and not entry.name.startswith("."):
                manifest_path = os.path.join(entry.path, MANIFEST_FILENAME)
                if os.path.isfile(manifest_path):
                    manifest = load_manifest_from_file(manifest_path)
                    if manifest and manifest.id not in self._registry:
                        pkg = MarketPackage.from_manifest(manifest, source="local")
                        pkg.installed_at = datetime.fromtimestamp(
                            os.path.getctime(manifest_path)).isoformat()
                        pkg.updated_at = datetime.fromtimestamp(
                            os.path.getmtime(manifest_path)).isoformat()
                        self._registry[manifest.id] = pkg

    # ───────── 安装 ─────────

    def install(self, source_path: str, skill_id: str = None) -> dict:
        """
        从本地路径安装技能

        参数:
            source_path: 技能目录或 skill.json 路径
            skill_id: 可选，指定技能 ID（冲突时重命名）

        返回:
            {"success": bool, "id": str, "error": str, "dependencies": [str]}
        """
        # 确定源目录
        source_dir = source_path
        manifest_path = os.path.join(source_path, MANIFEST_FILENAME)
        if not os.path.isfile(manifest_path):
            # 可能是 skill.json 本身
            if os.path.isfile(source_path) and source_path.endswith(".json"):
                source_dir = os.path.dirname(source_path)
                manifest_path = source_path
            else:
                return {"success": False, "error": f"找不到有效的技能清单: {source_path}"}

        # 读取清单
        manifest = load_manifest_from_file(manifest_path)
        if manifest is None:
            return {"success": False, "error": "技能清单验证失败"}

        target_id = skill_id or manifest.id

        # 检查是否已安装
        target_dir = os.path.join(self.skills_dir, target_id)
        already_installed = os.path.isdir(target_dir)

        # 依赖解析
        dep_result = self._resolve_dependencies(manifest.dependencies)
        if not dep_result.get("success"):
            return dep_result

        # 复制文件
        try:
            if already_installed:
                # 备份旧版本
                backup_dir = target_dir + ".bak"
                if os.path.isdir(backup_dir):
                    shutil.rmtree(backup_dir)
                shutil.move(target_dir, backup_dir)

            # 复制新版本
            if os.path.isdir(target_dir):
                shutil.rmtree(target_dir)
            shutil.copytree(source_dir, target_dir, ignore=shutil.ignore_patterns("__pycache__"))

            # 如果 ID 不同，修改 skill.json 中的 ID
            if skill_id and skill_id != manifest.id:
                manifest_path_new = os.path.join(target_dir, MANIFEST_FILENAME)
                with open(manifest_path_new, "r", encoding="utf-8") as f:
                    manifest_data = json.load(f)
                manifest_data["id"] = skill_id
                manifest_data["name"] = manifest_data.get("name", "") + f" ({skill_id})"
                with open(manifest_path_new, "w", encoding="utf-8") as f:
                    json.dump(manifest_data, f, ensure_ascii=False, indent=2)

        except Exception as e:
            # 回滚
            if already_installed and os.path.isdir(backup_dir) and not os.path.isdir(target_dir):
                shutil.move(backup_dir, target_dir)
            return {"success": False, "error": f"复制文件失败: {e}"}

        # 清理备份
        backup_dir = target_dir + ".bak"
        if os.path.isdir(backup_dir):
            shutil.rmtree(backup_dir)

        # 热加载
        if self.manager:
            loaded_id = self._run_manager_load(target_dir)
            if not loaded_id:
                return {"success": False, "error": "技能加载失败，请检查代码"}

        # 更新注册表
        now = datetime.now().isoformat()
        pkg = MarketPackage.from_manifest(
            manifest if target_id == manifest.id else None,
            source="local",
            source_url=source_path,
        )
        pkg.id = target_id
        pkg.installed_at = now if not already_installed else self._registry.get(target_id, pkg).installed_at
        pkg.updated_at = now
        self._registry[target_id] = pkg
        self._save_registry()

        if self.event_bus:
            event_name = "skill.market.updated" if already_installed else "skill.market.installed"
            self.event_bus.emit(event_name, {
                "id": target_id,
                "version": manifest.version,
                "source": source_path,
            })

        return {
            "success": True,
            "id": target_id,
            "name": manifest.name,
            "version": manifest.version,
            "action": "updated" if already_installed else "installed",
            "dependencies": dep_result.get("resolved", []),
        }

    def install_from_github(self, repo_url: str, skill_id: str = None) -> dict:
        """
        从 GitHub 安装技能

        注意: 需要 git 命令可用。
        使用临时目录 clone，然后调用 install()。

        参数:
            repo_url: GitHub 仓库 URL（支持 user/repo 简写）
            skill_id: 可选，指定技能 ID

        返回:
            {"success": bool, "id": str, "error": str}
        """
        # 规范化 URL
        if "/" in repo_url and not repo_url.startswith("http"):
            repo_url = f"https://github.com/{repo_url}.git"
        elif not repo_url.endswith(".git"):
            repo_url = repo_url  # 保持原样

        # 创建临时目录
        tmp_dir = tempfile.mkdtemp(prefix="friday_market_")
        try:
            # 克隆仓库
            import subprocess
            result = subprocess.run(
                ["git", "clone", "--depth", "1", repo_url, tmp_dir],
                capture_output=True, text=True, timeout=120
            )
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": f"Git clone 失败: {result.stderr[:200]}",
                }

            # 查找技能目录（可能直接在根目录或子目录中）
            skill_dir = self._find_skill_dir(tmp_dir)
            if not skill_dir:
                return {
                    "success": False,
                    "error": "仓库中找不到有效的技能 (skill.json)",
                }

            # 安装
            result = self.install(skill_dir, skill_id)
            if result.get("success"):
                result["source"] = "github"
                result["source_url"] = repo_url
                # 更新注册表中的 source
                if result["id"] in self._registry:
                    self._registry[result["id"]].source = "github"
                    self._registry[result["id"]].source_url = repo_url
                    self._save_registry()

            return result

        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Git clone 超时 (120s)"}
        except FileNotFoundError:
            return {"success": False, "error": "需要 git 命令 (未安装或不在 PATH 中)"}
        except Exception as e:
            return {"success": False, "error": f"GitHub 安装异常: {e}"}
        finally:
            # 清理临时目录
            try:
                shutil.rmtree(tmp_dir)
            except Exception:
                pass

    def _find_skill_dir(self, search_dir: str) -> Optional[str]:
        """在目录树中查找包含 skill.json 的目录"""
        # 直接检查根目录
        if os.path.isfile(os.path.join(search_dir, MANIFEST_FILENAME)):
            return search_dir

        # 检查一级子目录
        for entry in os.scandir(search_dir):
            if entry.is_dir():
                if os.path.isfile(os.path.join(entry.path, MANIFEST_FILENAME)):
                    return entry.path

        return None

    def _resolve_dependencies(self, dependencies: list[str]) -> dict:
        """
        解析依赖关系

        返回:
            {"success": bool, "resolved": [str], "missing": [str], "error": str}
        """
        if not dependencies:
            return {"success": True, "resolved": [], "missing": []}

        if not self.manager:
            return {"success": True, "resolved": [], "missing": dependencies}

        missing = []
        resolved = []
        for dep_id in dependencies:
            skill = self.manager.get_skill(dep_id)
            if skill:
                resolved.append(dep_id)
            elif dep_id in self._registry:
                resolved.append(dep_id)
            else:
                missing.append(dep_id)

        if missing:
            return {
                "success": False,
                "resolved": resolved,
                "missing": missing,
                "error": f"缺少依赖: {', '.join(missing)}",
            }

        return {"success": True, "resolved": resolved, "missing": []}

    # ───────── 卸载 ─────────

    def uninstall(self, skill_id: str, keep_files: bool = False) -> dict:
        """
        卸载技能

        参数:
            skill_id: 技能 ID
            keep_files: 是否保留文件（仅从管理器卸载）

        返回:
            {"success": bool, "error": str}
        """
        # 卸载
        if self.manager:
            ok = self._run_manager_unload(skill_id)
            if not ok:
                logger.warning("卸载管理器中的技能失败 [%s]", skill_id)

        # 删除文件
        if not keep_files:
            skill_dir = os.path.join(self.skills_dir, skill_id)
            if os.path.isdir(skill_dir):
                try:
                    shutil.rmtree(skill_dir)
                except Exception as e:
                    return {"success": False, "error": f"删除文件失败: {e}"}

        # 从注册表移除
        if skill_id in self._registry:
            del self._registry[skill_id]
            self._save_registry()

        if self.event_bus:
            self.event_bus.emit("skill.market.uninstalled", id=skill_id)

        logger.info("技能已卸载: %s (keep_files=%s)", skill_id, keep_files)
        return {"success": True, "id": skill_id}

    # ───────── 更新 ─────────

    def update(self, skill_id: str, source_dir: str = None) -> dict:
        """
        检查并更新技能

        参数:
            skill_id: 技能 ID
            source_dir: 新版本源目录（None 时使用注册表中的 source_url）

        返回:
            {"success": bool, "old_version": str, "new_version": str, "error": str}
        """
        pkg = self._registry.get(skill_id)
        if not pkg:
            return {"success": False, "error": f"技能未注册: {skill_id}"}

        old_version = pkg.version

        if source_dir:
            # 从指定源安装
            return self.install(source_dir, skill_id)
        elif pkg.source == "local" and pkg.source_url:
            # 从原始路径重新安装
            return self.install(pkg.source_url, skill_id)
        elif pkg.source == "github" and pkg.source_url:
            # 从 GitHub 重新拉取
            result = self.install_from_github(pkg.source_url, skill_id)
            if result.get("success"):
                result["old_version"] = old_version
            return result
        else:
            return {"success": False, "error": "无可用更新源"}

    # ───────── 搜索 ─────────

    def search(self, query: str = "", capabilities: list[str] = None,
               tags: list[str] = None) -> list[dict]:
        """
        搜索技能包

        参数:
            query: 搜索关键字（匹配名称、描述、ID）
            capabilities: 按能力标签筛选
            tags: 按分类标签筛选

        返回:
            [{"pkg": MarketPackage, "installed": bool, "rating": float, "favorite": bool}, ...]
        """
        results = []

        query = query.strip().lower()

        for pkg_id, pkg in self._registry.items():
            # 关键字筛选
            if query:
                if (query not in pkg_id.lower()
                        and query not in pkg.name.lower()
                        and query not in pkg.description.lower()
                        and not any(query in t.lower() for t in pkg.tags)):
                    continue

            # 能力标签筛选
            if capabilities and not any(c in pkg.capabilities for c in capabilities):
                continue

            # 分类标签筛选
            if tags and not any(t in pkg.tags for t in tags):
                continue

            results.append(self._enrich_pkg_info(pkg))

        return results

    def list_installed(self, include_details: bool = True) -> list[dict]:
        """
        列出所有已安装的技能

        include_details: 是否包含评分/收藏等附加信息
        """
        results = []
        for pkg_id, pkg in self._registry.items():
            if self._is_installed(pkg_id):
                if include_details:
                    results.append(self._enrich_pkg_info(pkg))
                else:
                    results.append({"id": pkg_id, "name": pkg.name, "version": pkg.version})
        return results

    def list_available(self) -> list[dict]:
        """列出所有可用的技能包（包括未安装的）"""
        return [self._enrich_pkg_info(pkg) for pkg in self._registry.values()]

    def get_package(self, skill_id: str) -> Optional[dict]:
        """获取技能包详情"""
        pkg = self._registry.get(skill_id)
        if not pkg:
            return None
        return self._enrich_pkg_info(pkg)

    def _is_installed(self, skill_id: str) -> bool:
        """检查技能是否已安装"""
        skill_dir = os.path.join(self.skills_dir, skill_id)
        return os.path.isdir(skill_dir) and os.path.isfile(
            os.path.join(skill_dir, MANIFEST_FILENAME))

    def _enrich_pkg_info(self, pkg: MarketPackage) -> dict:
        """丰富包信息（附加安装状态、评分、收藏）"""
        info = pkg.to_dict()
        info["installed"] = self._is_installed(pkg.id)
        info["favorite"] = pkg.id in self._favorites
        info["rating"] = self.get_rating(pkg.id)
        if self.manager:
            skill = self.manager.get_skill(pkg.id)
            info["loaded"] = skill is not None
            info["available"] = skill.is_available if skill else False
        return info

    # ───────── 注册表管理 ─────────

    def register_package(self, pkg: MarketPackage) -> bool:
        """注册一个技能包到市场"""
        if pkg.id in self._registry:
            # 版本更新
            existing = self._registry[pkg.id]
            existing_ver = SemVer.parse(existing.version)
            new_ver = SemVer.parse(pkg.version)
            if new_ver and existing_ver and new_ver > existing_ver:
                self._registry[pkg.id] = pkg
                self._save_registry()
                return True
            return False
        self._registry[pkg.id] = pkg
        self._save_registry()
        return True

    def unregister_package(self, skill_id: str) -> bool:
        """从市场注册表移除"""
        if skill_id in self._registry:
            del self._registry[skill_id]
            self._save_registry()
            return True
        return False

    # ───────── 收藏 ─────────

    def add_favorite(self, skill_id: str) -> dict:
        """添加收藏"""
        if skill_id not in self._registry:
            return {"success": False, "error": f"技能不存在: {skill_id}"}
        self._favorites.add(skill_id)
        self._save_favorites()
        return {"success": True, "id": skill_id}

    def remove_favorite(self, skill_id: str) -> dict:
        """取消收藏"""
        self._favorites.discard(skill_id)
        self._save_favorites()
        return {"success": True, "id": skill_id}

    def list_favorites(self) -> list[dict]:
        """列出收藏的技能"""
        results = []
        for skill_id in self._favorites:
            pkg = self._registry.get(skill_id)
            if pkg:
                results.append(self._enrich_pkg_info(pkg))
        return results

    def is_favorite(self, skill_id: str) -> bool:
        """检查是否已收藏"""
        return skill_id in self._favorites

    # ───────── 评分 ─────────

    def rate(self, skill_id: str, score: int, comment: str = "",
             user: str = "anonymous") -> dict:
        """
        为技能评分

        参数:
            skill_id: 技能 ID
            score: 1-5 分
            comment: 评论（可选）
            user: 评分用户（默认 anonymous）

        返回:
            {"success": bool, "new_average": float, "error": str}
        """
        if skill_id not in self._registry:
            return {"success": False, "error": f"技能不存在: {skill_id}"}

        if not (1 <= score <= 5):
            return {"success": False, "error": "评分必须在 1-5 之间"}

        if skill_id not in self._ratings:
            self._ratings[skill_id] = []

        self._ratings[skill_id].append({
            "user": user,
            "score": score,
            "comment": comment,
            "time": datetime.now().isoformat(),
        })

        # 只保留最近 100 条
        if len(self._ratings[skill_id]) > 100:
            self._ratings[skill_id] = self._ratings[skill_id][-100:]

        self._save_ratings()

        new_avg = self.get_rating(skill_id)["average"]

        if self.event_bus:
            self.event_bus.emit("skill.market.rated",
                id=skill_id, score=score, user=user,
            )

        return {"success": True, "new_average": new_avg}

    def get_rating(self, skill_id: str) -> dict:
        """获取技能评分统计"""
        ratings = self._ratings.get(skill_id, [])
        if not ratings:
            return {"average": 0.0, "count": 0, "distribution": {str(i): 0 for i in range(1, 6)}}

        scores = [r["score"] for r in ratings]
        distribution = {str(i): 0 for i in range(1, 6)}
        for s in scores:
            distribution[str(s)] = distribution.get(str(s), 0) + 1

        return {
            "average": round(sum(scores) / len(scores), 1),
            "count": len(scores),
            "distribution": distribution,
        }

    def get_top_rated(self, limit: int = 10) -> list[dict]:
        """获取评分最高的技能"""
        scored = []
        for pkg_id in self._registry:
            rating = self.get_rating(pkg_id)
            if rating["count"] > 0:
                scored.append((rating["average"], rating["count"], pkg_id))

        scored.sort(key=lambda x: (-x[0], -x[1]))

        results = []
        for _, _, pkg_id in scored[:limit]:
            pkg = self._registry.get(pkg_id)
            if pkg:
                results.append(self._enrich_pkg_info(pkg))

        return results

    # ───────── 统计 ─────────

    def get_stats(self) -> dict:
        """获取市场统计"""
        total = len(self._registry)
        installed = sum(1 for pkg_id in self._registry if self._is_installed(pkg_id))
        rated = sum(1 for r in self._ratings.values() if len(r) > 0)

        # 按来源统计
        sources = defaultdict(int)
        for pkg in self._registry.values():
            sources[pkg.source or "unknown"] += 1

        return {
            "total_packages": total,
            "installed": installed,
            "rated_skills": rated,
            "favorites": len(self._favorites),
            "sources": dict(sources),
            "market_dir": self._market_dir,
        }

    # ───────── 清理 ─────────

    def clear(self):
        """清理所有市场数据"""
        self._registry.clear()
        self._ratings.clear()
        self._favorites.clear()

        # 删除市场数据目录
        if os.path.isdir(self._market_dir):
            try:
                shutil.rmtree(self._market_dir)
            except Exception as e:
                logger.warning("清理市场目录失败: %s", e)

        logger.info("SkillMarket 已清理")
