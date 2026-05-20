import numpy as np

def calculate_graph_properties(skeleton_stars, edges):
    # Extrair apenas os valores [x, y, z] de cada dicionário de estrela
    coords_list = [[s['coords']['x'], s['coords']['y'], s['coords']['z']] for s in skeleton_stars]
    coords = np.array(coords_list)
    
    centroid = np.mean(coords, axis=0)
    
    dist_to_centroid = np.linalg.norm(coords - centroid, axis=1)
    max_dist = np.max(dist_to_centroid)
    avg_dist = np.mean(dist_to_centroid)
    elongation = max_dist / avg_dist if avg_dist > 0 else 1
    
    asymmetry = np.std(dist_to_centroid)

    num_nodes = len(skeleton_stars)
    num_edges = len(edges)
    
    adj = {s['id']: 0 for s in skeleton_stars}
    for e in edges:
        adj[e['from']] += 1
        adj[e['to']] += 1
    terminals = sum(1 for v in adj.values() if v == 1)

    return {
        "asymmetry": round(float(asymmetry), 3),
        "elongation": round(float(elongation), 3),
        "has_cycles": num_edges >= num_nodes,
        "terminal_nodes": terminals,
        "complexity": num_nodes + num_edges
    }

def get_geometric_candidates(skeleton_stars, full_catalog, limit_per_node=3):
    candidates = []
    skeleton_ids = {s['id'] for s in skeleton_stars}
    
    for star in skeleton_stars:
        # Extrair coords da estrela do esqueleto
        star_coords = np.array([star['coords']['x'], star['coords']['y'], star['coords']['z']])
        distances = []
        
        for cand in full_catalog:
            if cand['id'] in skeleton_ids: continue
            # No catálogo, as coords são uma lista [x, y, z]
            cand_coords = np.array(cand['coords'])
            dist = np.linalg.norm(star_coords - cand_coords)
            distances.append({"id": cand['id'], "name": cand['name'], "dist": dist})
        
        distances.sort(key=lambda x: x['dist'])
        for i in range(min(limit_per_node, len(distances))):
            candidates.append({
                "source_id": star['id'],
                "target_id": distances[i]['id'],
                "target_name": distances[i]['name']
            })
    return candidates