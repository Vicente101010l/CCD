"""Geração geométrica de constelações (determinística, sem LLM).

Liga estrelas espacialmente próximas segundo uma estratégia topológica,
garantindo grafos conexos e (por usarem vizinhança) tipicamente sem cruzamentos.
"""
import math

# Estratégias mapeiam para silhuetas: caminho->Serpente, anel->Coroa,
# arvore/estrela->Criatura/Ferramenta.
STRATEGIES = ["caminho", "arvore", "anel", "estrela"]


def _dist(a, b):
    return math.sqrt(
        (a["coords"]["x"] - b["coords"]["x"]) ** 2
        + (a["coords"]["y"] - b["coords"]["y"]) ** 2
        + (a["coords"]["z"] - b["coords"]["z"]) ** 2
    )


def _nearest_neighbour_order(stars):
    """Ordena as estrelas numa cadeia greedy a partir da mais brilhante."""
    n = len(stars)
    start = min(range(n), key=lambda i: stars[i].get("mag", 3.0))
    order = [start]
    used = {start}
    while len(order) < n:
        last = order[-1]
        nxt = min((i for i in range(n) if i not in used),
                  key=lambda i: _dist(stars[last], stars[i]))
        order.append(nxt)
        used.add(nxt)
    return order


def build_edges(stars, strategy):
    """Constrói arestas {from,to} ligando estrelas próximas segundo a estratégia."""
    n = len(stars)
    if n < 2:
        return []
    ids = [s["id"] for s in stars]

    if strategy == "estrela":
        hub = min(range(n), key=lambda i: stars[i].get("mag", 3.0))
        return [{"from": ids[hub], "to": ids[i]} for i in range(n) if i != hub]

    if strategy in ("caminho", "anel"):
        order = _nearest_neighbour_order(stars)
        edges = [{"from": ids[order[k]], "to": ids[order[k + 1]]} for k in range(n - 1)]
        if strategy == "anel":
            edges.append({"from": ids[order[-1]], "to": ids[order[0]]})
        return edges

    if strategy == "arvore":
        in_tree = {0}
        edges = []
        while len(in_tree) < n:
            best = None
            for i in in_tree:
                for j in range(n):
                    if j in in_tree:
                        continue
                    d = _dist(stars[i], stars[j])
                    if best is None or d < best[0]:
                        best = (d, i, j)
            _, i, j = best
            edges.append({"from": ids[i], "to": ids[j]})
            in_tree.add(j)
        return edges

    return []
