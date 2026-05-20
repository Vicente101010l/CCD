from flask import Flask, request, jsonify
from flask_cors import CORS
from services.geometry import calculate_graph_properties, get_geometric_candidates
from services.llm_service import get_ai_completion, generate_myth
import json
import random

app = Flask(__name__)
CORS(app)

ALL_STARS_DATABASE = []
for i in range(97):
    ALL_STARS_DATABASE.append({
        "id": i,
        "name": f"Estrela {i}",
        "coords": [
            (random.random() - 0.5) * 100,
            (random.random() - 0.5) * 100,
            (random.random() - 0.5) * 100
        ]
    })

@app.route('/api/complete', methods=['POST'])
def complete():
    data = request.json
    skeleton = data['skeleton_stars']
    edges = data['edges']
    
    props = calculate_graph_properties(skeleton, edges)
    candidates = get_geometric_candidates(skeleton, ALL_STARS_DATABASE)
    
    ai_raw = get_ai_completion(props, [s['name'] for s in skeleton], candidates)
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
    myth_data = generate_myth(data['constellation_name'], data['star_names'], data['properties'])
    return jsonify(json.loads(myth_data))

if __name__ == '__main__':
    app.run(debug=True, port=5000)