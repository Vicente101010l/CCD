import os
import json
import random
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from services.geometry import calculate_graph_properties
from services.generation import propose_ai_edges
from services.creativity import (
    pick_intention_targets, seed_from_intention, evaluate_candidate,
)
from services.constellation_builder import build_edges, STRATEGIES
from services.llm_service import (
    generate_myth, generate_intention_phrase, generate_justification,
)
from dotenv import load_dotenv

N_CANDIDATES = 4

load_dotenv()

app = Flask(__name__)
CORS(app)

stars_file_path = os.path.join(os.path.dirname(__file__), 'static', 'data', 'stars.json')
with open(stars_file_path, 'r', encoding='utf-8') as f:
    ALL_STARS_DATABASE = json.load(f)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/stars', methods=['GET'])
def get_stars():
    return jsonify(ALL_STARS_DATABASE)

@app.route('/api/complete', methods=['POST'])
def complete():
    data = request.json
    skeleton = data.get('skeleton_stars', [])
    edges = data.get('edges', [])
    visible_stars_ids = data.get('visible_stars', [])

    if not skeleton:
        return jsonify({"ai_edges": [], "properties": {}})

    enriched_skeleton = []
    stars_by_id = {s['id']: s for s in ALL_STARS_DATABASE}
    for s in skeleton:
        star_id = s.get('id')
        if star_id in stars_by_id:
            est = dict(stars_by_id[star_id])
            est['coords'] = s.get('coords', est['coords'])
            enriched_skeleton.append(est)
        else:
            enriched_skeleton.append(s)

    props = calculate_graph_properties(enriched_skeleton, edges)
    sanitized_edges = propose_ai_edges(enriched_skeleton, edges, ALL_STARS_DATABASE, visible_stars_ids)

    return jsonify({
        "ai_edges": sanitized_edges,
        "properties": props
    })

@app.route('/api/myth', methods=['POST'])
def myth():
    data = request.json
    properties = data['properties']
    stars = data.get('stars', [])

    myth_data = generate_myth(
        data['constellation_name'],
        stars,
        properties
    )

    myth_json = json.loads(myth_data)

    response_data = {
        "titulo": myth_json.get("titulo", "Mito Celestial"),
        "texto": myth_json.get("texto", ""),
        "is_real": False,
        "real_name": myth_json.get("nome_constelacao", "Nova Constelação")
    }
    return jsonify(response_data)

INTENTION_KEYS = ("silhueta_alvo", "temperamento_alvo", "estatuto_alvo", "epoca_alvo")


def _resolve_intention(user_choices, rng):
    """Constrói a intenção a partir das escolhas do Q&A; preenche os campos
    em falta ou marcados 'auto' com escolhas autónomas da IA."""
    auto = pick_intention_targets(rng)
    targets = {}
    for key in INTENTION_KEYS:
        v = (user_choices or {}).get(key)
        targets[key] = auto[key] if (not v or v == "auto") else v
    return targets


_COR_LABEL = {"Espiritual": "azuis", "Terrestre": "vermelhas", "Equilibrado": "mistas"}


def _literal_intention_phrase(user_choices):
    """Frase literal que descreve o pedido do utilizador (sem LLM)."""
    uc = user_choices or {}
    parts = []
    sil = uc.get("silhueta_alvo")
    if sil and sil != "auto":
        parts.append(f"forma {sil.lower()}")
    temp = uc.get("temperamento_alvo")
    if temp and temp != "auto":
        parts.append(f"estrelas {_COR_LABEL.get(temp, temp.lower())}")
    ep = uc.get("epoca_alvo")
    if ep and ep != "auto":
        parts.append(ep.lower())

    if parts:
        pedido = "Pedido: " + ", ".join(parts) + "."
    else:
        pedido = "Sem critérios definidos (geração livre)."
    return f"{pedido} Gerei e avaliei {N_CANDIDATES} constelações; mostro a escolhida e as preteridas."


@app.route('/api/dream', methods=['POST'])
def dream():
    data = request.json or {}
    library_vectors = data.get('library_vectors', [])
    user_choices = data.get('intention', {})  # do Q&A: valores ou "auto"

    rng = random.Random()
    targets = _resolve_intention(user_choices, rng)
    frase = _literal_intention_phrase(user_choices)
    intention = {**targets, "frase": frase}

    candidates = []
    for i, strategy in enumerate(STRATEGIES):
        seed = seed_from_intention(intention, ALL_STARS_DATABASE, rng, seed_size=6)
        edges = build_edges(seed, strategy)  # geração geométrica (instantânea, coerente)
        props = calculate_graph_properties(seed, edges)
        scores = evaluate_candidate(
            {"stars": seed, "edges": edges, "properties": props},
            intention, library_vectors, len(seed),
        )
        candidates.append({
            "id": i, "strategy": strategy, "stars": seed, "edges": edges,
            "properties": props, "scores": scores, "accepted": False,
        })

    winner = max(candidates, key=lambda c: c["scores"]["score"])
    winner["accepted"] = True

    rejected = [c for c in candidates if not c["accepted"]]
    justification = generate_justification(intention, winner, rejected)
    myth_raw = generate_myth("Constelação dos Céus", winner["stars"], winner["properties"])
    myth = json.loads(myth_raw)

    return jsonify({
        "intention": intention,
        "candidates": candidates,
        "winner_id": winner["id"],
        "justification": justification,
        "myth": myth,
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
