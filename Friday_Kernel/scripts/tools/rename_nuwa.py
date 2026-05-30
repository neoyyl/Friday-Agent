"""Batch rename Nuwa → Friday across the codebase."""
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

REPLACEMENTS = {
    "modules/web/app.py": [
        ("Nuwa Web UI", "Friday Web UI"),
        ("nuwa.web", "friday.web"),
        ("friday-kernel-nuwa", "friday-kernel"),
        ("[NuwaWeb]", "[Friday]"),
        ("Nuwa Web UI created", "Friday Web UI created"),
        ("女娲 Web UI", "Friday Web UI"),
    ],
    "web/app.py": [
        ("女娲 (Nuwa) Web UI", "Friday Web UI"),
        ("nuwa.web", "friday.web"),
        ("nuwa_config.json", "friday_config.json"),
        ("\u201c\u5973\u5a25\u201d", "\u201cFriday\u201d"),
        ("\u201c\u5634\u5973\u5a25\u201d", "\u201c\u5634Friday\u201d"),
        ("\u201c\u5634\u5973\u5a25\u201d", "\u201c\u5634Friday\u201d"),
        ("/ws/nuwa", "/ws/friday"),
        ("nuwa.state.changed", "friday.state.changed"),
        ("nuwa.config.updated", "friday.config.updated"),
        ("nuwa.wizard.completed", "friday.wizard.completed"),
        ("女娲", "Friday"),
        ("Nuwa Web UI", "Friday Web UI"),
    ],
    "modules/entry/nuwa.py": [
        ("Nuwa Bridge", "Friday Bridge"),
        ("nuwa.bridge", "friday.bridge"),
        ("NuwaBridge", "FridayBridge"),
        ("Nuwa 状态机", "Friday 状态机"),
        ("NuwaStateMachine", "FridayStateMachine"),
        ("Nuwa 进入", "Friday 进入"),
        ("Nuwa 退出", "Friday 退出"),
        ("Nuwa Web UI", "Friday Web UI"),
        ("Nuwa 自动创建", "Friday 自动创建"),
    ],
    "modules/services/voice_dialog.py": [
        ("nuwa.dialog", "friday.dialog"),
    ],
    "modules/services/skill_service.py": [
        ("Nuwa OS", "Friday OS"),
        ("nuwa.service.skill", "friday.service.skill"),
    ],
    "modules/services/self_heal.py": [
        ("nuwa.service.self_heal", "friday.service.self_heal"),
        ("nuwa_config.json", "friday_config.json"),
    ],
    "modules/services/perception/__init__.py": [
        ("Nuwa 的感知", "Friday 的感知"),
        ("让 Nuwa", "让 Friday"),
    ],
    "scripts/load_kernel.py": [
        ("Nuwa Web UI", "Friday Web UI"),
        ("启动 Nuwa Web UI", "启动 Friday Web UI"),
        ("from entry.nuwa import NuwaBridge", "from entry.nuwa import FridayBridge"),
        ("bridge = NuwaBridge", "bridge = FridayBridge"),
    ],
    "skills/skill_base.py": [
        ("Nuwa OS", "Friday OS"),
        ("Nuwa 技能", "Friday 技能"),
        ("nuwa.skill", "friday.skill"),
    ],
    "skills/manifest.py": [
        ("Nuwa Team", "Friday Team"),
        ("min_nuwa_version", "min_friday_version"),
        ("nuwa.skill.manifest", "friday.skill.manifest"),
    ],
    "skills/skill_market.py": [
        ("Nuwa OS", "Friday OS"),
        ("nuwa.skill.market", "friday.skill.market"),
        ("min_nuwa_version", "min_friday_version"),
        ("nuwa_market_", "friday_market_"),
    ],
    "skills/skill_manager.py": [
        ("nuwa.skill.manager", "friday.skill.manager"),
        ("nuwa_skill_", "friday_skill_"),
    ],
    "skills/skill_generator.py": [
        ("nuwa.skill.generator", "friday.skill.generator"),
        ("Nuwa NL", "Friday NL"),
        ("nuwa.skill.$skill_id", "friday.skill.$skill_id"),
    ],
    "skills/plugin_api.py": [
        ("Nuwa OS", "Friday OS"),
        ("nuwa.state.changed", "friday.state.changed"),
        ("nuwa.plugin", "friday.plugin"),
    ],
    "skills/examples/hello_world/main.py": [
        ("Nuwa 示例", "Friday 示例"),
        ("Nuwa 技能", "Friday 技能"),
        ("Nuwa Team", "Friday Team"),
    ],
    "modules/friday_all.py": [
        ("Nuwa 状态机", "Friday 状态机"),
    ],
    "modules/legacy/friday_voice.py": [
        ("Nuwa / OpenCode", "Friday / OpenCode"),
    ],
    "tools/friday_debug.py": [
        ("NuwaBridge", "FridayBridge"),
    ],
    "web/__init__.py": [
        ("女娲 (Nuwa) Web UI 包", "Friday Web UI 包"),
    ],
}

updated = 0
for filepath, replacements in REPLACEMENTS.items():
    full_path = os.path.join(BASE, filepath)
    if not os.path.exists(full_path):
        print(f"SKIP (not found): {filepath}")
        continue
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
    if content != original:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        updated += 1
        print(f"OK: {filepath}")
    else:
        print(f"NO CHANGE: {filepath}")

print(f"\nTotal updated: {updated} files")
