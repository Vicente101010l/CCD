from services.creativity import feature_vector
from services.geometry import calculate_graph_properties


def test_feature_vector_has_expected_length_and_avg_mag(line_skeleton):
    edges = [{"from": 1, "to": 2}, {"from": 2, "to": 3}, {"from": 3, "to": 4}]
    props = calculate_graph_properties(line_skeleton, edges)
    vec = feature_vector(props, line_skeleton)
    assert len(vec) == 9
    # avg_mag = (1.5+2.0+2.5+3.0)/4 = 2.25 é o último elemento
    assert abs(vec[-1] - 2.25) < 1e-6
    assert all(isinstance(v, float) for v in vec)


from services.creativity import novelty_score


def test_novelty_high_when_stars_span_many_real_constellations(line_skeleton):
    # line_skeleton tem 4 cons distintos (Aaa,Bbb,Ccc,Ddd) e biblioteca vazia
    feat = [1.0] * 9
    score = novelty_score(line_skeleton, feat, library_vectors=[])
    assert score > 0.9


def test_novelty_low_when_all_same_real_constellation(make_star_factory):
    ms = make_star_factory
    stars = [ms(1, 0, 0, 50, con="Ori"), ms(2, 5, 0, 50, con="Ori"),
             ms(3, 10, 0, 50, con="Ori"), ms(4, 15, 0, 50, con="Ori")]
    feat = [1.0] * 9
    score = novelty_score(stars, feat, library_vectors=[])
    assert score < 0.5


def test_novelty_drops_when_identical_to_library(line_skeleton):
    feat = [1.0] * 9
    # biblioteca contém um vetor idêntico => componente de biblioteca = 0
    score_dup = novelty_score(line_skeleton, feat, library_vectors=[[1.0] * 9])
    score_fresh = novelty_score(line_skeleton, feat, library_vectors=[])
    assert score_dup < score_fresh


from services.creativity import coherence_score, surprise_score, fidelity_score


def test_coherence_perfect_for_tree_like_edge_count():
    # árvore: n-1 arestas => coerência máxima
    assert coherence_score(5, 4) == 1.0
    assert coherence_score(5, 6) == 1.0  # n+1 ainda ideal


def test_coherence_penalizes_too_many_edges():
    assert coherence_score(5, 12) < 0.5


def test_surprise_rewards_cycles_and_branching():
    ring = {"has_cycles": True, "terminal_nodes": 0, "asymmetry": 5.0}
    line = {"has_cycles": False, "terminal_nodes": 2, "asymmetry": 1.0}
    hub = {"has_cycles": False, "terminal_nodes": 5, "asymmetry": 3.0}
    assert surprise_score(ring) > surprise_score(line)
    assert surprise_score(hub) > surprise_score(line)
    assert 0.0 <= surprise_score(ring) <= 1.0


def test_fidelity_counts_matching_dimensions():
    intention = {
        "silhueta_alvo": "Serpente",
        "temperamento_alvo": "Espiritual",
        "estatuto_alvo": "Heroico",
        "epoca_alvo": "Inverno",
    }
    props = {
        "silhueta_ancestral": "Serpente / Rio / Caminho Celeste",
        "temperamento_elemental": "Terrestre (Fogo Cósmico, Sangue, Terra, Ancestrais)",
        "estatuto_divino": "Heroico (Heróis Lendários, Semideuses)",
        "epoca_visibilidade": "Inverno (Céu gélido, recolhimento)",
    }
    # batem 3 de 4 (temperamento falha)
    assert abs(fidelity_score(intention, props) - 0.75) < 1e-6


from services.creativity import evaluate_candidate


def test_evaluate_candidate_returns_weighted_score(line_skeleton):
    edges = [{"from": 1, "to": 2}, {"from": 2, "to": 3}, {"from": 3, "to": 4}]
    props = calculate_graph_properties(line_skeleton, edges)
    candidate = {"stars": line_skeleton, "edges": edges, "properties": props}
    intention = {"silhueta_alvo": "Serpente", "epoca_alvo": "Zzz",
                 "temperamento_alvo": "Zzz", "estatuto_alvo": "Zzz"}
    out = evaluate_candidate(candidate, intention, library_vectors=[], seed_count=2)
    for k in ("novidade", "coerencia", "surpresa", "fidelidade", "score"):
        assert k in out
        assert 0.0 <= out[k] <= 1.0
    expected = round(0.4 * out["novidade"] + 0.2 * out["coerencia"]
                     + 0.2 * out["surpresa"] + 0.2 * out["fidelidade"], 4)
    assert abs(out["score"] - expected) < 1e-6


import random
from services.creativity import pick_intention_targets, seed_from_intention


def test_pick_intention_targets_has_all_dims():
    rng = random.Random(42)
    t = pick_intention_targets(rng)
    for k in ("silhueta_alvo", "temperamento_alvo", "estatuto_alvo", "epoca_alvo"):
        assert k in t and isinstance(t[k], str) and t[k]


def test_seed_prefers_blue_stars_for_spiritual(make_star_factory):
    ms = make_star_factory
    # 4 azuis juntas + 4 vermelhas juntas
    blue = [ms(i, i, 0, 50, color="#9bb0ff", con=f"B{i}") for i in range(1, 5)]
    red = [ms(i, i, 40, 30, color="#ff9e3a", con=f"R{i}") for i in range(5, 9)]
    catalog = blue + red
    intention = {"temperamento_alvo": "Espiritual", "epoca_alvo": "",
                 "silhueta_alvo": "Serpente", "estatuto_alvo": "Heroico"}
    rng = random.Random(0)
    seed = seed_from_intention(intention, catalog, rng, seed_size=3)
    # maioria das estrelas escolhidas deve ser azul
    blue_ids = {s["id"] for s in blue}
    chosen_blue = sum(1 for s in seed if s["id"] in blue_ids)
    assert chosen_blue >= 2
    assert len(seed) == 3
