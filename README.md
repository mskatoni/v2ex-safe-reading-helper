# V2EX Safe Reading Helper

V2EX Safe Reading Helper 是一个用于 V2EX 的 Tampermonkey / Userscript 自动阅读辅助脚本。

当前版本：`7.0.0`

## 安装

推荐通过 Greasy Fork 一键安装：

➡ [在 Greasy Fork 安装](https://greasyfork.org/en/scripts/575328-v2ex-safe-reading-helper)

也可以手动安装：

1. 安装浏览器扩展（任选其一）：[Tampermonkey](https://www.tampermonkey.net/) / [Violentmonkey](https://violentmonkey.github.io/)
2. 点击本仓库 `V2EX Safe Reading Helper-7.0.0.user.js` 文件，再点击 **Raw**
3. 扩展弹出安装确认页面后，点击 **安装**

## 功能概览

- 支持 `v2ex.com` 与 `www.v2ex.com`
- 首次启动自动拉取最新帖子 ID 作为起点
- 从当前帖子 ID 往前遍历，每轮最多 50 个
- 跨页持久化运行状态，跳转后自动续跑
- 支持暂停、立即跳下一帖
- 无需 GM API，零外部依赖

## 使用说明

| 按钮 | 功能 |
| --- | --- |
| ▶ 开始 | 启动自动阅读 |
| ⏸ 暂停 | 暂停自动阅读 |
| ⏭ 下一帖 | 立即跳转下一帖 |

默认阅读间隔为 10–15 秒随机延迟。

## 注意事项

- 请控制使用频率，避免对 V2EX 造成过高请求压力。
- 该脚本只在浏览器本地运行，不依赖后端服务。
- 自动阅读类脚本可能受站点规则、页面结构变化或反滥用策略影响。

## 仓库结构

```
.
├── LICENSE
├── README.md
├── SHA256SUMS.txt
└── V2EX Safe Reading Helper-7.0.0.user.js
```

## 社区

<a href="https://v2ex.com"><img src="https://user-images.githubusercontent.com/80169337/122051970-cd075b80-ce02-11eb-9653-0b8702377727.png" width="24" height="24" alt="V2EX" /></a>&nbsp;

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=mskatoni/v2ex-safe-reading-helper&type=Date)](https://star-history.com/#mskatoni/v2ex-safe-reading-helper&Date)

## 许可证

本项目使用 [MIT License](./LICENSE)。

你可以自由使用、复制、修改、分发、再许可或出售本软件，但需要保留原始版权声明和许可证文本。

## 免责声明

本脚本仅供个人学习与本地自动化辅助使用。请遵守 V2EX 站点规则，合理控制访问频率，自行承担使用风险。
## 免责声明

本脚本仅供个人学习与本地自动化辅助使用。请遵守 V2EX 站点规则，合理控制访问频率，自行承担使用风险。
