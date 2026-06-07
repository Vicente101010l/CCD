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
    
    style_guidelines = ""
    if "Serpente" in silhueta or "Rio" in silhueta or "Caminho" in silhueta:
        style_guidelines = """
    DIRETIVA DE ESTILO LITERÁRIO: ESTILO DE JORNADA/METAMORFOSE (Inspirado em Ovídio)
    - O mito deve descrever uma jornada linear, uma busca espiritual ou uma fuga dramática.
    - Foca na passagem do tempo, no movimento e na metamorfose do ser (ex: uma divindade que se transformou em rio para escapar, ou uma serpente condenada a rastejar para sempre entre as estrelas).
    """
    elif "Coroa" in silhueta or "Escudo" in silhueta or "Cálice" in silhueta:
        style_guidelines = """
    DIRETIVA DE ESTILO LITERÁRIO: ESTILO SOLENE/RELÍQUIA DE PODER (Inspirado em Épicos de Artefactos)
    - O mito deve centrar-se na criação de um objeto sagrado de proteção, um pacto inviolável ou uma prisão cósmica.
    - Descreve a constelação como um selo indestrutível que mantém o equilíbrio do universo ou que guarda a alma de um herói sacrificado.
    """
    elif "Criatura" in silhueta or "Humanoide" in silhueta or "Besta" in silhueta:
        style_guidelines = """
    DIRETIVA DE ESTILO LITERÁRIO: ESTILO DE CAÇADA/TRAGÉDIA DE MONSTROS (Inspirado na Tragédia Clássica)
    - A lenda deve narrar a história de uma criatura monstruosa de grande poder, uma caçada colossal ou um castigo trágico imposto pelos deuses.
    - Destaca o orgulho (húbris), a batalha épica e a subsequente imortalização da besta no céu como lembrete aos mortais.
    """
    else:
        style_guidelines = """
    DIRETIVA DE ESTILO LITERÁRIO: ESTILO DE PROVAÇÃO E JUSTIÇA (Inspirado em Parábolas de Julgamento)
    - O mito deve relatar uma provação de justiça, um sacrifício ou o estabelecimento de uma lei divina (como o peso do julgamento ou a seta do destino).
    - Descreve a ferramenta ou objeto celeste como um símbolo cósmico de ordem, verdade ou fado inalterável.
    """

    prompt = f"""
    CONTEXTO: Sistema de co-criação e simulação de constelações celestes.
    O utilizador desenhou uma nova constelação unindo as seguintes estrelas reais:
    {star_list_str}
    
    MÉTRICAS CIENTÍFICAS E ARQUÉTIPOS ANCESTRAIS CALCULADOS:
    1. Silhueta Ancestral (Forma física): '{properties.get('silhueta_ancestral', 'Indefinida')}'
    2. Temperamento Elemental (Cor/Espectro): '{properties.get('temperamento_elemental', 'Indefinido')}'
    3. Estatuto Divino (Brilho/Magnitude): '{properties.get('estatuto_divino', 'Indefinido')}'
    4. Zona Cósmica/Eternidade (Latitude Celestial Z): '{properties.get('zona_cosmica', 'Indefinida')}'
    5. Época de Visibilidade no Céu: '{properties.get('epoca_visibilidade', 'Indefinida')}'
    6. Relação Cósmica com a Via Láctea: '{properties.get('via_lactea_proximidade', 'Indefinida')}'
    
    INFORMAÇÕES DE SUPORTE:
    - Assimetria espacial: {properties['asymmetry']}
    - Alongamento geométrico: {properties['elongation']}
    - Densidade da rede (Compactness): {properties['compactness']}
    - Desvio de centro de gravidade (Barycenter Offset): {properties['barycenter_offset']}
    - Ciclos fechados detetados: {properties['has_cycles']}
    
    {style_guidelines}

    TAREFA:
    1. Inventa um nome poético, clássico e evocativo em português para esta nova constelação (ex: "Serpente das Águas Prateadas", "O Escudo do Rei Caído", "A Besta de Gelo Celeste"). O nome deve estar diretamente alinhado com a 'Silhueta Ancestral' e o 'Temperamento Elemental' obtidos.
    2. Cria um mito grego/clássico original que narre a história desta constelação. O mito deve justificar a sua colocação no céu (catasterismo) de acordo com:
       - As estrelas utilizadas: Deves atribuir um papel narrativo dramático a cada uma das estrelas listadas acima na história de acordo com o seu brilho (magnitude) e cor. A estrela mais brilhante (menor magnitude) deve ser o herói principal, o artefato supremo, ou o coração da besta. Estrelas vermelhas/laranjas devem estar ligadas a fogo, sangue, guerra ou terra; azuis a gelo, divindade, oráculo ou magia; brancas a éter e justiça.
       - A 'Época de Visibilidade': Deves referir no início do mito em que estação do ano esta constelação surge de forma dominante no céu noturno.
       - A 'Relação com a Via Láctea': Se for 'Cruzadora do Rio Celeste', integra na lenda o papel do "Rio de Estrelas" ou "Caminho das Almas" (Via Láctea). Se for 'Céu Profundo', foca na solidão, nos vazios cósmicos e nos segredos guardados longe da poeira estelar.
       - O 'Temperamento Elemental': Se Espiritual (magia, raios, gelo, deuses), se Terrestre (fogo, sacrifício, terra, antepassados), se Equilibrado (luz solar, éter, harmonia, justiça).
       - O 'Estatuto Divino': Se Divino (deuses supremos), se Heroico (semideuses, monstros protetores), se Mortal (morte de mortais, ferramentas, animais vulgares).
       - A 'Zona Cósmica': Se Polar (imortalidade, sentinelas eternas), se Equatorial (ciclos das estações, colheitas e renovação).
    
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