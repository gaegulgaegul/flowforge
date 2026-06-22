#!/usr/bin/env python3
"""골든 스냅샷 생성기 — Python 원본(generate_prototype.py)으로 정답 그래프를 뽑는다.

TS 포팅(specParser.ts/flowBinder.ts)이 이 출력과 동치임을 골든 테스트로 박제한다.
입력: openspec change 디렉토리(여러 screen spec). 출력: {nodes, edges} JSON.

⚠️ 이 파일은 '정답 생성' 1회용이 아니라, 원본 로직이 바뀌면 다시 돌려 골든을 갱신하는 회귀 도구다.
"""
import json
import os
import sys

# 원본 파서 import (skill 디렉토리)
GP_DIR = "/home/gaegul/agentic-harness/plugins/agentic-harness/skills/openspec-propose"
sys.path.insert(0, GP_DIR)
import generate_prototype as gp  # noqa: E402


def build_graph(change_dir):
    """change 디렉토리의 모든 screen spec → {nodes, edges} (flow_target 기반)."""
    specs_root = os.path.join(change_dir, "specs")
    specs = []
    for name in sorted(os.listdir(specs_root)):
        spec_md = os.path.join(specs_root, name, "spec.md")
        if not os.path.isfile(spec_md):
            continue
        spec = gp.parse_spec(spec_md)
        spec["_is_screen"] = gp.is_screen_spec(spec["raw"])
        specs.append(spec)

    # screen spec만 그래프 노드 (원본 build_html이 screen_specs로 한정)
    screens = [s for s in specs if s["_is_screen"]]
    for s in screens:
        s["_aliases"] = gp.screen_aliases(s)

    nodes = [{"id": "screen-" + gp.slug(s["name"]), "name": s["name"],
              "kind": "screen"} for s in screens]
    edges = []
    for s in screens:
        for req in s["requirements"]:
            for scn in req["scenarios"]:
                tgt = gp.flow_target(scn["then"], screens, source=s)
                if tgt is None:
                    continue
                anchor, hint = tgt
                edges.append({
                    "from": "screen-" + gp.slug(s["name"]),
                    "to": anchor,
                    "scenario": scn["title"],
                    "hint": hint,
                    "dangling": anchor == "__dangling__",
                })
    return {"change": os.path.basename(change_dir.rstrip("/")),
            "nodes": nodes, "edges": edges}


if __name__ == "__main__":
    out = {}
    for change_dir in sys.argv[1:]:
        g = build_graph(change_dir)
        out[g["change"]] = g
    print(json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True))
