# Contributing to ExamBridge

感谢你帮助改进 ExamBridge。项目欢迎小范围、可验证的代码修复、测试、无障碍改进和数据勘误。

## 开始之前

- 先搜索现有 Issue 和 Pull Request，避免重复工作。
- 涉及范围较大的功能或数据结构变更，请先创建 Issue 说明使用场景和边界。
- 不要提交 Token、Cookie、学生或机构数据，以及无权再分发的考试资料。

## 本地验证

需要 Node.js 22.13 或更高版本和 pnpm：

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test:coverage
pnpm test:e2e
```

Pull Request 应说明变更原因、用户影响和验证方式。计算、数据转换和行为修复必须包含能够复现问题的测试。

## 数据贡献

数据变更必须附带官方来源 URL、发布日期、访问日期及原始页码或行标识。未发布、取消或无法核验的数据必须保持缺失或进入隔离报告，不得推测补全。第三方数据不包含在项目 MIT 许可证中，具体边界见 [DATA_RIGHTS.md](DATA_RIGHTS.md)。
