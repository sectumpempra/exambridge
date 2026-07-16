# Past-paper candidates

Kimi 或其他采集任务只能把候选目录写入这里，不能直接修改
`public/data/past-papers`。候选文件必须通过 `PastPaperCatalogCandidateSchema`，并记录：

- 请求模型 ID、API 实际返回的模型 ID 与提示词版本；
- 官方来源页和最小化的目录字段；
- 链接检查时间与访问状态；
- `distributionStatus`，默认必须为 `link-only` 或 `unknown`；
- AQA 等明确限制 AI 处理的材料不得进入候选流程。

构建任务只生成差异报告，不会自动批准或发布候选数据。人工审核后，才可将
记录转换为 `approved` 并合并到正式目录。

已批准的候选批次移入 `approved/<日期-批次>/` 保存审计轨迹；构建脚本只读取本目录
顶层的 `.json` 候选，因此归档记录不会再次阻断发布。

校验候选前必须显式设置 `KIMI_EXPECTED_MODEL_ID`。请求 ID、API 响应 ID 和该
环境值必须完全一致；缺失或不匹配时立即失败，不允许静默降级。
