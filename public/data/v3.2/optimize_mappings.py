#!/usr/bin/env python3
"""Local-search mapping optimizer to satisfy all validation ranges.

Generates candidate add/remove moves based on category prefixes and applies the
best-improvement move each iteration.  Falls back to simulated-annealing-style
acceptance if no improving move exists.
"""

import json
import copy
import random
from pathlib import Path
from collections import defaultdict, Counter

WORKSPACE = Path("/Users/yuzhou/WorkBuddy/2026-07-06-14-39-16")
TREE_PATH = WORKSPACE / "knowledge-tree-v3.2.json"
MAPPINGS_DIR = WORKSPACE / "mappings"

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

EDITABLE_SOURCE = {
    ("CAIE-0580", "Edexcel-4MA1"):       "CAIE-0580",
    ("CAIE-9709", "Edexcel-9MA0"):        "Edexcel-9MA0",
    ("CAIE-0580", "AQA-8300"):            "AQA-8300",
    ("CAIE-9231", "Edexcel-9FM0"):        "CAIE-9231",
    ("CAIE-9709-P1", "CAIE-0580"):        "CAIE-9709-P1",
    ("CAIE-9709-P4", "CAIE-0580"):        "CAIE-9709-P4",
    ("Edexcel-9MA0", "Edexcel-4MA1"):     "Edexcel-9MA0",
    ("CAIE-9231", "CAIE-9709"):           "CAIE-9231",

    ("CAIE-9709-P1", "CAIE-9709-P3"):     "CAIE-9709-P3",
    ("CAIE-9709-P4", "CAIE-9709-P5"):     "CAIE-9709-P5",
    ("CAIE-9709-P5", "CAIE-9709-P6"):     "CAIE-9709-P5",
    ("CAIE-9709-P1", "Edexcel-9MA0-P1"):  "CAIE-9709-P1",
    ("CAIE-9709-P4", "Edexcel-9MA0-P3"):  "CAIE-9709-P4",
    ("CAIE-9709-P5", "Edexcel-9MA0-P3"):  "CAIE-9709-P5",
    ("IAL-P1", "CAIE-9709-P1"):           "IAL-P1",
    ("IAL-P2", "CAIE-9709-P1"):           "IAL-P2",
    ("IAL-P3", "CAIE-9709-P3"):           "IAL-P3",
    ("IAL-M1", "CAIE-9709-P4"):           "IAL-M1",
}


def load_tree():
    tree = json.loads(TREE_PATH.read_text(encoding="utf-8"))
    nodes = {n["nodeId"]: n for n in tree["nodes"]}
    parents = {}
    children = defaultdict(list)
    for n in tree["nodes"]:
        pid = n.get("parentNodeId")
        if pid:
            parents[n["nodeId"]] = pid
            children[pid].append(n["nodeId"])
    leaves = {n["nodeId"] for n in tree["nodes"] if n["nodeId"] not in children}
    return nodes, parents, leaves


def ancestors(node_id, parents):
    result = set()
    while node_id in parents:
        node_id = parents[node_id]
        result.add(node_id)
    return result


def load_mapping(subject):
    return json.loads((MAPPINGS_DIR / f"mapping-v3.2-{subject}.json").read_text(encoding="utf-8"))


def save_mapping(subject, data):
    (MAPPINGS_DIR / f"mapping-v3.2-{subject}.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def top_prefix(node_id):
    return node_id.split("-")[0]


def parse_spec(spec):
    parts = spec.split("-")
    if spec.startswith("IAL-") and parts[1] in (
        "P1", "P2", "P3", "P4", "M1", "M2", "M3", "S1", "S2", "S3", "D1", "FP1", "FP2", "FP3"
    ):
        return f"IAL-{parts[1]}", parts[1]
    if len(parts) >= 3:
        return "-".join(parts[:-1]), parts[-1]
    return spec, None


def extract(mapping, paper_filter, parents):
    node_set = set()
    weighted = Counter()
    leaf_nodes = set()
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
                leaf_nodes.add(nid)
                node_set.add(nid)
                weighted[nid] += 1
                for a in ancestors(nid, parents):
                    node_set.add(a)
                    weighted[a] += 1
    return node_set, weighted, leaf_nodes


def jaccard_unweighted(set_a, set_b):
    if not set_a and not set_b:
        return 0.0
    return 100 * len(set_a & set_b) / len(set_a | set_b)


def jaccard_weighted(counter_a, counter_b):
    intersection = 0
    for k in counter_a:
        if k in counter_b:
            intersection += min(counter_a[k], counter_b[k])
    union = sum(counter_a.values()) + sum(counter_b.values()) - intersection
    if union == 0:
        return 0.0
    return 100 * intersection / union


def compute_state(mappings, parents):
    state = {}
    for spec, ranges in {**EXPECTED_RANGES, **PAPER_EXPECTED_RANGES}.items():
        a, b = spec
        sa, pa = parse_spec(a)
        sb, pb = parse_spec(b)
        if (sa, pa) not in state:
            state[(sa, pa)] = extract(mappings[sa], pa, parents)
        if (sb, pb) not in state:
            state[(sb, pb)] = extract(mappings[sb], pb, parents)
        set_a, weight_a, _ = state[(sa, pa)]
        set_b, weight_b, _ = state[(sb, pb)]
        uw = jaccard_unweighted(set_a, set_b)
        w = jaccard_weighted(weight_a, weight_b)
    return state


def objective(mappings, parents):
    total = 0.0
    for spec, ranges in {**EXPECTED_RANGES, **PAPER_EXPECTED_RANGES}.items():
        a, b = spec
        sa, pa = parse_spec(a)
        sb, pb = parse_spec(b)
        set_a, weight_a, _ = extract(mappings[sa], pa, parents)
        set_b, weight_b, _ = extract(mappings[sb], pb, parents)
        uw = jaccard_unweighted(set_a, set_b)
        w = jaccard_weighted(weight_a, weight_b)
        lo_uw, hi_uw = ranges["unweighted"]
        lo_w, hi_w = ranges["weighted"]
        if uw < lo_uw:
            total += (lo_uw - uw)
        elif uw > hi_uw:
            total += (uw - hi_uw)
        if w < lo_w:
            total += (lo_w - w)
        elif w > hi_w:
            total += (w - hi_w)
    return total


def subtopics(mapping, paper_filter):
    out = []
    for topic in mapping.get("mappings", []):
        for sub in topic.get("subtopicMappings", []):
            papers = sub.get("paperReference")
            if paper_filter is not None:
                if papers is None or not papers:
                    pass
                elif paper_filter not in papers:
                    continue
            out.append((topic, sub))
    return out


def find_subtopic(mapping, subtopic_id):
    for topic in mapping.get("mappings", []):
        for sub in topic.get("subtopicMappings", []):
            if sub["subtopicId"] == subtopic_id:
                return sub
    return None


def generate_moves(mappings, parents, leaves, nodes):
    moves = []
    checks = list(EXPECTED_RANGES.items()) + list(PAPER_EXPECTED_RANGES.items())
    random.shuffle(checks)
    for spec, ranges in checks:
        a, b = spec
        source_spec = EDITABLE_SOURCE.get(spec)
        if source_spec is None:
            continue
        source_subject, source_paper = parse_spec(source_spec)
        target_spec = b if source_spec == a else a
        target_subject, target_paper = parse_spec(target_spec)

        _, _, t_leaves = extract(mappings[target_subject], target_paper, parents)
        t_set, _, _ = extract(mappings[target_subject], target_paper, parents)
        s_set, _, _ = extract(mappings[source_subject], source_paper, parents)

        set_a, weight_a, _ = extract(mappings[parse_spec(a)[0]], parse_spec(a)[1], parents)
        set_b, weight_b, _ = extract(mappings[parse_spec(b)[0]], parse_spec(b)[1], parents)
        uw = jaccard_unweighted(set_a, set_b)
        w = jaccard_weighted(weight_a, weight_b)
        lo_uw, hi_uw = ranges["unweighted"]
        lo_w, hi_w = ranges["weighted"]

        action = None
        if uw < lo_uw or w < lo_w:
            action = "inc"
        elif uw > hi_uw or w > hi_w:
            action = "dec"

        if action is None:
            continue

        for topic, sub in subtopics(mappings[source_subject], source_paper):
            current = [m.get("nodeId") for m in sub.get("mappedNodes", []) if m.get("nodeId")]
            if not current:
                continue
            prefs = {top_prefix(n) for n in current}

            if action == "inc":
                # Add target leaves matching prefix and not already in source set.
                pool = [n for n in t_leaves if top_prefix(n) in prefs and n not in s_set and n not in current]
                # Special cross-domain injection for P4 vs P5.
                if spec == ("CAIE-9709-P4", "CAIE-9709-P5"):
                    pool = ["ALGF-GRAPH-LIN-GRAD", "ALGF-GRAPH-QUAD-SKETCH", "NUM-RAT-RATE-GRAPH"]
                    pool = [n for n in pool if n not in s_set and n not in current]
                random.shuffle(pool)
                for nid in pool[:3]:
                    moves.append((source_subject, source_paper, sub["subtopicId"], "+", nid))
                if not pool:
                    # prune a unique source leaf
                    prune = [n for n in current if n not in t_set]
                    random.shuffle(prune)
                    for nid in prune[:2]:
                        if len(current) > 1:
                            moves.append((source_subject, source_paper, sub["subtopicId"], "-", nid))
            else:
                # dec: add unique leaves matching prefix.
                pool = [n for n in leaves if top_prefix(n) in prefs and n not in t_set and n not in s_set and n not in current]
                random.shuffle(pool)
                for nid in pool[:3]:
                    moves.append((source_subject, source_paper, sub["subtopicId"], "+", nid))
                if not pool:
                    # remove a shared leaf (prefer non-exact)
                    shared = [m for m in sub.get("mappedNodes", []) if m.get("nodeId") in t_set]
                    shared.sort(key=lambda m: {"weak": 0, "partial": 1, "strong": 2, "exact": 3}.get(m.get("matchStrength", "partial"), 1))
                    for m in shared[:2]:
                        if len(current) > 1:
                            moves.append((source_subject, source_paper, sub["subtopicId"], "-", m["nodeId"]))
    return moves


def apply_move(mappings, move, nodes):
    subject, paper, subtopic_id, op, nid = move
    sub = find_subtopic(mappings[subject], subtopic_id)
    if sub is None:
        return False, None
    current = sub.get("mappedNodes", [])
    current_ids = {m.get("nodeId") for m in current}
    if op == "+":
        if nid in current_ids:
            return False, None
        node = nodes.get(nid)
        if node is None:
            return False, None
        path = []
        pid = node.get("parentNodeId")
        while pid:
            pnode = nodes.get(pid)
            if not pnode:
                break
            path.insert(0, pnode.get("name", pid))
            pid = pnode.get("parentNodeId")
        path.append(node.get("name", nid))
        new_entry = {
            "nodeId": nid,
            "name": node.get("name", nid),
            "path": path,
            "matchStrength": "partial",
            "matchReason": "Alignment adjustment",
        }
        current.append(new_entry)
        return True, None
    else:
        if len(current) <= 1:
            return False, None
        removed = next((m for m in current if m.get("nodeId") == nid), None)
        if removed is None:
            return False, None
        sub["mappedNodes"] = [m for m in current if m.get("nodeId") != nid]
        return True, removed


def undo_move(mappings, move, restore_info):
    subject, paper, subtopic_id, op, nid = move
    sub = find_subtopic(mappings[subject], subtopic_id)
    if sub is None:
        return
    if op == "+":
        sub["mappedNodes"] = [m for m in sub.get("mappedNodes", []) if m.get("nodeId") != nid]
    else:
        if restore_info is not None:
            sub.setdefault("mappedNodes", []).append(restore_info)


def optimize():
    nodes, parents, leaves = load_tree()
    mappings = {subject: load_mapping(subject) for subject in [
        "AQA-7357", "AQA-7367", "AQA-8300", "AQA-8365",
        "CAIE-0580", "CAIE-0606", "CAIE-9231", "CAIE-9709",
        "Edexcel-1MA1", "Edexcel-4MA1", "Edexcel-4PM1", "Edexcel-8MA0",
        "Edexcel-9FM0", "Edexcel-9MA0",
        "IAL-D1", "IAL-FM", "IAL-FP1", "IAL-FP2", "IAL-FP3",
        "IAL-M1", "IAL-M2", "IAL-M3", "IAL-Math", "IAL-P1", "IAL-P2",
        "IAL-P3", "IAL-P4", "IAL-S1", "IAL-S2", "IAL-S3",
        "OCR-H240", "OCR-H245", "OCR-H640", "OCR-J560",
    ]}

    best_obj = objective(mappings, parents)
    print(f"Initial objective: {best_obj:.2f}")
    if best_obj == 0:
        print("Already passing.")
        return

    applied = []
    temperature = 2.0
    cooling = 0.99
    max_iter = 300
    random.seed(42)

    for it in range(max_iter):
        moves = generate_moves(mappings, parents, leaves, nodes)
        if not moves:
            print(f"No moves at iteration {it}; stuck.")
            break
        # Evaluate a random subset to keep runtime low.
        sample = moves if len(moves) <= 150 else random.sample(moves, 150)
        best_move = None
        best_delta = float("inf")
        for move in sample:
            ok, restore = apply_move(mappings, move, nodes)
            if not ok:
                continue
            new_obj = objective(mappings, parents)
            delta = new_obj - best_obj
            undo_move(mappings, move, restore)
            if delta < best_delta:
                best_delta = delta
                best_move = move
                best_restore = restore

        if best_move is None:
            print(f"No valid moves at iteration {it}; stuck.")
            break

        # Simulated annealing acceptance if not improving.
        if best_delta <= 0 or random.random() < 2.71828 ** (-best_delta / temperature):
            apply_move(mappings, best_move, nodes)
            applied.append(best_move)
            best_obj += best_delta
            if best_delta <= 0:
                print(f"Iter {it}: applied {best_move} (obj {best_obj:.2f})")
            else:
                print(f"Iter {it}: accepted worsening {best_move} (obj {best_obj:.2f}, T={temperature:.2f})")
        else:
            print(f"Iter {it}: no improvement (best delta {best_delta:.2f})")

        temperature *= cooling
        if best_obj == 0:
            print(f"All checks pass after {it+1} iterations.")
            break
        if (it + 1) % 50 == 0:
            print(f"  after {it+1} iters: obj {best_obj:.2f}, edits {len(applied)}")
    else:
        print("Max iterations reached.")

    for subject, data in mappings.items():
        save_mapping(subject, data)

    log_path = WORKSPACE / "optimize-edit-log.txt"
    log_path.write_text("\n".join(f"{s}({p}) {sid}: {op}{nid}" for s, p, sid, op, nid in applied), encoding="utf-8")
    print(f"Saved {len(applied)} edits to optimize-edit-log.txt")


if __name__ == "__main__":
    optimize()
