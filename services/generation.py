"""Geração de ligações da IA para um esqueleto de constelação.

Extraído da rota /api/complete (mesmo comportamento) para ser reutilizado
pelo modo colaborativo e pelo Modo Oráculo (/api/dream).
"""
import os
import json

from groq import Groq
from dotenv import load_dotenv

from services.geometry import (
    calculate_graph_properties,
    get_extended_candidates_and_pairs,
    arcs_intersect,
)

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def propose_ai_edges(enriched_skeleton, existing_edges, all_stars_database, visible_ids=None):
    """Devolve as ligações (edges) propostas pela IA para estender o esqueleto.

    Aplica os filtros anti-cruzamento e de conectividade. Mesmo comportamento
    que a versão original inline em /api/complete.
    """
    edges = existing_edges
    stars_by_id = {s['id']: s for s in all_stars_database}

    props = calculate_graph_properties(enriched_skeleton, edges)

    candidate_stars_list, recommended_pairs = get_extended_candidates_and_pairs(
        enriched_skeleton, all_stars_database, edges
    )

    if visible_ids:
        visible_set = set(visible_ids)
        candidate_stars_list = [c for c in candidate_stars_list if c['id'] in visible_set]
        recommended_pairs = [
            p for p in recommended_pairs
            if p['from_id'] in visible_set and p['to_id'] in visible_set
        ]

    all_available_nodes = enriched_skeleton + candidate_stars_list
    id_to_idx = {node['id']: idx for idx, node in enumerate(all_available_nodes)}
    idx_to_id = {idx: node['id'] for idx, node in enumerate(all_available_nodes)}

    skeleton_formatted = [f"Índice AI: {id_to_idx[s['id']]} (Estrela: {s['name']})" for s in enriched_skeleton]
    candidates_formatted = [f"Índice AI: {id_to_idx[c['id']]} (Estrela: {c['name']})" for c in candidate_stars_list]

    pairs_formatted = []
    for p in recommended_pairs:
        if p['from_id'] in id_to_idx and p['to_id'] in id_to_idx:
            pairs_formatted.append(f"- Conectar Índice {id_to_idx[p['from_id']]} ao Índice {id_to_idx[p['to_id']]} [Dist: {p['dist']}]")

    num_connections = max(4, min(10, len(enriched_skeleton) * 2 - 1))

    silhueta_style = props.get('silhueta_ancestral', 'Criatura / Humanoide / Besta Alada')
    shapes_detected = props.get('shapes_detected', 'Estrutura Aberta (Árvore/Linha)')
    compactness = props.get('compactness', 1.0)
    barycenter_offset = props.get('barycenter_offset', 0.0)

    brightest_star = min(enriched_skeleton, key=lambda s: s.get('mag', 3.0))
    brightest_name = brightest_star.get('name', 'Estrela Principal')

    offset_instructions = ""
    if barycenter_offset > 8.0:
        offset_instructions = f"""
    DIRETIVA DE EQUILÍBRIO ESTÉTICO (AGÊNCIA CRIATIVA):
    - A constelação está desequilibrada (Barycenter Offset: {barycenter_offset} unidades). O peso e brilho concentram-se na estrela {brightest_name}.
    - Proponha propositadamente ligações a estrelas candidatas que se projetem na direção oposta ao aglomerado mais pesado para criar caudas, asas ou membros de compensação, equilibrando esteticamente a constelação.
    """

    compactness_instructions = ""
    if compactness > 0.4:
        compactness_instructions = f"""
    DIRETIVA DE DENSIDADE (COMPACIDADE: {compactness}):
    - A constelação atual é compacta e densa. Tente propor ligações lineares estendidas (cadeias de candidatos) para o exterior para dar dinamismo e asas/membros à silhueta.
    """
    else:
        compactness_instructions = f"""
    DIRETIVA DE DENSIDADE (COMPACIDADE: {compactness}):
    - A constelação está muito dispersa. Tente propor ligações curtas e agrupadas para concentrar e dar coesão à forma global.
    """

    style_instructions = ""
    if "Serpente" in silhueta_style or "Rio" in silhueta_style or "Caminho" in silhueta_style:
        style_instructions = """
    ESTILO DE DESENHO REQUERIDO: CAMINHO LINEAR ABERTO
    - Mantenha a estrutura aberta e linear em forma de cauda ou rio.
    - Evite fechar novos ciclos (triângulos ou quadriláteros). Desenhe ligando candidatos em série.
    """
    elif "Coroa" in silhueta_style or "Escudo" in silhueta_style or "Cálice" in silhueta_style:
        style_instructions = f"""
    ESTILO DE DESENHO REQUERIDO: ESTRUTURA FECHADA (ANEL / CÍCLICA)
    - O utilizador já tem as seguintes formas desenhadas: {shapes_detected}.
    - Proponha deliberadamente ligações que fechem novas formas geométricas (como Triângulos ou Quadriláteros).
    """
    elif "Criatura" in silhueta_style or "Humanoide" in silhueta_style or "Besta" in silhueta_style:
        style_instructions = f"""
    ESTILO DE DESENHO REQUERIDO: RAMIFICAÇÃO SIMÉTRICA (CRIATURA)
    - O utilizador tem as seguintes formas desenhadas: {shapes_detected}.
    - Pode fechar triângulos ou quadriláteros no tronco, mas as extremidades devem ser ramos abertos.
    """
    else:
        style_instructions = f"""
    ESTILO DE DESENHO REQUERIDO: GEOMETRIA RÍGIDA
    - O utilizador tem as seguintes formas desenhadas: {shapes_detected}.
    - Tente criar formas fechadas retangulares ou triangulares para delinear pontas de seta.
    """

    prompt_ai = f"""
    CONTEXTO: Auxílio computacional na criação e extensão de grafos geométricos de constelações celestes.

    NÓS DO ESQUELETO ATUAL (Desenhados pelo utilizador humano):
    {', '.join(skeleton_formatted)}

    FORMAS GEOMÉTRICAS JÁ DETETADAS NO ESQUELETO:
    {shapes_detected}

    NÓS CANDIDATOS VIZINHOS DISPONÍVEIS:
    {', '.join(candidates_formatted)}

    LIGAÇÕES PLANARES RECOMENDADAS PELO SISTEMA:
    {chr(10).join(pairs_formatted)}

    {style_instructions}
    {offset_instructions}
    {compactness_instructions}

    TAREFA: Proponha exatamente {num_connections} novas linhas (new_edges) para estender a silhueta.

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

            # CORREÇÃO CRÍTICA: LLaMa pode devolver Strings ("1") em vez de Inteiros (1)
            try:
                u_idx = int(u_idx)
                v_idx = int(v_idx)
            except (TypeError, ValueError):
                continue

            if u_idx in idx_to_id and v_idx in idx_to_id:
                u_id = idx_to_id[u_idx]
                v_id = idx_to_id[v_idx]
                if u_id != v_id:
                    ai_edges.append({"from": int(u_id), "to": int(v_id)})

    except Exception as err:
        print("Falha de parsing na LLM:", err)
        if enriched_skeleton and candidate_stars_list:
            ai_edges.append({"from": enriched_skeleton[-1]['id'], "to": candidate_stars_list[0]['id']})

    accepted_ai_edges = []
    for e in ai_edges:
        u_id = e['from']
        v_id = e['to']
        if u_id not in stars_by_id or v_id not in stars_by_id:
            continue

        u_coords = stars_by_id[u_id]['coords']
        v_coords = stars_by_id[v_id]['coords']
        crosses = False

        for ue in edges:
            ue_from = ue.get('from')
            ue_to = ue.get('to')
            if ue_from in stars_by_id and ue_to in stars_by_id:
                if arcs_intersect(u_coords, v_coords, stars_by_id[ue_from]['coords'], stars_by_id[ue_to]['coords']):
                    crosses = True
                    break

        if crosses:
            continue

        for ae in accepted_ai_edges:
            ae_from = ae['from']
            ae_to = ae['to']
            if ae_from in stars_by_id and ae_to in stars_by_id:
                if arcs_intersect(u_coords, v_coords, stars_by_id[ae_from]['coords'], stars_by_id[ae_to]['coords']):
                    crosses = True
                    break

        if not crosses:
            accepted_ai_edges.append(e)

    ai_edges = accepted_ai_edges

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

    return sanitized_edges
