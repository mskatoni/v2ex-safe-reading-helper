# V2EX Safe Reading Helper

V2EX Safe Reading Helper 是一个用于 V2EX 的 Tampermonkey / Userscript 本地辅助脚本。

当前版本：`7.0.1`

## 安装

推荐通过 Greasy Fork 一键安装：

[在 Greasy Fork 安装](https://greasyfork.org/en/scripts/575328-v2ex-safe-reading-helper)

也可以手动安装：

1. 安装浏览器扩展，例如 Tampermonkey 或 Violentmonkey。
2. 打开本仓库的 `V2EX Safe Reading Helper.user.js`。
3. 点击 Raw，扩展弹出安装确认页面后点击安装。

## 功能概览

- 支持 `v2ex.com` 与 `www.v2ex.com`。
- 使用 Tampermonkey 菜单控制，不再显示右下角 UI 面板。
- 自动阅读从当前帖子 ID 往前遍历，每轮最多 50 个。
- 首次启动时可从 `/api/topics/latest.json` 获取最新帖子 ID 作为起点。
- 支持菜单命令：自动阅读、下一帖、重置阅读起点。
- 可选隐藏发帖入口、推广容器、右侧发帖提示和评论区。
- 可选 spam 举报附加：评论内容只有 `spam` 时，提交前自动附加指定 V2EX 成员链接。

## 菜单项

| 菜单项 | 类型 | 默认状态 | 说明 |
| --- | --- | --- | --- |
| 自动阅读 | 开关 | 关闭 | 10-15 秒随机延迟后跳到上一 ID 帖子 |
| 下一帖 | 一次性命令 | 不适用 | 立即跳转下一帖 |
| 重置阅读起点 | 一次性命令 | 不适用 | 将当前帖子 ID 设为新的遍历起点 |
| 屏蔽发帖/评论入口 | 开关 | 关闭 | 隐藏发帖按钮、推广容器、右侧发帖提示和 `#reply-box` |
| Spam 举报附加 | 开关 | 开启 | 当评论框只输入 `spam` 时，提交前自动附加成员链接 |

## Spam 举报附加

开启后，如果回复框内容仅为：

```text
spam
```

脚本会在提交前自动追加这些成员链接：

```text
@[Livid](https://www.v2ex.com/member/Livid) (https://www.v2ex.com/member/Livid)
@[Kai](https://www.v2ex.com/member/Kai) (https://www.v2ex.com/member/Kai)
@[Olivia](https://www.v2ex.com/member/Olivia) (https://www.v2ex.com/member/Olivia)
@[GordianZ](https://www.v2ex.com/member/GordianZ) (https://www.v2ex.com/member/GordianZ)
@[sparanoid](https://www.v2ex.com/member/sparanoid) (https://www.v2ex.com/member/sparanoid)
@[drymonfidelia](https://www.v2ex.com/member/drymonfidelia) (https://www.v2ex.com/member/drymonfidelia)
@[sillydaddy](https://www.v2ex.com/member/sillydaddy) (https://www.v2ex.com/member/sillydaddy)
```

该功能只在提交前检测精确内容 `spam`，不会修改其他正常回复。

## 注意事项

- 脚本只在浏览器本地运行，不依赖后端服务。
- 自动阅读类脚本会产生真实访问行为，请控制使用频率。
- 隐藏入口只是前端隐藏，不改变账号权限或站点规则。
- Spam 举报附加会修改回复框内容，请在提交前自行确认。

## 仓库结构

```text
.
├── LICENSE
├── README.md
├── SHA256SUMS.txt
├── V2EX Safe Reading Helper.user.js
└── V2EX Safe Reading Helper-5.3.0.user.js
```

## 社区

<a href="https://v2ex.com"><img src="https://user-images.githubusercontent.com/80169337/122051970-cd075b80-ce02-11eb-9653-0b8702377727.png" width="24" height="24" alt="V2EX" /></a>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=mskatoni/v2ex-safe-reading-helper&type=Date)](https://star-history.com/#mskatoni/v2ex-safe-reading-helper&Date)

## 许可证

本项目使用 [MIT License](./LICENSE)。

## 免责声明

本脚本仅供个人学习与本地自动化辅助使用。请遵守 V2EX 站点规则，合理控制访问频率，自行承担使用风险。
