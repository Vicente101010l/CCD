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

def generate_myth(constellation_name, full_star_names, properties):
    prompt = f"""
    CONTEXTO: Sistema de co-criação e simulação de constelações.
    O utilizador desenhou uma nova constelação unindo as estrelas: {', '.join(full_star_names)}.
    
    MÉTRICAS CIENTÍFICAS E ARQUÉTIPOS ANCESTRAIS CALCULADOS:
    1. Silhueta Ancestral (Forma física): '{properties.get('silhueta_ancestral', 'Indefinida')}'
    2. Temperamento Elemental (Cor/Espectro): '{properties.get('temperamento_elemental', 'Indefinido')}'
    3. Estatuto Divino (Brilho/Magnitude): '{properties.get('estatuto_divino', 'Indefinido')}'
    4. Zona Cósmica/Eternidade (Latitude Celestial Z): '{properties.get('zona_cosmica', 'Indefinida')}'
    5. Época de Visibilidade no Céu: '{properties.get('epoca_visibilidade', 'Indefinida')}'
    6. Relação Cósmica com a Via Láctea: '{properties.get('via_lactea_proximidade', 'Indefinida')}'
    
    INFORMAÇÕES DE SUPORTE:
    - Assimetria ({properties['asymmetry']})
    - Elongação ({properties['elongation']})
    - Ciclos ({properties['has_cycles']})

    TAREFA:
    1. Inventa um nome poético, clássico e evocativo em português para esta nova constelação (ex: "Serpente das Águas Prateadas", "O Escudo do Rei Caído", "A Besta de Gelo Celeste"). O nome deve estar diretamente alinhado com a 'Silhueta Ancestral' e o 'Temperamento Elemental' obtidos.
    2. Cria um mito grego/clássico original que narre a história desta constelação. O mito deve justificar a sua colocação no céu (catasterismo) de acordo com:
       - A 'Época de Visibilidade': Deves referir no início do mito em que estação do ano esta constelação surge de forma dominante no céu noturno (ex: noites frias de Inverno, renascimento da Primavera, calor do Verão ou sobriedade do Outono).
       - A 'Relação com a Via Láctea': Se for 'Cruzadora do Rio Celeste', integra na lenda o papel do "Rio de Estrelas" ou "Caminho das Almas" (Via Láctea). Se for 'Céu Profundo', foca na solidão, nos vazios cósmicos e nos segredos guardados longe da poeira estelar.
       - O 'Temperamento Elemental': Se Espiritual (magia, raios, gelo, deuses), se Terrestre (fogo, sacrifício, terra, antepassados), se Equilibrado (luz solar, éter, harmonia, justiça).
       - O 'Estatuto Divino': Se Divino (deuses supremos), se Heroico (semideuses, monstros protetores), se Mortal (morte de mortais, ferramentas, animais vulgares).
       - A 'Zona Cósmica': Se Polar (imortalidade, tempo infinito, sentinelas que nunca se põem), se Equatorial (ciclos das estações, colheitas, mortalidade e renovação).
    
    Deves usar os nomes das estrelas selecionadas ({', '.join(full_star_names)}) como personagens principais, deuses ou objetos sagrados na tua lenda.

    REGRAS DE ESCRITA:
    - 3 a 5 parágrafos narrativos.
    - Escreve em Português Europeu corrido e natural.
    - Mantém o tom literário elevado de mitologia clássica.
    - Responde EXCLUSIVAMENTE em formato JSON com as chaves indicadas.
    
    JSON FORMAT:
    {{
      "nome_constelacao": "NOME INVENTADO DA CONSTELAÇÃO",
      "titulo": "TÍTULO DA LENDA / MITO",
      "texto": "TEXTO DA LENDA MITOLÓGICA COMPLETO"
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