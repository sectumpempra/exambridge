import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const load = (name) => readFile(resolve(root, "generated", name), "utf8").then(JSON.parse);
const [points, mappings, ontology, migration, usage] = await Promise.all([
  load("knowledge-point-review-report.json"),
  load("knowledge-v4-audit-report.json"),
  load("knowledge-ontology-audit-report.json"),
  load("knowledge-node-migration-v4.json"),
  load("kimi-knowledge-v4-usage.json"),
]);

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const percent = (value) => `${Math.round(Number(value ?? 0) * 1000) / 10}%`;
const mappingById = new Map(mappings.summaries.map((entry) => [entry.qualificationVersionId.split(":")[0].toLowerCase(), entry]));
const rows = points.summaries.map((entry) => {
  const mapping = mappingById.get(entry.id.toLowerCase());
  const state = entry.approvalEligible ? (entry.warningCount ? "可带警告批准" : "可批准") : "必须修正";
  const tone = entry.approvalEligible ? (entry.warningCount ? "warn" : "pass") : "fail";
  return `<tr>
    <td><strong>${escapeHtml(entry.id)}</strong><br><span>${escapeHtml(entry.reviewMethod)}</span></td>
    <td>${entry.candidatePoints}</td><td>${entry.mappedPoints}/${entry.candidatePoints}</td><td>${entry.reviewedPoints}</td>
    <td>${percent(entry.sourcePageReferenceRate)}</td><td>${entry.warningCount}</td>
    <td>${entry.failCount}/${entry.missingOfficialPointCount}/${entry.highIssueCount}</td>
    <td><span class="badge ${tone}">${state}</span><br><span>${escapeHtml(mapping?.qualificationVersionId ?? "")}</span></td>
  </tr>`;
}).join("\n");
const recordedCalls = usage.calls ?? [];
const failedCalls = recordedCalls.filter((call) => call.status === "invalid-json" || call.status === "model-mismatch");
const successfulCalls = recordedCalls.filter((call) => call.status !== "invalid-json" && call.status !== "model-mismatch");
const totalTokens = recordedCalls.reduce((sum, call) => sum + Number(call.totalTokens ?? 0), 0);
const models = [...new Set(recordedCalls.map((call) => call.returnedModel).filter(Boolean))];
const ready = points.reviewedCourseCount === points.expectedCourseCount
  && points.approvalEligibleCourseCount === points.expectedCourseCount
  && points.failureCount === 0 && mappings.failureCount === 0 && ontology.failureCount === 0;
const decision = ready ? "21 门课程已达到提交用户批准的条件" : "尚未达到提交用户批准的条件";
const unresolved = points.summaries.filter((entry) => !entry.approvalEligible).map((entry) => entry.id);
const warningTotal = points.summaries.reduce((sum, entry) => sum + entry.warningCount, 0);

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ExamBridge 21 门知识映射批准报告</title>
<style>
:root{color-scheme:light;--ink:#172033;--muted:#657086;--line:#dce3ee;--bg:#f4f7fb;--card:#fff;--pass:#116b43;--passbg:#e8f7ef;--warn:#8a5700;--warnbg:#fff4d8;--fail:#9b2430;--failbg:#ffe8eb}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1180px;margin:auto;padding:36px 22px 72px}h1{font-size:30px;margin:0 0 8px}h2{margin:34px 0 12px;font-size:21px}p{margin:8px 0}.muted,td span{color:var(--muted);font-size:12px}.hero,.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px;box-shadow:0 8px 24px rgba(36,48,74,.05)}.hero{border-left:6px solid ${ready ? "var(--pass)" : "var(--warn)"}}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px}.metric{background:#f8fafd;border:1px solid var(--line);border-radius:12px;padding:14px}.metric b{display:block;font-size:24px}.table{overflow:auto;border:1px solid var(--line);border-radius:14px;background:#fff}table{width:100%;border-collapse:collapse;min-width:930px}th,td{text-align:left;padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{background:#eef3f9;font-size:12px;position:sticky;top:0}.badge{display:inline-block;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:700}.pass{color:var(--pass);background:var(--passbg)}.warn{color:var(--warn);background:var(--warnbg)}.fail{color:var(--fail);background:var(--failbg)}code{background:#eef3f9;padding:2px 5px;border-radius:5px}@media(max-width:760px){.grid{grid-template-columns:1fr 1fr}.wrap{padding:22px 12px}h1{font-size:24px}}
</style></head><body><main class="wrap">
<section class="hero"><h1>ExamBridge 21 门知识映射批准报告</h1><p><strong>${decision}</strong></p><p class="muted">生成时间：${escapeHtml(new Date().toISOString())}。本报告只针对本地修复分支的 candidate 数据；没有推送、部署或激活。</p>
<div class="grid"><div class="metric"><b>${points.reviewedCourseCount}/${points.expectedCourseCount}</b>完成逐点复核</div><div class="metric"><b>${points.totalReviewedPoints}</b>已复核考纲点</div><div class="metric"><b>${points.approvalEligibleCourseCount}</b>可提交批准课程</div><div class="metric"><b>${warningTotal}</b>保留的低置信度警告</div></div></section>

<h2>批准结论</h2><section class="card"><p>当前状态：<span class="badge ${ready ? "pass" : "fail"}">${ready ? "READY FOR OWNER APPROVAL" : "NOT READY"}</span></p>
<p>${ready ? "所有硬性条件已通过。用户仍需明确批准，系统才可以把 reviewStatus 从 candidate 改为 owner-approved。" : `仍需修正：${escapeHtml(unresolved.join("、") || "审计文件不完整")}。`}</p>
<p>警告不是隐藏失败：它表示官方点已逐项收录并有页码，但当前 812 节点本体只能提供较宽泛或较弱的语义匹配。批准后仍可保持 Paper 精确对比关闭。</p></section>

<h2>21 门逐点复核矩阵</h2><div class="table"><table><thead><tr><th>课程 / 方法</th><th>官方点</th><th>映射</th><th>复核</th><th>页码</th><th>警告</th><th>失败/遗漏/高问题</th><th>状态 / 版本</th></tr></thead><tbody>${rows}</tbody></table></div>

<h2>812 节点本体审计</h2><section class="card"><div class="grid"><div class="metric"><b>${ontology.tree.nodeCount}</b>审计节点</div><div class="metric"><b>${ontology.repeatedNameCandidateCount}</b>语义歧义候选</div><div class="metric"><b>${ontology.codexReviewedSemanticCandidateCount}</b>已逐项判定</div><div class="metric"><b>${migration.migrations.length}</b>必要 ID 迁移</div></div>
<p>结构检查：唯一 ID、父级完整、无环、层级与路径一致、叶节点一致、同级规范化名称唯一、阶段值有效。语义分类为 ${ontology.semanticClassCounts?.mathematicalKnowledge ?? "—"} 个数学知识节点、${ontology.semanticClassCounts?.mathematicalPractice ?? "—"} 个数学实践节点和 1 个根节点；仅 ${ontology.semanticClassCounts?.exactComparisonEligible ?? "—"} 个知识叶节点可用于精确相似度。</p>
<p>迁移结论：${escapeHtml(migration.rationale)} 树文件 SHA-256：<code>${escapeHtml(ontology.tree.sha256)}</code></p></section>

<h2>Kimi 使用与来源边界</h2><section class="card"><p>记录到的调用尝试：${recordedCalls.length}；成功解析：${successfulCalls.length}；失败或截断：${failedCalls.length}；记录 token：${totalTokens.toLocaleString("zh-CN")}；返回模型：<code>${escapeHtml(models.join(", ") || "无")}</code>。</p>
<p>17 门非 AQA 使用桌面官方 specification 的页码化文本进行候选生成与独立复核。4 门 AQA 因政策限制全程本地解析和规则复核，没有把 AQA 材料发送给外部 AI。Kimi 输出只进入 candidate，不能自动发布。</p>
<p class="muted">用量仅统计现有封装成功解析并写入 usage 文件的调用；被中断或 JSON 截断的失败响应无法从旧封装完整恢复 token，是本报告的已知限制。</p></section>

<h2>方法、限制与下一步</h2><section class="card"><p><strong>方法：</strong>官方 PDF 哈希与页码抽取 → V4 候选映射 → 独立逐点复核 → schema/节点/Paper/来源审计 → 用户批准门禁。</p>
<p><strong>限制：</strong>V4 允许 <code>broader</code>、<code>partial</code> 和带理由的不映射；这比把细粒度考纲点强行塞入错误叶节点更安全。所有 candidate 在用户批准前不得计算精确课程或 Paper 百分比。</p>
<p><strong>批准动作：</strong>只有当本报告显示 READY，且用户明确回复批准 21 门候选映射后，才执行 owner-approved 状态变更、重新审计并单独提交；仍不推送、不部署，除非用户另行授权。</p></section>
</main></body></html>`;

await mkdir(resolve(root, "generated"), { recursive: true });
await writeFile(resolve(root, "generated/knowledge-mapping-approval-report.html"), html);
console.log(`Knowledge approval report written: ${ready ? "READY" : "NOT READY"}.`);
