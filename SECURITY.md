# Security Policy

## Supported version

仅最新私有灰度版本接受安全修复。正式发布以 Sites 版本与 Git 提交 SHA 的对应关系为准。

## Reporting

请通过 GitHub 仓库的私密漏洞报告功能提交问题，不要在公开 Issue 中粘贴 Token、Cookie、学生信息或未公开数据。报告应包含受影响路由、复现步骤、影响范围和可行的最小复现。

## Credential rules

- 仓库、构建产物、日志和 Issue 中不得出现访问令牌。
- 任何曾在聊天或公开文本中出现的 Token 都视为已泄露，必须立即撤销并轮换。
- 本项目不需要在浏览器端配置 GitHub Token 或考试局凭据。
- CI 凭据只允许保存在 GitHub/Sites 的加密 Secret 中，并遵循最小权限。

## Security gates

发布要求生产依赖不存在中危或更高已知漏洞、凭据扫描通过、导出公式注入测试通过，并且生产错误信息不直接暴露底层异常。
