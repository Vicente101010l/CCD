import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def get_ai_completion(properties, skeleton_stars, candidate_stars, recommended_pairs, num_connections):
    # Formatar dados das estrelas para o prompt
    skeleton_formatted = [f"ID: {s['id']} ({s['name']}) [Coords: {s['coords']}]" for s in skeleton_stars]
    candidates_formatted = [f"ID: {s['id']} ({s['name']}) [Coords: {s['coords']}]" for s in candidate_stars]
    
    pairs_formatted = [
        f"- {p['from_name']} (ID: {p['from_id']}) e {p['to_name']} (ID: {p['to_id']}) [Distância: {p['dist']}] - Tipo: {p['type']}"
        for p in recommended_pairs
    ]
    
    prompt = f"""
    CONTEXTO: Sistema de co-criação astronómica de constelações.
    ESTRUTURA ATUAL (Desenhada pelo utilizador):
    Estrelas Selecionadas (Esqueleto):
    {chr(10).join(skeleton_formatted)}
    
    ESTRELAS CANDIDATAS DISPONÍVEIS VIZINHAS (1-hop e 2-hop):
    {chr(10).join(candidates_formatted)}
    
    PROPRIEDADES DA SILHUETA ATUAL: {properties}.
    
    LIGAÇÕES GEOMETRICAMENTE PRÓXIMAS RECOMENDADAS (Usa estas recomendações para propor ligações, pois representam estrelas próximas que formam caminhos visualmente contínuos e sem cruzamentos):
    {chr(10).join(pairs_formatted)}

    TAREFA:
    Proponha exatamente {num_connections} novas ligações (edges) de forma a complementar a constelação de maneira complexa e harmoniosa.
    
    INSTRUÇÕES CRÍTICAS PARA COMPLEXIDADE E CAUDAS:
    - Podes e deves sugerir ligações de tipo 'candidato-candidato' para criar cadeias longas (ex: caudas, asas, tentáculos) que se estendem para fora da constelação.
    - Procura estender a constelação ligando estrelas do Esqueleto a Candidatas, e depois estas Candidatas a outras Candidatas mais distantes.
    - NUNCA proponhas ligações soltas ou flutuantes. Todo e qualquer novo traço sugerido deve estar ligado direta ou indiretamente (através de outras ligações sugeridas) ao Esqueleto desenhado pelo utilizador. O resultado final deve ser um grafo único e totalmente conectado.
    - Se decidires propor uma ligação de tipo 'candidato-candidato' (por exemplo, ligar as candidatas C e D), deves OBRIGATORIAMENTE propor também uma ligação que conecte uma delas de volta ao esqueleto (por exemplo, ligar o Esqueleto à candidata C) para evitar que a linha fique flutuante.
    - Podes também sugerir fechar ciclos ligando estrelas do Esqueleto entre si se isso fizer sentido geométrico.
    - Assegura-te de propor EXATAMENTE {num_connections} novas ligações.

    REGRAS RÍGIDAS DE LIGAÇÃO (LÓGICA CELESTE):
    1. A constelação final deve parecer uma constelação real clássica (com um tronco central e ramos para membros ou silhuetas limpas).
    2. Evita cruzamento de linhas (linhas que se cortam não acontecem em constelações reais).
    3. As ligações devem fazer sentido em termos de coordenadas 3D (liga estrelas geometricamente próximas).
    4. Usa apenas IDs que estejam presentes nas listas do Esqueleto ou das Candidatas.
    5. Cada ligação no JSON deve conter os campos 'from', 'to' (IDs numéricos) e 'reason' (justificação poética baseada no arquétipo).
    6. Responde EXCLUSIVAMENTE em formato JSON.
    
    JSON FORMAT:
    {{ "new_edges": [ {{"from": ID, "to": ID, "reason": "texto"}} ] }}
    """
    
    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "system", "content": "És um curador de formas celestiais e arquétipos de constelações."},
                  {"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    return completion.choices[0].message.content

def generate_myth(constellation_name, stars, properties):
    color_map = {
        "#9bb0ff": "Super Azul (Gélida / Energia Espiritual)",
        "#aabfff": "Azul-Branco (Energia Elétrica / Céu Alto)",
        "#e3e7ff": "Branco Puro (Éter / Equilíbrio Sagrado)",
        "#f8f7ff": "Amarelo-Branco (Luz Estelar / Navegação)",
        "#fff4ea": "Amarelo Solar (Fecundidade / Justiça)",
        "#ffd2a1": "Laranja (Fogo Cósmico / Paixão / Lenda)",
        "#ff9e3a": "Vermelho-Laranja (Sangue Cósmico / Guerreiro / Terra)"
    }
    
    stars_formatted = []
    for s in stars:
        color_desc = color_map.get(s.get('color', ''), "Amarela/Branca")
        stars_formatted.append(
            f"- {s['name']} (Magnitude/Brilho: {s.get('mag', 3.0)}, Cor Espectral: {color_desc})"
        )
    
    star_list_str = "\n".join(stars_formatted)
    
    silhueta = properties.get('silhueta_ancestral', '')
    
    # Determinação do Estilo Literário
    if "Serpente" in silhueta or "Rio" in silhueta or "Caminho" in silhueta:
        style_guidelines = "DIRETIVA DE ESTILO: JORNADA/METAMORFOSE (Inspirado em Ovídio). O mito deve descrever uma jornada linear, metamorfose e passagem do tempo."
    elif "Coroa" in silhueta or "Escudo" in silhueta or "Cálice" in silhueta:
        style_guidelines = "DIRETIVA DE ESTILO: SOLENE/RELÍQUIA (Inspirado em Épicos). Foca na criação de um objeto sagrado, pacto ou selo indestrutível."
    elif "Criatura" in silhueta or "Humanoide" in silhueta or "Besta" in silhueta:
        style_guidelines = "DIRETIVA DE ESTILO: CAÇADA/TRAGÉDIA (Inspirado na Tragédia Clássica). Foca na batalha épica, orgulho (húbris) e imortalização do herói ou monstro."
    else:
        style_guidelines = "DIRETIVA DE ESTILO: PROVAÇÃO/JUSTIÇA (Inspirado em Parábolas). Foca em julgamentos, sacrifícios e leis divinas."

    prompt = f"""
    CONTEXTO: Sistema de co-criação astronómica. O utilizador desenhou uma constelação.
    ESTRELAS: {star_list_str}
    
    METRICAS GEOMÉTRICAS (TENS DE USAR ESTAS PARA A NARRATIVA):
    - Silhueta: {silhueta}
    - Ciclos Fechados (has_cycles): {properties['has_cycles']}
    - Assimetria: {properties['asymmetry']} (0 = simétrico, >1 = assimétrico)
    - Alongamento: {properties['elongation']} (Alto = linha/trajeto, Baixo = compacto/objeto)
    - Temperamento: {properties.get('temperamento_elemental', 'Indefinido')}
    
    {style_guidelines}

    REGRA DE VÍNCULO GEOMÉTRICO (OBRIGATÓRIO):
    1. Se 'has_cycles' for True: O mito deve falar de recorrência, eternidade, ciclos de vida/morte ou algo que nunca termina.
    2. Se 'elongation' > 2.0: O mito deve focar numa "Jornada", num "Caminho" ou numa perseguição entre dois pontos distantes.
    3. Se 'elongation' < 1.5: O mito deve focar num objeto de poder, um trono, uma coroa, ou um ponto de reunião estático.
    4. Se 'asymmetry' > 1.0: O mito deve incluir um conflito, um desequilíbrio, uma tragédia ou uma anomalia que quebra a harmonia.
    5. Usa o 'Temperamento Elemental' para escolher os adjetivos e metáforas (ex: se Espiritual, usa termos etéreos; se Terrestre, usa termos densos e físicos).

    TAREFA:
    1. Inventa um nome poético e evocativo em português para esta constelação.
    2. Cria um mito clássico original, integrando as estrelas listadas (a mais brilhante é a protagonista/artefato).
    
    REGRAS DE ESCRITA:
    - 3 a 5 parágrafos narrativos.
    - Escreve em Português Europeu corrido e natural.
    - Mantém um tom literário elevado de mitologia clássica.
    - Responde EXCLUSIVAMENTE em formato JSON.
    
    JSON FORMAT:
    {{
      "nome_constelacao": "...",
      "titulo": "...",
      "texto": "..."
    }}
    """
    
    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "És um mitógrafo clássico que escreve em Português Europeu corrido."},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    return completion.choices[0].message.content