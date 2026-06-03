import React, { useState, useEffect } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://biofasting.onrender.com";

export default function App() {
  const [plano, setPlano] = useState(null);
  const [receitas, setReceitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalSOSAberto, setModalSOSAberto] = useState(false);
  const [sintomaSelecionado, setSintomaSelecionado] = useState("");
  const [condutaRecebida, setCondutaRecebida] = useState(null);
  const [jejumAtivo, setJejumAtivo] = useState(
    () => localStorage.getItem("jejum_ativo") === "true",
  );
  const [horaInicioJejum, setHoraInicioJejum] = useState(() =>
    localStorage.getItem("hora_inicio_jejum"),
  );
  const [segundosDecorridos, setSegundosDecorridos] = useState(0);
  const [filtroAtivo, setFiltroAtivo] = useState("TODAS");
  const [historico, setHistorico] = useState([]);
  const [modalConfigAberto, setModalConfigAberto] = useState(false);

  // Estados para armazenar as entradas do usuário
  const [inputIdade, setInputIdade] = useState(34);
  const [inputNivel, setInputNivel] = useState("INTERMEDIARIO");
  const [inputTreina, setInputTreina] = useState(true);
  const [inputHoraTreino, setInputHoraTreino] = useState("18:30");
  const [inputProtocolo, setInputProtocolo] = useState("AUTOMATICO");

  // Retorna os dados visuais com base no tempo decorrido
  const obterFaseCelularDinamica = () => {
    if (!jejumAtivo) {
      return {
        nome: "JANELA ABERTA",
        mensagem:
          "Período de alimentação liberado. Foque em nutrientes de qualidade!",
        corTexto: "text-orange-400",
        corBorda: "#FB923C",
        corNeon: "rgb(254, 146, 60, 0.2",
      };
    }

    const horasDecorridas = segundosDecorridos / 3600;
    const protocoloAtual = plano?.protocolo || "16:8";

    // Protocolo iniciante 12:12
    if (protocoloAtual === "12:12") {
      if (horasDecorridas < 6) {
        return {
          nome: "DIGESTÃO ATIVA",
          mensagem:
            "Seu corpo está quebrando a última refeição e absorvendo os nutrientes.",
          corTexto: "text-blue-400",
          corBorda: "#60A5FA",
          corNeon: "rgba(96, 165, 250, 0.2)",
        };
      } else {
        return {
          nome: "QUEDA DE GLICOGÊNIO",
          mensagem:
            "Os níveis de açúcar no sangue baixam. O fígado começa a usar suas reservas de energia.",
          corTexto: "text-emerald-400",
          corBorda: "#34D399",
          corNeon: "rgba(52, 211, 153, 0.2)",
        };
      }
    }

    // --- PROTOCOLO AVANÇADO 18:6 ---
    if (protocoloAtual === "18:6") {
      if (horasDecorridas < 8) {
        return {
          nome: "PÓS-PRANDIAL",
          mensagem:
            "Processando nutrientes. Energia estabilizada e insulina agindo.",
          corTexto: "text-blue-400",
          corBorda: "#60A5FA",
          corNeon: "rgba(96, 165, 250, 0.2)",
        };
      } else if (horasDecorridas >= 8 && horasDecorridas < 14) {
        return {
          nome: "AUTOFAGIA BASAL",
          mensagem:
            "Suas células iniciam uma limpeza interna leve, reciclando proteínas antigas.",
          corTexto: "text-emerald-400",
          corBorda: "#34D399",
          corNeon: "rgba(52, 211, 153, 0.2)",
        };
      } else {
        return {
          nome: "CETOSE PROGRESSIVA",
          mensagem:
            "Otimização da queima de gordura! Seu corpo começa a produzir corpos cetônicos para o cérebro.",
          corTexto: "text-purple-400",
          corBorda: "#C084FC",
          corNeon: "rgba(192, 132, 252, 0.2)",
        };
      }
    }

    // --- PROTOCOLO PADRÃO OURO 16:8 (FALLBACK) ---
    if (horasDecorridas < 8) {
      return {
        nome: "ABSORÇÃO",
        mensagem:
          "Digestão em andamento. Níveis de glicose sendo gerenciados pelo pâncreas.",
        corTexto: "text-blue-400",
        corBorda: "#60A5FA",
        corNeon: "rgba(96, 165, 250, 0.2)",
      };
    } else if (horasDecorridas >= 8 && horasDecorridas < 12) {
      return {
        nome: "ZONA DE TRANSIÇÃO",
        mensagem:
          "Esvaziamento do glicogênio hepático. Corpo se prepara para queimar lipídios.",
        corTexto: "text-cyan-400",
        corBorda: "#22D3EE",
        corNeon: "rgba(34, 211, 238, 0.2)",
      };
    } else {
      return {
        nome: "AUTOFAGIA INICIAL",
        mensagem:
          "Fase celular ativa! Limpeza de toxinas e rejuvenescimento celular acelerados.",
        corTexto: "text-emerald-400",
        corBorda: "#34D399",
        corNeon: "rgba(52, 211, 153, 0.2)",
      };
    }
  };

  // Captura o estado atualizado
  const faseAtualInfo = obterFaseCelularDinamica();

  // Hook de inicialização protegido contra ausência de arquivo Excel
  useEffect(() => {
    const inicializarAplicacao = async () => {
      try {
        const resHistorico = await fetch(`${API_BASE_URL}/api/historico`);
        const dadosHistorico = await resHistorico.json();
        setHistorico(dadosHistorico);

        if (dadosHistorico.length === 0) {
          setPlano({
            protocolo: "A Calibrar",
            quebra_jejum_sugerida: "--:--",
            fase_atual: "CALIBRAÇÃO",
          });
          setModalConfigAberto(true);
        } else {
          const ultimoRegistro = dadosHistorico[0];
          const protocoloSalvo =
            ultimoRegistro.protocolo || ultimoRegistro.Protocolo || "16:8";

          // CORREÇÃO 2: Criada a variável faseSegura para substituir o erro de 'faseSalva' indefinida
          const faseSegura =
            ultimoRegistro.ultima_fase_celular ||
            ultimoRegistro.Ultima_Fase_Celular ||
            "JANELA_ABERTA";

          setPlano({
            protocolo: protocoloSalvo,
            quebra_jejum_sugerida:
              ultimoRegistro.janela_quebra ||
              ultimoRegistro.Janela_Quebra ||
              "12:00",
            fase_atual: faseSegura,
          });

          // Puxa as receitas ideais para o estado recuperado do Excel
          const resReceitas = await fetch(`${API_BASE_URL}/api/receitas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fase_janela: faseSegura,
              protocolo_ativo: protocoloSalvo,
              treino_concluido: false,
            }),
          });
          if (resReceitas.ok) {
            const dadosReceitas = await resReceitas.json();
            setReceitas(dadosReceitas);
          }
        }
      } catch (error) {
        console.error("Erro na inicialização segura:", error);
      } finally {
        setLoading(false);
      }
    };

    inicializarAplicacao();
  }, []);

  // Hook do motor do relógio
  useEffect(() => {
    let temporizador;

    if (jejumAtivo && horaInicioJejum) {
      const atualizarCronometro = () => {
        const agora = new Date();
        const inicio = new Date(horaInicioJejum);
        const diferencaEmSegundos = Math.floor((agora - inicio) / 1000);

        setSegundosDecorridos(
          diferencaEmSegundos > 0 ? diferencaEmSegundos : 0,
        );
      };

      atualizarCronometro();
      temporizador = setInterval(atualizarCronometro, 1000);
    } else {
      setSegundosDecorridos(0);
    }

    return () => clearInterval(temporizador);
  }, [jejumAtivo, horaInicioJejum]);

  // Lógica para filtrar as receitas na tela em tempo real
  const receitasFiltradas = receitas.filter((receita) => {
    if (filtroAtivo === "TODAS") return true;
    return receita.tags && receita.tags.includes(filtroAtivo);
  });

  const formatarTempo = (totalSegundos) => {
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    return `${horas.toString().padStart(2, "0")}:${minutos.toString().padStart(2, "0")}:${segundos.toString().padStart(2, "0")}`;
  };

  const buscarCondutaSOS = async (sintoma) => {
    setSintomaSelecionado(sintoma);
    try {
      const resposta = await fetch(`${API_BASE_URL}/api/sos-conduta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sintoma: sintoma }),
      });
      const dados = await resposta.json();
      setCondutaRecebida(dados);
    } catch (error) {
      console.error("Erro ao buscar conduta SOS:", error);
    }
  };

  const iniciarNovoJejum = () => {
    const agora_iso = new Date().toISOString();
    localStorage.setItem("jejum_ativo", "true");
    localStorage.setItem("hora_inicio_jejum", agora_iso);

    setJejumAtivo(true);
    setHoraInicioJejum(agora_iso);
    setPlano({ ...plano, fase_atual: "JEJUM_ATIVO" });
  };

  const concluirJejumReal = async () => {
    const horasRealizadas = parseFloat((segundosDecorridos / 3600).toFixed(2));
    const faseAtualInfo = obterFaseCelularDinamica();

    try {
      const resposta = await fetch(`${API_BASE_URL}/api/concluir-jejum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horas_decorridas: horasRealizadas,
          fase_atingida: faseAtualInfo.nome,
        }),
      });

      if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({}));
        throw new Error(
          erro.detail || `O servidor respondeu com status: ${resposta.status}`,
        );
      }

      const resultado = await resposta.json();

      if (resultado.status === "sucesso") {
        alert(
          `Parabéns! Jejum de ${horasRealizadas}h concluído e guardado no Excel.`,
        );

        localStorage.removeItem("jejum_ativo");
        localStorage.removeItem("hora_inicio_jejum");
        setJejumAtivo(false);
        setHoraInicioJejum(null);
        setSegundosDecorridos(0);
        setPlano({ ...plano, fase_atual: "JANELA_ABERTA" });

        const resHistorico = await fetch(`${API_BASE_URL}/api/historico`);
        if (resHistorico.ok) {
          const dadosHistorico = await resHistorico.json();
          setHistorico(dadosHistorico);

          // CORREÇÃO 3: Ajustado o IP de 172.0.0.1 para 127.0.0.1 e normalizada string da fase
          const resReceitas = await fetch(`${API_BASE_URL}/api/receitas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fase_janela: "JANELA_ABERTA",
              protocolo_ativo: plano?.protocolo || "16:8",
              treino_concluido: false,
            }),
          });
          if (resReceitas.ok) {
            setReceitas(await resReceitas.json());
          }
        }
      }
    } catch (error) {
      console.error("Erro ao comunicar o fim do jejum:", error);
      alert(`Falha ao concluir jejum: ${error.message}.`);
    }
  };

  const enviarDadosUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);

    const pacoteDados = {
      idade: parseInt(inputIdade) || 30,
      nivel_experiencia: inputNivel || "INTERMEDIARIO",
      treina: !!inputTreina,
      hora_treino: inputTreina ? inputHoraTreino || "18:30" : "00:00",
      protocolo_escolhido: inputProtocolo || "AUTOMATICO",
    };

    try {
      const resposta = await fetch(`${API_BASE_URL}/api/gerar-plano`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pacoteDados),
      });

      if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({}));
        throw new Error(
          erro.detail ||
            `O servidor Python respondeu com status: ${resposta.status}`,
        );
      }

      const dadosObtidos = await resposta.json();
      setPlano(dadosObtidos);
      setModalConfigAberto(false);

      // Atualiza o feed de receitas baseado na nova fase e protocolo ativos
      const resReceitas = await fetch(`${API_BASE_URL}/api/receitas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fase_janela: dadosObtidos.fase_atual,
          protocolo_ativo: dadosObtidos.protocolo,
          treino_concluido: false,
        }),
      });
      if (resReceitas.ok) {
        setReceitas(await resReceitas.json());
      }

      const resHistorico = await fetch(`${API_BASE_URL}/api/historico`);
      if (resHistorico.ok) {
        setHistorico(await resHistorico.json());
      }

      alert("Sistema Calibrado com sucesso!");
    } catch (error) {
      console.error("Erro crítico no envio:", error);
      alert(`Falha na calibração: ${error.message}.`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-emerald-400 flex justify-center items-center h-screen bg-[#121212] font-mono text-xl animate-pulse">
        Sincronizando com os receptores celulares...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-gray-200 p-6 font-sans pb-24 flex justify-center">
      <div className="w-full max-w-md">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold tracking-wider text-white">
            BIO<span className="text-emerald-500">FASTING</span>
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setModalConfigAberto(true)}
              className="bg-gray-900 text-gray-400 px-3 py-2 rounded-full text-xs font-bold border border-gray-800 hover:text-white hover:border-gray-700 transition-all"
            >
              ⚙️ Perfil
            </button>
            <button
              onClick={() => {
                setModalSOSAberto(true);
                setCondutaRecebida(null);
                setSintomaSelecionado("");
              }}
              className="bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-xs font-bold border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:bg-red-500/30 transition-all"
            >
              SOS PANIC
            </button>
          </div>
        </header>

        {/* Relógio Biológico Circular Dinâmico */}
        <div className="flex flex-col items-center justify-center my-10">
          {/* O container externo agora ganha um brilho neon proporcional à fase */}
          <div
            className="relative flex items-center justify-center w-60 h-60 rounded-full border-4 border-gray-800 transition-all duration-700"
            style={{
              borderColor: `${faseAtualInfo.corBorda}33`,
              boxShadow: `0 0 40px ${faseAtualInfo.corNeon}`,
            }}
          >
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle
                cx="120"
                cy="120"
                r="110"
                stroke="#1E1E1E"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="120"
                cy="120"
                r="110"
                stroke={faseAtualInfo.corBorda} // <-- A cor do traço muda dinamicamente
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="690"
                strokeDashoffset="200"
                className="transition-all duration-700"
                style={{
                  filter: `drop-shadow(0 0 6px ${faseAtualInfo.corBorda}aa)`,
                }}
              />
            </svg>

            <div className="text-center z-10 px-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">
                Estado Fisiológico
              </p>
              {/* Nome da fase adaptável e colorido */}
              <h2
                className={`text-lg font-black tracking-wide transition-colors duration-500 ${faseAtualInfo.corTexto}`}
              >
                {faseAtualInfo.nome}
              </h2>
              <p className="text-5xl font-mono text-white mt-2 tracking-normal">
                {formatarTempo(segundosDecorridos)}
              </p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">
                Horas Decorridas
              </p>
            </div>
          </div>

          {/* Banner explicativo pedagógico logo abaixo do relógio */}
          <div className="w-full text-center mt-4 bg-gray-950/40 p-3 rounded-xl border border-gray-900 text-xs text-gray-400 leading-relaxed max-w-sm animate-fade-in">
            🔬{" "}
            <span className="text-gray-300 font-medium">
              Atividade Celular:
            </span>{" "}
            {faseAtualInfo.mensagem}
          </div>
        </div>

        {/* Guia Pedagógico */}
        <div className="bg-[#1E1E1E] p-5 rounded-2xl border border-gray-800/60 shadow-lg mb-6">
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-3">
            🗺️ Mapa do seu Protocolo Atual ({plano?.protocolo || "16:8"})
          </p>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-900">
              <span className="block text-[9px] text-gray-500 uppercase font-bold">
                🌑 Início do Jejum
              </span>
              <span className="text-lg font-mono text-white font-bold block mt-0.5">
                {plano?.projeção_inicio || "20:00"}h
              </span>
              <span className="text-[9px] text-gray-400 block mt-1 italic">
                Última refeição feita
              </span>
            </div>

            <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-900">
              <span className="block text-[9px] text-orange-500 uppercase font-bold">
                ☀️ Janela de Alimentação
              </span>
              <span className="text-lg font-mono text-orange-400 font-bold block mt-0.5">
                {plano?.quebra_jejum_sugerida || "12:00"}h
              </span>
              <span className="text-[9px] text-gray-400 block mt-1 italic">
                Liberação para comer
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-900 text-xs text-gray-400 leading-relaxed">
            💡{" "}
            <span className="text-gray-300 font-semibold">Como funciona:</span>{" "}
            Você passará{" "}
            <strong className="text-emerald-400">
              {plano?.horas_jejum || 16} horas
            </strong>{" "}
            em restrição alimentar (foco em hidratação) e terá uma janela
            terapêutica de{" "}
            <strong className="text-orange-400">
              {plano?.horas_janela || 8} horas
            </strong>{" "}
            para bater suas metas de nutrientes.
          </div>
        </div>

        {/* Botão de Controle */}
        <div className="mt-6 flex justify-center">
          {jejumAtivo ? (
            <button
              onClick={concluirJejumReal}
              className="w-full bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 font-bold py-4 px-6 rounded-2xl tracking-wider text-xs uppercase transition-all shadow-[0_0_20px_rgba(239,68,68,0.1)] active:scale-[0.98]"
            >
              🛑 Quebrar Jejum Agora (Registra Tempo)
            </button>
          ) : (
            <button
              onClick={iniciarNovoJejum}
              className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 font-bold py-4 px-6 rounded-2xl tracking-wider text-xs uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.1)] active:scale-[0.98]"
            >
              ⚡ Iniciar Novo Jejum
            </button>
          )}
        </div>

        {/* Feed Clínico de Receitas */}
        <div className="mt-10">
          <div className="mb-4">
            <h3 className="text-md font-bold text-white uppercase tracking-wider">
              Farmácia Alimentar Sugerida
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Alimentos estratégicos baseados no seu estado metabólico atual.
            </p>
          </div>

          <div className="flex gap-2 mb-4">
            {["TODAS", "Low Carb", "Proteína"].map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltroAtivo(tipo)}
                className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg font-bold border transition-all ${filtroAtivo === tipo ? "bg-emerald-500/20 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-gray-900 border-gray-800 text-gray-400"}`}
              >
                {tipo === "TODAS"
                  ? "📊 Todas"
                  : tipo === "Low Carb"
                    ? "🥑 Low Carb"
                    : "🥤 Proteína"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {receitasFiltradas.map((receita) => (
              <div
                key={receita.id}
                className="bg-[#1E1E1E] border border-gray-800/80 rounded-2xl p-4 flex items-center gap-4 hover:border-emerald-500/30 transition-all cursor-pointer group"
              >
                <div className="w-14 h-14 bg-gray-900 rounded-xl flex items-center justify-center text-2xl border border-gray-800 group-hover:scale-105 transition-transform">
                  {receita.imagem_url}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-gray-100 group-hover:text-white transition-colors">
                    {receita.titulo}
                  </h4>
                  <div className="flex gap-2 mt-2">
                    {receita.tags &&
                      receita.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-[9px] uppercase tracking-wider bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md font-bold"
                        >
                          {tag}
                        </span>
                      ))}
                    <span className="text-[9px] uppercase tracking-wider bg-gray-900 text-gray-400 px-2 py-0.5 rounded-md font-medium border border-gray-800">
                      {receita.calorias} kcal
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Painel de Histórico */}
        <div className="mt-12 bg-[#1E1E1E] border border-gray-800/80 rounded-3xl p-5 shadow-lg">
          <div className="mb-4">
            <h3 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Registos de Bordo (Excel)
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Histórico de sessões guardado diretamente no disco local.
            </p>
          </div>

          {historico.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4 italic">
              Nenhum registo encontrado na planilha.
            </p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
              {historico.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-950/60 border border-gray-900 rounded-xl p-3 text-xs flex flex-col gap-1 hover:border-gray-800 transition-all"
                >
                  <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono">
                    <span>{item.data_registro || item.Data_Registro}</span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${(item.evento || item.Evento) === "FIM_JEJUM" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}
                    >
                      {item.evento || item.Evento || "NOVO_PLANO"}
                    </span>
                  </div>

                  <div className="text-gray-300 mt-1 flex justify-between">
                    {(item.evento || item.Evento) === "FIM_JEJUM" ? (
                      <>
                        <span>
                          Duraçao:{" "}
                          <strong className="text-white font-mono">
                            {item.horas_decorridas || item.Horas_Decorridas}h
                          </strong>
                        </span>
                        <span className="text-gray-500">
                          Fase:{" "}
                          <span className="text-orange-400">
                            {item.ultima_fase_celular ||
                              item.Ultima_Fase_Celular}
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          Protocolo:{" "}
                          <strong className="text-white">
                            {item.protocolo || item.Protocolo}
                          </strong>
                        </span>
                        <span>
                          Idade:{" "}
                          <strong className="text-white">
                            {item.idade || item.Idade}a
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal SOS */}
        {modalSOSAberto && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-[#1E1E1E] border border-red-500/30 w-full max-w-sm rounded-3xl p-6 shadow-[0_0_40px_rgba(239,68,68,0.15)] animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-red-400 tracking-wider">
                  TRIAGEM DE SINTOMAS
                </h3>
                <button
                  onClick={() => setModalSOSAberto(false)}
                  className="text-gray-400 hover:text-white font-bold text-sm bg-gray-950 px-2.5 py-1 rounded-full border border-gray-800"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 mb-6">
                {["DOR_DE_CABECA", "FRAQUEZA", "NAUSEA"].map((sintoma) => (
                  <button
                    key={sintoma}
                    onClick={() => buscarCondutaSOS(sintoma)}
                    className={`p-3 rounded-xl text-xs font-semibold text-left border transition-all ${sintomaSelecionado === sintoma ? "bg-red-500/20 border-red-500 text-white" : "bg-gray-950 border-gray-800 text-gray-300"}`}
                  >
                    {sintoma === "DOR_DE_CABECA"
                      ? "🤯 Dor de Cabeça"
                      : sintoma === "FRAQUEZA"
                        ? "🤢 Fraqueza Extrema"
                        : "🤮 Náusea"}
                  </button>
                ))}
              </div>
              {condutaRecebida && (
                <div className="bg-gray-950/60 border border-gray-800 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    {condutaRecebida.titulo}
                  </h4>
                  <p className="text-xs text-gray-300 leading-relaxed mt-2">
                    {condutaRecebida.conduta}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Configuração */}
        {modalConfigAberto && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex justify-center items-center z-50 p-4">
            <form
              onSubmit={enviarDadosUsuario}
              className="bg-[#1E1E1E] border border-emerald-500/30 w-full max-w-sm rounded-3xl p-6 shadow-[0_0_50px_rgba(16,185,129,0.15)]"
            >
              <div className="mb-6">
                <h3 className="text-lg font-bold text-emerald-400 tracking-wider uppercase">
                  Perfil Biométrico
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Insira os seus dados para calibração do protocolo metabólico.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">
                    Sua Idade
                  </label>
                  <input
                    type="number"
                    value={inputIdade}
                    onChange={(e) => setInputIdade(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">
                    Experiência com Jejum
                  </label>
                  <select
                    value={inputNivel}
                    onChange={(e) => setInputNivel(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none"
                  >
                    <option value="INICIANTE">Iniciante (Primeira Vez)</option>
                    <option value="INTERMEDIARIO">
                      Intermediário (Já praticou)
                    </option>
                    <option value="AVANCADO">
                      Avançado (Pratica constantemente)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">
                    Estratégia de Protocolo
                  </label>
                  <select
                    value={inputProtocolo}
                    onChange={(e) => setInputProtocolo(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none font-medium"
                  >
                    <option value="AUTOMATICO">
                      ✨ Sugerido pela IA do Sistema
                    </option>
                    <option value="12:12">
                      Protocolo Inicial (12h Jejum / 12h Janela)
                    </option>
                    <option value="16:8">
                      Protocolo Padrão Ouro (16h de Jejum / 8h Janela)
                    </option>
                    <option value="18:6">
                      Protocolo Avançado (18h Jejum / 6h Janela)
                    </option>
                  </select>
                </div>

                <div className="flex items-center justify-between bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">
                    Pratica Atividade Física?
                  </span>
                  <input
                    type="checkbox"
                    checked={inputTreina}
                    onChange={(e) => setInputTreina(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500 cursor-pointer"
                  />
                </div>

                {inputTreina && (
                  <div className="animate-fade-in">
                    <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">
                      Horário do Treino
                    </label>
                    <input
                      type="time"
                      value={inputHoraTreino}
                      onChange={(e) => setInputHoraTreino(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full mt-6 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 font-bold py-3.5 rounded-xl tracking-wider text-xs uppercase transition-all"
              >
                💾 Calibrar e Iniciar Sistema
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
