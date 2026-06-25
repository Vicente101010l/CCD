"""Motor de avaliação criativa do Modo Oráculo (funções puras)."""

import math

NOVELTY_LIB_SCALE = 5.0  # distância euclidiana acima da qual a biblioteca já é "distante"


def feature_vector(properties, stars):
    """Vetor numérico que caracteriza uma constelação, para comparações de novidade."""
    mags = [s.get("mag", 3.0) for s in stars]
    avg_mag = sum(mags) / len(mags) if mags else 3.0
    return [
        float(properties.get("elongation", 1.0)),
        float(properties.get("compactness", 1.0)),
        float(properties.get("asymmetry", 0.0)),
        float(properties.get("barycenter_offset", 0.0)),
        float(properties.get("num_triangles", 0)),
        float(properties.get("num_quadrilaterals", 0)),
        float(properties.get("terminal_nodes", 0)),
        float(properties.get("complexity", 0)),
        float(avg_mag),
    ]


def _con_diversity(stars):
    if len(stars) <= 1:
        return 0.0
    distinct = len({s.get("con", "") for s in stars})
    return (distinct - 1) / (len(stars) - 1)


def _nearest_lib_distance(feat_vec, library_vectors):
    if not library_vectors:
        return None
    dists = []
    for lib in library_vectors:
        d = math.sqrt(sum((a - b) ** 2 for a, b in zip(feat_vec, lib)))
        dists.append(d)
    return min(dists)


def novelty_score(stars, feat_vec, library_vectors):
    con_part = _con_diversity(stars)
    nearest = _nearest_lib_distance(feat_vec, library_vectors)
    if nearest is None:
        lib_part = 1.0
    else:
        lib_part = min(1.0, nearest / NOVELTY_LIB_SCALE)
    return round(0.6 * con_part + 0.4 * lib_part, 4)


def coherence_score(n_nodes, n_edges):
    if n_nodes < 2:
        return 0.0
    ideal_min = n_nodes - 1
    ideal_max = n_nodes + 1
    if ideal_min <= n_edges <= ideal_max:
        return 1.0
    excess = min(abs(n_edges - ideal_min), abs(n_edges - ideal_max))
    return round(max(0.0, 1.0 - excess / n_nodes), 4)


def surprise_score(properties):
    """Surpresa estrutural: formas não triviais (ciclos, ramificação, assimetria)
    são mais surpreendentes do que uma simples linha."""
    has_cycles = bool(properties.get("has_cycles"))
    terminals = properties.get("terminal_nodes", 0)
    asymmetry = properties.get("asymmetry", 0.0)

    cycle_part = 0.35 if has_cycles else 0.0
    # ramificação: mais de 2 pontas (hub/criatura) é mais surpreendente que uma linha
    branch_part = min(0.35, max(0, terminals - 2) * 0.12)
    asym_part = min(0.30, asymmetry / 20.0)
    return round(min(1.0, cycle_part + branch_part + asym_part), 4)


_FIDELITY_DIMS = [
    ("silhueta_alvo", "silhueta_ancestral"),
    ("temperamento_alvo", "temperamento_elemental"),
    ("estatuto_alvo", "estatuto_divino"),
    ("epoca_alvo", "epoca_visibilidade"),
]


def fidelity_score(intention, properties):
    total = 0
    matches = 0
    for ikey, pkey in _FIDELITY_DIMS:
        target = intention.get(ikey)
        if not target:
            continue
        total += 1
        prop_value = properties.get(pkey, "")
        if target.lower() in prop_value.lower():
            matches += 1
    if total == 0:
        return 0.0
    return round(matches / total, 4)


WEIGHTS = {"novidade": 0.4, "coerencia": 0.2, "surpresa": 0.2, "fidelidade": 0.2}


def evaluate_candidate(candidate, intention, library_vectors, seed_count):
    stars = candidate["stars"]
    edges = candidate["edges"]
    props = candidate["properties"]
    feat = feature_vector(props, stars)

    novidade = novelty_score(stars, feat, library_vectors)
    coerencia = coherence_score(len(stars), len(edges))
    surpresa = surprise_score(props)
    fidelidade = fidelity_score(intention, props)

    score = round(
        WEIGHTS["novidade"] * novidade
        + WEIGHTS["coerencia"] * coerencia
        + WEIGHTS["surpresa"] * surpresa
        + WEIGHTS["fidelidade"] * fidelidade,
        4,
    )
    return {
        "novidade": novidade,
        "coerencia": coerencia,
        "surpresa": surpresa,
        "fidelidade": fidelidade,
        "score": score,
    }


SILHUETAS = ["Serpente", "Coroa", "Criatura", "Ferramenta"]
TEMPERAMENTOS = ["Espiritual", "Terrestre", "Equilibrado"]
ESTATUTOS = ["Divino", "Heroico", "Mortal"]
EPOCAS = ["Inverno", "Primavera", "Verão", "Outono"]

_BLUE_COLORS = {"#9bb0ff", "#aabfff"}
_RED_COLORS = {"#ffd2a1", "#ff9e3a"}

_EPOCA_RA_BANDS = {
    "Inverno": (2.0, 8.0),
    "Primavera": (8.0, 14.0),
    "Verão": (14.0, 20.0),
    "Outono": (20.0, 24.0),  # + faixa 0-2 tratada à parte
}


def pick_intention_targets(rng):
    return {
        "silhueta_alvo": rng.choice(SILHUETAS),
        "temperamento_alvo": rng.choice(TEMPERAMENTOS),
        "estatuto_alvo": rng.choice(ESTATUTOS),
        "epoca_alvo": rng.choice(EPOCAS),
    }


def _ra_hours(star):
    x = star["coords"]["x"]
    y = star["coords"]["y"]
    angle = math.atan2(y, x)
    if angle < 0:
        angle += 2 * math.pi
    return (angle / (2 * math.pi)) * 24


def _matches_epoca(star, epoca):
    band = _EPOCA_RA_BANDS.get(epoca)
    if not band:
        return True
    ra = _ra_hours(star)
    if epoca == "Outono":
        return ra >= 20.0 or ra < 2.0
    return band[0] <= ra < band[1]


def _matches_temperamento(star, temperamento):
    c = star.get("color", "")
    if temperamento == "Espiritual":
        return c in _BLUE_COLORS
    if temperamento == "Terrestre":
        return c in _RED_COLORS
    return c not in _BLUE_COLORS and c not in _RED_COLORS


def _dist(a, b):
    return math.sqrt(
        (a["coords"]["x"] - b["coords"]["x"]) ** 2
        + (a["coords"]["y"] - b["coords"]["y"]) ** 2
        + (a["coords"]["z"] - b["coords"]["z"]) ** 2
    )


def seed_from_intention(intention, catalog, rng, seed_size=4):
    """Escolhe estrelas de partida enviesadas pela intenção (época + temperamento)."""
    epoca = intention.get("epoca_alvo", "")
    temperamento = intention.get("temperamento_alvo", "")

    # Filtro progressivo: tenta época+temperamento; relaxa se ficar pouca coisa.
    pool = [s for s in catalog
            if _matches_epoca(s, epoca) and _matches_temperamento(s, temperamento)]
    if len(pool) < seed_size:
        pool = [s for s in catalog if _matches_temperamento(s, temperamento)]
    if len(pool) < seed_size:
        pool = [s for s in catalog if _matches_epoca(s, epoca)]
    if len(pool) < seed_size:
        pool = list(catalog)

    # Âncora enviesada pela intenção; vizinhas escolhidas por proximidade
    # ESPACIAL no catálogo completo, para garantir um cluster local coerente.
    anchor = rng.choice(pool)
    others = [s for s in catalog if s["id"] != anchor["id"]]
    others.sort(key=lambda s: _dist(anchor, s))
    seed = [anchor] + others[: seed_size - 1]
    return seed
