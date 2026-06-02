from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from pathlib import Path
import pandas as pd
import os

app = FastAPI(title="BioFasting API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Caminho planilha
PASTA_ATUAL = Path(__file__).parent.resolve()
ARQUIVO_EXCEL = str(PASTA_ATUAL / "historico_jejum.xlsx")

class PerfilUsuario(BaseModel):
    idade: int
    nivel_experiencia: str
    treina: bool
    hora_treino: str = ""
    protocolo_escolhido: str

# recebe os dados do encerramento
class ConclusaoJejum(BaseModel):
    horas_decorridas: float
    fase_atingida: str

# Modelo de dados para o pedido de socorro
class PedidoSOS(BaseModel):
    sintoma: str

class RequisicaoReceitas(BaseModel):
    fase_janela: str
    protocolo_ativo: str
    treino_concluido: bool = False

#Base de dados
DICIONARIO_SOS = {
    "DOR_DE_CABECA":{
        "titulo": "Cefalei por Transição Metabólica",
        "conduta": "Adicione uma pitada de sal integral ou sal rosa num copo de água morna.",
        "gravidade": "LEVE"
    },
    "FRAQUEZA":{
        "titulo": "Hipoglicemia Reativa / Adaptação",
        "conduta": "Beba 200ml de água com uma colher de chá de vinagre de sidra de maça.",
        "gravidade": "MODERADA"
    },
    "NAUSEA": {
        "titulo": "Enfrentamento de Autofagia Gástrica",
        "conduta": "Prepare uma infusão de chá de gengibre ou hortelã morno (sem açúcar ou adoçante). Permaneça em repouso por 15 minutos.",
        "gravidade": "LEVE"
    }
}

#função salvar dados planilha
def salvar_no_execel(dados_plano: dict, perfil: PerfilUsuario):
    # 1. prepara a linha com as informações a serem guardadas
    nova_linha = {
        "Data_Registro": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Idade": perfil.idade,
        "Nivel": perfil.nivel_experiencia,
        "Treina": perfil.treina,
        "Hora_Treino": perfil.hora_treino if perfil.hora_treino else "Não treina",
        "Protocolo": dados_plano["protocolo"],
        "Janela_Quebra": dados_plano["quebra_jejum_sugerida"]
    }

    # 2. Se a planilha já exitir, será lida, senão será criada
    if os.path.exists(ARQUIVO_EXCEL) and os.path.getsize(ARQUIVO_EXCEL) > 0:
        df = pd.read_excel(ARQUIVO_EXCEL)
        # Adiciona nova linha ao Dataframe
        df = pd.concat([df, pd.DataFrame([nova_linha])], ignore_index=True)
    else:
        #cria a planilha pela primeira vez com a primeira linha
        df = pd.DataFrame([nova_linha])
    
    # 3. Salva arquivo
    df.to_excel(ARQUIVO_EXCEL, index=False)

#exibir histórico
@app.get("/api/historico")
async def obter_historio():
    print(f"Tentado ler a planilha em: {os.path.abspath(ARQUIVO_EXCEL)}")
    #se não existir, cria uma planilha
    if not os.path.exists(ARQUIVO_EXCEL) or os.path.getsize(ARQUIVO_EXCEL) == 0:
        print(f"Arquivo não encontado")
        return []
    try:
        #ler a planilha
        df = pd.read_excel(ARQUIVO_EXCEL)
        print(f"Planilha lida com sucesso. Total de linhas: {len(df)}")
        # substituí valores nulos por strings vazias
        df = df.fillna("")
        #converte linha da planilha num formato de lista de dicionário
        dados = df.to_dict(orient="records")
        #devolve lista invertidas para que os registros mais recentes aparecem primeiro
        return dados[::-1]
    except Exception as e:
        print(f"Erro ao ler a planilha: {e}")
        return[]

from datetime import datetime, timedelta

# 1. Atualizamos o modelo para receber a escolha do usuário
class PerfilUsuario(BaseModel):
    idade: int
    nivel_experiencia: str
    treina: bool
    hora_treino: str
    protocolo_escolhido: str # <-- NOVO: "AUTOMATICO", "12:12", "16:8" ou "18:6"

@app.post("/api/gerar-plano")
async def gerar_plano(dados: PerfilUsuario):
    print(f"Calibrando perfil. Idade={dados.idade}, Escolha={dados.protocolo_escolhido}")
    
    # 2. SISTEMA DE RECOMENDAÇÃO INTELIGENTE (Sugestão do Sistema)
    if dados.nivel_experiencia == "INICIANTE" and not dados.treina:
        protocolo_sugerido = "12:12"
    elif dados.idade > 30 and dados.treina:
        protocolo_sugerido = "18:6"
    else:
        protocolo_sugerido = "16:8"

    # 3. APLICAÇÃO DA DECISÃO (Escolha do usuário vs Sugestão automática)
    protocolo_final = protocolo_sugerido if dados.protocolo_escolhido == "AUTOMATICO" else dados.protocolo_escolhido

    # 4. MAPEAMENTO DE HORAS BASEADO NO PROTOCOLO FINAL
    if protocolo_final == "12:12":
        horas_jejum = 12
        fase_inicial = "GLICOGÊNIO_BAIXO"
        quebra_sugerida_padrao = "08:00"
    elif protocolo_final == "18:6":
        horas_jejum = 18
        fase_inicial = "CETOSE_PROGRESSIVA"
        quebra_sugerida_padrao = "14:00"
    else: # 16:8
        horas_jejum = 16
        fase_inicial = "AUTOFAGIA_INICIAL"
        quebra_sugerida_padrao = "12:00"

    # 5. CÁLCULO DOS HORÁRIOS CRONOBIOLÓGICOS
    try:
        if dados.treina and dados.hora_treino:
            hora_base = datetime.strptime(dados.hora_treino, "%H:%M")
            inicio_dt = hora_base + timedelta(hours=2) # 2h após o treino
        else:
            inicio_dt = datetime.strptime("20:00", "%H:%M")
        
        fim_dt = inicio_dt + timedelta(hours=horas_jejum)
        hora_inicio_jejum = inicio_dt.strftime("%H:%M")
        hora_abertura_janela = fim_dt.strftime("%H:%M")
    except Exception as e:
        print(f"Erro nos horários: {e}")
        hora_inicio_jejum = "20:00"
        hora_abertura_janela = quebra_sugerida_padrao

    # 6. MONTAGEM DA LINHA PARA O EXCEL
    registro_inicio = {
        "Data_Registro": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Idade": dados.idade,
        "Nivel": dados.nivel_experiencia,
        "Treina": "SIM" if dados.treina else "NÃO",
        "Hora_Treino": dados.hora_treino,
        "Protocolo": protocolo_final,
        "Janela_Quebra": hora_abertura_janela,
        "Evento": "INICIO_SESSÃO",
        "Horas_Decorridas": 0,
        "Ultima_Fase_Celular": fase_inicial,
        "Status": f"Ativo (Sugerido: {protocolo_sugerido})"
    }
    
    try:
        if os.path.exists(ARQUIVO_EXCEL) and os.path.getsize(ARQUIVO_EXCEL) > 0:
            df = pd.read_excel(ARQUIVO_EXCEL)
            df = pd.concat([df, pd.DataFrame([registro_inicio])], ignore_index=True)
        else:
            df = pd.DataFrame([registro_inicio])
        df.to_excel(ARQUIVO_EXCEL, index=False)
    except Exception as e:
        print(f"Erro ao salvar excel: {e}")

    return {
        "protocolo": protocolo_final,
        "protocolo_sugerido": protocolo_sugerido,
        "quebra_jejum_sugerida": hora_abertura_janela,
        "fase_atual": fase_inicial,
        "projeção_inicio": hora_inicio_jejum,
        "projeção_fim": hora_abertura_janela,
        "horas_jejum": horas_jejum,
        "horas_janela": 24 - horas_jejum
    }

# Rota para React chamar o botão
@app.post("/api/concluir-jejum")
async def concluir_jejum(dados: ConclusaoJejum):
    # prepara registro para o encerramento
    registro_fim = {
        "Data_Registro": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Idade": "",
        "Nivel": "",
        "Treina": "",
        "Hora_Treino": "",
        "Protocolo": "",
        "Janela_Quebra": "",
        "Evento": "FIM_JEJUM",
        "Horas_Decorridas": dados.horas_decorridas,
        "Ultima_Fase_Celular": dados.fase_atingida,
        "Status": "Concluído"
    }

    # Lê planilha e concatena nova linha
    if os.path.exists(ARQUIVO_EXCEL) and os.path.getsize(ARQUIVO_EXCEL) > 0:
        df = pd.read_excel(ARQUIVO_EXCEL)
        df = pd.concat([df, pd.DataFrame([registro_fim])], ignore_index=True)
    else:
        df = pd.DataFrame([registro_fim])

    df.to_excel(ARQUIVO_EXCEL, index=False)

    return {"status": "sucesso", "mensagem": "Encerramento registrado na panilha"}

#Rota de consulta do SOS
@app.post("/api/sos-conduta")
async def consultar_sos(pedido: PedidoSOS):
    #procura no dicionário
    conduta = DICIONARIO_SOS.get(
        pedido.sintoma, {
            "titulo": "Aviso Geral", "conduta": "Mantenha-se hidratado e consulte um médico se os sintomas persistirem.", "gravidade": "LEVE"
        }
    )
    return conduta

# endpoint receitas
@app.post("/api/receitas")
async def obter_receitas(dados: RequisicaoReceitas):
    print(f"Buscando receitas para Protocolo: {dados.protocolo_ativo} | Estado: {dados.fase_janela}")

    # Banco de dados
    banco_receitas = [
        {
            "id": 1,
            "titulo": "Abacate Premium com Ovos Escalfados",
            "imagem_url": "🥑",
            "tags": ["Low Carb", "Proteína"],
            "calorias": 380,
            "protocolos": ["18:6", "16:8"]
        },
        {
            "id": 2,
            "titulo": "Shots de Caldo de Ossos (Quebra de Jejum)",
            "imagem_url": "🥣",
            "tags": ["Proteína"],
            "calorias": 120,
            "protocolos": ["18:6"]
        },
        {
            "id": 3,
            "titulo": "Salmão Grelhado com Crosta de Gergelim",
            "imagem_url": "🐟",
            "tags": ["Proteína", "Low Carb"],
            "calorias": 450,
            "protocolos": ["18:6", "16:8"]
        },
        
        # --- RECEITAS PARA O PROTOCOLO PADRÃO (16:8) ---
        {
            "id": 4,
            "titulo": "Omelete de Espinafre com Queijo Cottage",
            "imagem_url": "🍳",
            "tags": ["Low Carb", "Proteína"],
            "calorias": 290,
            "protocolos": ["16:8", "12:12"]
        },
        
        # --- RECEITAS PARA O PROTOCOLO INICIANTE (12:12) - Carboidratos Complexos de Baixo IG liberados ---
        {
            "id": 5,
            "titulo": "Mingau de Aveia Integral com Canela e Chia",
            "imagem_url": "🥣",
            "tags": ["Fibra"],
            "calorias": 240,
            "protocolos": ["12:12"]
        },
        {
            "id": 6,
            "titulo": "Iogurte Natural com Morangos e Castanhas",
            "imagem_url": "🍓",
            "tags": ["Low Carb"],
            "calorias": 190,
            "protocolos": ["12:12", "16:8"]
        }
    ]

    # Filtragem inteligente
    receitas_filtradas = [
        rec for rec in banco_receitas
        if dados.protocolo_ativo in rec["protocolos"]
    ]

    if dados.fase_janela == "JEJUM_ATIVO":
        return [rec for rec in receitas_filtradas if "Quebra de jejum" in rec["titulo"] or rec["calorias"] <150]
    
    return receitas_filtradas

if __name__ == "__main__":
    import uvicorn
    import os
    
    # O Render fornece a porta na variável de ambiente PORT. Se não encontrar, usa a 8000.
    porta = int(os.environ.get("PORT", 8000))
    
    # Rodamos o uvicorn apontando para o IP 0.0.0.0 para aceitar conexões externas
    uvicorn.run("backend.main:app", host="0.0.0.0", port=porta, reload=False)