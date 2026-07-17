# ExamBridge 阿里云部署链整改报告

日期：2026-07-17（Asia/Shanghai）

## 结论

仓库内的部署模板已经完成 P0/P1 整改；SSH 主机指纹、服务器只读盘点、阿里云部署前快照和服务器隔离目录 dry-run 均已完成。生产同步脚本、调度、Nginx 和 `current` 仍未修改。真实 `gh-pages` 产物因缺少 `release-provenance.json` 被新门禁正确阻断，因此上线前必须先由新发布门禁生成并发布 provenance 完整的构建产物。

## 已整改

### 发布完整性

- 不再先读分支 SHA、再下载可变的分支归档；现在通过 `git ls-remote` 解析 gh-pages SHA，并下载该不可变提交的 codeload 归档。
- 拒绝绝对路径、目录穿越、符号链接、硬链接和设备文件归档。
- 要求 `release-provenance.json` 存在、schema 正确、源提交合法、tracked PDF 数量为 0。
- 对发布产物中列出的 `dist-static` 证据文件重新计算 SHA-256。
- 每次发布在服务器的非公开 shared 目录保存 gh-pages SHA、源提交、归档 SHA-256、provenance SHA-256、PDF 数量和材料字节数。

### 持久化 PDF 保护

- 删除了对 release 内 `exam-materials` 执行 `rm -rf` 的逻辑。
- 只有目标不存在或是指向已核验 shared 目录的符号链接时才允许继续；真实目录会直接阻断。
- 要求持久化目录 marker、已批准属主、非 world-writable 权限和最低 PDF 数量 guard。
- 每次发布前后比较 PDF 数量和全部持久化材料字节数。
- 从第二次新流程发布开始，还会和上一次验证记录比较；数量或大小下降均阻断发布。
- 静态发布归档中出现任何 PDF 都会在切换前失败。

### 原子发布与回滚

- 归档先解压到同一文件系统的 staging 目录，通过验证后才重命名为不可变 release。
- `current` 通过临时符号链接和 `os.replace` 原子切换。
- 切换后执行健康检查；失败、材料变化或状态写入失败都会恢复原来的 `current`。
- 至少保留 active 与 previous 两个验证版本，并保存 release record。
- 新增独立 `rollback-release.sh`；只接受仍有验证记录的 40 位 gh-pages SHA，并在回滚失败时恢复原目标。
- 同步和回滚共用互斥锁，避免 timer 与人工操作并发。

### systemd 与 Nginx

- systemd 服务增加超时、UMask、只允许写 `/var/www/exambridge`、NoNewPrivileges、PrivateTmp、ProtectSystem 等约束。
- `sw.js` 明确 no-store，避免旧 service worker 长期缓存。
- `manifest.webmanifest` 明确使用 `application/manifest+json`。
- `release-provenance.json` 使用精确 location，缺失时返回 404，不能再回退到 `index.html`。
- 在定义缓存头的 location 中重复安全头，修复 Nginx `add_header` 继承被覆盖的问题。
- 模板加入 HSTS、Permissions-Policy 和 report-only CSP。HSTS 还必须合并到服务器实际的 HTTPS server block 才会生效；CSP 尚未强制执行。

## 本地验证

- POSIX shell 语法检查：通过。
- 部署副本演练：11 个场景全部通过：
  - 验证后原子切换；
  - PDF 数量下降熔断；
  - dry-run 不切换；
  - 健康检查失败自动回滚；
  - 发布归档 PDF 阻断；
  - release 内真实 `exam-materials` 路径阻断；
  - active/previous 保留；
  - 已验证版本人工回滚；
  - 非法回滚 SHA 阻断；
  - provenance 被篡改时阻断回滚；
  - 持久化 PDF 字节保持不变。
- 新增部署契约测试：4/4 通过。
- 完整 Vitest：697/697 通过。
- TypeScript：通过。
- ESLint：通过。
- 静态生产构建、数据审计、PWA precache、bundle budget 和 release provenance：通过。

## 已完成的生产只读核验

- 已通过阿里云控制台确认新加坡轻量应用服务器 `Ubuntu-hkps`、实例 ID 和公网 IP。
- 已在 Workbench 内读取 SSH ED25519 公钥指纹，并与公网扫描值精确匹配。
- 已确认实际调度是 `deploy` 用户每两分钟 cron；systemd 模板仅位于 shared，尚未安装。
- 已记录 current SHA、旧同步脚本 hash、release 列表、Nginx 生效配置、Certbot 状态和证书有效期。
- 已核对持久化目录为 `deploy:deploy`、107 份 PDF、约 110 MB，当前 release 通过软链接访问。
- 只读盘点时实例没有快照；随后在用户明确批准后创建了部署前快照。UFW 未启用，阿里云防火墙仍将 22/80/443 和 ICMP 对 `0.0.0.0/0` 开放。
- 完整证据和风险分级见 `generated/aliyun-deployment-readonly-audit-2026-07-17.md`。

## 阿里云快照与服务器隔离演练

- 已创建系统盘快照 `exambridge-pre-deploy-20260717`，快照 ID `s-t4n68j7xx8p4p4wdi949`，控制台记录的创建时间为 2026-07-17 11:42:43（Asia/Shanghai）。
- 演练目录固定为 `/var/tmp/exambridge-deployment-dry-run-20260717`；没有切换 `/var/www/exambridge/current`，没有修改 Nginx、cron 或生产同步脚本。
- 上传到隔离目录的 `sync-gh-pages.sh` SHA-256 为 `a5f251d46193eb03ad15419a3573b1d71cd6296de73ff82221a453e2af788a8a`，与本地已验收脚本一致。
- 真实网络演练解析当前 `gh-pages` 后，被 `release provenance is missing` 门禁阻断，返回码为 1；staging 与互斥锁均自动清理。
- 使用服务器本地生成的 provenance 合规最小产物执行正向 dry-run，返回码为 0；校验、解包、材料链接、staging 清理和不切换 `current` 的路径全部通过。
- 演练前后生产 `current` 均指向 `/var/www/exambridge/releases/6d80cca85aa1c5dbc2541ee53e3f23f7a7f147e5`，生产 PDF 数量均为 107，`https://exambridge.cn/index.html` 健康检查通过。
- 生产旧同步脚本 SHA-256 仍为 `6e742261b71236924f21950ec0622364d77b12ecb80baf9beede752552575ba0`，证明本轮未替换生产脚本。
- 隔离复制发现 1 份 PDF 为 `deploy:deploy`、模式 `0600`，`admin` 无法读取；演练副本使用明确标记的合成占位 PDF 将门禁基线保持为 107。本轮没有修改该文件权限或任何生产 PDF。

## 尚未执行的生产步骤

以下内容没有在本轮执行，因此不能声称生产服务器已经整改：

- 确定 SSH 22 的来源限制策略；当前仍未修改防火墙。
- 创建 marker 和最低 PDF 数量 guard。
- 安装新脚本、systemd unit 或 Nginx 配置。
- 在生产脚本安装前，用 provenance 完整的真实 `gh-pages` 产物再次运行网络 dry-run；失败切换和人工回滚仍需在独立副本中演练。
- 重新加载 Nginx 或启动新同步任务。

在真实 `gh-pages` provenance、写操作窗口和生产切换得到再次明确批准之前，production 推送与服务器模板安装继续保持阻断。
