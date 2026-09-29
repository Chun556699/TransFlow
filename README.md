# TransFlow

高性能、低占用的双语网页翻译浏览器扩展 —— **Jev 决策模型**做毫秒级过滤与路由，**LLM 大模型**生成译文，两端点均可在设置中自定义。支持网页双语对照翻译与视频字幕翻译。

[English below](#english) · 调研报告见 [docs/research.md](docs/research.md)

## 特性

- **双模型管线**：Jev（TypeSafe SystemOne，70–500ms）逐段判断「是否值得翻译」，LLM 批量生成译文（支持 OpenAI 兼容 / Anthropic Claude / Google Gemini / Azure OpenAI / Ollama 原生，按域名自动识别，地址自动补全 https 与路径）；Jev 不可用时自动降级为本地启发式规则，开箱即用
- **秒翻体验**：视口懒翻译（IntersectionObserver）、批量请求、IndexedDB 译文缓存、动态内容增量扫描
- **高颜值双语样式**：5 套主题（细线下划线 / 磨砂卡片 / 高亮 / 柔和灰显 / 悬停显字）+ 自定义强调色、字号、CSS
- **视频字幕**：YouTube 双语字幕（拦截播放器 timedtext 请求复用其签名 URL，绕开 PoToken 限制；ASR 逐词字幕自动断句合并）；其他站点原生 CC 轨道兜底翻译
- **划词翻译**：选中文字出现浮窗（原文 + 译文 + 复制）；输入框聚焦出现翻译按钮，可一键替换输入为译文；右键菜单与 `Alt+S` 快捷键同入口
- **低占用**：零运行时依赖，content script ≈24KB、background ≈20KB、无重框架、后台零常驻状态
- **主流浏览器适配**：Chrome / Edge / Opera（MV3 service worker）、Firefox（MV3 event page）、Safari（`safari-web-extension-converter`）、iOS（Userscripts 油猴形态）

## 安装（开发者模式）

```sh
npm install
npm run build    # 产出 dist/chrome 与 dist/firefox
npm run zip      # 额外产出可分发 zip
```

- **Chrome / Edge**：`chrome://extensions` → 开发者模式 → 加载已解压的扩展 → 选 `dist/chrome`
- **Firefox**：`about:debugging` → 此 Firefox → 临时载入附加组件 → 选 `dist/firefox/manifest.json`
- **Safari**：`xcrun safari-web-extension-converter dist/chrome`

## 使用

1. 打开设置页，填 **LLM** 端点（选「接口格式」或保持自动识别；OpenAI / DeepSeek / vLLM / 阿里百炼只填域名即可，Claude、Gemini、Azure、Ollama 同样支持）与 API Key、模型名
   - 推荐：阿里百炼 **qwen-mt-turbo**（专用翻译模型，逐条调用，并发池并行；支持术语表）；或任意通用对话模型（走 JSON 批量，如 `qwen3.8-flash`、`gpt-4o-mini`）
2. （可选）填 **Jev** 端点：官方 `https://api.typesafe.ai/v1/systemone` 或自托管兼容端点（decider-2b、openjev 等）
3. 网页中点击扩展图标 →「翻译此页」，或按 `Alt+T`；双语译文随滚动懒加载
   - 选中文字点「译」浮窗图标（或右键菜单 / `Alt+S`）即可划词翻译；输入框聚焦点右下「译」可翻译并替换输入
4. YouTube 打开播放器原生字幕后，自动出现双语字幕层

## 架构

```
content script (轻)
 ├─ dom-scan    块级段落聚合（原文 DOM 不动，译文节点插入）
 ├─ translator  IO 懒翻 + MutationObserver 增量 + 批量 flush
 └─ youtube     XHR/fetch 拦截 timedtext → json3 解析 → 断句 → 双语 overlay
        │  msg
background (SW / event page)
 ├─ cache       IndexedDB 译文缓存 (sha256 key)
 ├─ jev         SystemOne 决策层（Noul 过滤，一次请求并行判 100 段）
 ├─ llm         批量翻译（JSON 数组对齐、注入防护）
 ├─ providers   多接口格式适配（OpenAI/Anthropic/Gemini/Azure/Ollama）
 └─ translate   管线编排 + 并发池 + 重试退避
```

**为什么是 Jev**：它是非生成式决策模型（Choice/Score/Noul），不做 decode 所以毫秒级、按输入计费（$0.042/M token）。用它做「这段要不要翻」的并行 Noul 门控，能在不损失质量的前提下砍掉大量 LLM 调用 —— 详见调研报告。

## English

Fast, low-footprint bilingual webpage-translation extension. A **Jev decision model** (TypeSafe SystemOne) gates which segments are worth translating in milliseconds; an **OpenAI-compatible LLM** generates the translations. Both endpoints are user-configurable in settings.

- Bilingual page translation with lazy viewport scanning, batching, IndexedDB cache, 5 translation themes + custom CSS
- YouTube bilingual subtitles via timedtext interception (reuses the player's signed URL, sidestepping PoToken); generic `<video>` CC-track fallback
- Chrome/Edge (MV3 SW) + Firefox (MV3 event page) builds from one codebase; Safari via converter

Build: `npm install && npm run build` → load `dist/chrome` or `dist/firefox`. See [docs/research.md](docs/research.md) for the ecosystem analysis.

## License

MIT
