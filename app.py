import os
import json
import math
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from services.geometry import calculate_graph_properties, get_extended_candidates_and_pairs
from services.llm_service import generate_myth
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Carregar base de dados real a partir do arquivo stars.json do catálogo HYG
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
    visible_stars_ids = data.get('visible_stars', [])  # Filtro de visão recuperado

    if not skeleton:
        return jsonify({"ai_edges": [], "properties": {}})

    # Enriquecer o esqueleto com os dados do catálogo local (mag, color, con)
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

    # Calcular propriedades métricas e lógicas ancestrais
    props = calculate_graph_properties(enriched_skeleton, edges)
    
    # Obter os candidatos estendidos 1-hop e 2-hop baseados na topologia geométrica
    candidate_stars_list, recommended_pairs = get_extended_candidates_and_pairs(enriched_skeleton, ALL_STARS_DATABASE, edges)
    
    # --- FILTRO ANTI-COSTAS: Restringir estritamente ao que está no ecrã do utilizador ---
    if visible_stars_ids:
        visible_set = set(visible_stars_ids)
        candidate_stars_list = [c for c in candidate_stars_list if c['id'] in visible_set]
        recommended_pairs = [
            p for p in recommended_pairs 
            if p['from_id'] in visible_set and p['to_id'] in visible_set
        ]

    # Mapeamento para índices sequenciais simples (Impede falhas de parsing de IDs gigantes no Llama)
    all_available_nodes = enriched_skeleton + candidate_stars_list
    id_to_idx = {node['id']: idx for idx, node in enumerate(all_available_nodes)}
    idx_to_id = {idx: node['id'] for idx, node in enumerate(all_available_nodes)}

    skeleton_formatted = [f"Índice AI: {id_to_idx[s['id']]} (Estrela: {s['name']})" for s in enriched_skeleton]
    candidates_formatted = [f"Índice AI: {id_to_idx[c['id']]} (Estrela: {c['name']})" for c in candidate_stars_list]
    
    pairs_formatted = []
    for p in recommended_pairs:
        if p['from_id'] in id_to_idx and p['to_id'] in id_to_idx:
            pairs_formatted.append(f"- Conectar Índice {id_to_idx[p['from_id']]} ao Índice {id_to_idx[p['to_id']]} [Dist: {p['dist']}]")

    num_connections = max(3, min(5, len(enriched_skeleton) + 1))

    prompt_ai = f"""
    CONTEXTO: Auxílio computacional na criação e extensão de grafos geométricos de constelações celestes.
    
    NÓS DO ESQUELETO ATUAL (Desenhados pelo utilizador humano):
    {', '.join(skeleton_formatted)}
    
    NÓS CANDIDATOS VIZINHOS DISPONÍVEIS (Estrelas que estão estritamente no ecrã ativo e campo de visão do observador):
    {', '.join(candidates_formatted)}
    
    LIGAÇÕES PLANARES RECOMENDADAS PELO SISTEMA:
    {chr(10).join(pairs_formatted)}

    TAREFA: Proponha exatamente {num_connections} novas linhas (new_edges) para estender a silhueta de forma complexa e harmoniosa.
    Restrições: Proponha ligações unindo nós do esqueleto a nós candidatos disponíveis, ou candidatos entre si. Nunca deixe nós isolados ou flutuantes.
    
    Responda RIGOROSAMENTE no formato JSON estruturado:
    {{ "new_edges": [ {{"from": Índice, "to": Índice, "reason": "motivo poético"}} ] }}
    """

    ai_edges = []
    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt_ai}],
            response_format={"type": "json_object"},
            temperature=0.2
        )
        ai_data = json.loads(completion.choices[0].message.content)
        
        for e in ai_data.get('new_edges', []):
            u_idx, v_idx = e.get('from'), e.get('to')
            if u_idx in idx_to_id and v_idx in idx_to_id:
                u_id = idx_to_id[u_idx]
                v_id = idx_to_id[v_idx]
                if u_id != v_id:
                    ai_edges.append({"from": int(u_id), "to": int(v_id)})
                    
    except Exception as err:
        print("Aviso: Falha de parsing na LLM, a aplicar rota de salvaguarda geométrica local:", err)
        if enriched_skeleton and candidate_stars_list:
            ai_edges.append({"from": enriched_skeleton[-1]['id'], "to": candidate_stars_list[0]['id']})

   
    skeleton_ids = {s['id'] for s in enriched_skeleton}
    adj = {}
    for e in ai_edges:
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
                
    sanitized_edges = [e for e in ai_edges if e['from'] in visited and e['to'] in visited]
    
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
    
    response_data = {
        "titulo": myth_json.get("titulo", "Mito Celestial"),
        "texto": myth_json.get("texto", ""),
        "is_real": False,
        "real_name": myth_json.get("nome_constelacao", "Nova Constelação")
    }
    return jsonify(response_data)

if __name__ == '__main__':
    app.run(debug=True, port=5000)