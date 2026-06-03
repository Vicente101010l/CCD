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

    # LÓGICA ANCESTRAL 1: Silhueta Ancestral (Forma)
    if elongation > 2.0 and terminals <= 2:
        silhueta = "Serpente / Rio / Caminho Celeste"
    elif num_edges >= num_nodes and elongation <= 1.8:
        silhueta = "Coroa / Escudo / Cálice Sagrado"
    elif terminals >= 3 or (num_nodes + num_edges) > 8:
        silhueta = "Criatura / Humanoide / Besta Alada"
    else:
        silhueta = "Ferramenta / Seta / Balança de Julgamento"
        
    # LÓGICA ANCESTRAL 2: Temperamento Elemental (Cor/Espectro)
    colors = [s.get('color', '#fff4ea') for s in skeleton_stars]
    hot_count = sum(1 for c in colors if c in ['#9bb0ff', '#aabfff'])
    cool_count = sum(1 for c in colors if c in ['#ffd2a1', '#ff9e3a'])
    medium_count = len(colors) - hot_count - cool_count
    
    if hot_count > cool_count and hot_count > medium_count:
        temperamento = "Espiritual (Gelo, Trovão, Energia Cósmica)"
    elif cool_count > hot_count and cool_count > medium_count:
        temperamento = "Terrestre (Fogo Cósmico, Sangue, Terra, Ancestrais)"
    else:
        temperamento = "Equilibrado (Luz Solar, Éter, Harmonia, Justiça)"
        
    # LÓGICA ANCESTRAL 3: Estatuto Divino/Nobreza (Brilho/Magnitude)
    mags = [s.get('mag', 3.0) for s in skeleton_stars]
    avg_mag = np.mean(mags) if mags else 3.0
    if avg_mag < 1.8:
        estatuto = "Divino (Deuses Supremos, Reis Celestiais, Símbolos Sagrados)"
    elif avg_mag < 2.8:
        estatuto = "Heroico (Heróis Lendários, Semideuses, Criaturas Protetoras)"
    else:
        estatuto = "Mortal (Mero Mortal, Animais Comuns, Ferramentas dos Deuses)"
        
    # LÓGICA ANCESTRAL 4: Zona Cósmica/Eternidade (Z médio - Circumpolar vs Equatorial)
    z_coords = [abs(s['coords']['z']) for s in skeleton_stars]
    avg_z = np.mean(z_coords) if z_coords else 0.0
    if avg_z > 35:
        zona = "Polar (Eternidade, Guardiões Eternos, Navegação, Vigilância)"
    else:
        zona = "Equatorial (Ciclos das Estações, Tempo, Agricultura, Transição Terrena)"

    return {
        "asymmetry": round(float(asymmetry), 3),
        "elongation": round(float(elongation), 3),
        "has_cycles": num_edges >= num_nodes,
        "terminal_nodes": terminals,
        "complexity": num_nodes + num_edges,
        "silhueta_ancestral": silhueta,
        "temperamento_elemental": temperamento,
        "estatuto_divino": estatuto,
        "zona_cosmica": zona
    }

def get_geometric_candidates(skeleton_stars, full_catalog, limit_per_node=3):
    candidates = []
    skeleton_ids = {s['id'] for s in skeleton_stars}
    
    for star in skeleton_stars:
        # Extrair coords da estrela do esqueleto
        star_coords = np.array([star['coords']['x'], star['coords']['y'], star['coords']['z']])
        distances = []
        
        for cand in full_catalog:
            if cand['id'] in skeleton_ids:
                continue
            # No catálogo, as coords são um dicionário {"x": x, "y": y, "z": z}
            cand_coords = np.array([cand['coords']['x'], cand['coords']['y'], cand['coords']['z']])
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