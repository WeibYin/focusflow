/**
 * FocusFlow Core Application Logic
 * 包含：番茄钟状态机、任务看板持久化、仿 GitHub 24周专注热力图、背景动态粒子画布
 */

(() => {
  const STORAGE_KEY = 'focusflow_state_v1';
  const CIRCUMFERENCE = 2 * Math.PI * 114; // r=114 -> ~716.28

  const defaultState = {
    theme: 'emerald',
    settings: {
      focus: 25,
      shortBreak: 5,
      longBreak: 15,
    },
    activeTaskId: 't-1',
    filter: 'all',
    useDemoHeatmap: true,
    tasks: [
      { id: 't-1', title: '打造 FocusFlow 沉浸式番茄工作台并开源到 GitHub', est: 3, donePomos: 1, priority: 'high', completed: false },
      { id: 't-2', title: '体验 Web Audio 实时合成的窗外夜雨与篝火白噪音', est: 1, donePomos: 1, priority: 'medium', completed: true },
      { id: 't-3', title: '开启 GitHub Pages 让所有访问者在线预览项目', est: 2, donePomos: 0, priority: 'high', completed: false },
    ],
    // Map of 'YYYY-MM-DD' -> { pomos: number, mins: number }
    history: {},
  };

  let state = loadState();
  const audio = new window.AmbientAudioEngine();

  // Timer runtime variables
  let currentMode = 'focus'; // 'focus' | 'shortBreak' | 'longBreak'
  let totalSeconds = state.settings.focus * 60;
  let remainingSeconds = totalSeconds;
  let timerInterval = null;
  let isRunning = false;

  // DOM Elements
  const elTimerDisplay = document.getElementById('timer-display');
  const elTimerProgress = document.getElementById('timer-progress');
  const elStatusBadge = document.getElementById('timer-status-badge');
  const elBtnToggle = document.getElementById('btn-toggle');
  const elBtnToggleText = document.getElementById('btn-toggle-text');
  const elBtnReset = document.getElementById('btn-reset');
  const elBtnSkip = document.getElementById('btn-skip');
  const elActiveTaskTitle = document.getElementById('active-task-title');
  const elTaskList = document.getElementById('task-list');
  const elTaskForm = document.getElementById('task-form');
  const elTaskInput = document.getElementById('task-input');
  const elTaskEst = document.getElementById('task-est');
  const elTaskPriority = document.getElementById('task-priority');
  const elTaskSummary = document.getElementById('task-summary');
  const elHeatmapGrid = document.getElementById('heatmap-grid');
  const elHeatmapMonths = document.getElementById('heatmap-months');
  const elHeatmapTotalText = document.getElementById('heatmap-total-text');
  const elStatTodayPomos = document.getElementById('stat-today-pomos');
  const elStatTodayMins = document.getElementById('stat-today-mins');
  const elStatStreak = document.getElementById('stat-streak');
  const elToast = document.getElementById('toast');

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(defaultState),
        ...parsed,
        settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      };
    } catch (_) {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function formatDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function showToast(msg) {
    elToast.textContent = msg;
    elToast.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      elToast.classList.add('hidden');
    }, 3200);
  }

  // ==================== Theme ====================
  function applyTheme(themeName) {
    state.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    document.querySelectorAll('.theme-dot').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.themeVal === themeName);
    });
    saveState();
  }

  // ==================== Timer Engine ====================
  function switchMode(mode) {
    pauseTimer();
    currentMode = mode;
    totalSeconds = (state.settings[mode] || 25) * 60;
    remainingSeconds = totalSeconds;

    document.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    const labels = {
      focus: 'READY TO FOCUS',
      shortBreak: 'SHORT BREAK',
      longBreak: 'LONG REST',
    };
    elStatusBadge.textContent = labels[mode] || 'READY';
    updateTimerUI();
  }

  function updateTimerUI() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    elTimerDisplay.textContent = formatted;
    document.title = isRunning ? `(${formatted}) FocusFlow` : 'FocusFlow — 沉浸式白噪音番茄钟 & 极简任务工作台';

    const ratio = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
    const offset = CIRCUMFERENCE * (1 - ratio);
    elTimerProgress.style.strokeDashoffset = offset.toFixed(2);
  }

  function startTimer() {
    if (isRunning) return;
    isRunning = true;
    elBtnToggleText.textContent = '暂停';
    elStatusBadge.textContent = currentMode === 'focus' ? 'DEEP FOCUSING...' : 'RECHARGING...';

    timerInterval = setInterval(() => {
      if (remainingSeconds > 0) {
        remainingSeconds--;
        updateTimerUI();
      } else {
        completeCurrentPhase();
      }
    }, 1000);
  }

  function pauseTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    elBtnToggleText.textContent = currentMode === 'focus' ? '开始专注' : '开始休息';
    updateTimerUI();
  }

  function completeCurrentPhase() {
    pauseTimer();
    audio.playChime();

    if (currentMode === 'focus') {
      const focusMins = state.settings.focus || 25;
      recordFocusSession(focusMins);

      // Increment active task pomodoro count
      const activeTask = state.tasks.find((t) => t.id === state.activeTaskId);
      if (activeTask) {
        activeTask.donePomos = (activeTask.donePomos || 0) + 1;
        showToast(`🎉 完成 1 个番茄钟！已累加至「${activeTask.title}」`);
      } else {
        showToast(`🎉 棒极了！已完成 ${focusMins} 分钟深度专注！`);
      }

      saveState();
      renderTasks();
      renderStatsAndHeatmap();
      switchMode('shortBreak');
    } else {
      showToast('⚡ 休息结束，准备好开启新一轮专注了吗？');
      switchMode('focus');
    }
  }

  function recordFocusSession(mins) {
    const todayKey = formatDateKey(new Date());
    if (!state.history[todayKey]) {
      state.history[todayKey] = { pomos: 0, mins: 0 };
    }
    state.history[todayKey].pomos += 1;
    state.history[todayKey].mins += mins;
    saveState();
  }

  // ==================== White Noise Mixer ====================
  function initMixer() {
    document.querySelectorAll('.sound-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.sound;
        const active = audio.toggleSound(type);
        const card = document.querySelector(`.sound-channel[data-sound="${type}"]`);
        if (card) card.classList.toggle('playing', active);
      });
    });

    document.querySelectorAll('.sound-slider').forEach((slider) => {
      slider.addEventListener('input', (e) => {
        const type = slider.dataset.sound;
        const val = Number(e.target.value);
        const label = document.getElementById(`vol-label-${type}`);
        if (label) label.textContent = `${val}%`;
        audio.setVolume(type, val);
      });
    });

    document.querySelectorAll('.mixer-presets .preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const preset = chip.dataset.preset;
        audio.stopAll();
        document.querySelectorAll('.sound-channel').forEach((c) => c.classList.remove('playing'));

        if (preset === 'coding') {
          activatePresetChannel('rain', 35);
          activatePresetChannel('binaural', 22);
          showToast('🎧 已开启「深度编码」声景：窗外夜雨 + Alpha 双耳脑波');
        } else if (preset === 'reading') {
          activatePresetChannel('rain', 50);
          activatePresetChannel('fire', 40);
          showToast('🌧️ 已开启「雨夜阅读」声景：窗外夜雨 + 壁炉篝火');
        } else if (preset === 'mute') {
          showToast('🔇 已静音所有环境白噪音');
        }
      });
    });
  }

  function activatePresetChannel(type, vol) {
    const slider = document.querySelector(`.sound-slider[data-sound="${type}"]`);
    const label = document.getElementById(`vol-label-${type}`);
    const card = document.querySelector(`.sound-channel[data-sound="${type}"]`);
    if (slider) slider.value = vol;
    if (label) label.textContent = `${vol}%`;
    audio.setVolume(type, vol);
    audio.toggleSound(type);
    if (card) card.classList.add('playing');
  }

  // ==================== Tasks Workbench ====================
  function renderTasks() {
    elTaskList.innerHTML = '';

    const activeTask = state.tasks.find((t) => t.id === state.activeTaskId);
    elActiveTaskTitle.textContent = activeTask
      ? `正在攻克：${activeTask.title}`
      : '点击右侧任务设为当前专注目标';

    const filtered = state.tasks.filter((t) => {
      if (state.filter === 'active') return !t.completed;
      if (state.filter === 'completed') return t.completed;
      return true;
    });

    const priorityLabels = {
      high: '🔥 高优',
      medium: '⚡ 普通',
      low: '🌱 轻松',
    };

    filtered.forEach((task) => {
      const li = document.createElement('li');
      li.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === state.activeTaskId ? 'active-focus' : ''}`;

      li.innerHTML = `
        <div class="task-left">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="完成任务" />
          <span class="priority-tag priority-${task.priority}">${priorityLabels[task.priority] || '⚡ 普通'}</span>
          <span class="task-text" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</span>
        </div>
        <div class="task-right">
          <span class="task-pomo-count">🍅 ${task.donePomos || 0}/${task.est || 1}</span>
          <button class="task-delete-btn" title="删除任务" aria-label="删除任务">✕</button>
        </div>
      `;

      const checkbox = li.querySelector('.task-checkbox');
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        task.completed = checkbox.checked;
        saveState();
        renderTasks();
      });

      const delBtn = li.querySelector('.task-delete-btn');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.tasks = state.tasks.filter((item) => item.id !== task.id);
        if (state.activeTaskId === task.id) {
          state.activeTaskId = state.tasks[0]?.id || null;
        }
        saveState();
        renderTasks();
      });

      li.addEventListener('click', () => {
        state.activeTaskId = task.id;
        saveState();
        renderTasks();
      });

      elTaskList.appendChild(li);
    });

    const pendingCount = state.tasks.filter((t) => !t.completed).length;
    elTaskSummary.textContent = `共 ${pendingCount} 项待办 · 已完成 ${state.tasks.length - pendingCount} 项`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==================== Heatmap & Stats ====================
  function getDeterministicDemoPomos(dateStr) {
    // 稳定的伪随机演示数据，确保展示效果饱满美观
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = (hash * 31 + dateStr.charCodeAt(i)) % 10007;
    }
    if (hash % 5 === 0) return 0;
    if (hash % 7 === 0) return 5;
    return (hash % 4) + 1;
  }

  function renderStatsAndHeatmap() {
    const today = new Date();
    const todayKey = formatDateKey(today);
    const todayData = state.history[todayKey] || { pomos: 0, mins: 0 };

    elStatTodayPomos.textContent = todayData.pomos;
    elStatTodayMins.textContent = `${todayData.mins}m`;

    // Build 24 weeks (168 days) heatmap ending on current week's Saturday
    const WEEKS = 24;
    const totalDays = WEEKS * 7;
    const endDay = new Date(today);
    const startDay = new Date(today);
    startDay.setDate(endDay.getDate() - totalDays + 1);

    elHeatmapGrid.innerHTML = '';
    elHeatmapMonths.innerHTML = '';

    let totalMinutes24w = 0;
    let streak = 0;
    let lastMonth = -1;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + i);
      const key = formatDateKey(d);

      // Month header tracking (on first row of each column)
      if (i % 7 === 0) {
        const m = d.getMonth();
        const monthSpan = document.createElement('span');
        if (m !== lastMonth) {
          monthSpan.textContent = `${m + 1}月`;
          lastMonth = m;
        }
        elHeatmapMonths.appendChild(monthSpan);
      }

      const realEntry = state.history[key];
      const pomos = realEntry
        ? realEntry.pomos
        : state.useDemoHeatmap && d <= today
        ? getDeterministicDemoPomos(key)
        : 0;

      const mins = realEntry ? realEntry.mins : pomos * 25;
      totalMinutes24w += mins;

      let level = 0;
      if (pomos === 1) level = 1;
      else if (pomos === 2) level = 2;
      else if (pomos >= 3 && pomos <= 4) level = 3;
      else if (pomos >= 5) level = 4;

      const cell = document.createElement('div');
      cell.className = `heat-cell level-${level}`;
      cell.title = `${key}：完成 ${pomos} 🍅 (${mins} 分钟)`;
      elHeatmapGrid.appendChild(cell);
    }

    // Calculate streak
    for (let back = 0; back < 60; back++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - back);
      const k = formatDateKey(checkDate);
      const p = state.history[k]?.pomos || (state.useDemoHeatmap ? getDeterministicDemoPomos(k) : 0);
      if (p > 0) {
        streak++;
      } else if (back > 0) {
        break;
      }
    }

    elStatStreak.textContent = `${streak} 天`;
    const hours = (totalMinutes24w / 60).toFixed(1);
    elHeatmapTotalText.textContent = `过去 24 周累计专注 ${totalMinutes24w} 分钟 (约 ${hours} 小时)${state.useDemoHeatmap ? ' · [当前含演示数据]' : ''}`;
  }

  // ==================== Background Particle Canvas ====================
  function initBackgroundCanvas() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = Array.from({ length: 38 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2 + 0.8,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.45 + 0.15,
    }));

    function animate() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.fill();
      });
      requestAnimationFrame(animate);
    }
    animate();
  }

  // ==================== Event Bindings ====================
  function bindEvents() {
    // Theme buttons
    document.querySelectorAll('.theme-dot').forEach((btn) => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.themeVal));
    });

    // Mode tabs
    document.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    // Timer controls
    elBtnToggle.addEventListener('click', () => {
      if (isRunning) pauseTimer();
      else startTimer();
    });

    elBtnReset.addEventListener('click', () => {
      pauseTimer();
      remainingSeconds = totalSeconds;
      updateTimerUI();
      showToast('⏱️ 计时器已重置');
    });

    elBtnSkip.addEventListener('click', () => {
      completeCurrentPhase();
    });

    // Keyboard shortcut: Space to toggle timer when not typing in input
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (isRunning) pauseTimer();
        else startTimer();
      } else if (e.key === 'r' || e.key === 'R') {
        pauseTimer();
        remainingSeconds = totalSeconds;
        updateTimerUI();
      }
    });

    // Task form submit
    elTaskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = elTaskInput.value.trim();
      if (!title) return;

      const newTask = {
        id: `t-${Date.now()}`,
        title,
        est: Math.max(1, Number(elTaskEst.value) || 1),
        donePomos: 0,
        priority: elTaskPriority.value,
        completed: false,
      };
      state.tasks.unshift(newTask);
      state.activeTaskId = newTask.id;
      elTaskInput.value = '';
      saveState();
      renderTasks();
      showToast('✅ 已添加新任务并设为当前专注目标');
    });

    // Task filters
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.filter = btn.dataset.filter;
        document.querySelectorAll('.filter-btn').forEach((b) =>
          b.classList.toggle('active', b.dataset.filter === state.filter)
        );
        renderTasks();
      });
    });

    document.getElementById('btn-clear-completed').addEventListener('click', () => {
      state.tasks = state.tasks.filter((t) => !t.completed);
      saveState();
      renderTasks();
      showToast('🧹 已清理所有已完成任务');
    });

    // Heatmap controls
    document.getElementById('btn-demo-data').addEventListener('click', () => {
      state.useDemoHeatmap = !state.useDemoHeatmap;
      saveState();
      renderStatsAndHeatmap();
      showToast(state.useDemoHeatmap ? '✨ 已开启热力图演示数据' : '📊 已切换为仅显示真实打卡数据');
    });

    document.getElementById('btn-log-session').addEventListener('click', () => {
      audio.playChime();
      recordFocusSession(state.settings.focus || 25);
      renderStatsAndHeatmap();
      showToast('🟩 已在今日热力图上记录 1 个番茄钟！');
    });

    // Settings Modal
    const modal = document.getElementById('settings-modal');
    document.getElementById('btn-settings').addEventListener('click', () => {
      document.getElementById('set-focus').value = state.settings.focus;
      document.getElementById('set-short').value = state.settings.shortBreak;
      document.getElementById('set-long').value = state.settings.longBreak;
      modal.classList.remove('hidden');
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      state.settings.focus = Math.max(1, Number(document.getElementById('set-focus').value) || 25);
      state.settings.shortBreak = Math.max(1, Number(document.getElementById('set-short').value) || 5);
      state.settings.longBreak = Math.max(1, Number(document.getElementById('set-long').value) || 15);
      saveState();
      modal.classList.add('hidden');
      switchMode(currentMode);
      showToast('⚙️ 计时器设置已保存');
    });
  }

  // Init
  applyTheme(state.theme || 'emerald');
  switchMode('focus');
  initMixer();
  renderTasks();
  renderStatsAndHeatmap();
  bindEvents();
  initBackgroundCanvas();
})();
