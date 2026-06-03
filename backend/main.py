from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from supabase import create_client, Client
import os

# CONFIGURAÇÃO DO SUPABASE
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://rfniwomlyduynidhhgno.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_b547kf9GfOr3qfJyux_1hQ_-VnzjnfS")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="BioFasting API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://biofasting.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS DE DADOS (PYDANTIC) ---
class PerfilUsuario(BaseModel):
    idade: int
    nivel_experiencia: str
    treina: bool
    hora_treino: str = ""
    protocolo_escolhido: str

class ConclusaoJejum(BaseModel):
    horas_decorridas: float
    fase_atingida: str

class PedidoSOS(BaseModel):
    sintoma: str

class RequisicaoReceitas(BaseModel):
    fase_janela: str
    protocolo_ativo: str
    treino_concluido: bool = False

# --- BASE DE DADOS SOS ---
DICIONARIO_SOS = {
    "DOR_DE_CABECA": {
        "titulo": "Cefaleia por Transição Metabólica",
        "conduta": "Adicione uma pitada de sal integral ou sal rosa num copo de água morna.",
        "gravidade": "LEVE"
    },
    "FRAQUEZA": {
        "titulo": "Hipoglicemia Reativa / Adaptação",
        "conduta": "Beba 200ml de água com uma colher de chá de vinagre de sidra de maçã.",
        "gravidade": "MODERADA"
    },
    "NAUSEA": {
        "titulo": "Enfrentamento de Autofagia Gástrica",
        "conduta": "Prepare uma infusão de chá de gengibre ou hortelã morno (sem açúcar ou adoçante). Permaneça em repouso por 15 minutos.",
        "gravidade": "LEVE"
    }
}

# --- ROTAS DA API ---

# Exibir histórico buscado diretamente do Supabase
@app.get("/api/historico")
async def obter_historico():
    print("Buscando histórico no Supabase...")
    try:
        # Busca todas as linhas da tabela ordenando pelo ID decrescente (mais recentes primeiro)
        resposta = supabase.table("historico_jejum").select("*").order("id", desc=True).execute()
        return resposta.data
    except Exception as e:
        print(f"Erro ao ler dados do Supabase: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao ler dados do Supabase: {e}")

# Gerar plano e iniciar sessão salvando no Supabase
@app.post("/api/gerar-plano")
async def gerar_plano(dados: PerfilUsuario):
    print(f"Calibrando perfil. Idade={dados.idade}, Escolha={dados.protocolo_escolhido}")
    
    # Sistema de recomendação inteligente
    if dados.nivel_experiencia == "INICIANTE" and not dados.treina:
        protocolo_sugerido = "12:12"
    elif dados.idade > 30 and dados.treina:
        protocolo_sugerido = "18:6"
    else:
        protocolo_sugerido = "16:8"

    protocolo_final = protocolo_sugerido if dados.protocolo_escolhido == "AUTOMATICO" else dados.protocolo_escolhido

    if protocolo_final == "12:12":
        horas_jejum = 12
        fase_inicial = "GLICOGÊNIO_BAIXO"
        quebra_sugerida_padrao = "08:00"
    elif protocolo_final == "18:6":
        horas_jejum = 18
        fase_inicial = "CETOSE_PROGRESSIVA"
        quebra_sugerida_padrao = "14:00"
    else:
        horas_jejum = 16
        fase_inicial = "AUTOFAGIA_INICIAL"
        quebra_sugerida_padrao = "12:00"

    try:
        if dados.treina and dados.hora_treino:
            hora_base = datetime.strptime(dados.hora_treino, "%H:%M")
            inicio_dt = hora_base + timedelta(hours=2)
        else:
            inicio_dt = datetime.strptime("20:00", "%H:%M")
        
        fim_dt = inicio_dt + timedelta(hours=horas_jejum)
        hora_inicio_jejum = inicio_dt.strftime("%H:%M")
        hora_abertura_janela = fim_dt.strftime("%H:%M")
    except Exception as e:
        print(f"Erro nos horários: {e}")
        hora_inicio_jejum = "20:00"
        hora_abertura_janela = quebra_sugerida_padrao

    # Montagem do dicionário mapeado exatamente para as colunas do seu Supabase
    registro_inicio = {
        "data_registro": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "idade": dados.idade,
        "nivel": dados.nivel_experiencia,
        "treina": "SIM" if dados.treina else "NÃO",
        "hora_treino": dados.hora_treino if dados.hora_treino else "Não treina",
        "protocolo": protocolo_final,
        "janela_quebra": hora_abertura_janela,
        "evento": "INICIO_SESSÃO",
        "horas_decorridas": 0.0,
        "ultima_fase_celular": fase_inicial,
        "status": f"Ativo (Sugerido: {protocolo_sugerido})"
    }
    
    try:
        # Envia a nova linha diretamente para o banco de dados
        supabase.table("historico_jejum").insert(registro_inicio).execute()
    except Exception as e:
        print(f"Erro ao salvar no Supabase: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao salvar no Supabase: {e}")

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

# Rota para concluir jejum e salvar no Supabase
@app.post("/api/concluir-jejum")
async def concluir_jejum(dados: ConclusaoJejum):
    registro_fim = {
        "data_registro": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "idade": None,
        "nivel": "",
        "treina": "",
        "hora_treino": "",
        "protocolo": "",
        "janela_quebra": "",
        "evento": "FIM_JEJUM",
        "horas_decorridas": dados.horas_decorridas,
        "ultima_fase_celular": dados.fase_atingida,
        "status": "Concluído"
    }

    try:
        # Envia o encerramento do jejum para o banco de dados
        supabase.table("historico_jejum").insert(registro_fim).execute()
        return {"status": "sucesso", "mensagem": "Encerramento registrado no Supabase"}
    except Exception as e:
        print(f"Erro ao salvar conclusão no Supabase: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao salvar conclusão no Supabase: {e}")

# Rota de consulta do SOS
@app.post("/api/sos-conduta")
async def consultar_sos(pedido: PedidoSOS):
    conduta = DICIONARIO_SOS.get(
        pedido.sintoma, {
            "titulo": "Aviso Geral", 
            "conduta": "Mantenha-se hidratado e consulte um médico se os sintomas persistirem.", 
            "gravidade": "LEVE"
        }
    )
    return conduta

# Endpoint receitas
@app.post("/api/receitas")
async def obter_receitas(dados: RequisicaoReceitas):
    banco_receitas = [
        {"id": 1, "titulo": "Abacate Premium com Ovos Escalfados", "imagem_url": "🥑", "tags": ["Low Carb", "Proteína"], "calorias": 380, "protocolos": ["18:6", "16:8"]},
        {"id": 2, "titulo": "Shots de Caldo de Ossos (Quebra de Jejum)", "imagem_url": "🥣", "tags": ["Proteína"], "calorias": 120, "protocolos": ["18:6"]},
        {"id": 3, "titulo": "Salmão Grelhado com Crosta de Gergelim", "imagem_url": "🐟", "tags": ["Proteína", "Low Carb"], "calorias": 450, "protocolos": ["18:6", "16:8"]},
        {"id": 4, "titulo": "Omelete de Espinafre com Queijo Cottage", "imagem_url": "🍳", "tags": ["Low Carb", "Proteína"], "calorias": 290, "protocolos": ["16:8", "12:12"]},
        {"id": 5, "titulo": "Mingau de Aveia Integral com Canela e Chia", "imagem_url": "🥣", "tags": ["Fibra"], "calorias": 240, "protocolos": ["12:12"]},
        {"id": 6, "titulo": "Iogurte Natural com Morangos e Castanhas", "imagem_url": "🍓", "tags": ["Low Carb"], "calorias": 190, "protocolos": ["12:12", "16:8"]}
    ]

    receitas_filtradas = [rec for rec in banco_receitas if dados.protocolo_ativo in rec["protocolos"]]

    if dados.fase_janela == "JEJUM_ATIVO":
        return [rec for rec in receitas_filtradas if "Quebra de jejum" in rec["titulo"] or rec["calorias"] < 150]
    
    return receitas_filtradas

if __name__ == "__main__":
    import uvicorn
    porta = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=porta, reload=False)
