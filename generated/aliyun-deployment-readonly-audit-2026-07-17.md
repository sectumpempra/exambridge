# ExamBridge 阿里云生产部署链只读审计

日期：2026-07-17（Asia/Shanghai）

## 结论

生产站点当前可访问，`current` 指向的 gh-pages 提交与 GitHub 当前分支一致，107 份持久化 PDF 仍完整存在。但服务器仍运行旧的 cron 同步脚本，仓库内的新 systemd、原子发布、provenance、PDF 熔断和回滚方案尚未安装。生产发布门禁应继续保持阻断，直到完成一次有快照保护的服务器 dry-run 和人工验收。

本次仅执行读取、HTTPS 请求和 Workbench 登录。没有修改服务器文件、crontab、systemd、Nginx、防火墙、快照、软链接、release 或 PDF。

## 可信身份链

- 阿里云产品：轻量应用服务器。
- 地域：新加坡（`ap-southeast-1`）。
- 实例：`Ubuntu-hkps`。
- 实例 ID：`36f96d04419d42c58faffbcf944ee539`。
- 公网 IP：`8.219.182.177`；私网 IP：`172.19.57.87`。
- 系统：Ubuntu 24.04 LTS，内核 `6.8.0-63-generic`，x86_64。
- SSH ED25519 指纹由公网扫描和阿里云 Workbench 内的服务器公钥独立核对，二者均为 `SHA256:eDndc93roeKJp87Ih7ju20jnODPhB7R6Anf0VDI6QaE`。
- Workbench 登录用户为 `admin`（uid/gid 1000）；部署目录和定时任务归属 `deploy`（uid/gid 1001）。

## 当前更新链

### 调度方式

- `exambridge-sync.timer` 和 `exambridge-sync.service` 未安装：`is-enabled` 返回 `unknown`，两者均不在有效 timer 列表中。
- `admin` 和 `root` 均无 crontab。
- 实际任务在 `deploy` crontab：

```cron
*/2 * * * * /var/www/exambridge/shared/sync-gh-pages.sh >> /var/www/exambridge/shared/sync.log 2>&1
```

- `/var/www/exambridge/shared/` 中已有旧版 `exambridge-sync.service` 和 `exambridge-sync.timer` 模板，但没有复制到 systemd，也没有启用。

### 生效脚本

- 路径：`/var/www/exambridge/shared/sync-gh-pages.sh`。
- 属主/权限：`deploy:deploy`，0755。
- SHA-256：`6e742261b71236924f21950ec0622364d77b12ecb80baf9beede752552575ba0`。
- 脚本只有 30 行，仍存在以下发布风险：
  - 先读取 gh-pages SHA，再下载可变的 `refs/heads/gh-pages` 归档，存在分支移动竞态。
  - 直接解压到最终 release 目录，没有 staging、provenance 校验或归档安全检查。
  - 没有互斥锁，cron 重叠时可能并发更新同一路径。
  - 对 release 内的 `exam-materials` 执行 `rm -rf`；若该路径意外成为真实目录会删除内容。
  - 用 `ln -sfn` 切换 `current`，没有切换后健康检查和自动回滚。
  - 没有可信 release record、保留策略或经过验证的一键回滚。
  - 成功运行不记录时间、提交和健康结果；日志中保留多次 404，但最后修改时间为 2026-07-16 02:02，无法从日志直接判断最近每次 cron 是否成功。

### 当前 release

- `current`：`/var/www/exambridge/releases/6d80cca85aa1c5dbc2541ee53e3f23f7a7f147e5`。
- GitHub gh-pages 当前 SHA 也是 `6d80cca85aa1c5dbc2541ee53e3f23f7a7f147e5`，当前线上版本未落后。
- 服务器保留 3 个 SHA release 和 1 个 `initial` 目录，但没有验证记录证明任一旧 release 可安全回滚。
- 服务器没有阿里云快照；实例级灾难恢复目前没有独立恢复点。

## 持久化 PDF

- 真实目录：`/var/www/exambridge/shared/exam-materials`，不是符号链接。
- 属主/权限：`deploy:deploy`，0755，非 world-writable。
- PDF 数量：107。
- 目录大小：约 110 MB。
- 当前 release 的 `exam-materials` 正确软链接到该 shared 目录。
- 文件系统：ext4，30 GB，总使用约 2.9 GB，可用约 25 GB，使用率 11%。
- 当前没有 `.exambridge-persistent-materials` marker、`exam-materials.minimum` 数量熔断或发布前后字节数记录；这些必须在安装新同步脚本前按已核验的 107 份基线显式创建。

## Nginx、TLS 与 PWA

- Nginx 1.24.0 正常运行并开机启用；监听 80/443。
- Web 根目录为 `/var/www/exambridge/current`。
- Certbot timer 正常运行并开机启用。
- 证书覆盖 `exambridge.cn` 和 `www.exambridge.cn`，ECDSA，过期时间为 2026-10-13 15:58:31 UTC；审计时剩余 88 天。
- 首页返回 200，`index.html` 为 no-store；带 hash 的 assets 为一年 immutable。
- 当前 `sw.js` 没有显式 Cache-Control，可能延迟 PWA 更新。
- 当前配置没有为 web manifest 声明 `application/manifest+json`。
- `index.html` 和 assets location 自己声明了 Cache-Control，导致 server 级 `add_header` 不再继承；实测这些响应缺少 X-Content-Type-Options、Referrer-Policy 和 X-Frame-Options。
- 当前没有有效 HSTS、Permissions-Policy 或 CSP report-only。
- `/release-provenance.json` 没有精确 location，缺失时会回退为 SPA 页面。
- shared 中的 `exambridge.conf` 与当前 `/etc/nginx/sites-enabled/exambridge` 哈希一致，说明服务器上的待用副本并不是仓库最新加固版本。

## 网络暴露与备份

- 主机 UFW 未启用。
- 主机实际仅公开监听 SSH 22、HTTP 80、HTTPS 443；53 仅回环监听。
- 阿里云轻量防火墙允许 TCP 22、80、443 和全部 ICMP，来源均为 `0.0.0.0/0`。
- 80/443 面向公网符合站点需求；SSH 22 面向全网风险偏高。后续应在确认固定管理出口 IP 后限制来源，或仅保留阿里云 Workbench 运维路径。该选择会影响用户日常登录方式，不能擅自修改。
- 当前实例没有任何快照。安装新部署链前应先创建一次明确命名的快照；创建快照属于生产写操作，需要用户单独批准。

## 与仓库加固方案的差异

仓库分支 `repair/audit-p0-p1-20260716` 已具备不可变 SHA 下载、staging、provenance、PDF marker/最低数量/字节数熔断、原子软链接、健康回滚、release record、保留策略和人工回滚脚本。上述能力均未进入生产服务器。

本次审计还据实修正了本地模板：Nginx 现在明确由 80 跳转到 HTTPS，并使用已核验的 Certbot 证书路径；同步健康检查改为访问生产 HTTPS，而不是依赖未来会被重定向的本机 80 端口。修改仍只存在于本地修复分支。

## 推荐的受控实施顺序

1. 用户批准创建阿里云快照，并确定 SSH 22 的允许来源策略。
2. 记录 107 份 PDF 的批准基线，创建 marker 和最低数量 guard；安装前再次核对数量和字节数。
3. 将新脚本以临时文件复制到 shared，核对 hash、属主和权限后再原子替换；保留旧脚本副本。
4. 在服务器副本目录运行新脚本 `EXAMBRIDGE_DRY_RUN=1`，证明不会切换 `current` 或改变 PDF。
5. 安装 systemd unit，但先不启用 timer；停止 cron 与启用 timer 必须在同一受控窗口完成，避免双调度。
6. 合并 Nginx HTTPS 配置，执行 `nginx -t`，确认无误后 reload；不要用 HTTP-only 文件覆盖 Certbot 生效块。
7. 手工运行一次同步，核对 release record、公开 provenance、PWA 头、健康检查、PDF 数量和 current SHA。
8. 演练一次已验证 release 的回滚，再启用两分钟 timer，并观察至少三个周期。

在用户批准第 1 步前，不应对服务器执行上述任何写操作。
