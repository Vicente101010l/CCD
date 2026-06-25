from services.constellation_builder import build_edges, STRATEGIES


def _stars_line(n):
    # n estrelas aproximadamente colineares, magnitudes decrescentes
    return [
        {"id": i + 1, "name": f"S{i}", "coords": {"x": float(i * 3), "y": float(i % 2), "z": 50.0},
         "mag": 1.0 + i * 0.2, "color": "#fff4ea", "con": "X"}
        for i in range(n)
    ]


def _connected(ids, edges):
    adj = {i: set() for i in ids}
    for e in edges:
        adj[e["from"]].add(e["to"])
        adj[e["to"]].add(e["from"])
    seen = {ids[0]}
    stack = [ids[0]]
    while stack:
        c = stack.pop()
        for nb in adj[c]:
            if nb not in seen:
                seen.add(nb)
                stack.append(nb)
    return len(seen) == len(ids)


def test_all_strategies_connect_all_stars_without_selfloops():
    stars = _stars_line(6)
    ids = [s["id"] for s in stars]
    for strat in STRATEGIES:
        edges = build_edges(stars, strat)
        assert _connected(ids, edges), f"{strat} não ligou todas as estrelas"
        for e in edges:
            assert e["from"] != e["to"]


def test_edge_counts_by_strategy():
    stars = _stars_line(5)
    assert len(build_edges(stars, "caminho")) == 4   # n-1 (cadeia)
    assert len(build_edges(stars, "arvore")) == 4    # n-1 (árvore)
    assert len(build_edges(stars, "estrela")) == 4   # n-1 (hub)
    assert len(build_edges(stars, "anel")) == 5      # n (fecha o ciclo)


def test_strategies_produce_different_shapes():
    stars = _stars_line(5)
    shapes = {tuple(sorted((e["from"], e["to"]) for e in build_edges(stars, s)))
              for s in STRATEGIES}
    # pelo menos 3 topologias distintas entre as 4 estratégias
    assert len(shapes) >= 3
