const VERSION = "exambridge-5b2b94ea9fee429c";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;
const CACHE_PREFIX = "exambridge-";
const APP_SHELL = "/";
const CORE = ["/","/apple-touch-icon.png","/assets/AIAssistantLauncher-Dw01WDRZ.js","/assets/AIAssistantPage-BQjIzc3S.js","/assets/AIChatPanel-Bow6iw-D.js","/assets/ALevelBoardPage-BHE7spmM.js","/assets/About-D1oKSF_G.js","/assets/AcademicAnalysisPage-B599i7yV.js","/assets/AqaPage-Df5godag.js","/assets/AqaPage-XyAaxdkB.js","/assets/AreaChart-C30CekJN.js","/assets/BoardPage-BmHRXmOr.js","/assets/CaiePage-BvuTiBZj.js","/assets/CaiePage-X6ZY7pZG.js","/assets/CourseCenter-Si1yzAjP.js","/assets/EdexcelPage--cQ0-sIY.js","/assets/EdexcelPage-BDCW2ZRa.js","/assets/ExamOverviewInsights-BbZFhsi5.js","/assets/ExamOverviewPage-ChI1ATBx.js","/assets/GradeCalculator-DKwfp6ai.js","/assets/GradeChart-CudWISe9.js","/assets/GraphPage-BjEzpdGC.js","/assets/GraphPage-BwGdFLVb.css","/assets/Home-CrZ8LUeA.js","/assets/Home-ho6O7l7s.js","/assets/IdentitySelect-DpKbkAxC.js","/assets/KnowledgeTreeComparePage-CBh7XbXZ.js","/assets/MechanicsLabPage-CYTZdzy6.css","/assets/MechanicsLabPage-LOCgapf1.js","/assets/NotFound-BTFCB8ti.js","/assets/OcrFsmqPage-LqtYvDw5.js","/assets/OcrPage-BKUIXfL4.js","/assets/OcrPage-Bu6Hig7B.js","/assets/PaperComparePage-CI5BJs9N.js","/assets/PaperDetailPage-m0KmwjsY.js","/assets/PaperSearchPage-B0EcWo26.js","/assets/PastPaperLibrary-hMLoEY8w.js","/assets/PersonalityTest-BRuAotbb.js","/assets/Planner-kUKhH5g2.js","/assets/ResultStatisticsPage-COa7mMtn.js","/assets/ResultsHub-IQmDbalt.js","/assets/ToolsHub-vhYrrzll.js","/assets/VectorGeometryLabPage-C8dQKlql.css","/assets/VectorGeometryLabPage-Dwb-0ceG.js","/assets/WjecPage-1uue5WeP.js","/assets/YAxis-DxxHtpHt.js","/assets/arrow-left-B4zAHCLP.js","/assets/atom-CsMcCrbo.js","/assets/award-CDvZ-9i5.js","/assets/badge-check-BkXZK-S1.js","/assets/box-qHLvPGAi.js","/assets/browser-BoJ3s3kw.js","/assets/browser-G80jqhgw.js","/assets/caie-0580-p2-syllabus-BytJSbr9.js","/assets/caie-0580-p4-syllabus-BkGx2Zcv.js","/assets/caie-9709-p1-syllabus-DJszdva4.js","/assets/caie-9709-p2-syllabus-DnRMnZcm.js","/assets/caie-9709-p3-syllabus-Cl2fwG-H.js","/assets/caie-9709-p4-syllabus-CiefaNLM.js","/assets/caie-9709-p5-syllabus-CEj7FVU8.js","/assets/caie-9709-p6-syllabus-BkeLeHni.js","/assets/catalog-CFFG-0Ab.js","/assets/chart-line-bYnHqM_i.js","/assets/chevron-right-CFV82N7H.js","/assets/chevron-up-BARK6h9c.js","/assets/chunk-aKtaBQYM.js","/assets/circle-alert-DA8kGdvB.js","/assets/clock-3-Dg9TUXKp.js","/assets/clock-BYdn3eO3.js","/assets/copy-DPh5CpcB.js","/assets/csvExport-DtLhp2kF.js","/assets/defineProperty-CHyAdSol.js","/assets/dist-D6zqhpjg.js","/assets/edexcel-Bitq2emO.js","/assets/edexcel_al-mMzDaKvy.js","/assets/edx-4ma1-p1h-syllabus-CjFWiUrq.js","/assets/edx-4ma1-p2h-syllabus-DRecdM-t.js","/assets/examDates-BusbuGce.js","/assets/excelExport-DXpDwCOm.js","/assets/external-link-Em9Iz1eF.js","/assets/eye-DUeql6uJ.js","/assets/file-text-CenLPjMG.js","/assets/format-C1kAZyxP.js","/assets/generateCategoricalChart-BGlt7p1D.js","/assets/graduation-cap-C6rsnlSH.js","/assets/html2canvas-B1hV9e2W.js","/assets/index-Bu2ReYK2.css","/assets/index-l6pMh8xm.js","/assets/index.es-DhbII5_3.js","/assets/info-AXKexQ-Z.js","/assets/jspdf.es.min-JQ3-pGJT.js","/assets/jsx-runtime-CjNSP63y.js","/assets/knowledgeComparison-RtNT6Psm.js","/assets/loader-v5-DotsRmnn.js","/assets/lz-string-B3ekpoKr.js","/assets/mergedMathData-CR5LNxus.js","/assets/minus-BVcBi39d.js","/assets/ocrGradeBoundaries-PTZGUZf8.js","/assets/ocr_al-DkcTjlvC.js","/assets/paperGroups-BnmDHKwn.js","/assets/paperMetadata-CIAnzec9.js","/assets/past-papers-CP4SqBbQ.js","/assets/preload-helper-zJ_50EbN.js","/assets/purify.es-adlwq8Pz.js","/assets/resultStatistics-pk7e4wU4.js","/assets/share-2-XRmQhyo6.js","/assets/shield-check-T2mlFRaf.js","/assets/size-xkbVHEHR.js","/assets/sparkles-B19vSStk.js","/assets/three-C4Po5aDo.js","/assets/trash-2-ZPDVFW-g.js","/assets/triangle-alert-Cg3jLxjq.js","/assets/typeof-B5XbjTb1.js","/assets/useStaticBoundaryData-DdAQIHCi.js","/brand/exambridge-logo-horizontal.svg","/brand/exambridge-mark.svg","/data/academic-results-v2/manifest.json","/data/caie-al-history-v1.json","/data/knowledge-v5/knowledge-tree.json","/data/knowledge-v5/manifest.json","/data/knowledge-v5/mappings/AQA-7357.json","/data/knowledge-v5/mappings/AQA-7367.json","/data/knowledge-v5/mappings/AQA-8300.json","/data/knowledge-v5/mappings/AQA-8365.json","/data/knowledge-v5/mappings/CAIE-0580.json","/data/knowledge-v5/mappings/CAIE-0606.json","/data/knowledge-v5/mappings/CAIE-9231.json","/data/knowledge-v5/mappings/CAIE-9709.json","/data/knowledge-v5/mappings/Edexcel-1MA1.json","/data/knowledge-v5/mappings/Edexcel-4MA1.json","/data/knowledge-v5/mappings/Edexcel-4PM1.json","/data/knowledge-v5/mappings/Edexcel-8MA0.json","/data/knowledge-v5/mappings/Edexcel-9FM0.json","/data/knowledge-v5/mappings/Edexcel-9MA0.json","/data/knowledge-v5/mappings/Edexcel-IAL.json","/data/knowledge-v5/mappings/OCR-6993.json","/data/knowledge-v5/mappings/OCR-H240.json","/data/knowledge-v5/mappings/OCR-H245.json","/data/knowledge-v5/mappings/OCR-H640.json","/data/knowledge-v5/mappings/OCR-J560.json","/data/knowledge-v5/mappings/WJEC-3300.json","/data/knowledge-v5/mappings/WJEC-C00-4968-0.json","/data/knowledge-v5/ontology.json","/data/past-papers/caie-0580.json","/data/past-papers/caie-0606.json","/data/past-papers/caie-9231.json","/data/past-papers/caie-9709.json","/data/past-papers/index.json","/data/past-papers/ocr-h240.json","/data/past-papers/pearson-1ma1.json","/data/past-papers/pearson-4ma1.json","/data/past-papers/pearson-9fm0.json","/data/past-papers/pearson-9ma0.json","/data/past-papers/pearson-yma01.json","/favicon-16x16.png","/favicon-32x32.png","/favicon.svg","/file.svg","/globe.svg","/icons/icon-192x192.png","/icons/icon-512x512.png","/icons/maskable-icon-512x512.png","/icons/pwa-icon-maskable.svg","/icons/pwa-icon.svg","/index.html","/knowledge-tree/AQA-7357_vs_AQA-7367.json","/knowledge-tree/AQA-7367_vs_OCR-H245.json","/knowledge-tree/CAIE-9231_vs_AQA-7367.json","/knowledge-tree/CAIE-9231_vs_Edexcel-9FM0.json","/knowledge-tree/CAIE-9231_vs_Edexcel-IAL-FM.json","/knowledge-tree/CAIE-9231_vs_OCR-H245.json","/knowledge-tree/CAIE-9709_vs_CAIE-9231.json","/knowledge-tree/Edexcel-8MA0_vs_CAIE-9231.json","/knowledge-tree/Edexcel-9FM0_vs_AQA-7367.json","/knowledge-tree/Edexcel-9MA0_vs_Edexcel-9FM0.json","/knowledge-tree/Edexcel-9MA0_vs_Edexcel-IAL-FM.json","/knowledge-tree/Edexcel-IAL-FM_vs_AQA-7367.json","/knowledge-tree/aqa-7357_vs_ocr-h240.json","/knowledge-tree/caie-9709_vs_aqa-7357.json","/knowledge-tree/caie-9709_vs_edexcel-8ma0.json","/knowledge-tree/caie-9709_vs_edexcel-9ma0.json","/knowledge-tree/caie-9709_vs_edexcel-ial.json","/knowledge-tree/caie-9709_vs_ocr-h240.json","/knowledge-tree/edexcel-1ma1_vs_aqa-7357.json","/knowledge-tree/edexcel-1ma1_vs_edexcel-8ma0.json","/knowledge-tree/edexcel-1ma1_vs_edexcel-9ma0.json","/knowledge-tree/edexcel-8ma0_vs_aqa-7357.json","/knowledge-tree/edexcel-8ma0_vs_edexcel-9ma0.json","/knowledge-tree/edexcel-9ma0_vs_aqa-7357.json","/knowledge-tree/edexcel-9ma0_vs_edexcel-gce-fm.json","/knowledge-tree/edexcel-ial_vs_aqa-7357.json","/knowledge-tree/knowledge-tree-phase1-alevel-math.json","/knowledge-tree/knowledge-tree-phase2-alevel-fm.json","/knowledge-tree/knowledge-tree-phase3-gcse-fm.json","/knowledge-tree/knowledge-tree-phase3-gcse-math.json","/knowledge-tree/mapping-AQA-7357.json","/knowledge-tree/mapping-AQA-7367.json","/knowledge-tree/mapping-AQA-8300.json","/knowledge-tree/mapping-AQA-8365.json","/knowledge-tree/mapping-CAIE-0580.json","/knowledge-tree/mapping-CAIE-0606.json","/knowledge-tree/mapping-CAIE-9231.json","/knowledge-tree/mapping-CAIE-9709.json","/knowledge-tree/mapping-Edexcel-1MA1.json","/knowledge-tree/mapping-Edexcel-4MA1.json","/knowledge-tree/mapping-Edexcel-8MA0.json","/knowledge-tree/mapping-Edexcel-9FM0.json","/knowledge-tree/mapping-Edexcel-9MA0.json","/knowledge-tree/mapping-Edexcel-YFM01.json","/knowledge-tree/mapping-Edexcel-YMA01.json","/knowledge-tree/mapping-OCR-H240.json","/knowledge-tree/mapping-OCR-H245.json","/knowledge-tree/mapping-OCR-J560.json","/knowledge-tree/mapping-WJEC-1300.json","/knowledge-tree/mapping-WJEC-3300.json","/knowledge-tree/mapping-WJEC-FM.json","/knowledge-tree/syllabus/syllabus-AQA-7357.json","/knowledge-tree/syllabus/syllabus-AQA-7367.json","/knowledge-tree/syllabus/syllabus-AQA-8300.json","/knowledge-tree/syllabus/syllabus-AQA-8365.json","/knowledge-tree/syllabus/syllabus-CAIE-0580.json","/knowledge-tree/syllabus/syllabus-CAIE-0606.json","/knowledge-tree/syllabus/syllabus-CAIE-9231.json","/knowledge-tree/syllabus/syllabus-CAIE-9709.json","/knowledge-tree/syllabus/syllabus-Edexcel-1MA1.json","/knowledge-tree/syllabus/syllabus-Edexcel-4MA1.json","/knowledge-tree/syllabus/syllabus-Edexcel-8MA0.json","/knowledge-tree/syllabus/syllabus-Edexcel-9FM0.json","/knowledge-tree/syllabus/syllabus-Edexcel-9MA0.json","/knowledge-tree/syllabus/syllabus-Edexcel-YFM01.json","/knowledge-tree/syllabus/syllabus-Edexcel-YMA01.json","/knowledge-tree/syllabus/syllabus-OCR-H240.json","/knowledge-tree/syllabus/syllabus-OCR-H245.json","/knowledge-tree/syllabus/syllabus-OCR-J560.json","/knowledge-tree/syllabus/syllabus-WJEC-3300.json","/knowledge-tree/unified-knowledge-tree.json","/manifest.webmanifest","/window.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(CORE))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, DATA_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  const update = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    update.catch(() => undefined);
    return cached;
  }
  return update;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // AI requests and health checks are always live and must never enter PWA caches.
  if (url.pathname.startsWith("/api/ai/")) return;
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
          caches.open(SHELL_CACHE).then((cache) => cache.put(APP_SHELL, response.clone()));
        }
        return response;
      }).catch(async () => (await caches.match(APP_SHELL)) || Response.error())
    );
    return;
  }

  if (url.pathname.startsWith("/data/") || url.pathname.startsWith("/knowledge-tree/")) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  if (/\.(?:js|css|png|svg|ico|webmanifest|woff2?)$/i.test(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    })));
  }
});
