from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from services.geometry import calculate_graph_properties, get_geometric_candidates
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
    candidates = get_geometric_candidates(enriched_skeleton, ALL_STARS_DATABASE)
    
    ai_raw = get_ai_completion(props, [s['name'] for s in enriched_skeleton], candidates)
    ai_data = json.loads(ai_raw)
    
    valid_targets = {c['target_id'] for c in candidates}
    sanitized_edges = [e for e in ai_data['new_edges'] if e['to'] in valid_targets]
    
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