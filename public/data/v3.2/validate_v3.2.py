import json
import re
from pathlib import Path
from collections import defaultdict, Counter

WORKSPACE = Path("/Users/yuzhou/WorkBuddy/2026-07-06-14-39-16")
TREE_PATH = WORKSPACE / "knowledge-tree-v3.2.json"
MAPPINGS_DIR = WORKSPACE / "mappings"
SYLLABI_DIR = WORKSPACE / "syllabi"

EXPECTED_RANGES = {
    ("CAIE-0580", "Edexcel-4MA1"):       {"unweighted": [85, 100], "weighted": [55, 100]},
    ("CAIE-9709", "Edexcel-9MA0"):        {"unweighted": [60, 85],  "weighted": [55, 80]},
    ("CAIE-0580", "AQA-8300"):            {"unweighted": [65, 85],  "weighted": [60, 80]},
    ("CAIE-9231", "Edexcel-9FM0"):        {"unweighted": [55, 80],  "weighted": [50, 75]},
    ("CAIE-9709-P1", "CAIE-0580"):        {"unweighted": [30, 60],  "weighted": [25, 55]},
    ("CAIE-9709-P4", "CAIE-0580"):        {"unweighted": [10, 25],  "weighted": [8, 20]},
    ("Edexcel-9MA0", "Edexcel-4MA1"):     {"unweighted": [30, 50],  "weighted": [25, 45]},
    ("CAIE-9231", "CAIE-9709"):           {"unweighted": [40, 60],  "weighted": [35, 55]},
}

PAPER_EXPECTED_RANGES = {
    ("CAIE-9709-P1", "CAIE-9709-P3"):     {"unweighted": [55, 80],  "weighted": [50, 75]},
    ("CAIE-9709-P4", "CAIE-9709-P5"):     {"unweighted": [5, 20],   "weighted": [3, 15]},
    ("CAIE-9709-P5", "CAIE-9709-P6"):     {"unweighted": [40, 65],  "weighted": [35, 60]},
    ("CAIE-9709-P1", "Edexcel-9MA0-P1"):  {"unweighted": [50, 75],  "weighted": [45, 70]},
    ("CAIE-9709-P4", "Edexcel-9MA0-P3"):  {"unweighted": [15, 35],  "weighted": [12, 30]},
    ("CAIE-9709-P5", "Edexcel-9MA0-P3"):  {"unweighted": [20, 40],  "weighted": [15, 35]},
    ("IAL-P1", "CAIE-9709-P1"):           {"unweighted": [60, 85],  "weighted": [55, 80]},
    ("IAL-P2", "CAIE-9709-P1"):           {"unweighted": [50, 75],  "weighted": [45, 70]},
    ("IAL-P3", "CAIE-9709-P3"):           {"unweighted": [50, 75],  "weighted": [45, 70]},
    ("IAL-M1", "CAIE-9709-P4"):           {"unweighted": [55, 80],  "weighted": [50, 75]},
}


def load_tree():
    tree = json.loads(TREE_PATH.read_text(encoding="utf-8"))
    nodes = {n["nodeId"]: n for n in tree["nodes"]}
    parents = {}
    for n in tree["nodes"]:
        pid = n.get("parentNodeId")
        if pid:
            parents[n["nodeId"]] = pid
    return nodes, parents


def ancestors(node_id, parents):
    result = set()
    while node_id in parents:
        node_id = parents[node_id]
        result.add(node_id)
    return result


def load_mapping(subject):
    path = MAPPINGS_DIR / f"mapping-v3.2-{subject}.json"
    if not path.exists():
        raise FileNotFoundError(f"Missing mapping: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def extract_nodes(mapping, paper_filter=None, include_ancestors=True, parents=None):
    node_set = set()
    weighted = Counter()
    for topic in mapping.get("mappings", []):
        for sub in topic.get("subtopicMappings", []):
            papers = sub.get("paperReference")
            if paper_filter is not None:
                if papers is None or not papers:
                    pass
                elif paper_filter not in papers:
                    continue
            for m in sub.get("mappedNodes", []):
                nid = m.get("nodeId")
                if not nid:
                    continue
                node_set.add(nid)
                weighted[nid] += 1
                if include_ancestors and parents is not None:
                    for anc in ancestors(nid, parents):
                        node_set.add(anc)
                        weighted[anc] += 1
    return node_set, weighted


def jaccard_unweighted(set_a, set_b):
    if not set_a and not set_b:
        return 0
    return 100 * len(set_a & set_b) / len(set_a | set_b)


def jaccard_weighted(counter_a, counter_b):
    intersection = 0
    for k in counter_a:
        if k in counter_b:
            intersection += min(counter_a[k], counter_b[k])
    union = sum(counter_a.values()) + sum(counter_b.values()) - intersection
    if union == 0:
        return 0
    return 100 * intersection / union


def parse_spec(spec):
    parts = spec.split("-")
    if spec.startswith("IAL-") and parts[1] in ("P1", "P2", "P3", "P4", "M1", "M2", "M3", "S1", "S2", "S3", "D1", "FP1", "FP2", "FP3"):
        return (f"IAL-{parts[1]}", parts[1])
    if len(parts) >= 3:
        subject = "-".join(parts[:-1])
        paper = parts[-1]
        return subject, paper
    return spec, None


def compare(spec_a, spec_b, parents):
    subject_a, paper_a = parse_spec(spec_a)
    subject_b, paper_b = parse_spec(spec_b)
    mapping_a = load_mapping(subject_a)
    mapping_b = load_mapping(subject_b)
    set_a, weight_a = extract_nodes(mapping_a, paper_a, parents=parents)
    set_b, weight_b = extract_nodes(mapping_b, paper_b, parents=parents)
    uw = jaccard_unweighted(set_a, set_b)
    w = jaccard_weighted(weight_a, weight_b)
    return round(uw, 2), round(w, 2)


def check_range(name, uw, w, ranges):
    lo_uw, hi_uw = ranges["unweighted"]
    lo_w, hi_w = ranges["weighted"]
    return {
        "name": name,
        "unweighted": uw,
        "weighted": w,
        "unweighted_pass": lo_uw <= uw <= hi_uw,
        "weighted_pass": lo_w <= w <= hi_w,
        "expected": ranges,
    }


def validate_file_integrity(nodes):
    errors = []
    file_stats = {}
    for f in sorted(MAPPINGS_DIR.glob("mapping-v3.2-*.json")):
        subject = f.stem.replace("mapping-v3.2-", "")
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{subject}: invalid JSON - {e}")
            continue
        missing = set()
        total_subtopics = 0
        mapped_subtopics = 0
        for t in data.get("mappings", []):
            for s in t.get("subtopicMappings", []):
                total_subtopics += 1
                if s.get("mappedNodes"):
                    mapped_subtopics += 1
                for m in s.get("mappedNodes", []):
                    nid = m.get("nodeId")
                    if nid and nid not in nodes:
                        missing.add(nid)
        if missing:
            errors.append(f"{subject}: {len(missing)} missing node IDs: {sorted(missing)[:5]}")
        file_stats[subject] = {
            "topics": data.get("totalTopics", 0),
            "subtopics": total_subtopics,
            "mappedSubtopics": mapped_subtopics,
            "coverage": round(mapped_subtopics / total_subtopics, 4) if total_subtopics else 0,
        }
    return errors, file_stats


def validate_all():
    nodes, parents = load_tree()
    integrity_errors, file_stats = validate_file_integrity(nodes)

    results = []
    for spec, ranges in EXPECTED_RANGES.items():
        a, b = spec
        uw, w = compare(a, b, parents)
        results.append({"type": "subject", "spec": f"{a} vs {b}", **check_range(f"{a} vs {b}", uw, w, ranges)})

    for spec, ranges in PAPER_EXPECTED_RANGES.items():
        a, b = spec
        uw, w = compare(a, b, parents)
        results.append({"type": "paper", "spec": f"{a} vs {b}", **check_range(f"{a} vs {b}", uw, w, ranges)})

    return results, integrity_errors, file_stats


def main():
    results, integrity_errors, file_stats = validate_all()
    subject_results = [r for r in results if r["type"] == "subject"]
    paper_results = [r for r in results if r["type"] == "paper"]

    all_pass = all(r["unweighted_pass"] and r["weighted_pass"] for r in results) and not integrity_errors

    report = {
        "status": "PASS" if all_pass else "FAIL",
        "integrityErrors": integrity_errors,
        "subjectComparisons": subject_results,
        "paperComparisons": paper_results,
        "fileStats": file_stats,
        "summary": {
            "subjectPass": sum(1 for r in subject_results if r["unweighted_pass"] and r["weighted_pass"]),
            "subjectTotal": len(subject_results),
            "paperPass": sum(1 for r in paper_results if r["unweighted_pass"] and r["weighted_pass"]),
            "paperTotal": len(paper_results),
            "totalMappingFiles": len(file_stats),
        }
    }

    out_path = WORKSPACE / "validation-report.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Validation status: {report['status']}")
    if integrity_errors:
        print(f"Integrity errors: {len(integrity_errors)}")
        for e in integrity_errors:
            print(f"  - {e}")
    print(f"Subject checks: {report['summary']['subjectPass']}/{report['summary']['subjectTotal']} PASS")
    print(f"Paper checks: {report['summary']['paperPass']}/{report['summary']['paperTotal']} PASS")
    for r in results:
        status = "PASS" if r["unweighted_pass"] and r["weighted_pass"] else "FAIL"
        print(f"  [{status}] {r['name']}: uw={r['unweighted']} (exp {r['expected']['unweighted']}), w={r['weighted']} (exp {r['expected']['weighted']})")


if __name__ == "__main__":
    main()
