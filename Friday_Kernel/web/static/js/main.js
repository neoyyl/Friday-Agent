/**
 * 女娲 (Nuwa) — 主菜单交互逻辑
 * Three zoom levels: fullbody → halfbody → closeup
 */
(function() {
  'use strict';

  // --- State ---
  const ZOOM_LEVELS = ['full', 'half', 'close'];
  const ZOOM_NAMES = { full: '远景', half: '中景', close: '近景' };

  let currentZoom = 0; // index into ZOOM_LEVELS
  let isTransitioning = false;
  let autoAdvanceTimer = null;
  let breatheTimer = null;

  // Phase 4: Emotion state
  const EMOTION_LABELS = {
    happy: { icon: '😊', label: '开心', color: '#FFD700' },
    sad: { icon: '😢', label: '难过', color: '#6B8EC4' },
    angry: { icon: '😠', label: '生气', color: '#FF6B6B' },
    surprised: { icon: '😮', label: '惊讶', color: '#FFB347' },
    anxious: { icon: '😰', label: '焦虑', color: '#9B8EC4' },
    neutral: { icon: '😐', label: '平静', color: '#B8B8B8' },
  };
  let currentEmotion = 'neutral';
  let emotionIntensity = 0;

  // --- DOM Refs ---
  const app = document.querySelector('.app-container');
  const stage = document.querySelector('.character-stage');
  const image = document.querySelector('.character-image');
  const indicator = document.querySelector('.zoom-indicator');
  const dots = indicator ? indicator.querySelectorAll('span') : null;
  const greeting = document.querySelector('.greeting');
  const listening = document.querySelector('.listening-indicator');
  const clickHint = document.querySelector('.click-hint');
  const topBar = document.querySelector('.top-bar');
  const bottomLeft = document.querySelector('.bottom-left');

  // --- Init ---
  function init() {
    setZoom(0, true);
    updateTime();
    setInterval(updateTime, 1000);
    fetchGreeting();
    setupEvents();
    showClickHint();
    startBreathe();
  }

  // --- Zoom Control ---
  function setZoom(level, instant = false) {
    if (isTransitioning && !instant) return;
    
    currentZoom = Math.max(0, Math.min(level, ZOOM_LEVELS.length - 1));
    const zoomClass = `zoom-${ZOOM_LEVELS[currentZoom]}`;
    
    // Update class on app container
    ZOOM_LEVELS.forEach(z => app.classList.remove(`zoom-${z}`));
    app.classList.add(zoomClass);
    
    // Update indicator dots
    if (dots) {
      dots.forEach((d, i) => d.classList.toggle('active', i === currentZoom));
    }
    
    // Show/hide greeting at half zoom
    if (greeting) {
      greeting.classList.toggle('visible', currentZoom === 1);
    }
    
    // Show/hide listening at close zoom
    if (listening) {
      listening.classList.toggle('visible', currentZoom === 2);
    }
    
    // Show/hide click hint
    if (clickHint) {
      clickHint.style.display = currentZoom === 2 ? 'none' : '';
    }
    
    // Phase 4: Gesture animation
    const gesture = STATE_GESTURE[currentNuwaState] || 'tilt';
    setGesture(gesture);

    // Breathing animation pause/resume (keep current state class)
    const currentBreatheClass = NUWA_STATES[currentNuwaState]?.breatheClass || 'breathe-idle';
    image.classList.toggle(currentBreatheClass, currentZoom !== 2);
    
    // Auto-advance timer for close-up
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
    
    if (!instant) {
      isTransitioning = true;
      setTimeout(() => { isTransitioning = false; }, 800);
    }
  }

  function zoomIn() {
    setZoom(currentZoom + 1);
  }

  function zoomOut() {
    setZoom(currentZoom - 1);
  }

  // ─── Phase 4: Emotion + Gesture ───

  function setEmotion(emotion, intensity) {
    if (!emotion || emotion === currentEmotion) return;
    currentEmotion = emotion;
    emotionIntensity = intensity || 0.5;

    const info = EMOTION_LABELS[emotion] || EMOTION_LABELS.neutral;
    const image = document.querySelector('.character-image');
    const glow = document.getElementById('emotionGlow');
    const badge = document.getElementById('emotionBadge');

    // Update emotion glow
    if (glow) {
      glow.className = 'emotion-glow active ' + emotion;
      if (emotion === 'neutral' || !emotionIntensity || emotionIntensity < 0.3) {
        glow.classList.remove('active');
      }
    }

    // Update badge
    if (badge) {
      badge.className = 'emotion-badge visible ' + emotion;
      badge.textContent = info.icon + ' ' + info.label;
      if (emotion === 'neutral' || !emotionIntensity || emotionIntensity < 0.3) {
        badge.classList.remove('visible');
      }
    }

    // Emotion animation speed on character
    if (image) {
      // Remove old emotion classes
      Object.keys(EMOTION_LABELS).forEach(e => {
        image.classList.remove('emotion-' + e);
      });
      if (emotion !== 'neutral') {
        image.classList.add('emotion-' + emotion);
      }
    }

    console.log('[Emotion]', emotion, '(' + (intensity || 0).toFixed(2) + ')');
  }

  function setGesture(gesture) {
    const image = document.querySelector('.character-image');
    if (!image) return;

    // Clear all gesture classes
    const gestures = ['gesture-tilt', 'gesture-sway', 'gesture-speaking', 'gesture-listening'];
    gestures.forEach(g => image.classList.remove(g));

    if (gesture && gesture !== 'none') {
      image.classList.add('gesture-' + gesture);
    }
  }

  // Map state to gesture
  const STATE_GESTURE = {
    idle: 'tilt',
    listening: 'listening',
    speaking: 'speaking',
    waking: 'tilt',
    working: 'tilt',
    notify: 'sway',
    sleeping: 'none',
  };

  // ─── Event Handlers ───
  function setupEvents() {
    // Click to advance
    document.addEventListener('click', (e) => {
      // Don't handle clicks on interactive elements
      if (e.target.closest('.settings-btn, .settings-page, .wizard-overlay')) return;
      zoomIn();
    });
    
    // Mouse wheel
    document.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY > 0) zoomIn();
      else zoomOut();
    }, { passive: false });
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === 'Escape') {
        setZoom(0);
      }
    });
    
    // Touch support
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
      const endY = e.changedTouches[0].clientY;
      const diff = touchStartY - endY;
      if (Math.abs(diff) > 30) {
        if (diff > 0) zoomIn();
        else zoomOut();
      }
    }, { passive: true });
  }

  // --- UI Updates ---
  function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('zh-CN', { 
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
    });
    
    const timeEl = document.querySelector('.time');
    const dateEl = document.querySelector('.date');
    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
  }

  function fetchGreeting() {
    fetch('/api/hello')
      .then(r => r.json())
      .then(data => {
        const h1 = greeting ? greeting.querySelector('h1') : null;
        const p = greeting ? greeting.querySelector('p') : null;
        if (h1) h1.textContent = data.greeting;
        if (p) p.textContent = `${data.date} · ${data.time}`;
      })
      .catch(() => {});
  }

  function showClickHint() {
    if (clickHint) {
      setTimeout(() => clickHint.classList.add('visible'), 2000);
    }
  }

  function startBreathe() {
    const stateClass = NUWA_STATES[currentNuwaState]?.breatheClass || 'breathe-idle';
    image.classList.add(stateClass);
  }

  // --- Wizard Control (exposed globally) ---
  window.NuwaWizard = {
    show() {
      document.querySelector('.wizard-overlay').classList.add('active');
    },
    hide() {
      document.querySelector('.wizard-overlay').classList.remove('active');
    },
    nextStep(currentStep) {
      const totalSteps = 4;
      if (currentStep < totalSteps) {
        // Show next step
        document.querySelectorAll('.wizard-step').forEach((el, i) => {
          el.style.display = i === currentStep ? 'block' : 'none';
        });
      }
    },
    complete(formData) {
      fetch('/api/wizard_complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      }).then(() => {
        this.hide();
      });
    }
  };

  // --- Settings Control ---
  window.NuwaSettings = {
    open() {
      const page = document.querySelector('.settings-page');
      if (page) page.classList.add('active');
      // Load current config
      fetch('/api/config')
        .then(r => r.json())
        .then(cfg => {
          // Populate form
          const nameInput = document.getElementById('settings-name');
          if (nameInput) nameInput.value = cfg.name || '女娲';
        });
    },
    close() {
      document.querySelector('.settings-page').classList.remove('active');
    },
    save() {
      const nameInput = document.getElementById('settings-name');
      const data = {};
      if (nameInput) data.name = nameInput.value;
      
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(() => {
        this.close();
        fetchGreeting(); // Refresh greeting with new name
      });
    }
  };

  // ========================================
  // Nuwa State Management (placeholder for 0.5)
  // 提前建设状态驱动层，0.4 WebSocket 接入后自动调用
  // ========================================

  const NUWA_STATES = {
    idle:     { label: '待机',   glowClass: 'idle',     breatheClass: 'breathe-idle' },
    waking:   { label: '唤醒中', glowClass: 'waking',   breatheClass: 'breathe-waking' },
    listening:{ label: '倾听中', glowClass: 'listening', breatheClass: 'breathe-listening' },
    speaking: { label: '回复中', glowClass: 'speaking',  breatheClass: 'breathe-speaking' },
    working:  { label: '处理中', glowClass: 'working',  breatheClass: 'breathe-working' },
    notify:   { label: '提醒',   glowClass: 'notify',   breatheClass: 'breathe-notify' },
    sleeping: { label: '休眠',   glowClass: 'sleeping',  breatheClass: 'breathe-sleeping' },
  };

  let currentNuwaState = 'idle';

  /**
   * 设置女娲状态 — 驱动视觉变化
   * 由 WebSocket (0.4) 或状态机 (0.5) 调用
   */
  function setNuwaState(state) {
    if (!NUWA_STATES[state]) {
      console.warn('Unknown Nuwa state:', state);
      return;
    }
    currentNuwaState = state;
    const cfg = NUWA_STATES[state];

    // 1. 更新呼吸动画
    const img = document.getElementById('nuwaImage');
    if (img) {
      Object.keys(NUWA_STATES).forEach(s => {
        img.classList.remove(NUWA_STATES[s].breatheClass);
      });
      img.classList.add(cfg.breatheClass);
    }

    // 2. 更新状态光晕
    const glow = document.getElementById('stateGlow');
    if (glow) {
      Object.keys(NUWA_STATES).forEach(s => {
        glow.classList.remove(NUWA_STATES[s].glowClass);
      });
      glow.classList.add(cfg.glowClass);
      glow.classList.add('active');
    }

    // 3. 更新底部状态指示点
    const dot = document.getElementById('stateDot');
    const label = document.getElementById('stateLabel');
    if (dot) {
      Object.keys(NUWA_STATES).forEach(s => {
        dot.classList.remove(NUWA_STATES[s].glowClass);
      });
      dot.classList.add(cfg.glowClass);
    }
    if (label) {
      Object.keys(NUWA_STATES).forEach(s => {
        label.classList.remove(NUWA_STATES[s].glowClass);
      });
      label.classList.add(cfg.glowClass);
      label.textContent = cfg.label;
    }

    // 4. 自动调整 zoom 级别（状态相关）
    // idle/sleeping → 远景, listening/speaking → 近景, 其他保持
    const zoomMap = {
      idle: 0, sleeping: 0,
      listening: 2, speaking: 2,
      waking: 1, working: 1, notify: 1,
    };
    if (zoomMap[state] !== undefined) {
      setZoom(zoomMap[state]);
    }
  }

  // 暴露全局
  window.setNuwaState = setNuwaState;

  // ========================================
  // WebSocket 客户端 (0.4)
  // 连接后端 socketio，接收状态推送，自动驱动前端
  // ========================================

  let wsConnected = false;
  let nuwaSocket = null;

  function connectWebSocket() {
    // 检测 socket.io 是否加载
    if (typeof io === 'undefined') {
      // socket.io 库未加载，10秒后重试
      setTimeout(connectWebSocket, 10000);
      return;
    }

    try {
      nuwaSocket = io('/ws/nuwa', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: Infinity,
      });

      nuwaSocket.on('connect', () => {
        wsConnected = true;
        console.log('[Nuwa WS] 已连接');
        // Request current state
        nuwaSocket.emit('ping', {});
        // Refresh scheduler data
        if (window.SchedulerPanel) {
          window.SchedulerPanel.fetchJobs();
          window.SchedulerPanel.fetchStatus();
        }
      });

      nuwaSocket.on('state.changed', (data) => {
        console.log('[Nuwa WS] 状态更新:', data.state);
        if (data.state && NUWA_STATES[data.state]) {
          setNuwaState(data.state);
        }
      });

      nuwaSocket.on('config.updated', (data) => {
        console.log('[Nuwa WS] 配置更新');
        if (data.config && data.config.name) {
          document.title = data.config.name;
        }
      });

      // Scheduler events
      nuwaSocket.on('scheduler.jobs', (data) => {
        if (window.SchedulerPanel) window.SchedulerPanel.updateList(data.jobs);
      });
      nuwaSocket.on('scheduler.event', (data) => {
        console.log('[Scheduler]', data.type, data.job_name);
        if (data.type === 'job_triggered') {
          // Flash effect for triggered job
          const el = document.getElementById('sched-job-' + data.job_id);
          if (el) { el.style.background = 'rgba(255,200,50,0.3)'; setTimeout(() => el.style.background = '', 1000); }
        }
      });
      nuwaSocket.on('scheduler.health', (data) => {
        console.log('[Health]', data.report);
      });

      // Phase 4: Emotion events
      nuwaSocket.on('emotion.updated', (data) => {
        if (data.emotion) {
          setEmotion(data.emotion, data.intensity);
        }
      });

      nuwaSocket.on('emotion.user_input', (data) => {
        // User said something with emotion — animate
        setEmotion(data.emotion, data.intensity);
        // Flash the emotion badge
        setTimeout(() => {
          const badge = document.getElementById('emotionBadge');
          if (badge) badge.style.transition = 'opacity 0.3s';
        }, 100);
      });

      nuwaSocket.on('disconnect', () => {
        wsConnected = false;
        console.log('[Nuwa WS] 已断开');
      });

      nuwaSocket.on('connect_error', (err) => {
        console.warn('[Nuwa WS] 连接失败，3秒后重试:', err.message);
        wsConnected = false;
      });
    } catch (e) {
      console.warn('[Nuwa WS] 初始化失败:', e);
      setTimeout(connectWebSocket, 5000);
    }
  }

  // 自动连接
  connectWebSocket();

  // --- Scheduler Panel ---
  window.SchedulerPanel = {
    jobs: [],
    init: function() {
      this.fetchJobs();
      this.fetchStatus();
    },
    fetchJobs: function() {
      fetch('/api/scheduler/jobs')
        .then(r => r.json())
        .then(jobs => { this.jobs = jobs; this.updateList(jobs); })
        .catch(() => {});
    },
    fetchStatus: function() {
      fetch('/api/scheduler/status')
        .then(r => r.json())
        .then(s => {
          document.getElementById('schedulerStatus').textContent =
            s.running ? '运行中 (' + s.enabled_jobs + '/' + s.total_jobs + ' 任务)' : '已停止';
        })
        .catch(() => {
          document.getElementById('schedulerStatus').textContent = '未连接';
        });
    },
    updateList: function(jobs) {
      this.jobs = jobs;
      const container = document.getElementById('schedulerJobList');
      if (!container) return;
      if (!jobs || jobs.length === 0) {
        container.innerHTML = '<div style="font-size:13px;opacity:0.4;padding:8px 0">暂无定时任务</div>';
        return;
      }
      container.innerHTML = jobs.map(j => {
        const triggerDesc = this._triggerDesc(j);
        const lastRun = j.last_run ? new Date(j.last_run).toLocaleString('zh-CN') : '从未执行';
        return `
          <div id="sched-job-${j.id}" style="
            display:flex;align-items:center;justify-content:space-between;
            padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);
            font-size:13px;transition:background 0.3s">
            <div style="flex:1;min-width:0">
              <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${j.enabled ? '🟢' : '⏸️'} ${j.name}
              </div>
              <div style="font-size:11px;opacity:0.5;margin-top:2px">
                ${triggerDesc} · 运行${j.run_count}次 · ${lastRun}
              </div>
            </div>
            <button onclick="SchedulerPanel.toggleJob('${j.id}')"
                    style="background:none;border:1px solid rgba(255,255,255,0.2);
                           border-radius:4px;color:inherit;font-size:11px;padding:2px 8px;cursor:pointer">
              ${j.enabled ? '暂停' : '启用'}
            </button>
            <button onclick="SchedulerPanel.removeJob('${j.id}')"
                    style="background:none;border:none;color:#ff6b6b;font-size:14px;padding:2px 8px;cursor:pointer">
              ✕
            </button>
          </div>
        `;
      }).join('');
    },
    _triggerDesc: function(job) {
      if (job.trigger_type === 'cron') {
        const a = job.trigger_args || {};
        return (a.hour || '*') + ':' + (a.minute || '00') + ' 每周' + (a.day_of_week || '每天');
      } else if (job.trigger_type === 'interval') {
        const a = job.trigger_args || {};
        return '每' + (a.minutes || a.hours || a.seconds || '?') + (a.minutes ? '分钟' : a.hours ? '小时' : '秒');
      }
      return job.trigger_type;
    },
    toggleJob: function(jobId) {
      fetch('/api/scheduler/jobs/' + jobId + '/toggle', { method: 'POST' })
        .then(r => r.json()).then(() => this.fetchJobs());
    },
    removeJob: function(jobId) {
      if (!confirm('确定删除此任务？')) return;
      fetch('/api/scheduler/jobs/' + jobId, { method: 'DELETE' })
        .then(r => r.json()).then(() => this.fetchJobs());
    },
    showAddForm: function() {
      document.getElementById('addJobForm').style.display = 'block';
    },
    hideAddForm: function() {
      document.getElementById('addJobForm').style.display = 'none';
    },
    addJob: function() {
      const name = document.getElementById('jobName').value.trim();
      const triggerType = document.getElementById('jobTriggerType').value;
      const actionName = document.getElementById('jobAction').value;

      let triggerArgs = {};
      if (triggerType === 'cron') {
        triggerArgs = {
          hour: document.getElementById('cronHour').value || '*',
          minute: document.getElementById('cronMinute').value || '0',
        };
        const dow = document.getElementById('cronDayOfWeek').value.trim();
        if (dow) triggerArgs.day_of_week = dow;
      } else if (triggerType === 'interval') {
        triggerArgs = { minutes: parseInt(document.getElementById('intervalMinutes').value) || 30 };
      }

      fetch('/api/scheduler/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          trigger_type: triggerType,
          trigger_args: triggerArgs,
          action_type: 'callable',
          action_name: actionName,
          description: name,
        })
      })
      .then(r => r.json())
      .then(resp => {
        if (resp.status === 'ok') {
          this.hideAddForm();
          this.fetchJobs();
        } else {
          alert('添加失败: ' + (resp.message || 'unknown'));
        }
      });
    },
    toggleTriggerType: function(type) {
      document.getElementById('cronArgs').style.display = type === 'cron' ? '' : 'none';
      document.getElementById('intervalArgs').style.display = type === 'interval' ? '' : 'none';
    },
    runAction: function(actionName) {
      fetch('/api/scheduler/actions/' + actionName, { method: 'POST' })
        .then(r => r.json())
        .then(resp => {
          if (resp.status === 'ok') {
            alert('执行成功: ' + (resp.result || 'done'));
            this.fetchJobs();
          } else {
            alert('执行失败: ' + (resp.message || 'unknown'));
          }
        });
    },
  };

  // --- Boot ---
  document.addEventListener('DOMContentLoaded', () => {
    // Check if wizard is needed
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => {
        if (!cfg.wizard_completed) {
          window.NuwaWizard.show();
        }
      });
    
    init();
    setNuwaState('idle');
  });

})();
