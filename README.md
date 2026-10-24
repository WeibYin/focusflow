# 🎧 FocusFlow — 沉浸式白噪音番茄钟 & 极简任务工作台

![License](https://img.shields.io/badge/license-MIT-10b981.svg)
![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-6366f1.svg)
![Web Audio API](https://img.shields.io/badge/Audio-Web_Audio_Synth-f59e0b.svg)

**FocusFlow** 是一款专为开发者、创作者与深度学习者打造的**单页沉浸式生产力工作台**。它结合了番茄工作法（Pomodoro）、基于浏览器原生 **Web Audio API 实时物理合成的白噪音混音台**、极简待办任务看板以及**仿 GitHub 绿格子风格的专注贡献热力图**。

> 💡 **零外部音频文件依赖、零构建配置**：所有雨声、壁炉篝火、深海潮汐与 Alpha 专注双耳节拍均通过数学滤波算法在浏览器内实时生成，克隆即用，完美支持 **GitHub Pages** 一键部署。

---

## ✨ 核心特性

- 🍅 **流光环形番茄钟**
  - 支持「专注模式」「短休息」「长休息」一键切换与自定义时长。
  - 键盘快捷键支持（按 `Space` 快速启动/暂停，按 `R` 重置计时）。
  - 计时结束自动触发 Web Audio 正弦琶音治愈提示音，并将番茄数自动累加到当前绑定的任务。
- 🎛️ **纯 Web Audio API 环境白噪音合成器**
  - **🌧️ 窗外夜雨**：粉红噪波（Pink Noise）+ 低通滤波器实时合成。
  - **🔥 壁炉篝火**：布朗噪波（Brown Noise）暖低频 + 随机火花噼啪脉冲。
  - **🌊 深海潮汐**：低频振荡器（LFO）调制的 7 秒呼吸节律海浪。
  - **🧠 Alpha 专注脑波**：左耳 `216Hz` + 右耳 `226Hz` 形成 `10Hz` Alpha 双耳差频，帮助大脑快速进入心流状态。
  - 内置 **「💻 深度编码」** 与 **「🌧️ 雨夜阅读」** 一键声景预设。
- 📋 **任务绑定看板**
  - 为每个任务设置优先级（🔥 高优 / ⚡ 普通 / 🌱 轻松）与预计番茄数。
  - 点击任意任务即可将其设为当前专注目标，所有数据自动持久化在本地 `localStorage`。
- 🟩 **GitHub 风格专注度热力图 (Focus Graph)**
  - 展示过去 24 周的每日专注贡献格子，支持一键切换「演示数据」与「真实打卡数据」。
- 🎨 **多套极客主题切换**
  - 内置 **极客翠绿 (Emerald)**、**深空星蓝 (Indigo)**、**温暖篝火 (Amber)**、**霓虹玫红 (Rose)** 四套毛玻璃暗黑主题。

---

## 🚀 快速开始

### 方式一：直接双击打开
无需安装 Node.js 或任何依赖，直接用现代浏览器打开 `index.html` 即可使用。

### 方式二：本地启动静态服务器
```bash
git clone https://github.com/<你的用户名>/focusflow.git
cd focusflow
# 使用 Python 内置服务器预览
python -m http.server 8080
```
然后在浏览器访问 `http://localhost:8080`。

---

## 📁 目录结构

```text
focusflow/
├── index.html       # 主界面结构与 SVG 环形计时器
├── css/
│   └── style.css    # 响应式毛玻璃暗黑样式与多主题变量
├── js/
│   ├── audio.js     # Web Audio API 实时白噪音与和弦合成引擎
│   └── app.js       # 番茄钟状态机、任务看板与 24 周热力图渲染
├── LICENSE          # MIT 开源协议
└── README.md        # 项目说明文档
```

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源，欢迎 Star ⭐ 与 Fork！
