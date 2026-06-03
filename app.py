from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from services.geometry import calculate_graph_properties, get_geometric_candidates, get_extended_candidates_and_pairs
from services.llm_service import get_ai_completion, generate_myth
import json
import random

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


import os

# Carregar o catálogo de estrelas reais a partir do JSON gerado
stars_file_path = os.path.join(os.path.dirname(__file__), 'static', 'data', 'stars.json')
with open(stars_file_path, 'r', encoding='utf-8') as f:
    ALL_STARS_DATABASE = json.load(f)

@app.route('/api/stars', methods=['GET'])
def get_stars():
    return jsonify(ALL_STARS_DATABASE)

@app.route('/api/complete', methods=['POST'])
def complete():
    data = request.json
    skeleton = data['skeleton_stars']
    edges = data['edges']
    
    # Enriquecer o esqueleto com os dados completos do catálogo local (mag, color, etc)
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
    
    # Obter conexões de candidatos vizinhos (geometria 3D) e pares sugeridos
    candidate_stars_list, recommended_pairs = get_extended_candidates_and_pairs(enriched_skeleton, ALL_STARS_DATABASE, edges)
    candidate_ids = {c['id'] for c in candidate_stars_list}
    
    # Número dinâmico de sugestões baseadas no tamanho do esqueleto
    num_connections = max(4, min(8, len(enriched_skeleton) + 1))
    
    ai_raw = get_ai_completion(props, enriched_skeleton, candidate_stars_list, recommended_pairs, num_connections)
    ai_data = json.loads(ai_raw)
    
    # Validar as novas ligações (podem ligar esqueleto-esqueleto, esqueleto-candidato ou candidato-candidato)
    valid_ids = {s['id'] for s in enriched_skeleton} | candidate_ids
    initial_ai_edges = []
    for e in ai_data.get('new_edges', []):
        u, v = e.get('from'), e.get('to')
        if u in valid_ids and v in valid_ids:
            if u != v:
                initial_ai_edges.append(e)
                
    # Filtrar ligações flutuantes (garantir que estão ligadas ao esqueleto do utilizador)
    skeleton_ids = {s['id'] for s in enriched_skeleton}
    adj = {}
    for e in initial_ai_edges:
        u, v = e['from'], e['to']
        if u not in adj: adj[u] = []
        if v not in adj: adj[v] = []
        adj[u].append(v)
        adj[v].append(u)
        
    visited = set(skeleton_ids)
    queue = list(skeleton_ids)
    while queue:
        curr = queue.pop(0)
        for neighbor in adj.get(curr, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
                
    sanitized_edges = []
    for e in initial_ai_edges:
        u, v = e['from'], e['to']
        if u in visited and v in visited:
            sanitized_edges.append(e)
    
    return jsonify({
        "ai_edges": sanitized_edges,
        "properties": props
    })

@app.route('/api/myth', methods=['POST'])
def myth():
    data = request.json
    properties = data['properties']
    
    myth_data = generate_myth(
        data['constellation_name'], 
        data['star_names'], 
        properties
    )
    
    myth_json = json.loads(myth_data)
    constellation_name = myth_json.get("nome_constelacao", "Nova Constelação")
    
    response_data = {
        "titulo": myth_json.get("titulo", "Mito Celestial"),
        "texto": myth_json.get("texto", ""),
        "is_real": False,
        "real_name": constellation_name
    }
    return jsonify(response_data)

if __name__ == '__main__':
    app.run(debug=True, port=5000)