import { useEffect, useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, BookOpenCheck, Download, Gauge, ShieldCheck, Trash2, Upload } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  AcademicResultsManifestV2Schema,
  BOUNDARY_PREDICTION_DISCLAIMER_VERSION,
  calculateKnowledgeDimensions,
  deleteMasteryProfile,
  evaluateStudentReadiness,
  exportMasteryProfile,
  importMasteryProfile,
  loadMasteryProfile,
  predictGradeBoundaryV1,
  saveMasteryProfile,
  type AcademicResultsManifestV2,
  type DifficultyProfileV1,
  type ReadinessRequirement,
} from "@/domain-v2/academic-results";
import type { KnowledgeMappingV5 } from "@/domain-v2/knowledge-tree";

type Tab = "results" | "difficulty" | "transition";
type KnowledgeManifest = {
  activeBatch: string;
  ontologyUrl: string;
  mappings: Array<{ code: string; qualificationVersionId: string; subjectName: string; mappingUrl: string }>;
};

const DIMENSION_LABELS = {
  contentGap: "内容跨度",
  depthUplift: "概念深度",
  assessmentDemand: "评估强度",
  questionComplexity: "题目复杂度",
  empiricalDemand: "实证难度",
} as const;

const DEPTH_ORDER = { knowledge: 0, application: 1, reasoning: 2, proof: 3 } as const;
const MASTERY_LABELS = {
  "not-studied": "未学习",
  weak: "较弱",
  basic: "基本掌握",
  proficient: "熟练",
} as const;

function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[#cfc8bf] bg-white/70 p-8 text-center"><ShieldCheck className="mx-auto text-[#526b7e]" /><h3 className="mb-0 mt-3 text-lg font-bold">{title}</h3><p className="mx-auto mb-0 mt-2 max-w-2xl text-sm leading-6 text-[#716a61]">{children}</p></div>;
}

function DifficultyRadar({ profile }: { profile: DifficultyProfileV1 }) {
  const data = Object.entries(profile.dimensions).map(([key, value]) => ({
    key,
    label: DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS],
    score: value.score,
    plottedScore: value.score ?? 0,
    coverage: value.evidenceCoverage,
  }));
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
    <div className="h-[360px] min-w-0" role="img" aria-label={`五维难度雷达图，总分 ${profile.score.toFixed(1)}，区间 ${profile.interval[0].toFixed(1)} 到 ${profile.interval[1].toFixed(1)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%"><PolarGrid stroke="#d8d1c8" /><PolarAngleAxis dataKey="label" tick={{ fill: "#625c54", fontSize: 12 }} /><PolarRadiusAxis domain={[0, 100]} tickCount={6} tick={{ fill: "#8a8279", fontSize: 10 }} /><Radar dataKey="plottedScore" stroke="#526b7e" fill="#526b7e" fillOpacity={0.22} /></RadarChart>
      </ResponsiveContainer>
    </div>
    <div className="overflow-hidden rounded-2xl border border-[#ded8d0] bg-white">
      <table className="w-full border-collapse text-left text-sm"><caption className="sr-only">五维难度文本等价内容</caption><thead><tr className="bg-[#f2eee8] text-[#625c54]"><th className="px-4 py-3">维度</th><th className="px-4 py-3">得分</th><th className="px-4 py-3">证据覆盖</th></tr></thead><tbody>{data.map(row => <tr key={row.key} className="border-t border-[#ebe6df]"><th className="px-4 py-3 font-semibold">{row.label}</th><td className="px-4 py-3">{row.score === null ? "数据不足" : row.score.toFixed(1)}</td><td className="px-4 py-3">{Math.round(row.coverage * 100)}%</td></tr>)}</tbody></table>
    </div>
  </div>;
}

async function loadReadinessRequirements(profile: DifficultyProfileV1) {
  if (!profile.sourcePaperIds?.length || !profile.targetPaperIds?.length) return null;
  const manifest = await fetch("/data/knowledge-v5/manifest.json").then(response => response.json()) as KnowledgeManifest;
  const sourceEntry = manifest.mappings.find(entry => entry.qualificationVersionId === profile.sourceQualificationVersionId);
  const targetEntry = manifest.mappings.find(entry => entry.qualificationVersionId === profile.targetQualificationVersionId);
  if (!sourceEntry || !targetEntry) return null;
  const [source, target, ontology] = await Promise.all([
    fetch(sourceEntry.mappingUrl).then(response => response.json()) as Promise<KnowledgeMappingV5>,
    fetch(targetEntry.mappingUrl).then(response => response.json()) as Promise<KnowledgeMappingV5>,
    fetch(manifest.ontologyUrl).then(response => response.json()) as Promise<{ nodes: Array<{ nodeId: string; comparisonEligible: boolean; reviewStatus: string }> }>,
  ]);
  const dimensions = calculateKnowledgeDimensions(
    { statements: source.statements, paperIds: profile.sourcePaperIds, tiers: profile.sourceTiers, sourceIds: [] },
    { statements: target.statements, paperIds: profile.targetPaperIds, tiers: profile.targetTiers, sourceIds: [] },
    ontology.nodes,
  );
  const missing = new Set(dimensions.missingNodeIds);
  const requirements = [...missing].map(nodeId => {
    const statements = target.statements.filter(statement =>
      statement.statementType === "assessable-content"
      && statement.reviewStatus === "owner-approved"
      && statement.paperApplicability.kind !== "not-specified"
      && statement.paperApplicability.papers.some(paperId => profile.targetPaperIds!.includes(paperId))
      && statement.conceptLinks.some(link => link.nodeId === nodeId),
    );
    const targetDepth = statements.flatMap(statement => statement.conceptLinks)
      .filter(link => link.nodeId === nodeId)
      .map(link => link.assessmentDepth)
      .sort((a, b) => DEPTH_ORDER[b] - DEPTH_ORDER[a])[0] ?? "knowledge";
    return {
      nodeId,
      criticality: 1 + DEPTH_ORDER[targetDepth] / 3,
      targetDepth,
      prerequisiteNodeIds: [],
      statements: statements.map(statement => ({
        statementId: statement.statementId,
        statementText: statement.statementText,
        sourceLocator: statement.sourceLocator,
        paperIds: statement.paperApplicability.kind === "not-specified" ? [] : statement.paperApplicability.papers,
      })),
    } satisfies ReadinessRequirement;
  });
  return { manifest, sourceEntry, targetEntry, requirements };
}

export default function AcademicAnalysisPage() {
  const [tab, setTab] = useState<Tab>("results");
  const [manifest, setManifest] = useState<AcademicResultsManifestV2 | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [requirements, setRequirements] = useState<Awaited<ReturnType<typeof loadReadinessRequirements>>>(null);
  const [mastery, setMastery] = useState<Record<string, keyof typeof MASTERY_LABELS>>({});
  const [predictionConsent, setPredictionConsent] = useState(false);
  const [predictionMessage, setPredictionMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/academic-results-v2/manifest.json")
      .then(response => response.json())
      .then(value => setManifest(AcademicResultsManifestV2Schema.parse(value)))
      .catch(() => setLoadError(true));
  }, []);

  const selectedProfile = manifest?.difficultyProfiles.find(profile => profile.profileId === profileId)
    ?? manifest?.difficultyProfiles[0];

  useEffect(() => {
    if (!selectedProfile) { queueMicrotask(() => setRequirements(null)); return; }
    let cancelled = false;
    loadReadinessRequirements(selectedProfile).then(result => { if (!cancelled) setRequirements(result); }).catch(() => { if (!cancelled) setRequirements(null); });
    const stored = loadMasteryProfile(window.localStorage);
    if (stored?.sourceQualificationVersionId === selectedProfile.sourceQualificationVersionId && stored.targetQualificationVersionId === selectedProfile.targetQualificationVersionId) {
      queueMicrotask(() => setMastery(Object.fromEntries(stored.mastery.map(item => [item.nodeId, item.level]))));
    } else queueMicrotask(() => setMastery({}));
    return () => { cancelled = true; };
  }, [selectedProfile]);

  const readiness = useMemo(() => selectedProfile && requirements
    ? evaluateStudentReadiness({ courseTransitionDifficulty: selectedProfile.score, requirements: requirements.requirements, mastery })
    : null, [mastery, requirements, selectedProfile]);

  const persistMastery = (next: typeof mastery) => {
    setMastery(next);
    if (!selectedProfile || !requirements) return;
    saveMasteryProfile(window.localStorage, {
      schemaVersion: "1.0.0",
      profileVersion: 1,
      knowledgeBatchId: requirements.manifest.activeBatch,
      sourceQualificationVersionId: selectedProfile.sourceQualificationVersionId,
      sourceRouteId: selectedProfile.sourceRouteId,
      targetQualificationVersionId: selectedProfile.targetQualificationVersionId,
      targetRouteId: selectedProfile.targetRouteId,
      mastery: Object.entries(next).map(([nodeId, level]) => ({ nodeId, level })),
      updatedAt: new Date().toISOString(),
    });
  };

  const createPrediction = () => {
    if (!manifest || manifest.boundaries.length === 0) { setPredictionMessage("当前 active 数据没有足够的历史官方整体边界。"); return; }
    const latest = [...manifest.boundaries].filter(boundary => boundary.boundaryScope === "overall").sort((a, b) => b.year - a.year)[0];
    if (!latest) { setPredictionMessage("当前 active 数据没有可用于预测的整体边界。"); return; }
    try {
      const prediction = predictGradeBoundaryV1({
        qualificationVersionId: latest.qualificationVersionId,
        awardQualificationId: latest.awardQualificationId,
        routeId: latest.routeId,
        targetYear: latest.year + 1,
        targetSeries: latest.series,
        dataCutoff: new Date().toISOString().slice(0, 10),
        tier: latest.tier,
        optionCode: latest.optionCode,
        disclaimerAccepted: predictionConsent,
        disclaimerVersion: predictionConsent ? BOUNDARY_PREDICTION_DISCLAIMER_VERSION : undefined,
      }, manifest.boundaries);
      setPredictionMessage(`非官方预测：${prediction.targetYear} ${prediction.targetSeries}，样本 ${prediction.sampleSeries.join("、")}，置信度 ${prediction.confidence}。`);
    } catch (error) {
      setPredictionMessage(error instanceof Error && error.message === "CONSENT_REQUIRED" ? "请先主动勾选免责声明。" : "同版本、同 route 的有效考季不足 3 个，暂不生成预测。");
    }
  };

  const exportCurrent = () => {
    if (!selectedProfile || !requirements) return;
    const value = exportMasteryProfile({
      schemaVersion: "1.0.0", profileVersion: 1, knowledgeBatchId: requirements.manifest.activeBatch,
      sourceQualificationVersionId: selectedProfile.sourceQualificationVersionId, sourceRouteId: selectedProfile.sourceRouteId,
      targetQualificationVersionId: selectedProfile.targetQualificationVersionId, targetRouteId: selectedProfile.targetRouteId,
      mastery: Object.entries(mastery).map(([nodeId, level]) => ({ nodeId, level })), updatedAt: new Date().toISOString(),
    });
    const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "exambridge-mastery-v1.json"; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className="min-h-screen bg-[linear-gradient(180deg,#f0ede8,#f7f4f0)] text-[#3d3832]">
    <Header title="成绩与难度分析" />
    <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="mb-6"><p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-[#526b7e]">Academic Results V2</p><h1 className="mb-0 mt-2 text-3xl font-bold tracking-tight">成绩、难度与个性化过渡</h1><p className="mb-0 mt-3 max-w-3xl text-sm leading-6 text-[#716a61]">所有数值只读取 owner-approved active 数据。预测与个人掌握度有独立边界；没有证据时显示数据不足。</p></div>
      <div className="mb-6 grid grid-cols-1 gap-2 rounded-2xl border border-[#d9d4ce] bg-white/75 p-2 sm:grid-cols-3" role="tablist" aria-label="分析类型">{([
        ["results", "成绩与规则", BarChart3], ["difficulty", "方向性难度", Gauge], ["transition", "个性化过渡", BookOpenCheck],
      ] as const).map(([value, label, Icon]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${tab === value ? "bg-[#253b46] text-white" : "text-[#625c54] hover:bg-[#eee9e3]"}`}><Icon size={16} />{label}</button>)}</div>

      {loadError && <EmptyState title="数据清单读取失败">请刷新页面；系统不会回退到 legacy 或 candidate 数据。</EmptyState>}
      {!manifest && !loadError && <EmptyState title="正在读取 active 数据">正在核验 Academic Results V2 manifest。</EmptyState>}

      {manifest && tab === "results" && <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[#ddd6ce] bg-white p-5"><span className="text-xs text-[#756e67]">官方分数线</span><strong className="mt-2 block text-3xl">{manifest.boundaries.length}</strong></div><div className="rounded-2xl border border-[#ddd6ce] bg-white p-5"><span className="text-xs text-[#756e67]">成绩统计</span><strong className="mt-2 block text-3xl">{manifest.statistics.length}</strong></div><div className="rounded-2xl border border-[#ddd6ce] bg-white p-5"><span className="text-xs text-[#756e67]">合分规则</span><strong className="mt-2 block text-3xl">{manifest.awardRules.length}</strong></div></div>
        {manifest.boundaries.length === 0 ? <EmptyState title="尚无已批准成绩数据">候选迁移和冲突复核仍在进行；在 owner approval 前，这里不会展示 candidate 数值。</EmptyState> : <div className="overflow-x-auto rounded-2xl border border-[#ddd6ce] bg-white"><table className="min-w-[760px] w-full text-left text-sm"><thead><tr className="bg-[#f2eee8]"><th className="px-4 py-3">资格 / Route</th><th className="px-4 py-3">考季</th><th className="px-4 py-3">满分</th><th className="px-4 py-3">等级边界</th><th className="px-4 py-3">状态</th></tr></thead><tbody>{manifest.boundaries.map(boundary => <tr key={boundary.boundaryId} className="border-t border-[#ebe6df]"><td className="px-4 py-3 font-medium">{boundary.awardQualificationId}<span className="block text-xs text-[#81796f]">{boundary.routeId}</span></td><td className="px-4 py-3">{boundary.year} {boundary.series}</td><td className="px-4 py-3">{boundary.maximumMark ?? "—"}</td><td className="px-4 py-3">{boundary.gradeOrder.map(grade => `${grade}: ${boundary.thresholds[grade] ?? "—"}`).join(" · ")}</td><td className="px-4 py-3">{boundary.publicationStatus}</td></tr>)}</tbody></table></div>}
        <div className="rounded-2xl border border-[#d5ccc0] bg-[#fffaf2] p-5"><h2 className="m-0 text-lg font-bold">非官方分数线预测</h2><p className="mb-0 mt-2 text-sm leading-6 text-[#716a61]">默认关闭。预测只使用最近 3–5 个同资格版本、同 route、同 tier、同满分的 owner-approved 官方整体边界；不能用于成绩承诺。</p><label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={predictionConsent} onChange={event => { setPredictionConsent(event.target.checked); setPredictionMessage(null); }} className="mt-1" /><span>我理解这是非官方统计预测，可能与最终官方边界明显不同。</span></label><Button type="button" className="mt-4" onClick={createPrediction} disabled={!predictionConsent}>生成示例预测</Button>{predictionMessage && <p className="mb-0 mt-3 text-sm font-medium" role="status">{predictionMessage}</p>}</div>
      </section>}

      {manifest && tab === "difficulty" && <section className="space-y-5">
        {manifest.difficultyProfiles.length === 0 ? <EmptyState title="难度 candidate 尚未激活">7 条方向性 gold transition 已生成 candidate；题目复杂度和实证难度仍保持缺失，因此当前 active 不展示评分。</EmptyState> : <><label className="block text-sm font-semibold">过渡方向<select value={selectedProfile?.profileId ?? ""} onChange={event => setProfileId(event.target.value)} className="mt-2 block w-full rounded-xl border border-[#d5cec6] bg-white px-3 py-3">{manifest.difficultyProfiles.map(profile => <option key={profile.profileId} value={profile.profileId}>{profile.sourceQualificationVersionId} → {profile.targetQualificationVersionId}</option>)}</select></label>{selectedProfile && <div className="rounded-2xl border border-[#ddd6ce] bg-white p-5 sm:p-7"><div className="grid gap-4 sm:grid-cols-3"><div><span className="text-xs text-[#756e67]">0–100 总分</span><strong className="mt-1 block text-4xl">{selectedProfile.score.toFixed(1)}</strong></div><div><span className="text-xs text-[#756e67]">不确定区间</span><strong className="mt-1 block text-2xl">{selectedProfile.interval[0].toFixed(1)}–{selectedProfile.interval[1].toFixed(1)}</strong></div><div><span className="text-xs text-[#756e67]">数据覆盖</span><strong className="mt-1 block text-2xl">{Math.round(selectedProfile.evidenceCoverage * 100)}%</strong></div></div><div className="mt-6"><DifficultyRadar profile={selectedProfile} /></div><details className="mt-5 rounded-xl bg-[#f5f1ec] p-4 text-sm"><summary className="cursor-pointer font-semibold">展开计算规则</summary><p className="mb-0 mt-3 leading-6 text-[#716a61]">内容跨度 30%、概念深度 25%、评估强度 20%、题目复杂度 15%、实证难度 10%。缺失维度不重分权重，而以 50 分中性值计入中心并扩展上下界。</p></details></div>}</>}
      </section>}

      {manifest && tab === "transition" && <section className="space-y-5">
        {!selectedProfile || !requirements || !readiness ? <EmptyState title="过渡评估尚不可用">需要已批准的方向性难度档案和对应 Knowledge V5 Paper 范围；candidate 不会被页面读取。</EmptyState> : <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[#ddd6ce] bg-white p-5"><span className="text-xs text-[#756e67]">课程过渡难度</span><strong className="mt-2 block text-3xl">{readiness.courseTransitionDifficulty.toFixed(1)}</strong></div><div className="rounded-2xl border border-[#ddd6ce] bg-white p-5"><span className="text-xs text-[#756e67]">个人知识缺口</span><strong className="mt-2 block text-3xl">{readiness.masteryGapScore.toFixed(1)}</strong></div><div className="rounded-2xl border border-[#526b7e] bg-[#253b46] p-5 text-white"><span className="text-xs text-[#cfdbdd]">个人难度（65% + 35%）</span><strong className="mt-2 block text-3xl">{readiness.personalDifficulty.toFixed(1)}</strong></div></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={exportCurrent}><Download size={15} />导出</Button><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#d8d1c9] bg-white px-3 py-2 text-sm font-medium"><Upload size={15} />导入<input type="file" accept="application/json" className="sr-only" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; const imported = importMasteryProfile(await file.text()); persistMastery(Object.fromEntries(imported.mastery.map(item => [item.nodeId, item.level]))); }} /></label><Button type="button" variant="outline" onClick={() => { deleteMasteryProfile(window.localStorage); setMastery({}); }}><Trash2 size={15} />删除本机记录</Button></div><div className="space-y-3">{readiness.orderedGaps.map((gap, index) => <article key={gap.nodeId} className="rounded-2xl border border-[#ddd6ce] bg-white p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><span className="text-xs font-semibold text-[#526b7e]">优先级 {index + 1} · {gap.nodeId}</span><h3 className="mb-0 mt-1 text-base font-bold">目标深度：{gap.targetDepth}</h3></div><label className="text-xs font-semibold text-[#756e67]">当前掌握度<select value={mastery[gap.nodeId] ?? "not-studied"} onChange={event => persistMastery({ ...mastery, [gap.nodeId]: event.target.value as keyof typeof MASTERY_LABELS })} className="mt-1 block rounded-lg border border-[#d5cec6] bg-white px-3 py-2 text-sm text-[#3d3832]">{Object.entries(MASTERY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><p className="mb-0 mt-3 text-sm text-[#7a6258]">{gap.riskReason}</p><div className="mt-3 space-y-2">{gap.statements.map(statement => <div key={statement.statementId} className="rounded-xl bg-[#f5f1ec] p-3"><p className="m-0 text-sm leading-6">{statement.statementText}</p><p className="mb-0 mt-1 text-[11px] text-[#81796f]">{statement.sourceLocator} · {statement.paperIds.join(", ")}</p></div>)}</div></article>)}</div></>}
      </section>}
    </main><Footer />
  </div>;
}
