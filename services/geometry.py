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

    # LÓGICA ANCESTRAL 5: Época de Visibilidade (Estação do Ano baseada em Ascensão Reta - RA)
    import math
    ra_angles = []
    for s in skeleton_stars:
        x = s['coords']['x']
        y = s['coords']['y']
        angle = math.atan2(y, x)
        if angle < 0:
            angle += 2 * math.pi
        ra_hours = (angle / (2 * math.pi)) * 24
        ra_angles.append(ra_hours)
    
    if ra_angles:
        sin_sum = sum(math.sin(a * math.pi / 12) for a in ra_angles)
        cos_sum = sum(math.cos(a * math.pi / 12) for a in ra_angles)
        avg_angle = math.atan2(sin_sum, cos_sum)
        if avg_angle < 0:
            avg_angle += 2 * math.pi
        avg_ra = (avg_angle / (2 * math.pi)) * 24
    else:
        avg_ra = 0.0

    if 2.0 <= avg_ra < 8.0:
        estacao = "Inverno (Céu gélido, recolhimento, noites longas de reflexão)"
    elif 8.0 <= avg_ra < 14.0:
        estacao = "Primavera (Renascimento, florescimento, início dos ciclos férteis)"
    elif 14.0 <= avg_ra < 20.0:
        estacao = "Verão (Calor, colheita, atividade intensa, noites quentes)"
    else:
        estacao = "Outono (Transição, queda das folhas, preparação, sobriedade)"

    # LÓGICA ANCESTRAL 6: Proximidade da Via Láctea (Latitude Galáctica b)
    # Direção do Polo Norte Galáctico: n_ngp = [-0.8676, -0.1980, 0.4560]
    sin_b_list = []
    for s in skeleton_stars:
        ux = s['coords']['x'] / 50.0
        uy = s['coords']['y'] / 50.0
        uz = s['coords']['z'] / 50.0
        sin_b = ux * (-0.8676) + uy * (-0.1980) + uz * 0.4560
        sin_b_list.append(abs(sin_b))
        
    avg_abs_sin_b = np.mean(sin_b_list) if sin_b_list else 0.0
    if avg_abs_sin_b < 0.26:
        via_lactea = "Cruzadora do Rio Celeste (Atravessa a Via Láctea, ligada a caminhos de almas, pontes divinas e poeira estelar)"
    else:
        via_lactea = "Céu Profundo (Afastada da Via Láctea, localizada no vazio do cosmos, ligada a mistérios solitários e abismos celestes)"

    return {
        "asymmetry": round(float(asymmetry), 3),
        "elongation": round(float(elongation), 3),
        "has_cycles": num_edges >= num_nodes,
        "terminal_nodes": terminals,
        "complexity": num_nodes + num_edges,
        "silhueta_ancestral": silhueta,
        "temperamento_elemental": temperamento,
        "estatuto_divino": estatuto,
        "zona_cosmica": zona,
        "epoca_visibilidade": estacao,
        "via_lactea_proximidade": via_lactea
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

def get_extended_candidates_and_pairs(skeleton_stars, full_catalog, existing_edges):
    skeleton_ids = {s['id'] for s in skeleton_stars}
    stars_by_id = {s['id']: s for s in full_catalog}
    
    # 1. 1-hop candidates
    one_hop_ids = set()
    for star in skeleton_stars:
        star_coords = np.array([star['coords']['x'], star['coords']['y'], star['coords']['z']])
        distances = []
        for cand in full_catalog:
            if cand['id'] in skeleton_ids:
                continue
            cand_coords = np.array([cand['coords']['x'], cand['coords']['y'], cand['coords']['z']])
            dist = np.linalg.norm(star_coords - cand_coords)
            distances.append((cand['id'], dist))
        distances.sort(key=lambda x: x[1])
        for cid, d in distances[:4]:
            one_hop_ids.add(cid)
            
    # 2. 2-hop candidates
    two_hop_ids = set()
    for cid in one_hop_ids:
        cand_star = stars_by_id.get(cid)
        if not cand_star:
            continue
        star_coords = np.array([cand_star['coords']['x'], cand_star['coords']['y'], cand_star['coords']['z']])
        distances = []
        for cand in full_catalog:
            if cand['id'] in skeleton_ids or cand['id'] == cid:
                continue
            cand_coords = np.array([cand['coords']['x'], cand['coords']['y'], cand['coords']['z']])
            dist = np.linalg.norm(star_coords - cand_coords)
            distances.append((cand['id'], dist))
        distances.sort(key=lambda x: x[1])
        for ccid, d in distances[:2]:
            two_hop_ids.add(ccid)
            
    all_candidate_ids = one_hop_ids | two_hop_ids
    candidate_stars = [stars_by_id[cid] for cid in all_candidate_ids if cid in stars_by_id]
    
    all_nodes = skeleton_stars + candidate_stars
    recommended_pairs = []
    
    edges_set = set()
    for e in existing_edges:
        u, v = e['from'], e['to']
        edges_set.add((min(u, v), max(u, v)))
        
    for i in range(len(all_nodes)):
        node_a = all_nodes[i]
        coords_a = np.array([node_a['coords']['x'], node_a['coords']['y'], node_a['coords']['z']])
        id_a = node_a['id']
        is_sk_a = id_a in skeleton_ids
        
        for j in range(i + 1, len(all_nodes)):
            node_b = all_nodes[j]
            coords_b = np.array([node_b['coords']['x'], node_b['coords']['y'], node_b['coords']['z']])
            id_b = node_b['id']
            is_sk_b = id_b in skeleton_ids
            
            if is_sk_a and is_sk_b:
                if (min(id_a, id_b), max(id_a, id_b)) in edges_set:
                    continue
                    
            dist = np.linalg.norm(coords_a - coords_b)
            if dist < 18.0:
                p_type = "candidato-candidato"
                if is_sk_a and is_sk_b:
                    p_type = "esqueleto-esqueleto"
                elif is_sk_a or is_sk_b:
                    p_type = "esqueleto-candidato"
                    
                recommended_pairs.append({
                    "from_id": id_a,
                    "from_name": node_a['name'],
                    "to_id": id_b,
                    "to_name": node_b['name'],
                    "dist": round(float(dist), 2),
                    "type": p_type
                })
                
    recommended_pairs.sort(key=lambda x: x['dist'])
    return candidate_stars, recommended_pairs[:25]