"""
Friday Web UI — Flask + SocketIO application
===========================================
Provides REST API and WebSocket bridge for Friday Kernel.
All routes are registered on the Flask app and events
are broadcast via SocketIO to connected clients.
"""

import base64
import json
import logging
import sys
import os
import subprocess
import threading
import time
import traceback
from pathlib import Path

import flask
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit

logger = logging.getLogger("friday.web")

# Globals
_socketio = None
_event_bus = None
_app = None
_sherpa_proc = None

def _wrap_result(data, status=200):
    return jsonify({"success": True, "data": data}), status

def _error(msg, status=400):
    return jsonify({"success": False, "error": msg}), status

# ─── 服务加载器 ───
_SERVICE_LOADERS = {
    "agent_registry": lambda: __import__("services.agent_registry", fromlist=["get_registry"]).get_registry(event_bus=_event_bus),
    "agent_orchestrator": lambda: __import__("services.agent_orchestrator", fromlist=["get_orchestrator"]).get_orchestrator(event_bus=_event_bus),
    "skill_service": lambda: __import__("services.skill_service", fromlist=["get_skill_service"]).get_skill_service(event_bus=_event_bus),
    "scheduler_service": lambda: __import__("services.scheduler_service", fromlist=["get_scheduler"]).get_scheduler(event_bus=_event_bus),
    "trigger_service": lambda: __import__("services.trigger_service", fromlist=["get_trigger_service"]).get_trigger_service(event_bus=_event_bus),
    "workflow_engine": lambda: __import__("services.workflow_engine", fromlist=["get_engine"]).get_engine(event_bus=_event_bus),
    "emotion_service": lambda: __import__("services.emotion_service", fromlist=["get_emotion_engine"]).get_emotion_engine(),
    "voice_service": lambda: __import__("services.voice_service", fromlist=["get_voice_service"]).get_voice_service(event_bus=_event_bus),
    "friday_memory": lambda: __import__("services.friday_memory", fromlist=["ConversationMemory"]).ConversationMemory(),
    "friday_timing": lambda: __import__("services.friday_timing", fromlist=["FridayTiming"]).FridayTiming(),
    "conversation_memory": lambda: __import__("services.conversation_memory", fromlist=["get_memory"]).get_memory(),
    "dispatch_logger": lambda: __import__("services.dispatch_logger", fromlist=["get_dispatch_logger"]).get_dispatch_logger(),
    "execution_logger": lambda: __import__("services.execution_logger", fromlist=["get_logger"]).get_logger(event_bus=_event_bus),
    "friday_voiceprint": lambda: __import__("services.friday_voiceprint", fromlist=["VoiceprintRecognizer"]).VoiceprintRecognizer(),
    "red_team": lambda: __import__("services.red_team", fromlist=["get_redteam"]).get_redteam(event_bus=_event_bus),
    "timing_service": lambda: __import__("services.timing_service", fromlist=["get_timing_service"]).get_timing_service(),
    "self_heal": lambda: __import__("services.self_heal", fromlist=["get_healer"]).get_healer(),
}

_service_cache = {}

def _lazy_service(name):
    if name in _service_cache:
        return _service_cache[name]
    loader = _SERVICE_LOADERS.get(name)
    if not loader:
        return None
    try:
        svc = loader()
        _service_cache[name] = svc
        return svc
    except Exception as e:
        logger.warning("Service load failed [%s]: %s", name, e)
        return None

def _start_sherpa_server(port=3723):
    """启动 sherpa-onnx ASR 服务（后台子进程）"""
    global _sherpa_proc
    if _sherpa_proc and _sherpa_proc.poll() is None:
        logger.info("Sherpa server already running (pid=%s)", _sherpa_proc.pid)
        return True

    server_script = Path(__file__).parent.parent / "services" / "sherpa_server.py"
    if not server_script.exists():
        logger.warning("Sherpa server script not found: %s", server_script)
        return False

    try:
        cmd = [sys.executable, str(server_script), "--port", str(port)]
        env = os.environ.copy()
        kernel_root = str(Path(__file__).parent.parent.parent)
        modules_dir = str(Path(__file__).parent.parent)
        services_dir = str(Path(__file__).parent.parent / "services")
        pythonpath = os.pathsep.join([kernel_root, modules_dir, services_dir, env.get("PYTHONPATH", "")])
        env["PYTHONPATH"] = pythonpath
        env["PYTHONUNBUFFERED"] = "1"
        _sherpa_proc = subprocess.Popen(
            cmd, cwd=kernel_root,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env=env,
        )
        # 等待启动（后台线程，不阻塞 Flask）
        import websockets.sync.client as _ws_sync

        def _wait_ready(proc=_sherpa_proc):
            start = time.time()
            while time.time() - start < 30:
                if proc.poll() is not None:
                    logger.error("Sherpa server exited (code=%s)", proc.returncode)
                    return
                try:
                    with _ws_sync.connect(f"ws://127.0.0.1:{port}", open_timeout=2) as ws:
                        ws.send(json.dumps({"type": "config", "lang": "zh"}))
                        msg = json.loads(ws.recv())
                        if msg.get("type") == "config_ok":
                            logger.info("Sherpa server started on port %s", port)
                            return
                except Exception:
                    time.sleep(0.5)
            logger.warning("Sherpa server start timeout")

            return
        threading.Thread(target=_wait_ready, daemon=True, name="sherpa-wait").start()
        logger.info("Sherpa server starting in background (pid=%s)...", port)
        return True
    except Exception as e:
        logger.error("Failed to start sherpa server: %s", e)
        return False


# ==================== Route Registration ====================


def _register_routes(app, bus):
    """Register all API routes on the Flask app."""

    # --- Config ---
    _CONFIG_DIR = str(Path(__file__).resolve().parent.parent.parent / "web")
    _CONFIG_PATH = os.path.join(_CONFIG_DIR, "friday_config.json")
    _DEFAULT_CONFIG = {"wizard_completed": False, "name": "Friday", "language": "zh-CN", "personality": "warm", "wake_word": "Hey Friday", "tts_speed": 1.0, "auto_start": True}

    def _load_config():
        if os.path.exists(_CONFIG_PATH):
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        return dict(_DEFAULT_CONFIG)

    def _save_config(cfg):
        with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)

    @app.route("/api/config", methods=["GET"])
    def get_config():
        return jsonify(_load_config())

    @app.route("/api/config", methods=["POST"])
    def update_config():
        cfg = _load_config()
        cfg.update(request.json or {})
        _save_config(cfg)
        return jsonify({"status": "ok", "config": cfg})

    # --- Health ---
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "friday-kernel"})

    @app.route("/api/hello")
    def hello():
        return jsonify({"message": "Friday Kernel is ready", "version": "1.0.0"})

    # --- Core Personality ---
    _MEMORY_DIR = str(Path(__file__).resolve().parent.parent.parent / "memory")

    @app.route("/api/personality")
    def get_personality():
        memory_file = os.path.join(_MEMORY_DIR, "friday_memory.md")
        try:
            with open(memory_file, "r", encoding="utf-8") as f:
                content = f.read()
            return jsonify({"content": content})
        except Exception as e:
            return jsonify({"error": str(e), "content": ""})

    # --- Agents ---
    @app.route("/api/agents")
    def list_agents():
        svc = _lazy_service("agent_registry")
        if not svc:
            return _error("agent_registry not available")
        try:
            agents = svc.list_agents()
            return _wrap_result({"agents": agents})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/agents/stats")
    def agent_stats():
        svc = _lazy_service("agent_registry")
        if not svc:
            return _error("agent_registry not available")
        try:
            stats = svc.get_stats()
            return _wrap_result(stats)
        except Exception as e:
            return _error(str(e))

    # --- Orchestrator ---
    @app.route("/api/orchestrator/dispatch", methods=["POST"])
    def dispatch():
        svc = _lazy_service("agent_orchestrator")
        if not svc:
            return _error("agent_orchestrator not available")
        try:
            data = request.json or {}
            result = svc.dispatch(data.get("task", ""), data.get("mode", "direct"), data)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/orchestrator/history")
    def dispatch_history():
        svc = _lazy_service("dispatch_logger")
        if not svc:
            return _error("dispatch_logger not available")
        try:
            history = svc.get_history()
            return _wrap_result({"history": history})
        except Exception as e:
            return _error(str(e))

    # --- Skills ---
    @app.route("/api/skills")
    def list_skills():
        svc = _lazy_service("skill_service")
        if not svc:
            return _error("skill_service not available")
        try:
            skills = svc.list_skills()
            return _wrap_result({"skills": skills})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/skills/stats")
    def skill_stats():
        svc = _lazy_service("skill_service")
        if not svc:
            return _error("skill_service not available")
        try:
            stats = svc.get_stats()
            return _wrap_result(stats)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/skills/<skill_id>/call", methods=["POST"])
    def call_skill(skill_id):
        svc = _lazy_service("skill_service")
        if not svc:
            return _error("skill_service not available")
        try:
            params = request.json or {}
            result = svc.call_skill(skill_id, params)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/skills/<skill_id>/reload", methods=["POST"])
    def reload_skill(skill_id):
        svc = _lazy_service("skill_service")
        if not svc:
            return _error("skill_service not available")
        try:
            result = svc.reload_skill(skill_id)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/skills/find")
    def find_skills():
        svc = _lazy_service("skill_service")
        if not svc:
            return _error("skill_service not available")
        try:
            capability = request.args.get("capability", "")
            results = svc.find_by_capability(capability)
            return _wrap_result({"skills": results})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/skills/scan", methods=["POST"])
    def scan_skills():
        svc = _lazy_service("skill_service")
        if not svc:
            return _error("skill_service not available")
        try:
            result = svc.scan_skills()
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    # --- Scheduler ---
    @app.route("/api/scheduler/status")
    def scheduler_status():
        svc = _lazy_service("scheduler_service")
        if not svc:
            return _error("scheduler_service not available")
        try:
            return _wrap_result(svc.summary())
        except Exception as e:
            return _error(str(e))

    @app.route("/api/scheduler/jobs")
    def scheduler_jobs():
        svc = _lazy_service("scheduler_service")
        if not svc:
            return _error("scheduler_service not available")
        try:
            jobs = svc.list_jobs()
            return _wrap_result({"jobs": jobs})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/scheduler/jobs", methods=["POST"])
    def create_scheduler_job():
        svc = _lazy_service("scheduler_service")
        if not svc:
            return _error("scheduler_service not available")
        try:
            job = svc.add_job(request.json or {})
            return _wrap_result(job, 201)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/scheduler/jobs/<job_id>", methods=["DELETE"])
    def delete_scheduler_job(job_id):
        svc = _lazy_service("scheduler_service")
        if not svc:
            return _error("scheduler_service not available")
        try:
            svc.remove_job(job_id)
            return _wrap_result({"success": True})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/scheduler/jobs/<job_id>/toggle", methods=["POST"])
    def toggle_scheduler_job(job_id):
        svc = _lazy_service("scheduler_service")
        if not svc:
            return _error("scheduler_service not available")
        try:
            result = svc.toggle_job(job_id)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/scheduler/actions/<action_name>", methods=["POST"])
    def run_scheduler_action(action_name):
        svc = _lazy_service("scheduler_service")
        if not svc:
            return _error("scheduler_service not available")
        try:
            data = request.json or {}
            result = svc.register_action(action_name, data)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    # --- Triggers ---
    @app.route("/api/triggers")
    def list_triggers():
        svc = _lazy_service("trigger_service")
        if not svc:
            return _error("trigger_service not available")
        try:
            triggers = svc.list_triggers()
            return _wrap_result({"triggers": triggers})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/triggers", methods=["POST"])
    def create_trigger():
        svc = _lazy_service("trigger_service")
        if not svc:
            return _error("trigger_service not available")
        try:
            trigger = svc.add_trigger(request.json or {})
            return _wrap_result(trigger, 201)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/triggers/<trigger_id>", methods=["DELETE"])
    def delete_trigger(trigger_id):
        svc = _lazy_service("trigger_service")
        if not svc:
            return _error("trigger_service not available")
        try:
            svc.remove_trigger(trigger_id)
            return _wrap_result({"success": True})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/triggers/<trigger_id>/toggle", methods=["POST"])
    def toggle_trigger(trigger_id):
        svc = _lazy_service("trigger_service")
        if not svc:
            return _error("trigger_service not available")
        try:
            result = svc.toggle_trigger(trigger_id)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/triggers/presets")
    def trigger_presets():
        svc = _lazy_service("trigger_service")
        if not svc:
            return _error("trigger_service not available")
        try:
            return _wrap_result(svc.summary())
        except Exception as e:
            return _error(str(e))

    @app.route("/api/triggers/status")
    def trigger_status():
        svc = _lazy_service("trigger_service")
        if not svc:
            return _error("trigger_service not available")
        try:
            return _wrap_result(svc.summary())
        except Exception as e:
            return _error(str(e))

    # --- Workflows ---
    @app.route("/api/workflows")
    def list_workflows():
        svc = _lazy_service("workflow_engine")
        if not svc:
            return _error("workflow_engine not available")
        try:
            workflows = svc.list_workflows()
            return _wrap_result({"workflows": workflows})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/workflows", methods=["POST"])
    def create_workflow():
        svc = _lazy_service("workflow_engine")
        if not svc:
            return _error("workflow_engine not available")
        try:
            wf = svc.create_workflow(request.json or {})
            return _wrap_result(wf, 201)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/workflows/<workflow_id>")
    def get_workflow(workflow_id):
        svc = _lazy_service("workflow_engine")
        if not svc:
            return _error("workflow_engine not available")
        try:
            wf = svc.get_workflow(workflow_id)
            return _wrap_result(wf)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/workflows/<workflow_id>", methods=["DELETE"])
    def delete_workflow(workflow_id):
        svc = _lazy_service("workflow_engine")
        if not svc:
            return _error("workflow_engine not available")
        try:
            svc.delete_workflow(workflow_id)
            return _wrap_result({"success": True})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/workflows/<workflow_id>/run", methods=["POST"])
    def run_workflow(workflow_id):
        svc = _lazy_service("workflow_engine")
        if not svc:
            return _error("workflow_engine not available")
        try:
            data = request.json or {}
            result = svc.run_workflow(workflow_id, data)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/workflows/instances")
    def workflow_instances():
        svc = _lazy_service("workflow_engine")
        if not svc:
            return _error("workflow_engine not available")
        try:
            instances = svc.list_instances()
            return _wrap_result({"instances": instances})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/workflows/engine/status")
    def workflow_engine_status():
        svc = _lazy_service("workflow_engine")
        if not svc:
            return _error("workflow_engine not available")
        try:
            return _wrap_result({"status": "running", "workflows": len(svc.list_workflows())})
        except Exception as e:
            return _error(str(e))

    # --- Emotion ---
    @app.route("/api/emotion/analyze", methods=["POST"])
    def analyze_emotion():
        svc = _lazy_service("emotion_service")
        if not svc:
            return _error("emotion_service not available")
        try:
            data = request.json or {}
            result = svc.analyze_text(data.get("text", ""))
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/emotion/state")
    def emotion_state():
        svc = _lazy_service("emotion_service")
        if not svc:
            return _error("emotion_service not available")
        try:
            state = svc.get_emotional_state()
            return _wrap_result(state)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/emotion/update_conversation", methods=["POST"])
    def update_conversation_emotion():
        svc = _lazy_service("emotion_service")
        if not svc:
            return _error("emotion_service not available")
        try:
            data = request.json or {}
            result = svc.update_conversation(data)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    # --- TTS ---
    @app.route("/api/tts/speak", methods=["POST"])
    def tts_speak():
        svc = _lazy_service("voice_service")
        if not svc:
            return _error("voice_service not available")
        try:
            data = request.json or {}
            result = svc.speak(data.get("text", ""), data.get("tone"))
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/tts/stop", methods=["POST"])
    def tts_stop():
        svc = _lazy_service("voice_service")
        if not svc:
            return _error("voice_service not available")
        try:
            svc.stop()
            return _wrap_result({"success": True})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/tts/status")
    def tts_status():
        svc = _lazy_service("voice_service")
        if not svc:
            return _error("voice_service not available")
        try:
            return _wrap_result(svc.get_status())
        except Exception as e:
            return _error(str(e))

    @app.route("/api/tts/detect_tone", methods=["POST"])
    def tts_detect_tone():
        svc = _lazy_service("voice_service")
        if not svc:
            return _error("voice_service not available")
        try:
            data = request.json or {}
            result = svc.detect_tone(data.get("text", ""))
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    # --- Voice / Speakers ---
    @app.route("/api/voice/speakers")
    def voice_speakers():
        svc = _lazy_service("voice_service")
        if not svc:
            return _error("voice_service not available")
        try:
            speakers = svc.get_speakers()
            return _wrap_result({"speakers": speakers})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/voice/speakers", methods=["POST"])
    def voice_register_speaker():
        svc = _lazy_service("voice_service")
        if not svc:
            return _error("voice_service not available")
        try:
            data = request.json or {}
            result = svc.register_speaker(data.get("name", "unknown"), data.get("audio"), data)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/voice/speakers/<speaker_name>", methods=["DELETE"])
    def voice_delete_speaker(speaker_name):
        svc = _lazy_service("voice_service")
        if not svc:
            return _error("voice_service not available")
        try:
            svc.delete_speaker(speaker_name)
            return _wrap_result({"success": True})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/voice/identify", methods=["POST"])
    def voice_identify():
        svc = _lazy_service("voice_service")
        if not svc:
            return _error("voice_service not available")
        try:
            data = request.json or {}
            result = svc.identify(data.get("audio"), data)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/voice/current")
    def voice_current_speaker():
        svc = _lazy_service("voice_service")
        if not svc:
            return _error("voice_service not available")
        try:
            result = svc.get_current_speaker()
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    # --- ASR (sherpa-onnx) ---
    @app.route("/api/asr/status")
    def asr_status():
        try:
            import websockets.sync.client as _ws_sync
            with _ws_sync.connect("ws://127.0.0.1:3723", open_timeout=3) as ws:
                ws.send(json.dumps({"type": "config", "lang": "zh"}))
                resp = json.loads(ws.recv())
                ready = resp.get("type") == "config_ok"
                return jsonify({"ready": ready})
        except Exception as e:
            return jsonify({"ready": False, "message": str(e)})

    @app.route("/api/asr/transcribe", methods=["POST"])
    def asr_transcribe():
        try:
            data = request.json or {}
            audio_base64 = data.get("audio", "")
            lang = data.get("lang", "zh")
            if not audio_base64:
                return _error("no audio data")
            import websockets.sync.client as _ws_sync
            with _ws_sync.connect("ws://127.0.0.1:3723", open_timeout=5) as ws:
                ws.send(json.dumps({"type": "config", "lang": lang}))
                resp = json.loads(ws.recv())
                if resp.get("type") != "config_ok":
                    return _error("sherpa config failed")
                audio_bytes = base64.b64decode(audio_base64)
                ws.send(audio_bytes)
                ws.send(json.dumps({"type": "flush"}))
                result = json.loads(ws.recv())
                if result.get("type") == "transcript":
                    return _wrap_result({"text": result.get("text", ""), "lang": result.get("lang", lang)})
                return _wrap_result({"text": ""})
        except Exception as e:
            return _error(f"ASR failed: {e}")

    # --- Dispatch Log ---
    @app.route("/api/dispatch_log/stats")
    def dispatch_log_stats():
        svc = _lazy_service("dispatch_logger")
        if not svc:
            return _error("dispatch_logger not available")
        try:
            return _wrap_result(svc.get_stats())
        except Exception as e:
            return _error(str(e))

    @app.route("/api/dispatch_log/insights")
    def dispatch_log_insights():
        svc = _lazy_service("dispatch_logger")
        if not svc:
            return _error("dispatch_logger not available")
        try:
            return _wrap_result(svc.get_insights())
        except Exception as e:
            return _error(str(e))

    # --- Execution Log ---
    @app.route("/api/log")
    def execution_log():
        svc = _lazy_service("execution_logger")
        if not svc:
            return _error("execution_logger not available")
        try:
            return _wrap_result(svc.get_log())
        except Exception as e:
            return _error(str(e))

    @app.route("/api/log/report")
    def execution_report():
        svc = _lazy_service("execution_logger")
        if not svc:
            return _error("execution_logger not available")
        try:
            return _wrap_result(svc.get_report())
        except Exception as e:
            return _error(str(e))

    # --- Timing ---
    @app.route("/api/timing/readiness")
    def timing_readiness():
        svc = _lazy_service("timing_service")
        if not svc:
            svc = _lazy_service("friday_timing")
        if not svc:
            return _error("timing_service not available")
        try:
            return _wrap_result(svc.get_readiness())
        except Exception as e:
            return _error(str(e))

    @app.route("/api/timing/should_notify", methods=["POST"])
    def timing_should_notify():
        svc = _lazy_service("timing_service")
        if not svc:
            svc = _lazy_service("friday_timing")
        if not svc:
            return _error("timing_service not available")
        try:
            data = request.json or {}
            result = svc.should_notify(data)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    # --- Self Healer ---
    @app.route("/api/self_heal/check")
    def self_heal_check():
        svc = _lazy_service("self_heal")
        if not svc:
            return _error("self_heal not available")
        try:
            result = svc.full_check()
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/self_heal/fix", methods=["POST"])
    def self_heal_fix():
        svc = _lazy_service("self_heal")
        if not svc:
            return _error("self_heal not available")
        try:
            report = svc.full_check()
            result = svc.fix_all(report)
            return _wrap_result(result)
        except Exception as e:
            return _error(str(e))

    # --- Perception ---
    @app.route("/api/perception/window")
    def perception_window():
        try:
            from services.perception import PerceptionAggregator
            agg = PerceptionAggregator()
            ctx = agg.get_context()
            return _wrap_result(ctx.active_window)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/perception/git")
    def perception_git():
        try:
            from services.perception import PerceptionAggregator
            agg = PerceptionAggregator()
            ctx = agg.get_context()
            return _wrap_result(ctx.git)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/perception/project")
    def perception_project():
        try:
            from services.perception import PerceptionAggregator
            agg = PerceptionAggregator()
            ctx = agg.get_context()
            return _wrap_result(ctx.project)
        except Exception as e:
            return _error(str(e))

    @app.route("/api/perception/context")
    def perception_context():
        try:
            from services.perception import PerceptionAggregator
            agg = PerceptionAggregator()
            ctx = agg.get_context()
            return _wrap_result({
                "active_window": ctx.active_window,
                "git": ctx.git,
                "project": ctx.project,
                "timestamp": ctx.timestamp,
                "formatted": ctx.formatted,
            })
        except Exception as e:
            return _error(str(e))

    # --- GPU Monitor ---
    @app.route("/api/gpu/status")
    def gpu_status():
        try:
            from services.gpu_monitor import GPUMonitor
            mon = GPUMonitor()
            return _wrap_result(mon.get_gpu_status())
        except Exception as e:
            return _error(str(e))

    # --- Obsidian ---
    @app.route("/api/obsidian/config")
    def obsidian_config():
        try:
            from services.friday_obsidian import ObsidianWriter, VAULT_PATH
            return _wrap_result({"vault_path": VAULT_PATH, "exists": os.path.isdir(VAULT_PATH)})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/obsidian/notes")
    def obsidian_list_notes():
        try:
            from services.friday_obsidian import VAULT_PATH
            folder = request.args.get("folder", "")
            base = os.path.join(VAULT_PATH, folder) if folder else VAULT_PATH
            notes = []
            if os.path.isdir(base):
                for f in os.listdir(base):
                    if f.endswith(".md"):
                        fp = os.path.join(base, f)
                        notes.append({
                            "name": f[:-3],
                            "path": fp,
                            "size": os.path.getsize(fp),
                            "modified": os.path.getmtime(fp),
                        })
            return _wrap_result({"notes": notes, "vault": VAULT_PATH})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/obsidian/write", methods=["POST"])
    def obsidian_write():
        try:
            from services.friday_obsidian import ObsidianWriter
            data = request.json or {}
            w = ObsidianWriter()
            path = w.write_note(
                data.get("title", "Untitled"),
                data.get("content", ""),
                tags=data.get("tags", []),
                folder=data.get("folder", ""),
            )
            return _wrap_result({"path": path})
        except Exception as e:
            return _error(str(e))

    # --- Memory / Conversation ---
    @app.route("/api/memory")
    def list_memory():
        svc = _lazy_service("conversation_memory")
        if not svc:
            return _error("conversation_memory not available")
        try:
            context = svc.get_context(max_turns=50)
            facts = svc.get_facts()
            return _wrap_result({"context": context, "facts": facts})
        except Exception as e:
            return _error(str(e))

    @app.route("/api/memory/context")
    def memory_context():
        svc = _lazy_service("conversation_memory")
        if not svc:
            return _error("conversation_memory not available")
        try:
            context = svc.get_context(max_turns=20)
            return jsonify({"context": context})
        except Exception as e:
            return jsonify({"error": str(e)})

    @app.route("/api/memory", methods=["POST"])
    def save_memory():
        svc = _lazy_service("conversation_memory")
        if not svc:
            return _error("conversation_memory not available")
        try:
            data = request.json or {}
            svc.add(data.get("role", "user"), data.get("content", ""),
                    emotion=data.get("emotion", ""), topic=data.get("topic", ""))
            return _wrap_result({"success": True})
        except Exception as e:
            return _error(str(e))


def _register_socketio_events(sio, bus):
    """Register SocketIO event handlers and forward bus events."""

    @sio.on("connect")
    def handle_connect():
        logger.info("WebSocket client connected")

    @sio.on("disconnect")
    def handle_disconnect():
        logger.info("WebSocket client disconnected")

    @sio.on("ping")
    def handle_ping():
        emit("pong", {"ok": True})

    # Forward EventBus events to all WebSocket clients
    if bus:
        def forward_event(event_name, **data):
            try:
                sio.emit(event_name, data)
            except Exception:
                pass

        bus.on("state.changed", lambda **kw: forward_event("state.changed", **kw))
        bus.on("dispatch.event", lambda **kw: forward_event("dispatch.event", **kw))
        bus.on("emotion.updated", lambda **kw: forward_event("emotion.updated", **kw))
        bus.on("emotion.user_input", lambda **kw: forward_event("emotion.user_input", **kw))
        bus.on("scheduler.event", lambda **kw: forward_event("scheduler.event", **kw))
        bus.on("trigger.event", lambda **kw: forward_event("trigger.event", **kw))
        bus.on("workflow.event", lambda **kw: forward_event("workflow.event", **kw))
        bus.on("tts.state", lambda **kw: forward_event("tts.state", **kw))
        bus.on("voice.*", lambda **kw: forward_event("voice.event", **kw))
        bus.on("config.updated", lambda **kw: forward_event("config.updated", **kw))
        bus.on("log.recorded", lambda **kw: forward_event("log.recorded", **kw))
        logger.info("EventBus → SocketIO forwarding registered")


def create_app(event_bus=None, static_folder=None):
    """
    Create and configure the Flask application.

    Args:
        event_bus: Optional EventBus instance for event forwarding.
        static_folder: Optional path to static files (for built-in UI).

    Returns:
        Configured Flask application.
    """
    global _socketio, _event_bus, _app

    app = Flask(__name__, static_folder=static_folder, static_url_path="")
    CORS(app)

    app.config["SECRET_KEY"] = "friday-kernel"
    app.config["WTF_CSRF_ENABLED"] = False

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="[Friday] %(levelname)s %(message)s",
        stream=sys.stdout,
    )

    # Create SocketIO with multiple transport support
    sio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode="threading",
        logger=False,
        engineio_logger=False,
        ping_interval=25,
        ping_timeout=60,
    )

    _socketio = sio
    _event_bus = event_bus
    _app = app

    # Store bus reference for routes
    app.config["event_bus"] = event_bus

    # Register all REST routes
    _register_routes(app, event_bus)

    # Register SocketIO events
    _register_socketio_events(sio, event_bus)

    # 自动启动 sherpa-onnx ASR 服务
    threading.Thread(target=_start_sherpa_server, daemon=True, name="sherpa-init").start()

    # 自动清理 7 天前的日志
    def _cleanup_logs():
        import glob
        logs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
        cutoff = time.time() - 7 * 86400
        for f in glob.glob(os.path.join(logs_dir, "debug_report_*.txt")):
            try:
                if os.path.getmtime(f) < cutoff:
                    os.remove(f)
                    logger.info("Cleaned old log: %s", os.path.basename(f))
            except Exception:
                pass
    threading.Thread(target=_cleanup_logs, daemon=True).start()

    logger.info("Friday Web UI created (routes: ~50, websocket: enabled)")
    return app


def get_socketio():
    """获取全局 SocketIO 实例。"""
    global _socketio
    return _socketio
