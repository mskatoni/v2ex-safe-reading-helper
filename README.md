# V2EX Safe Reading Helper

V2EX Safe Reading Helper 是一个用于 V2EX 的 Tampermonkey / Userscript 自动阅读辅助脚本。

> 当前脚本头部版本：`5.3.0`  
> 当前仓库内脚本文件：`V2EX Safe Reading Helper-4.0.0.user.js`  
> 说明：本仓库未修改脚本代码，仅整理 README，便于上传 GitHub。

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

## 安装方式

1. 安装浏览器扩展：
   - Tampermonkey
   - Violentmonkey
   - 其他兼容 Userscript 的扩展
2. 打开脚本文件：
   - `V2EX Safe Reading Helper-4.0.0.user.js`
3. 点击扩展弹出的安装按钮。
4. 打开：
   - `https://www.v2ex.com/`
   - 或 `https://v2ex.com/`
5. 页面右下角会出现 `V2EX 阅读助手` 面板。

## 使用说明

面板按钮含义：

- `▶ 开始`：启动自动阅读
- `⏸ 暂停`：暂停自动阅读，并清除运行状态
- `⏭ 下一帖`：立即打开队列中的下一帖
- `🔄 刷新`：手动补充队列
- `🗑 重置`：清空队列、已读记录、游标和运行状态

默认阅读间隔为 10–15 秒随机延迟。

## 注意事项

- 请控制使用频率，避免对 V2EX 造成过高请求压力。
- 若触发限流，脚本会进入等待重试状态。
- 该脚本只在浏览器本地运行，不依赖后端服务。
- 自动阅读类脚本可能受站点规则、页面结构变化或反滥用策略影响。
- 本项目使用标准开源许可证 MIT License。

## 仓库结构

```text
.
├── LICENSE
├── README.md
├── SHA256SUMS.txt
└── V2EX Safe Reading Helper-4.0.0.user.js
```

## 许可证

本项目使用标准开源许可证 **MIT License**。

你可以自由使用、复制、修改、分发、再许可或出售本软件，但需要保留原始版权声明和许可证文本。

## GitHub 上传步骤

```bash
git init
git add README.md LICENSE SHA256SUMS.txt "V2EX Safe Reading Helper-4.0.0.user.js"
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/<your-name>/<repo-name>.git
git push -u origin main
```

把 `<your-name>` 和 `<repo-name>` 替换成你的 GitHub 用户名与仓库名。

## Release 建议

GitHub Release 标题可以写：

```text
V2EX Safe Reading Helper v5.3.0
```

Release 说明可以写：

```text
- 持久化队列、游标与运行状态
- 多来源轮询补充主题
- 白屏 / 卡死自动刷新保护
- 网络异常、空队列、限流自动等待重试
```

## 免责声明

本脚本仅供个人学习与本地自动化辅助使用。请遵守 V2EX 站点规则，合理控制访问频率，自行承担使用风险。
