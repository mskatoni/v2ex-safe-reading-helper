# V2EX Safe Reading Helper

V2EX Safe Reading Helper 是一个用于 V2EX 的 Tampermonkey / Userscript 自动阅读辅助脚本。

当前版本：`5.3.0`

## 安装

推荐通过 Greasy Fork 一键安装：

➡ [在 Greasy Fork 安装](https://greasyfork.org/en/scripts/575328-v2ex-safe-reading-helper)

也可以手动安装：
1. 安装浏览器扩展（任选其一）：[Tampermonkey](https://www.tampermonkey.net/) / [Violentmonkey](https://violentmonkey.github.io/)
2. 点击本仓库 `V2EX Safe Reading Helper-5.3.0.user.js` 文件，再点击 **Raw**
3. 扩展弹出安装确认页面后，点击 **安装**

## 功能概览

- 支持 `v2ex.com` 与 `www.v2ex.com`
- 自动维护阅读队列
- 持久化队列、游标与运行状态
- 多来源补充主题：API、Recent、节点页面、ID 扫描
- 支持暂停、下一帖、刷新补队列、重置状态
- 队列不足时自动预补
- 遇到网络异常、空队列或限流时自动等待重试
- 页面白屏 / 卡死时自动刷新保护
- 兼容 `GM_getValue` / `GM_setValue`，无 GM API 时回退到 `localStorage`

## 使用说明

| 按钮 | 功能 |
|------|------|
| ▶ 开始 | 启动自动阅读 |
| ⏸ 暂停 | 暂停自动阅读，并清除运行状态 |
| ⏭ 下一帖 | 立即打开队列中的下一帖 |
| 🔄 刷新 | 手动补充队列 |
| 🗑 重置 | 清空队列、已读记录、游标和运行状态 |

默认阅读间隔为 10–15 秒随机延迟。

## 注意事项

- 请控制使用频率，避免对 V2EX 造成过高请求压力。
- 若触发限流，脚本会进入等待重试状态。
- 该脚本只在浏览器本地运行，不依赖后端服务。
- 自动阅读类脚本可能受站点规则、页面结构变化或反滥用策略影响。

## 仓库结构

```
.
├── LICENSE
├── README.md
├── SHA256SUMS.txt
└── V2EX Safe Reading Helper-5.3.0.user.js
```

## 许可证

本项目使用 [MIT License](LICENSE)。

你可以自由使用、复制、修改、分发、再许可或出售本软件，但需要保留原始版权声明和许可证文本。

## 免责声明

本脚本仅供个人学习与本地自动化辅助使用。请遵守 V2EX 站点规则，合理控制访问频率，自行承担使用风险。
