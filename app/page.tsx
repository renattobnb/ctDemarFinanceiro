"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
  CircleCheck,
  Copy,
  Gift,
  GraduationCap,
  LayoutDashboard,
  LinkIcon,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  XCircle,
  Trash2,
  TrendingUp,
  Users
} from "lucide-react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { competenciasAntecipadas, type TipoDescontoAntecipado } from "@/lib/pagamento-antecipado";
import { InstallAppBanner, InstallAppHelpButton, InstallAppModal, useInstallPrompt } from "./install-app";
import {
  anoAtual,
  dataAtualIso,
  formatarData,
  formatarMoeda,
  mesAtual,
  meses,
  numeroWhatsapp
} from "@/lib/formatadores";
import type { Aluno, AlunoTurma, CorFaixa, MensalidadeComDetalhes, PagamentoAntecipado, ResumoFinanceiro, Turma } from "@/lib/tipos";

type Aba = "dashboard" | "alunos" | "turmas" | "vinculos" | "mensalidades" | "pagas" | "canceladas" | "inadimplentes";

type Inadimplencia = {
  id: string;
  nome_aluno: string;
  telefone: string | null;
  nome_turma: string;
  mes_referencia: number;
  ano_referencia: number;
  valor: number;
  data_vencimento: string;
  status: "Pendente" | "Atrasado" | "Nao lancada";
};

type ResumoDashboard = ResumoFinanceiro & {
  receita_prevista_mes: number;
  novos_alunos_mes: number;
  alunos_cancelados_mes: number;
};

type ReceitaMensal = {
  mes: number;
  ano: number;
  rotulo: string;
  valor: number;
};

const abas: Array<{ id: Aba; rotulo: string; Icone: typeof LayoutDashboard }> = [
  { id: "dashboard", rotulo: "Dashboard", Icone: LayoutDashboard },
  { id: "alunos", rotulo: "Alunos", Icone: Users },
  { id: "turmas", rotulo: "Turmas", Icone: GraduationCap },
  { id: "vinculos", rotulo: "Vinculos", Icone: LinkIcon },
  { id: "mensalidades", rotulo: "Mensalidades", Icone: Banknote },
  { id: "pagas", rotulo: "Pagas", Icone: CircleCheck },
  { id: "canceladas", rotulo: "Canceladas", Icone: CircleX },
  { id: "inadimplentes", rotulo: "Inadimplentes", Icone: AlertCircle }
];

const abasPrincipaisMobile = abas.filter(({ id }) => ["dashboard", "alunos", "turmas"].includes(id));
const abasFinanceiroMobile = abas.filter(({ id }) =>
  ["mensalidades", "pagas", "canceladas", "inadimplentes"].includes(id)
);

const alunoInicial = {
  nome_completo: "",
  telefone: "",
  data_nascimento: "",
  data_matricula: dataAtualIso(),
  cor_faixa: "Branca" as CorFaixa,
  status: "Ativo",
  observacoes: ""
};

const faixasAlunos: Array<{ valor: CorFaixa; rotulo: string }> = [
  { valor: "Branca", rotulo: "Branca ⚪" },
  { valor: "Cinza", rotulo: "Cinza ⚪⚫" },
  { valor: "Amarela", rotulo: "Amarela 🟡" },
  { valor: "Laranja", rotulo: "Laranja 🟠" },
  { valor: "Verde", rotulo: "Verde 🟢" },
  { valor: "Azul", rotulo: "Azul 🔵" },
  { valor: "Roxa", rotulo: "Roxa 🟣" },
  { valor: "Marrom", rotulo: "Marrom 🟤" },
  { valor: "Preta", rotulo: "Preta ⚫" }
];

const itensPorPagina = 5;
const diaVencimentoPadrao = 8;
const capacidadePadraoTurma = 20;

const turmaInicial = {
  nome: "",
  dias_semana: "",
  horario: "",
  valor_mensalidade: "",
  capacidade_alunos: String(capacidadePadraoTurma),
  status: "Ativa"
};

const pagamentoAntecipadoInicial = {
  alunoId: "", turmaId: "", mes: mesAtual(), ano: anoAtual(), quantidade: 3,
  tipoDesconto: "Sem desconto" as TipoDescontoAntecipado, desconto: "", formaPagamento: "Dinheiro",
  dataPagamento: dataAtualIso(), observacao: "", reativarCanceladas: false
};

function dataVencimentoPadrao(mes: number, ano: number) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(diaVencimentoPadrao).padStart(2, "0")}`;
}

function ultimoDiaDoMes(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

function montarDataVencimento(mes: number, ano: number, dia: number) {
  const diaAjustado = Math.min(dia, ultimoDiaDoMes(mes, ano));
  return `${ano}-${String(mes).padStart(2, "0")}-${String(diaAjustado).padStart(2, "0")}`;
}

function proximoMesReferencia() {
  const hoje = new Date();
  const proximoMes = hoje.getMonth() + 2;

  if (proximoMes === 13) {
    return { mes: 1, ano: hoje.getFullYear() + 1 };
  }

  return { mes: proximoMes, ano: hoje.getFullYear() };
}

function obterDataBasePagamento(mensalidade: MensalidadeComDetalhes) {
  return mensalidade.data_pagamento ?? mensalidade.data_vencimento;
}

function formatarDiaMes(dataIso: string) {
  const [, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}`;
}

function adicionarDiasIso(dataIso: string, dias: number) {
  const data = new Date(`${dataIso}T00:00:00`);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

function mesesReceitaUltimosSeisMeses() {
  const hoje = new Date();

  return Array.from({ length: 6 }, (_, indice) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - indice), 1);
    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();
    return {
      mes,
      ano,
      rotulo: `${meses[mes - 1].slice(0, 3)}/${ano}`
    };
  });
}

export default function PaginaInicial() {
  const controleInstalacao = useInstallPrompt();
  const [abaAtiva, definirAbaAtiva] = useState<Aba>("dashboard");
  const [menuTurmasAberto, definirMenuTurmasAberto] = useState(false);
  const [menuFinanceiroAberto, definirMenuFinanceiroAberto] = useState(false);
  const [indicadoresExpandidos, definirIndicadoresExpandidos] = useState(false);
  const [acoesRapidasAbertas, definirAcoesRapidasAbertas] = useState(false);
  const [acoesRapidasVisiveis, definirAcoesRapidasVisiveis] = useState(false);
  const [carregando, definirCarregando] = useState(false);
  const [salvando, definirSalvando] = useState(false);
  const [mensagem, definirMensagem] = useState("");
  const [busca, definirBusca] = useState("");
  const [buscaVinculo, definirBuscaVinculo] = useState("");
  const [buscaMensalidade, definirBuscaMensalidade] = useState("");
  const [buscaPagas, definirBuscaPagas] = useState("");
  const [buscaCanceladas, definirBuscaCanceladas] = useState("");
  const [paginaAlunos, definirPaginaAlunos] = useState(1);
  const [paginaTurmas, definirPaginaTurmas] = useState(1);
  const [paginaVinculos, definirPaginaVinculos] = useState(1);
  const [paginaMensalidades, definirPaginaMensalidades] = useState(1);
  const [paginaPagas, definirPaginaPagas] = useState(1);
  const [paginaCanceladas, definirPaginaCanceladas] = useState(1);
  const [alunos, definirAlunos] = useState<Aluno[]>([]);
  const [turmas, definirTurmas] = useState<Turma[]>([]);
  const [vinculos, definirVinculos] = useState<AlunoTurma[]>([]);
  const [mensalidades, definirMensalidades] = useState<MensalidadeComDetalhes[]>([]);
  const [formAluno, definirFormAluno] = useState(alunoInicial);
  const [formTurma, definirFormTurma] = useState(turmaInicial);
  const [alunoEmEdicao, definirAlunoEmEdicao] = useState<Aluno | null>(null);
  const [turmaEmEdicao, definirTurmaEmEdicao] = useState<Turma | null>(null);
  const [alunoSelecionado, definirAlunoSelecionado] = useState("");
  const [turmaSelecionada, definirTurmaSelecionada] = useState("");
  const [vinculoEmEdicao, definirVinculoEmEdicao] = useState<AlunoTurma | null>(null);
  const [mensalidadeEmEdicao, definirMensalidadeEmEdicao] = useState<MensalidadeComDetalhes | null>(null);
  const [mesReferencia, definirMesReferencia] = useState(mesAtual());
  const [anoReferencia, definirAnoReferencia] = useState(anoAtual());
  const [dataVencimento, definirDataVencimento] = useState(dataVencimentoPadrao(mesAtual(), anoAtual()));
  const [modalAntecipadoAberto, definirModalAntecipadoAberto] = useState(false);
  const [formAntecipado, definirFormAntecipado] = useState(pagamentoAntecipadoInicial);
  const [detalheAntecipado, definirDetalheAntecipado] = useState<PagamentoAntecipado | null>(null);
  const [requisicaoAntecipada, definirRequisicaoAntecipada] = useState("");

  async function carregarDados() {
    if (!supabaseConfigurado) return;

    definirCarregando(true);
    definirMensagem("");

    const [respostaAlunos, respostaTurmas, respostaVinculos, respostaMensalidades] = await Promise.all([
      supabase.from("alunos").select("*").order("nome_completo"),
      supabase.from("turmas").select("*").order("nome"),
      supabase.from("aluno_turma").select("*").order("created_at", { ascending: false }),
      supabase
        .from("financeiro")
        .select("*, alunos(nome_completo, telefone), turmas(nome)")
        .order("ano_referencia", { ascending: false })
        .order("mes_referencia", { ascending: false })
        .order("data_vencimento", { ascending: true })
    ]);

    const erro = respostaAlunos.error || respostaTurmas.error || respostaVinculos.error || respostaMensalidades.error;

    if (erro) {
      definirMensagem(`Nao foi possivel carregar os dados: ${erro.message}`);
    } else {
      definirAlunos((respostaAlunos.data ?? []) as Aluno[]);
      definirTurmas((respostaTurmas.data ?? []) as Turma[]);
      definirVinculos((respostaVinculos.data ?? []) as AlunoTurma[]);
      definirMensalidades((respostaMensalidades.data ?? []) as MensalidadeComDetalhes[]);
    }

    definirCarregando(false);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js");
    }
  }, []);

  useEffect(() => {
    if (abaAtiva !== "dashboard") {
      definirAcoesRapidasVisiveis(false);
      definirAcoesRapidasAbertas(false);
      return;
    }

    function atualizarVisibilidadeAcoes() {
      const visivel = window.scrollY > 90;
      definirAcoesRapidasVisiveis(visivel);
      if (!visivel) definirAcoesRapidasAbertas(false);
    }

    atualizarVisibilidadeAcoes();
    window.addEventListener("scroll", atualizarVisibilidadeAcoes, { passive: true });

    return () => window.removeEventListener("scroll", atualizarVisibilidadeAcoes);
  }, [abaAtiva]);

  useEffect(() => {
    definirPaginaAlunos(1);
  }, [busca]);

  useEffect(() => {
    definirPaginaVinculos(1);
  }, [buscaVinculo]);

  useEffect(() => {
    definirPaginaMensalidades(1);
  }, [buscaMensalidade]);

  useEffect(() => {
    definirPaginaPagas(1);
  }, [buscaPagas]);

  useEffect(() => {
    definirPaginaCanceladas(1);
  }, [buscaCanceladas]);

  const resumo = useMemo<ResumoDashboard>(() => {
    const mesAtualReferencia = mesAtual();
    const anoAtualReferencia = anoAtual();

    return mensalidades.reduce(
      (acumulado, mensalidade) => {
        if (
          mensalidade.status !== "Cancelado" &&
          mensalidade.mes_referencia === mesAtualReferencia &&
          mensalidade.ano_referencia === anoAtualReferencia
        ) {
          acumulado.receita_prevista_mes += Number(mensalidade.valor);
        }
        if (
          mensalidade.status === "Pago" &&
          mensalidade.mes_referencia === mesAtualReferencia &&
          mensalidade.ano_referencia === anoAtualReferencia
        ) {
          acumulado.total_recebido += Number(mensalidade.valor);
        }
        if (mensalidade.status === "Pendente") acumulado.total_pendente += Number(mensalidade.valor);
        if (mensalidade.status === "Atrasado") acumulado.total_atrasado += Number(mensalidade.valor);
        return acumulado;
      },
      {
        total_recebido: 0,
        total_pendente: 0,
        total_atrasado: 0,
        receita_prevista_mes: 0,
        novos_alunos_mes: alunos.filter((aluno) => {
          return (
            Number(aluno.data_matricula.slice(5, 7)) === mesAtualReferencia &&
            Number(aluno.data_matricula.slice(0, 4)) === anoAtualReferencia
          );
        }).length,
        alunos_cancelados_mes: alunos.filter((aluno) => {
          return (
            aluno.status === "Inativo" &&
            Number(aluno.updated_at.slice(5, 7)) === mesAtualReferencia &&
            Number(aluno.updated_at.slice(0, 4)) === anoAtualReferencia
          );
        }).length,
        quantidade_alunos: alunos.length,
        quantidade_turmas: turmas.length
      }
    );
  }, [alunos, mensalidades, turmas.length]);

  const receitaUltimosSeisMeses = useMemo<ReceitaMensal[]>(() => {
    return mesesReceitaUltimosSeisMeses().map((referencia) => {
      const valor = mensalidades.reduce((total, mensalidade) => {
        if (
          mensalidade.status === "Pago" &&
          mensalidade.mes_referencia === referencia.mes &&
          mensalidade.ano_referencia === referencia.ano
        ) {
          return total + Number(mensalidade.valor);
        }

        return total;
      }, 0);

      return {
        ...referencia,
        valor
      };
    });
  }, [mensalidades]);

  const alunosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return alunos;
    return alunos.filter((aluno) => aluno.nome_completo.toLowerCase().includes(termo));
  }, [alunos, busca]);

  const alunosPaginados = useMemo(() => {
    const inicio = (paginaAlunos - 1) * itensPorPagina;
    return alunosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [alunosFiltrados, paginaAlunos]);

  const aniversariantesDoMes = useMemo(() => {
    const mesAtualReferencia = mesAtual();

    return alunos
      .filter((aluno) => {
        if (!aluno.data_nascimento || aluno.status === "Inativo") return false;
        return Number(aluno.data_nascimento.slice(5, 7)) === mesAtualReferencia;
      })
      .sort((primeiro, segundo) => {
        return Number(primeiro.data_nascimento?.slice(8, 10) ?? 0) - Number(segundo.data_nascimento?.slice(8, 10) ?? 0);
      });
  }, [alunos]);

  const quantidadeAlunosAtivos = useMemo(() => {
    return alunos.filter((aluno) => aluno.status === "Ativo").length;
  }, [alunos]);

  const turmasPaginadas = useMemo(() => {
    const inicio = (paginaTurmas - 1) * itensPorPagina;
    return turmas.slice(inicio, inicio + itensPorPagina);
  }, [paginaTurmas, turmas]);

  const mensalidadesAtivas = useMemo(() => {
    return mensalidades.filter((mensalidade) => mensalidade.status !== "Cancelado" && mensalidade.status !== "Pago");
  }, [mensalidades]);

  const mensalidadesFiltradas = useMemo(() => {
    const termo = buscaMensalidade.trim().toLowerCase();
    if (!termo) return mensalidadesAtivas;

    return mensalidadesAtivas.filter((mensalidade) => {
      return mensalidade.alunos?.nome_completo.toLowerCase().includes(termo);
    });
  }, [buscaMensalidade, mensalidadesAtivas]);

  const mensalidadesPaginadas = useMemo(() => {
    const inicio = (paginaMensalidades - 1) * itensPorPagina;
    return mensalidadesFiltradas.slice(inicio, inicio + itensPorPagina);
  }, [mensalidadesFiltradas, paginaMensalidades]);

  const mensalidadesPagas = useMemo(() => {
    return mensalidades.filter((mensalidade) => mensalidade.status === "Pago");
  }, [mensalidades]);

  const mensalidadesPagasFiltradas = useMemo(() => {
    const termo = buscaPagas.trim().toLowerCase();
    if (!termo) return mensalidadesPagas;

    return mensalidadesPagas.filter((mensalidade) => {
      return mensalidade.alunos?.nome_completo.toLowerCase().includes(termo);
    });
  }, [buscaPagas, mensalidadesPagas]);

  const mensalidadesPagasPaginadas = useMemo(() => {
    const inicio = (paginaPagas - 1) * itensPorPagina;
    return mensalidadesPagasFiltradas.slice(inicio, inicio + itensPorPagina);
  }, [mensalidadesPagasFiltradas, paginaPagas]);

  const mensalidadesCanceladas = useMemo(() => {
    return mensalidades.filter((mensalidade) => mensalidade.status === "Cancelado");
  }, [mensalidades]);

  const mensalidadesCanceladasFiltradas = useMemo(() => {
    const termo = buscaCanceladas.trim().toLowerCase();
    if (!termo) return mensalidadesCanceladas;

    return mensalidadesCanceladas.filter((mensalidade) => {
      return mensalidade.alunos?.nome_completo.toLowerCase().includes(termo);
    });
  }, [buscaCanceladas, mensalidadesCanceladas]);

  const mensalidadesCanceladasPaginadas = useMemo(() => {
    const inicio = (paginaCanceladas - 1) * itensPorPagina;
    return mensalidadesCanceladasFiltradas.slice(inicio, inicio + itensPorPagina);
  }, [mensalidadesCanceladasFiltradas, paginaCanceladas]);

  const vinculosComDetalhes = useMemo(() => {
    return vinculos.map((vinculo) => ({
      vinculo,
      aluno: alunos.find((item) => item.id === vinculo.aluno_id),
      turma: turmas.find((item) => item.id === vinculo.turma_id)
    }));
  }, [alunos, turmas, vinculos]);

  const vinculosFiltrados = useMemo(() => {
    const termo = buscaVinculo.trim().toLowerCase();
    if (!termo) return vinculosComDetalhes;

    return vinculosComDetalhes.filter(({ aluno, turma }) => {
      return (
        aluno?.nome_completo.toLowerCase().includes(termo) ||
        aluno?.telefone?.toLowerCase().includes(termo) ||
        turma?.nome.toLowerCase().includes(termo)
      );
    });
  }, [buscaVinculo, vinculosComDetalhes]);

  const vinculosPaginados = useMemo(() => {
    const inicio = (paginaVinculos - 1) * itensPorPagina;
    return vinculosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [paginaVinculos, vinculosFiltrados]);

  const ocupacaoTurmas = useMemo(() => {
    return turmas
      .map((turma) => ({
        turma,
        quantidade: vinculos.filter((vinculo) => vinculo.turma_id === turma.id).length
      }))
      .sort((primeira, segunda) => segunda.quantidade - primeira.quantidade || primeira.turma.nome.localeCompare(segunda.turma.nome));
  }, [turmas, vinculos]);

  const inadimplencias = useMemo<Inadimplencia[]>(() => {
    return mensalidades
      .filter((mensalidade) => mensalidade.status === "Atrasado")
      .map((mensalidade) => ({
        id: mensalidade.id,
        nome_aluno: mensalidade.alunos?.nome_completo ?? "Aluno nao encontrado",
        telefone: mensalidade.alunos?.telefone ?? null,
        nome_turma: mensalidade.turmas?.nome ?? "Turma nao encontrada",
        mes_referencia: mensalidade.mes_referencia,
        ano_referencia: mensalidade.ano_referencia,
        valor: Number(mensalidade.valor),
        data_vencimento: mensalidade.data_vencimento,
        status: "Atrasado"
      }));
  }, [mensalidades]);

  const quantidadeAlunosInadimplentes = useMemo(() => {
    return new Set(
      mensalidades
        .filter((mensalidade) => mensalidade.status === "Atrasado")
        .map((mensalidade) => mensalidade.aluno_id)
    ).size;
  }, [mensalidades]);

  const taxaInadimplencia = useMemo(() => {
    if (alunos.length === 0) return "0%";

    const percentual = (quantidadeAlunosInadimplentes / alunos.length) * 100;
    const valorFormatado = Number.isInteger(percentual) ? String(percentual) : percentual.toFixed(1).replace(".", ",");
    return `${valorFormatado}%`;
  }, [alunos.length, quantidadeAlunosInadimplentes]);

  const percentualReceitaRecebida = useMemo(() => {
    if (resumo.receita_prevista_mes === 0) return "0%";

    const percentual = (resumo.total_recebido / resumo.receita_prevista_mes) * 100;
    const percentualLimitado = Math.min(percentual, 100);
    const valorFormatado = Number.isInteger(percentualLimitado)
      ? String(percentualLimitado)
      : percentualLimitado.toFixed(1).replace(".", ",");
    return `${valorFormatado}%`;
  }, [resumo.receita_prevista_mes, resumo.total_recebido]);

  const receitaPerdidaMes = useMemo(() => {
    const mesAtualReferencia = mesAtual();
    const anoAtualReferencia = anoAtual();
    const totalCanceladoMes = mensalidades.reduce((total, mensalidade) => {
      if (
        mensalidade.status === "Cancelado" &&
        mensalidade.mes_referencia === mesAtualReferencia &&
        mensalidade.ano_referencia === anoAtualReferencia
      ) {
        return total + Number(mensalidade.valor);
      }

      return total;
    }, 0);
    const alunosInativos = new Set(alunos.filter((aluno) => aluno.status === "Inativo").map((aluno) => aluno.id));
    const receitaAlunosInativos = vinculos.reduce((total, vinculo) => {
      if (!alunosInativos.has(vinculo.aluno_id)) return total;

      const turma = turmas.find((item) => item.id === vinculo.turma_id);
      return total + Number(turma?.valor_mensalidade ?? 0);
    }, 0);

    return totalCanceladoMes + receitaAlunosInativos;
  }, [alunos, mensalidades, turmas, vinculos]);

  const alertasDashboard = useMemo(() => {
    const hoje = dataAtualIso();
    const limiteAtraso = adicionarDiasIso(hoje, -15);
    const amanha = adicionarDiasIso(hoje, 1);
    const mesDiaAmanha = amanha.slice(5, 10);
    const mensalidadesVencemHoje = mensalidades.filter((mensalidade) => {
      return mensalidade.data_vencimento === hoje && mensalidade.status !== "Pago" && mensalidade.status !== "Cancelado";
    }).length;
    const alunosAtrasadosMaisDeQuinzeDias = new Set(
      mensalidades
        .filter((mensalidade) => {
          return mensalidade.status === "Atrasado" && mensalidade.data_vencimento < limiteAtraso;
        })
        .map((mensalidade) => mensalidade.aluno_id)
    ).size;
    const aniversariantesAmanha = alunos.filter((aluno) => {
      return aluno.status === "Ativo" && aluno.data_nascimento?.slice(5, 10) === mesDiaAmanha;
    }).length;

    return {
      mensalidadesVencemHoje,
      alunosAtrasadosMaisDeQuinzeDias,
      aniversariantesAmanha
    };
  }, [alunos, mensalidades]);

  const textoAlertasDashboard = useMemo(() => {
    return [
      `${alertasDashboard.mensalidadesVencemHoje} mensalidade(s) vencem hoje`,
      `${alertasDashboard.alunosAtrasadosMaisDeQuinzeDias} aluno(s) com pagamento atrasado ha mais de 15 dias`,
      `${alertasDashboard.aniversariantesAmanha} aniversariante(s) amanha`
    ].join("\n");
  }, [alertasDashboard]);

  const totalReceitaPeriodo = useMemo(() => {
    return receitaUltimosSeisMeses.reduce((total, item) => total + item.valor, 0);
  }, [receitaUltimosSeisMeses]);

  const resumoContextualDashboard = useMemo(() => {
    const inadimplenciaTexto =
      quantidadeAlunosInadimplentes === 0
        ? "nenhuma inadimplencia"
        : `${quantidadeAlunosInadimplentes} ${quantidadeAlunosInadimplentes === 1 ? "inadimplente" : "inadimplentes"}`;

    return `Hoje voce possui ${formatarMoeda(resumo.receita_prevista_mes)} previstos, ${quantidadeAlunosAtivos} ${quantidadeAlunosAtivos === 1 ? "aluno ativo" : "alunos ativos"} e ${inadimplenciaTexto}.`;
  }, [quantidadeAlunosAtivos, quantidadeAlunosInadimplentes, resumo.receita_prevista_mes]);

  const turmaDoAlunoSelecionado = turmas.find((turma) => turma.id === turmaSelecionada);

  async function salvarAluno(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirSalvando(true);

    const dadosAluno = {
      nome_completo: formAluno.nome_completo,
      telefone: formAluno.telefone || null,
      data_nascimento: formAluno.data_nascimento || null,
      data_matricula: formAluno.data_matricula,
      cor_faixa: formAluno.cor_faixa,
      status: formAluno.status,
      observacoes: formAluno.observacoes || null
    };

    const resposta = alunoEmEdicao
      ? await supabase.from("alunos").update(dadosAluno).eq("id", alunoEmEdicao.id)
      : await supabase.from("alunos").insert(dadosAluno);

    definirSalvando(false);
    if (resposta.error) return definirMensagem(`Erro ao salvar aluno: ${resposta.error.message}`);
    definirMensagem(alunoEmEdicao ? "Aluno alterado com sucesso." : "Aluno cadastrado com sucesso.");
    definirFormAluno(alunoInicial);
    definirAlunoEmEdicao(null);
    carregarDados();
  }

  function iniciarEdicaoAluno(aluno: Aluno) {
    definirAlunoEmEdicao(aluno);
    definirFormAluno({
      nome_completo: aluno.nome_completo,
      telefone: aluno.telefone ?? "",
      data_nascimento: aluno.data_nascimento ?? "",
      data_matricula: aluno.data_matricula,
      cor_faixa: aluno.cor_faixa ?? "Branca",
      status: aluno.status,
      observacoes: aluno.observacoes ?? ""
    });
    definirMensagem("Altere os dados do aluno no formulario e salve novamente.");
  }

  function cancelarEdicaoAluno() {
    definirAlunoEmEdicao(null);
    definirFormAluno(alunoInicial);
    definirMensagem("");
  }

  async function excluirAluno(aluno: Aluno) {
    const confirmou = window.confirm(
      `Deseja excluir o aluno ${aluno.nome_completo}? Os vinculos e lancamentos financeiros ligados a este aluno tambem podem ser removidos.`
    );
    if (!confirmou) return;

    definirSalvando(true);
    const { error } = await supabase.from("alunos").delete().eq("id", aluno.id);
    definirSalvando(false);

    if (error) return definirMensagem(`Erro ao excluir aluno: ${error.message}`);
    if (alunoEmEdicao?.id === aluno.id) cancelarEdicaoAluno();
    definirMensagem("Aluno excluido com sucesso.");
    carregarDados();
  }

  async function salvarTurma(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirSalvando(true);

    const dadosTurma = {
      nome: formTurma.nome,
      dias_semana: formTurma.dias_semana || null,
      horario: formTurma.horario || null,
      valor_mensalidade: Number(formTurma.valor_mensalidade),
      capacidade_alunos: Number(formTurma.capacidade_alunos || capacidadePadraoTurma),
      status: formTurma.status
    };

    const resposta = turmaEmEdicao
      ? await supabase.from("turmas").update(dadosTurma).eq("id", turmaEmEdicao.id)
      : await supabase.from("turmas").insert(dadosTurma);

    definirSalvando(false);
    if (resposta.error) return definirMensagem(`Erro ao salvar turma: ${resposta.error.message}`);
    definirMensagem(turmaEmEdicao ? "Turma alterada com sucesso." : "Turma cadastrada com sucesso.");
    definirFormTurma(turmaInicial);
    definirTurmaEmEdicao(null);
    carregarDados();
  }

  function iniciarEdicaoTurma(turma: Turma) {
    definirTurmaEmEdicao(turma);
    definirFormTurma({
      nome: turma.nome,
      dias_semana: turma.dias_semana ?? "",
      horario: turma.horario ?? "",
      valor_mensalidade: String(turma.valor_mensalidade),
      capacidade_alunos: String(turma.capacidade_alunos ?? capacidadePadraoTurma),
      status: turma.status
    });
    definirMensagem("Altere os dados da turma no formulario e salve novamente.");
  }

  function cancelarEdicaoTurma() {
    definirTurmaEmEdicao(null);
    definirFormTurma(turmaInicial);
    definirMensagem("");
  }

  async function excluirTurma(turma: Turma) {
    const confirmou = window.confirm(
      `Deseja excluir a turma ${turma.nome}? Se houver alunos ou mensalidades vinculados, o banco pode impedir a exclusao.`
    );
    if (!confirmou) return;

    definirSalvando(true);
    const { error } = await supabase.from("turmas").delete().eq("id", turma.id);
    definirSalvando(false);

    if (error) return definirMensagem(`Erro ao excluir turma: ${error.message}`);
    if (turmaEmEdicao?.id === turma.id) cancelarEdicaoTurma();
    definirMensagem("Turma excluida com sucesso.");
    carregarDados();
  }

  async function vincularAlunoTurma(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirSalvando(true);

    const resposta = vinculoEmEdicao
      ? await supabase
          .from("aluno_turma")
          .update({
            aluno_id: alunoSelecionado,
            turma_id: turmaSelecionada
          })
          .eq("id", vinculoEmEdicao.id)
      : await supabase.from("aluno_turma").insert({
          aluno_id: alunoSelecionado,
          turma_id: turmaSelecionada
        });

    definirSalvando(false);
    if (resposta.error) return definirMensagem(`Erro ao salvar vinculo: ${resposta.error.message}`);
    definirMensagem(vinculoEmEdicao ? "Vinculo alterado com sucesso." : "Aluno vinculado a turma com sucesso.");
    definirAlunoSelecionado("");
    definirTurmaSelecionada("");
    definirVinculoEmEdicao(null);
    carregarDados();
  }

  function iniciarEdicaoVinculo(vinculo: AlunoTurma) {
    definirVinculoEmEdicao(vinculo);
    definirAlunoSelecionado(vinculo.aluno_id);
    definirTurmaSelecionada(vinculo.turma_id);
    definirMensagem("Altere os dados no formulario e salve novamente.");
  }

  function cancelarEdicaoVinculo() {
    definirVinculoEmEdicao(null);
    definirAlunoSelecionado("");
    definirTurmaSelecionada("");
    definirMensagem("");
  }

  async function excluirVinculo(vinculo: AlunoTurma) {
    const confirmou = window.confirm("Deseja excluir este vinculo?");
    if (!confirmou) return;

    definirSalvando(true);
    const { error } = await supabase.from("aluno_turma").delete().eq("id", vinculo.id);
    definirSalvando(false);

    if (error) return definirMensagem(`Erro ao excluir vinculo: ${error.message}`);
    if (vinculoEmEdicao?.id === vinculo.id) cancelarEdicaoVinculo();
    definirMensagem("Vinculo excluido com sucesso.");
    carregarDados();
  }

  const turmaAntecipada = turmas.find((turma) => turma.id === formAntecipado.turmaId);
  const competenciasPrevia = useMemo(() => competenciasAntecipadas(
    formAntecipado.mes, formAntecipado.ano, formAntecipado.quantidade,
    Number(turmaAntecipada?.valor_mensalidade ?? 0), formAntecipado.tipoDesconto, Number(formAntecipado.desconto || 0)
  ), [formAntecipado.ano, formAntecipado.desconto, formAntecipado.mes, formAntecipado.quantidade, formAntecipado.tipoDesconto, turmaAntecipada?.valor_mensalidade]);
  const conflitosAntecipados = useMemo(() => competenciasPrevia.map((competencia) => {
    const existente = mensalidades.find((item) => item.aluno_id === formAntecipado.alunoId && item.turma_id === formAntecipado.turmaId && item.mes_referencia === competencia.mes && item.ano_referencia === competencia.ano);
    return { ...competencia, situacao: existente?.status === "Pago" ? "Bloqueada" : existente?.status === "Cancelado" ? "Cancelada" : existente ? "Atualizada" : "Criada" };
  }), [competenciasPrevia, formAntecipado.alunoId, formAntecipado.turmaId, mensalidades]);

  function abrirPagamentoAntecipado() {
    definirFormAntecipado({ ...pagamentoAntecipadoInicial, alunoId: alunoSelecionado, turmaId: turmaSelecionada });
    definirRequisicaoAntecipada(crypto.randomUUID());
    definirModalAntecipadoAberto(true);
    definirMensagem("");
  }

  async function confirmarPagamentoAntecipado() {
    if (!formAntecipado.alunoId || !formAntecipado.turmaId || !turmaAntecipada) return definirMensagem("Selecione o aluno e a turma do pagamento antecipado.");
    if (!Number.isInteger(formAntecipado.quantidade) || formAntecipado.quantidade < 1 || formAntecipado.quantidade > 24) return definirMensagem("A quantidade deve ser um número inteiro entre 1 e 24.");
    const bloqueadas = conflitosAntecipados.filter((item) => item.situacao === "Bloqueada");
    const canceladas = conflitosAntecipados.filter((item) => item.situacao === "Cancelada");
    if (bloqueadas.length) return definirMensagem(`A mensalidade de ${bloqueadas.map((item) => item.rotulo).join(", ")} já está paga.`);
    if (canceladas.length && !formAntecipado.reativarCanceladas) return definirMensagem("Há mensalidade cancelada. Marque a opção para reativá-la ou ajuste o período.");
    definirSalvando(true);
    const { data, error } = await supabase.rpc("registrar_pagamento_antecipado", {
      p_aluno_id: formAntecipado.alunoId, p_turma_id: formAntecipado.turmaId, p_mes_inicial: formAntecipado.mes, p_ano_inicial: formAntecipado.ano,
      p_quantidade_meses: formAntecipado.quantidade, p_tipo_desconto: formAntecipado.tipoDesconto, p_valor_desconto: Number(formAntecipado.desconto || 0),
      p_forma_pagamento: formAntecipado.formaPagamento, p_data_pagamento: formAntecipado.dataPagamento, p_observacao: formAntecipado.observacao,
      p_reativar_canceladas: formAntecipado.reativarCanceladas, p_requisicao_id: requisicaoAntecipada
    });
    definirSalvando(false);
    if (error) return definirMensagem(`Não foi possível registrar o pagamento antecipado: ${error.message}`);
    const resultado = data as { processadas: number; total: number; repetido: boolean };
    definirModalAntecipadoAberto(false);
    definirMensagem(resultado.repetido ? "Este pagamento antecipado já havia sido registrado." : `Pagamento antecipado registrado com sucesso. Foram processadas ${resultado.processadas} mensalidades, de ${competenciasPrevia[0].rotulo} a ${competenciasPrevia.at(-1)?.rotulo}, totalizando ${formatarMoeda(Number(resultado.total))}.`);
    carregarDados();
  }

  async function abrirDetalheAntecipado(id: string) {
    const { data, error } = await supabase.from("pagamentos_antecipados").select("*").eq("id", id).single();
    if (error) return definirMensagem(`Não foi possível carregar o lote: ${error.message}`);
    definirDetalheAntecipado(data as PagamentoAntecipado);
  }

  async function cancelarPagamentoAntecipado() {
    if (!detalheAntecipado) return;
    const motivo = window.prompt("Informe o motivo do cancelamento ou estorno:");
    if (!motivo) return;
    definirSalvando(true);
    const { error } = await supabase.rpc("cancelar_pagamento_antecipado", { p_lote_id: detalheAntecipado.id, p_motivo: motivo });
    definirSalvando(false);
    if (error) return definirMensagem(`Não foi possível cancelar o lote: ${error.message}`);
    definirDetalheAntecipado(null);
    definirMensagem("Pagamento antecipado cancelado. As mensalidades do lote foram mantidas no histórico como canceladas.");
    carregarDados();
  }

  async function lancarMensalidade(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirSalvando(true);

    const dadosMensalidade = {
      aluno_id: alunoSelecionado,
      turma_id: turmaSelecionada,
      mes_referencia: mesReferencia,
      ano_referencia: anoReferencia,
      valor: Number(turmaDoAlunoSelecionado?.valor_mensalidade ?? mensalidadeEmEdicao?.valor ?? 0),
      valor_original: Number(turmaDoAlunoSelecionado?.valor_mensalidade ?? mensalidadeEmEdicao?.valor_original ?? mensalidadeEmEdicao?.valor ?? 0),
      valor_desconto: 0,
      data_vencimento: dataVencimento
    };

    const resposta = mensalidadeEmEdicao
      ? await supabase.from("financeiro").update(dadosMensalidade).eq("id", mensalidadeEmEdicao.id)
      : await supabase.from("financeiro").insert({
          ...dadosMensalidade,
          status: "Pendente"
        });

    definirSalvando(false);
    if (resposta.error) return definirMensagem(`Erro ao salvar mensalidade: ${resposta.error.message}`);
    definirMensagem(mensalidadeEmEdicao ? "Mensalidade alterada com sucesso." : "Mensalidade lancada com sucesso.");
    definirMensalidadeEmEdicao(null);
    definirAlunoSelecionado("");
    definirTurmaSelecionada("");
    definirMesReferencia(mesAtual());
    definirAnoReferencia(anoAtual());
    definirDataVencimento(dataVencimentoPadrao(mesAtual(), anoAtual()));
    carregarDados();
  }

  function iniciarEdicaoMensalidade(mensalidade: MensalidadeComDetalhes) {
    definirMensalidadeEmEdicao(mensalidade);
    definirAlunoSelecionado(mensalidade.aluno_id);
    definirTurmaSelecionada(mensalidade.turma_id);
    definirMesReferencia(mensalidade.mes_referencia);
    definirAnoReferencia(mensalidade.ano_referencia);
    definirDataVencimento(mensalidade.data_vencimento);
    definirMensagem("Altere os dados da mensalidade no formulario e salve novamente.");
  }

  function cancelarEdicaoMensalidade() {
    definirMensalidadeEmEdicao(null);
    definirAlunoSelecionado("");
    definirTurmaSelecionada("");
    definirMesReferencia(mesAtual());
    definirAnoReferencia(anoAtual());
    definirDataVencimento(dataVencimentoPadrao(mesAtual(), anoAtual()));
    definirMensagem("");
  }

  async function lancarMensalidadeProximoMesAluno() {
    if (!alunoSelecionado || !turmaSelecionada || !turmaDoAlunoSelecionado) {
      definirMensagem("Selecione um aluno e uma turma para lancar o proximo mes.");
      return;
    }

    const { mes, ano } = proximoMesReferencia();
    const ultimaMensalidadePaga = mensalidades
      .filter(
        (mensalidade) =>
          mensalidade.aluno_id === alunoSelecionado &&
          mensalidade.turma_id === turmaSelecionada &&
          mensalidade.status === "Pago"
      )
      .sort((primeira, segunda) => obterDataBasePagamento(segunda).localeCompare(obterDataBasePagamento(primeira)))[0];
    const diaVencimento = ultimaMensalidadePaga
      ? Number(obterDataBasePagamento(ultimaMensalidadePaga).slice(8, 10))
      : diaVencimentoPadrao;
    const jaExiste = mensalidades.some(
      (mensalidade) =>
        mensalidade.aluno_id === alunoSelecionado &&
        mensalidade.turma_id === turmaSelecionada &&
        mensalidade.mes_referencia === mes &&
        mensalidade.ano_referencia === ano
    );

    if (jaExiste) {
      definirMensagem(`A mensalidade de ${meses[mes - 1]}/${ano} ja existe para este aluno e turma.`);
      return;
    }

    definirSalvando(true);
    const { error } = await supabase.from("financeiro").insert({
      aluno_id: alunoSelecionado,
      turma_id: turmaSelecionada,
      mes_referencia: mes,
      ano_referencia: ano,
      valor: Number(turmaDoAlunoSelecionado.valor_mensalidade),
      data_vencimento: montarDataVencimento(mes, ano, diaVencimento),
      valor_original: Number(turmaDoAlunoSelecionado.valor_mensalidade),
      valor_desconto: 0,
      status: "Pendente"
    });
    definirSalvando(false);

    if (error) return definirMensagem(`Erro ao lancar proximo mes: ${error.message}`);
    definirMensagem(`Mensalidade de ${meses[mes - 1]}/${ano} lancada para o aluno selecionado.`);
    carregarDados();
  }

  async function lancarMensalidadesProximoMesTodos() {
    const { mes, ano } = proximoMesReferencia();
    const confirmou = window.confirm(`Deseja lancar mensalidades de ${meses[mes - 1]}/${ano} para todos os alunos vinculados?`);
    if (!confirmou) return;

    const mensalidadesExistentes = new Set(
      mensalidades
        .filter((mensalidade) => mensalidade.mes_referencia === mes && mensalidade.ano_referencia === ano)
        .map((mensalidade) => `${mensalidade.aluno_id}-${mensalidade.turma_id}`)
    );

    const lancamentos = vinculos
      .map((vinculo) => {
        const aluno = alunos.find((item) => item.id === vinculo.aluno_id);
        const turma = turmas.find((item) => item.id === vinculo.turma_id);

        if (!aluno || !turma || aluno.status !== "Ativo" || turma.status !== "Ativa") return null;
        if (mensalidadesExistentes.has(`${vinculo.aluno_id}-${vinculo.turma_id}`)) return null;

        const ultimaMensalidadePaga = mensalidades
          .filter(
            (mensalidade) =>
              mensalidade.aluno_id === vinculo.aluno_id &&
              mensalidade.turma_id === vinculo.turma_id &&
              mensalidade.status === "Pago"
          )
          .sort((primeira, segunda) => obterDataBasePagamento(segunda).localeCompare(obterDataBasePagamento(primeira)))[0];
        const diaVencimento = ultimaMensalidadePaga
          ? Number(obterDataBasePagamento(ultimaMensalidadePaga).slice(8, 10))
          : diaVencimentoPadrao;

        return {
          aluno_id: vinculo.aluno_id,
          turma_id: vinculo.turma_id,
          mes_referencia: mes,
          ano_referencia: ano,
          valor: Number(turma.valor_mensalidade),
          valor_original: Number(turma.valor_mensalidade),
          valor_desconto: 0,
          data_vencimento: montarDataVencimento(mes, ano, diaVencimento),
          status: "Pendente"
        };
      })
      .filter((item): item is {
        aluno_id: string;
        turma_id: string;
        mes_referencia: number;
        ano_referencia: number;
        valor: number;
        valor_original: number;
        valor_desconto: number;
        data_vencimento: string;
        status: string;
      } => Boolean(item));

    if (lancamentos.length === 0) {
      definirMensagem(`Nenhuma mensalidade nova para lancar em ${meses[mes - 1]}/${ano}.`);
      return;
    }

    definirSalvando(true);
    const { error } = await supabase.from("financeiro").insert(lancamentos);
    definirSalvando(false);

    if (error) return definirMensagem(`Erro ao lancar mensalidades automaticas: ${error.message}`);
    definirMensagem(`${lancamentos.length} mensalidade(s) de ${meses[mes - 1]}/${ano} lancada(s) com sucesso.`);
    carregarDados();
  }

  function alterarMesReferencia(mes: number) {
    definirMesReferencia(mes);
    definirDataVencimento(dataVencimentoPadrao(mes, anoReferencia));
  }

  function alterarAnoReferencia(ano: number) {
    definirAnoReferencia(ano);
    definirDataVencimento(dataVencimentoPadrao(mesReferencia, ano));
  }

  async function registrarPagamento(mensalidade: MensalidadeComDetalhes) {
    definirSalvando(true);
    const { error } = await supabase
      .from("financeiro")
      .update({
        status: "Pago",
        data_pagamento: dataAtualIso(),
        forma_pagamento: "Nao informado",
        valor_pago: mensalidade.valor,
        valor_original: mensalidade.valor_original ?? mensalidade.valor,
        valor_desconto: mensalidade.valor_desconto ?? 0
      })
      .eq("id", mensalidade.id);

    definirSalvando(false);
    if (error) return definirMensagem(`Erro ao registrar pagamento: ${error.message}`);
    definirMensagem("Pagamento registrado com sucesso.");
    carregarDados();
  }

  async function cancelarMensalidade(mensalidade: MensalidadeComDetalhes) {
    if (mensalidade.pagamento_antecipado_id) {
      definirMensagem("Esta mensalidade pertence a um pagamento antecipado. Abra os detalhes do lote para realizar o cancelamento controlado.");
      return;
    }
    const confirmou = window.confirm(
      `Deseja cancelar a mensalidade de ${mensalidade.alunos?.nome_completo ?? "aluno"} referente a ${meses[mensalidade.mes_referencia - 1]}/${mensalidade.ano_referencia}?`
    );
    if (!confirmou) return;

    definirSalvando(true);
    const { error } = await supabase
      .from("financeiro")
      .update({
        status: "Cancelado",
        data_pagamento: null,
        forma_pagamento: null
      })
      .eq("id", mensalidade.id);
    definirSalvando(false);

    if (error) return definirMensagem(`Erro ao cancelar mensalidade: ${error.message}`);
    definirMensagem("Mensalidade cancelada com sucesso.");
    carregarDados();
  }

  async function marcarAtrasadas() {
    definirSalvando(true);
    const hoje = dataAtualIso();
    const { error } = await supabase
      .from("financeiro")
      .update({ status: "Atrasado" })
      .lt("data_vencimento", hoje)
      .neq("status", "Pago")
      .neq("status", "Cancelado");

    definirSalvando(false);
    if (error) return definirMensagem(`Erro ao atualizar atrasadas: ${error.message}`);
    definirMensagem("Mensalidades vencidas foram marcadas como atrasadas.");
    carregarDados();
  }

  function navegarParaAba(aba: Aba) {
    definirAbaAtiva(aba);
    definirMenuTurmasAberto(false);
    definirMenuFinanceiroAberto(false);
    definirAcoesRapidasAbertas(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!supabaseConfigurado) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-10">
        <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-suave">
          <h1 className="text-2xl font-bold text-tinta">CTDemar Financeiro</h1>
          <p className="mt-3 text-sm text-slate-700">
            Configure o Supabase antes de usar o sistema. Crie um arquivo <strong>.env.local</strong> com as chaves do
            projeto ctDemar seguindo o exemplo de <strong>.env.example</strong>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden px-3 pb-32 pt-3 sm:px-5 sm:py-4 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="surface-card flex items-center justify-between gap-3 px-3 py-2.5 backdrop-blur sm:p-4">
          <div>
            <p className="text-[0.68rem] font-bold uppercase text-destaque sm:text-sm">CTDEMAR</p>
            <h1 className="text-lg font-extrabold leading-tight text-tinta sm:mt-1 sm:text-3xl">Controle Financeiro</h1>
          </div>
          <button
            onClick={carregarDados}
            className="group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tinta text-white shadow-sm hover:bg-destaque active:scale-95 focus:outline-none focus:ring-2 focus:ring-destaque focus:ring-offset-2 sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2 sm:text-sm sm:font-semibold"
            title="Atualizar dados"
            aria-label="Atualizar dados"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />}
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </header>

        <nav className="mt-2 grid grid-cols-4 gap-1.5 rounded-xl border border-black/10 bg-white/80 p-1.5 shadow-suave sm:hidden">
          {abasPrincipaisMobile.map(({ id, rotulo, Icone }) => (
            <button
              key={id}
              onClick={() => {
                if (id === "turmas") {
                  definirAbaAtiva("turmas");
                  definirMenuTurmasAberto((aberto) => !aberto);
                  definirMenuFinanceiroAberto(false);
                  return;
                }

                navegarParaAba(id);
              }}
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-[0.68rem] font-bold ${
                (id === "turmas" ? ["turmas", "vinculos"].includes(abaAtiva) : abaAtiva === id)
                  ? "border-destaque bg-destaque text-white shadow-sm"
                  : "border-transparent bg-transparent text-slate-700 hover:bg-teal-50"
              }`}
            >
              <Icone className="h-4 w-4" />
              {rotulo}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              definirMenuFinanceiroAberto((aberto) => !aberto);
              definirMenuTurmasAberto(false);
            }}
            className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-[0.68rem] font-bold ${
              ["mensalidades", "pagas", "canceladas", "inadimplentes"].includes(abaAtiva)
                ? "border-destaque bg-destaque text-white shadow-sm"
                : "border-transparent bg-transparent text-slate-700 hover:bg-teal-50"
            }`}
          >
            <Banknote className="h-4 w-4" />
            Financeiro
          </button>
        </nav>

        {menuTurmasAberto && (
          <div className="mt-2 rounded-xl border border-black/10 bg-white p-1.5 shadow-suave sm:hidden">
            <button
              type="button"
              onClick={() => navegarParaAba("vinculos")}
              className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                abaAtiva === "vinculos"
                  ? "border-destaque bg-teal-50 text-destaque"
                  : "border-black/10 bg-white text-slate-700"
              }`}
            >
              <LinkIcon className="h-4 w-4" />
              Vinculos
            </button>
          </div>
        )}

        {menuFinanceiroAberto && (
          <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-black/10 bg-white p-1.5 shadow-suave sm:hidden">
            {abasFinanceiroMobile.map(({ id, rotulo, Icone }) => (
              <button
                key={id}
                onClick={() => navegarParaAba(id)}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-semibold ${
                  abaAtiva === id
                    ? "border-destaque bg-teal-50 text-destaque"
                    : "border-black/10 bg-white text-slate-700"
                }`}
              >
                <Icone className="h-4 w-4" />
                {rotulo}
              </button>
            ))}
          </div>
        )}

        <nav className="mt-4 hidden grid-cols-4 gap-2 sm:grid lg:grid-cols-8">
          {abas.map(({ id, rotulo, Icone }) => (
            <button
              key={id}
              onClick={() => navegarParaAba(id)}
              className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-semibold ${
                abaAtiva === id
                  ? "border-destaque bg-destaque text-white"
                  : "border-black/10 bg-white text-slate-700 hover:border-destaque"
              }`}
            >
              <Icone className="h-4 w-4" />
              {rotulo}
            </button>
          ))}
        </nav>

        {mensagem && (
          <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
            {mensagem}
          </div>
        )}

        <section key={abaAtiva} className="animate-tab-in mt-3 sm:mt-5">
          {abaAtiva === "dashboard" && (
            <div className="space-y-2.5 sm:space-y-4">
              {carregando && (
                <div className="grid grid-cols-3 gap-2 sm:hidden" aria-label="Carregando resumo">
                  <div className="skeleton h-16 rounded-xl" />
                  <div className="skeleton h-16 rounded-xl" />
                  <div className="skeleton h-16 rounded-xl" />
                </div>
              )}

              <div className="surface-card px-3 py-2.5 sm:hidden">
                <div className="grid grid-cols-3 divide-x divide-black/10 text-center">
                  <div className="px-1">
                    <Users className="mx-auto mb-1 h-3.5 w-3.5 text-destaque" />
                    <p className="text-xl font-extrabold leading-none text-slate-950">{quantidadeAlunosAtivos}</p>
                    <p className="mt-1 text-[0.68rem] font-semibold text-slate-500">ativos</p>
                  </div>
                  <div className="px-1">
                    <CheckCircle2 className="mx-auto mb-1 h-3.5 w-3.5 text-destaque" />
                    <p className="text-base font-extrabold leading-none text-teal-950">{formatarMoeda(resumo.total_recebido)}</p>
                    <p className="mt-1 text-[0.68rem] font-semibold text-slate-500">recebidos</p>
                  </div>
                  <div className="px-1">
                    <AlertCircle className="mx-auto mb-1 h-3.5 w-3.5 text-red-700" />
                    <p className="text-xl font-extrabold leading-none text-red-950">{quantidadeAlunosInadimplentes}</p>
                    <p className="mt-1 text-[0.68rem] font-semibold text-slate-500">inadimplentes</p>
                  </div>
                </div>
              </div>

              <div className="surface-card flex items-start gap-2 px-3 py-2 text-xs font-semibold text-slate-700 sm:hidden">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-destaque" />
                <p className="leading-relaxed">{resumoContextualDashboard}</p>
              </div>

              <InstallAppBanner controle={controleInstalacao} />
              {controleInstalacao.mensagem && (
                <p className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-900 sm:hidden">
                  {controleInstalacao.mensagem}
                </p>
              )}
              <div className="sm:hidden">
                <InstallAppHelpButton controle={controleInstalacao} />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:hidden">
                <CartaoResumo rotulo="Recebido" valor={formatarMoeda(resumo.total_recebido)} tom="verde" Icone={CheckCircle2} />
                <CartaoResumo rotulo="Receita prevista" valor={formatarMoeda(resumo.receita_prevista_mes)} tom="azul" Icone={Banknote} />
                <CartaoResumo rotulo="Pendente" valor={formatarMoeda(resumo.total_pendente)} tom="amarelo" Icone={AlertCircle} />
                <CartaoResumo rotulo="Inadimplentes" valor={String(quantidadeAlunosInadimplentes)} tom="vermelho" Icone={Users} />
              </div>

              <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-5">
                <CartaoResumo rotulo="Recebido" valor={formatarMoeda(resumo.total_recebido)} tom="verde" Icone={CheckCircle2} />
                <CartaoResumo rotulo="Receita prevista" valor={formatarMoeda(resumo.receita_prevista_mes)} tom="azul" Icone={Banknote} />
                <CartaoResumo rotulo="Receita recebida" valor={percentualReceitaRecebida} tom="verde" Icone={CheckCircle2} />
                <CartaoResumo rotulo="Receita perdida" valor={formatarMoeda(receitaPerdidaMes)} tom="vermelho" Icone={XCircle} />
                <CartaoResumo rotulo="Pendente" valor={formatarMoeda(resumo.total_pendente)} tom="amarelo" Icone={AlertCircle} />
                <CartaoResumo rotulo="Atrasado" valor={formatarMoeda(resumo.total_atrasado)} tom="vermelho" Icone={AlertCircle} />
                <CartaoResumo rotulo="Inadimplentes" valor={String(quantidadeAlunosInadimplentes)} tom="vermelho" Icone={Users} />
                <CartaoResumo rotulo="Taxa inadimplencia" valor={taxaInadimplencia} tom="vermelho" Icone={AlertCircle} />
                <CartaoResumo rotulo="Novos alunos" valor={String(resumo.novos_alunos_mes)} tom="azul" Icone={CalendarPlus} />
                <CartaoResumo rotulo="Alunos cancelados" valor={String(resumo.alunos_cancelados_mes)} tom="vermelho" Icone={CircleX} />
              </div>

              <GraficoReceita dados={receitaUltimosSeisMeses} totalPeriodo={totalReceitaPeriodo} />

              <div className="surface-card border-amber-200 bg-amber-50/80 p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-amber-900">Atencao operacional</p>
                    <h2 className="text-base font-extrabold text-amber-950 sm:text-lg">Alertas</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(textoAlertasDashboard);
                      definirMensagem("Alertas copiados com sucesso.");
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-900 hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                    title="Copiar alertas"
                    aria-label="Copiar alertas"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <LinhaAlerta Icone={AlertCircle} titulo="Hoje" valor={`${alertasDashboard.mensalidadesVencemHoje} mensalidades vencem hoje`} tom="amber" />
                  <LinhaAlerta Icone={AlertCircle} titulo="Atrasados" valor={`${alertasDashboard.alunosAtrasadosMaisDeQuinzeDias} alunos ha mais de 15 dias`} tom="red" />
                  <LinhaAlerta Icone={Gift} titulo="Amanha" valor={`${alertasDashboard.aniversariantesAmanha} aniversariantes`} tom="teal" />
                </div>
              </div>

              <div className="surface-card p-3 sm:p-4">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Alunos vinculados</p>
                    <h2 className="text-base font-extrabold text-slate-950 sm:text-lg">Ocupacao das turmas</h2>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-50 text-sky-800">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                </div>

                {ocupacaoTurmas.length === 0 && (
                  <p className="rounded-md border border-black/10 bg-slate-50 p-3 text-sm text-slate-600">
                    Nenhuma turma cadastrada.
                  </p>
                )}

                {ocupacaoTurmas.length > 0 && (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {ocupacaoTurmas.map(({ turma, quantidade }) => {
                      const capacidadeTurma = Number(turma.capacidade_alunos ?? capacidadePadraoTurma) || capacidadePadraoTurma;
                      const percentualOcupacao = Math.min(Math.round((quantidade / capacidadeTurma) * 100), 100);
                      return (
                      <article key={turma.id} className="rounded-lg border border-black/10 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-extrabold text-slate-950">{turma.nome}</h3>
                          <strong className="rounded-full bg-white px-2 py-1 text-xs text-slate-900">{quantidade} / {capacidadeTurma} alunos</strong>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                          <span>{turma.dias_semana || "Dias nao informados"} | {turma.horario || "Horario nao informado"}</span>
                          <span>{percentualOcupacao}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-destaque transition-[width] duration-500"
                            style={{ width: `${percentualOcupacao}%` }}
                          />
                        </div>
                      </article>
                    );
                    })}
                  </div>
                )}
              </div>

              <div className="surface-card p-3 sm:p-4">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Este mes</p>
                    <h2 className="text-base font-extrabold text-slate-950 sm:text-lg">Aniversariantes</h2>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-destaque">
                    <Gift className="h-5 w-5" />
                  </div>
                </div>

                {aniversariantesDoMes.length === 0 && (
                  <p className="rounded-md border border-black/10 bg-slate-50 p-3 text-sm text-slate-600">
                    Nenhum aniversariante cadastrado para este mes.
                  </p>
                )}

                {aniversariantesDoMes.length > 0 && (
                  <div className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {aniversariantesDoMes.map((aluno) => (
                      <article key={aluno.id} className="flex min-w-0 w-full items-center justify-between gap-3 rounded-lg border border-black/10 bg-slate-50 p-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-extrabold text-slate-950">{aluno.nome_completo}</h3>
                          {aluno.telefone && <p className="truncate mt-0.5 text-xs font-medium text-slate-500">{aluno.telefone}</p>}
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1.5 text-xs font-extrabold text-destaque">
                          <Gift className="h-3.5 w-3.5" />
                          {formatarDiaMes(aluno.data_nascimento ?? "")}
                        </span>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="sm:hidden">
                <button
                  type="button"
                  onClick={() => definirIndicadoresExpandidos((expandido) => !expandido)}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-white/80 px-3 py-1.5 text-sm font-bold text-slate-700 shadow-sm hover:border-destaque focus:outline-none focus:ring-2 focus:ring-destaque focus:ring-offset-2"
                  aria-expanded={indicadoresExpandidos}
                >
                  {indicadoresExpandidos ? "Ver menos indicadores" : "Mais indicadores"}
                  <ChevronDown className={`h-4 w-4 transition-transform ${indicadoresExpandidos ? "rotate-180" : ""}`} />
                </button>

                <div className={`grid overflow-hidden transition-all duration-300 ${indicadoresExpandidos ? "mt-2 max-h-[420px] grid-cols-2 gap-2 opacity-100" : "max-h-0 grid-cols-2 gap-2 opacity-0"}`}>
                  <CartaoResumo rotulo="Receita recebida" valor={percentualReceitaRecebida} tom="verde" Icone={CheckCircle2} />
                  <CartaoResumo rotulo="Receita perdida" valor={formatarMoeda(receitaPerdidaMes)} tom="vermelho" Icone={XCircle} />
                  <CartaoResumo rotulo="Atrasado" valor={formatarMoeda(resumo.total_atrasado)} tom="vermelho" Icone={AlertCircle} />
                  <CartaoResumo rotulo="Taxa inadimplencia" valor={taxaInadimplencia} tom="vermelho" Icone={AlertCircle} />
                  <CartaoResumo rotulo="Novos alunos" valor={String(resumo.novos_alunos_mes)} tom="azul" Icone={CalendarPlus} />
                  <CartaoResumo rotulo="Alunos cancelados" valor={String(resumo.alunos_cancelados_mes)} tom="vermelho" Icone={CircleX} />
                </div>
              </div>
            </div>
          )}

          {abaAtiva === "alunos" && (
            <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
              <Formulario titulo={alunoEmEdicao ? "Alterar aluno" : "Cadastrar aluno"} onSubmit={salvarAluno}>
                <SecaoFormulario titulo="Dados pessoais">
                  <Campo rotulo="Nome completo" obrigatorio>
                    <input className="campo" value={formAluno.nome_completo} onChange={(e) => definirFormAluno({ ...formAluno, nome_completo: e.target.value })} required />
                  </Campo>
                  <Campo rotulo="Telefone">
                    <input className="campo" value={formAluno.telefone} onChange={(e) => definirFormAluno({ ...formAluno, telefone: e.target.value })} />
                  </Campo>
                  <Campo rotulo="Data de nascimento">
                    <input className="campo" type="date" value={formAluno.data_nascimento} onChange={(e) => definirFormAluno({ ...formAluno, data_nascimento: e.target.value })} />
                  </Campo>
                </SecaoFormulario>
                <SecaoFormulario titulo="Dados da academia">
                  <Campo rotulo="Data de matricula" obrigatorio>
                    <input className="campo" type="date" value={formAluno.data_matricula} onChange={(e) => definirFormAluno({ ...formAluno, data_matricula: e.target.value })} required />
                  </Campo>
                  <Campo rotulo="Cor da faixa">
                    <select
                      className="campo"
                      value={formAluno.cor_faixa}
                      onChange={(e) => definirFormAluno({ ...formAluno, cor_faixa: e.target.value as CorFaixa })}
                    >
                      {faixasAlunos.map((faixa) => (
                        <option key={faixa.valor} value={faixa.valor}>
                          {faixa.rotulo}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo rotulo="Status do aluno">
                    <select
                      className="campo"
                      value={formAluno.status}
                      onChange={(e) => definirFormAluno({ ...formAluno, status: e.target.value })}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Cancelado</option>
                    </select>
                  </Campo>
                </SecaoFormulario>
                <SecaoFormulario titulo="Observacoes">
                  <Campo rotulo="Observacoes">
                    <textarea className="campo min-h-20" value={formAluno.observacoes} onChange={(e) => definirFormAluno({ ...formAluno, observacoes: e.target.value })} />
                  </Campo>
                </SecaoFormulario>
                <BotaoSalvar salvando={salvando} texto={alunoEmEdicao ? "Salvar alteracao" : "Salvar aluno"} />
                {alunoEmEdicao && (
                  <button
                    type="button"
                    onClick={cancelarEdicaoAluno}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancelar alteracao
                  </button>
                )}
              </Formulario>
              <PainelLista titulo="Alunos cadastrados">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input className="campo pl-9" placeholder="Buscar aluno" value={busca} onChange={(e) => definirBusca(e.target.value)} />
                </div>
                {alunosFiltrados.length === 0 && (
                  <p className="rounded-md border border-black/10 bg-slate-50 p-3 text-sm text-slate-600">
                    Nenhum aluno encontrado.
                  </p>
                )}
                {alunosPaginados.map((aluno) => (
                  <article
                    key={aluno.id}
                    className={`cartao-interativo mb-2 rounded-xl border p-3 shadow-sm ${
                      alunoEmEdicao?.id === aluno.id ? "border-destaque bg-teal-50" : "border-black/10 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2 sm:block">
                          <h3 className="min-w-0 text-sm font-extrabold leading-snug text-slate-950 sm:text-base">{aluno.nome_completo}</h3>
                          <Etiqueta status={aluno.status === "Inativo" ? "Cancelado" : "Ativo"} />
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {aluno.telefone ?? "Sem telefone"} | Matricula: {formatarData(aluno.data_matricula)}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <span className={`h-2.5 w-2.5 rounded-full border ${corFaixaClasse(aluno.cor_faixa)}`} aria-hidden="true" />
                          Faixa: {faixasAlunos.find((faixa) => faixa.valor === aluno.cor_faixa)?.rotulo ?? "Branca ⚪"}
                        </p>
                        <p className="sr-only">
                          Status: {aluno.status === "Inativo" ? "Cancelado" : "Ativo"}
                        </p>
                      </div>
                      <div className="flex gap-2 sm:self-end">
                        <button
                          type="button"
                          onClick={() => iniciarEdicaoAluno(aluno)}
                          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-destaque bg-white px-2.5 py-1.5 text-xs font-bold text-destaque sm:flex-none"
                        >
                          <Pencil className="h-4 w-4" />
                          Alterar
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirAluno(aluno)}
                          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-700 sm:flex-none"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                <Paginacao
                  paginaAtual={paginaAlunos}
                  totalItens={alunosFiltrados.length}
                  itensPorPagina={itensPorPagina}
                  alterarPagina={definirPaginaAlunos}
                />
              </PainelLista>
            </div>
          )}

          {abaAtiva === "turmas" && (
            <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
              <Formulario titulo={turmaEmEdicao ? "Alterar turma" : "Cadastrar turma"} onSubmit={salvarTurma}>
                <SecaoFormulario titulo="Dados da turma">
                  <Campo rotulo="Nome da turma" obrigatorio>
                    <input className="campo" value={formTurma.nome} onChange={(e) => definirFormTurma({ ...formTurma, nome: e.target.value })} required />
                  </Campo>
                  <Campo rotulo="Dias da semana">
                    <input className="campo" value={formTurma.dias_semana} onChange={(e) => definirFormTurma({ ...formTurma, dias_semana: e.target.value })} />
                  </Campo>
                  <Campo rotulo="Horario">
                    <input className="campo" value={formTurma.horario} onChange={(e) => definirFormTurma({ ...formTurma, horario: e.target.value })} />
                  </Campo>
                  <Campo rotulo="Valor da mensalidade" obrigatorio>
                    <input className="campo" type="number" min="0" step="0.01" value={formTurma.valor_mensalidade} onChange={(e) => definirFormTurma({ ...formTurma, valor_mensalidade: e.target.value })} required />
                  </Campo>
                  <Campo rotulo="Capacidade de alunos" obrigatorio>
                    <input
                      className="campo"
                      type="number"
                      min="1"
                      step="1"
                      value={formTurma.capacidade_alunos}
                      onChange={(e) => definirFormTurma({ ...formTurma, capacidade_alunos: e.target.value })}
                      required
                    />
                  </Campo>
                </SecaoFormulario>
                <BotaoSalvar salvando={salvando} texto={turmaEmEdicao ? "Salvar alteracao" : "Salvar turma"} />
                {turmaEmEdicao && (
                  <button
                    type="button"
                    onClick={cancelarEdicaoTurma}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancelar alteracao
                  </button>
                )}
              </Formulario>
              <PainelLista titulo="Turmas cadastradas">
                {turmas.length === 0 && (
                  <p className="rounded-md border border-black/10 bg-slate-50 p-3 text-sm text-slate-600">
                    Nenhuma turma cadastrada.
                  </p>
                )}
                {turmasPaginadas.map((turma) => (
                  <article
                    key={turma.id}
                    className={`cartao-interativo mb-2 rounded-xl border p-3 shadow-sm ${
                      turmaEmEdicao?.id === turma.id ? "border-destaque bg-teal-50" : "border-black/10 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="min-w-0 text-sm font-extrabold leading-snug text-slate-950 sm:text-base">{turma.nome}</h3>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-teal-50 px-2 py-1 text-xs font-bold text-destaque">
                            <Users className="h-3.5 w-3.5" />
                            {vinculos.filter((vinculo) => vinculo.turma_id === turma.id).length} / {turma.capacidade_alunos ?? capacidadePadraoTurma}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {turma.dias_semana ?? "Dias nao informados"} | {turma.horario ?? "Horario nao informado"}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-2 py-1 text-xs font-bold text-destaque">
                          <Banknote className="h-3.5 w-3.5" />
                          {formatarMoeda(Number(turma.valor_mensalidade))}
                        </span>
                        <span className="ml-1 mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600">
                          <Users className="h-3.5 w-3.5" />
                          Capacidade: {turma.capacidade_alunos ?? capacidadePadraoTurma}
                        </span>
                      </div>
                      <div className="flex gap-2 sm:self-end">
                        <button
                          type="button"
                          onClick={() => iniciarEdicaoTurma(turma)}
                          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-destaque bg-white px-2.5 py-1.5 text-xs font-bold text-destaque sm:flex-none"
                        >
                          <Pencil className="h-4 w-4" />
                          Alterar
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirTurma(turma)}
                          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-700 sm:flex-none"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                <Paginacao
                  paginaAtual={paginaTurmas}
                  totalItens={turmas.length}
                  itensPorPagina={itensPorPagina}
                  alterarPagina={definirPaginaTurmas}
                />
              </PainelLista>
            </div>
          )}

          {abaAtiva === "vinculos" && (
            <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
              <Formulario titulo={vinculoEmEdicao ? "Alterar vinculo" : "Vincular aluno a turma"} onSubmit={vincularAlunoTurma}>
                <SelecaoAluno valor={alunoSelecionado} alterar={definirAlunoSelecionado} alunos={alunos} />
                <SelecaoTurma valor={turmaSelecionada} alterar={definirTurmaSelecionada} turmas={turmas} />
                <BotaoSalvar salvando={salvando} texto={vinculoEmEdicao ? "Salvar alteracao" : "Vincular"} />
                {vinculoEmEdicao && (
                  <button
                    type="button"
                    onClick={cancelarEdicaoVinculo}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    Cancelar alteracao
                  </button>
                )}
              </Formulario>
              <PainelLista titulo="Vinculos cadastrados">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    className="campo pl-9"
                    placeholder="Buscar por aluno, telefone ou turma"
                    value={buscaVinculo}
                    onChange={(e) => definirBuscaVinculo(e.target.value)}
                  />
                </div>
                {vinculosFiltrados.length === 0 && (
                  <p className="rounded-md border border-black/10 bg-slate-50 p-3 text-sm text-slate-600">
                    Nenhum vinculo encontrado.
                  </p>
                )}
                {vinculosPaginados.map(({ vinculo, aluno, turma }) => {
                  return (
                    <article
                      key={vinculo.id}
                      className={`mb-3 rounded-md border p-3 ${
                        vinculoEmEdicao?.id === vinculo.id
                          ? "border-destaque bg-teal-50"
                          : "border-black/10 bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-semibold">{aluno?.nome_completo ?? "Aluno nao encontrado"}</h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {turma?.nome ?? "Turma nao encontrada"} | Vinculado em: {formatarData(vinculo.created_at.slice(0, 10))}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => iniciarEdicaoVinculo(vinculo)}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-destaque bg-white px-3 py-2 text-sm font-semibold text-destaque"
                          >
                            <Pencil className="h-4 w-4" />
                            Alterar
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirVinculo(vinculo)}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                <Paginacao
                  paginaAtual={paginaVinculos}
                  totalItens={vinculosFiltrados.length}
                  itensPorPagina={itensPorPagina}
                  alterarPagina={definirPaginaVinculos}
                />
              </PainelLista>
            </div>
          )}

          {abaAtiva === "mensalidades" && (
            <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
              <Formulario titulo={mensalidadeEmEdicao ? "Alterar mensalidade" : "Lancar mensalidade"} onSubmit={lancarMensalidade}>
                <SelecaoAluno valor={alunoSelecionado} alterar={definirAlunoSelecionado} alunos={alunos} />
                <SelecaoTurma valor={turmaSelecionada} alterar={definirTurmaSelecionada} turmas={turmas} />
                <Campo rotulo="Mes de referencia">
                  <select className="campo" value={mesReferencia} onChange={(e) => alterarMesReferencia(Number(e.target.value))}>
                    {meses.map((mes, indice) => (
                      <option key={mes} value={indice + 1}>{mes}</option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Ano de referencia">
                  <input className="campo" type="number" value={anoReferencia} onChange={(e) => alterarAnoReferencia(Number(e.target.value))} />
                </Campo>
                <Campo rotulo="Data de vencimento">
                  <input className="campo" type="date" value={dataVencimento} onChange={(e) => definirDataVencimento(e.target.value)} />
                </Campo>
                <BotaoSalvar salvando={salvando} texto={mensalidadeEmEdicao ? "Salvar alteracao" : "Lancar mensalidade"} />
                {mensalidadeEmEdicao && (
                  <button
                    type="button"
                    onClick={cancelarEdicaoMensalidade}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar alteracao
                  </button>
                )}
                {!mensalidadeEmEdicao && (
                  <div className="rounded-md border border-teal-100 bg-teal-50 p-3">
                    <p className="mb-3 text-sm font-semibold text-teal-900">Lancamento automatico do proximo mes</p>
                    <div className="grid gap-2">
                      <button
                        type="button"
                        onClick={abrirPagamentoAntecipado}
                        disabled={salvando}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-destaque px-3 py-2 text-sm font-semibold text-white"
                      >
                        <ClipboardList className="h-4 w-4" />
                        Pagamento antecipado
                      </button>
                      <button
                        type="button"
                        onClick={lancarMensalidadeProximoMesAluno}
                        disabled={salvando}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-destaque bg-white px-3 py-2 text-sm font-semibold text-destaque"
                      >
                        <PlusCircle className="h-4 w-4" />
                        Proximo mes do aluno
                      </button>
                      <button
                        type="button"
                        onClick={lancarMensalidadesProximoMesTodos}
                        disabled={salvando}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-tinta px-3 py-2 text-sm font-semibold text-white"
                      >
                        <PlusCircle className="h-4 w-4" />
                        Proximo mes de todos
                      </button>
                    </div>
                  </div>
                )}
              </Formulario>
              <PainelLista titulo="Mensalidades">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    className="campo pl-9"
                    placeholder="Buscar por aluno"
                    value={buscaMensalidade}
                    onChange={(e) => definirBuscaMensalidade(e.target.value)}
                  />
                </div>
                <button onClick={marcarAtrasadas} className="mb-3 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  <CalendarPlus className="h-4 w-4" />
                  Marcar vencidas como atrasadas
                </button>
                {mensalidadesFiltradas.length === 0 && (
                  <p className="rounded-md border border-black/10 bg-slate-50 p-3 text-sm text-slate-600">
                    Nenhuma mensalidade encontrada.
                  </p>
                )}
                {mensalidadesPaginadas.map((mensalidade) => (
                  <article
                    key={mensalidade.id}
                    className={`mb-3 rounded-md border p-3 ${
                      mensalidadeEmEdicao?.id === mensalidade.id ? "border-destaque bg-teal-50" : "border-black/10 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{mensalidade.alunos?.nome_completo ?? "Aluno nao encontrado"}</h3>
                        <p className="text-sm text-slate-600">
                          {mensalidade.turmas?.nome ?? "Turma nao encontrada"} | {meses[mensalidade.mes_referencia - 1]}/{mensalidade.ano_referencia} | Vence em {formatarData(mensalidade.data_vencimento)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{formatarMoeda(Number(mensalidade.valor))}</span>
                        <Etiqueta status={mensalidade.status} />
                        {mensalidade.pagamento_antecipado_id && (
                          <button type="button" onClick={() => abrirDetalheAntecipado(mensalidade.pagamento_antecipado_id!)} className="rounded-full bg-sky-100 px-2.5 py-1 text-[0.68rem] font-extrabold uppercase text-sky-800">
                            Pagamento antecipado
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => iniciarEdicaoMensalidade(mensalidade)}
                          className="inline-flex items-center gap-2 rounded-md border border-destaque bg-white px-3 py-2 text-sm font-semibold text-destaque"
                        >
                          <Pencil className="h-4 w-4" />
                          Alterar
                        </button>
                        {mensalidade.status !== "Pago" && mensalidade.status !== "Cancelado" && (
                          <button onClick={() => registrarPagamento(mensalidade)} className="inline-flex items-center gap-2 rounded-md bg-destaque px-3 py-2 text-sm font-semibold text-white">
                            <CheckCircle2 className="h-4 w-4" />
                            Pago
                          </button>
                        )}
                        {mensalidade.status !== "Cancelado" && (
                          <button
                            onClick={() => cancelarMensalidade(mensalidade)}
                            className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
                <Paginacao
                  paginaAtual={paginaMensalidades}
                  totalItens={mensalidadesFiltradas.length}
                  itensPorPagina={itensPorPagina}
                  alterarPagina={definirPaginaMensalidades}
                />
              </PainelLista>
            </div>
          )}

          {abaAtiva === "pagas" && (
            <PainelLista titulo="Mensalidades pagas">
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  className="campo pl-9"
                  placeholder="Buscar por aluno"
                  value={buscaPagas}
                  onChange={(e) => definirBuscaPagas(e.target.value)}
                />
              </div>
              {mensalidadesPagasFiltradas.length === 0 && (
                <p className="rounded-md border border-black/10 bg-slate-50 p-3 text-sm text-slate-600">
                  Nenhuma mensalidade paga encontrada.
                </p>
              )}
              {mensalidadesPagasPaginadas.map((mensalidade) => {
                const telefone = numeroWhatsapp(mensalidade.alunos?.telefone ?? null);
                const texto = encodeURIComponent(
                  `Ola, ${mensalidade.alunos?.nome_completo ?? "aluno"}. Recebemos o pagamento da mensalidade de ${meses[mensalidade.mes_referencia - 1]}/${mensalidade.ano_referencia} do CTDemar. Turma: ${mensalidade.turmas?.nome ?? "nao informada"}. Valor: ${formatarMoeda(Number(mensalidade.valor))}. Data do pagamento: ${formatarData(mensalidade.data_pagamento)}. Obrigado!`
                );

                return (
                  <article key={mensalidade.id} className="mb-3 rounded-md border border-black/10 bg-white p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{mensalidade.alunos?.nome_completo ?? "Aluno nao encontrado"}</h3>
                        <p className="text-sm text-slate-600">
                          {mensalidade.turmas?.nome ?? "Turma nao encontrada"} | {meses[mensalidade.mes_referencia - 1]}/{mensalidade.ano_referencia} | Vence em {formatarData(mensalidade.data_vencimento)}
                        </p>
                        <p className="text-sm text-slate-600">Pago em {formatarData(mensalidade.data_pagamento)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{formatarMoeda(Number(mensalidade.valor))}</span>
                        <Etiqueta status={mensalidade.status} />
                        {mensalidade.pagamento_antecipado_id && <button type="button" onClick={() => abrirDetalheAntecipado(mensalidade.pagamento_antecipado_id!)} className="rounded-full bg-sky-100 px-2.5 py-1 text-[0.68rem] font-extrabold uppercase text-sky-800">Pagamento antecipado</button>}
                        <a
                          href={telefone ? `https://wa.me/55${telefone}?text=${texto}` : "#"}
                          target="_blank"
                          className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white ${
                            telefone ? "bg-[#128c7e]" : "pointer-events-none bg-slate-300"
                          }`}
                          aria-disabled={!telefone}
                        >
                          <MessageCircle className="h-4 w-4" />
                          Enviar recibo
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
              <Paginacao
                paginaAtual={paginaPagas}
                totalItens={mensalidadesPagasFiltradas.length}
                itensPorPagina={itensPorPagina}
                alterarPagina={definirPaginaPagas}
              />
            </PainelLista>
          )}

          {abaAtiva === "canceladas" && (
            <PainelLista titulo="Mensalidades canceladas">
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  className="campo pl-9"
                  placeholder="Buscar por aluno"
                  value={buscaCanceladas}
                  onChange={(e) => definirBuscaCanceladas(e.target.value)}
                />
              </div>
              {mensalidadesCanceladasFiltradas.length === 0 && (
                <p className="rounded-md border border-black/10 bg-slate-50 p-3 text-sm text-slate-600">
                  Nenhuma mensalidade cancelada encontrada.
                </p>
              )}
              {mensalidadesCanceladasPaginadas.map((mensalidade) => (
                <article key={mensalidade.id} className="mb-3 rounded-md border border-black/10 bg-white p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{mensalidade.alunos?.nome_completo ?? "Aluno nao encontrado"}</h3>
                      <p className="text-sm text-slate-600">
                        {mensalidade.turmas?.nome ?? "Turma nao encontrada"} | {meses[mensalidade.mes_referencia - 1]}/{mensalidade.ano_referencia} | Vence em {formatarData(mensalidade.data_vencimento)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{formatarMoeda(Number(mensalidade.valor))}</span>
                      <Etiqueta status={mensalidade.status} />
                    </div>
                  </div>
                </article>
              ))}
              <Paginacao
                paginaAtual={paginaCanceladas}
                totalItens={mensalidadesCanceladasFiltradas.length}
                itensPorPagina={itensPorPagina}
                alterarPagina={definirPaginaCanceladas}
              />
            </PainelLista>
          )}

          {abaAtiva === "inadimplentes" && (
            <PainelLista titulo="Relatorio de inadimplentes">
              <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                O relatorio mostra apenas mensalidades marcadas com status Atrasado.
              </p>
              {inadimplencias.length === 0 && (
                <p className="rounded-md border border-black/10 bg-slate-50 p-3 text-sm text-slate-600">
                  Nenhuma inadimplencia encontrada.
                </p>
              )}
              {inadimplencias.map((inadimplencia) => {
                const telefone = numeroWhatsapp(inadimplencia.telefone);
                const texto = encodeURIComponent(`Ola, ${inadimplencia.nome_aluno}. Identificamos a mensalidade de ${meses[inadimplencia.mes_referencia - 1]}/${inadimplencia.ano_referencia} em aberto no CTDemar. Valor: ${formatarMoeda(Number(inadimplencia.valor))}.`);
                return (
                  <article key={inadimplencia.id} className="mb-3 rounded-md border border-red-100 bg-white p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{inadimplencia.nome_aluno}</h3>
                        <p className="text-sm text-slate-600">
                          {inadimplencia.nome_turma} | {meses[inadimplencia.mes_referencia - 1]}/{inadimplencia.ano_referencia} | {formatarMoeda(Number(inadimplencia.valor))} | vencimento {formatarData(inadimplencia.data_vencimento)}
                        </p>
                        <Etiqueta status={inadimplencia.status} />
                      </div>
                      <a
                        href={telefone ? `https://wa.me/55${telefone}?text=${texto}` : "#"}
                        target="_blank"
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-[#128c7e] px-3 py-2 text-sm font-semibold text-white"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Cobrar no WhatsApp
                      </a>
                    </div>
                  </article>
                );
              })}
            </PainelLista>
          )}
        </section>
      </div>

      {abaAtiva === "dashboard" && (
        <>
        {acoesRapidasAbertas && (
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default bg-transparent sm:hidden"
            aria-label="Fechar acoes rapidas"
            onClick={() => definirAcoesRapidasAbertas(false)}
          />
        )}
        <div
          className={`fixed right-4 z-40 transition-all duration-200 sm:hidden ${
            acoesRapidasVisiveis ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
          }`}
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.35rem)" }}
        >
          {acoesRapidasAbertas && (
            <div className="animate-menu-fab mb-3 w-52 space-y-1.5 rounded-xl border border-black/10 bg-white p-2 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  definirAlunoEmEdicao(null);
                  definirFormAluno(alunoInicial);
                  navegarParaAba("alunos");
                }}
                className="inline-flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-teal-50"
              >
                <Users className="h-4 w-4 text-destaque" />
                Cadastrar aluno
              </button>
              <button
                type="button"
                onClick={() => {
                  definirTurmaEmEdicao(null);
                  definirFormTurma(turmaInicial);
                  navegarParaAba("turmas");
                }}
                className="inline-flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-teal-50"
              >
                <GraduationCap className="h-4 w-4 text-destaque" />
                Cadastrar turma
              </button>
              <button
                type="button"
                onClick={() => {
                  definirMensalidadeEmEdicao(null);
                  navegarParaAba("mensalidades");
                }}
                className="inline-flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-teal-50"
              >
                <Banknote className="h-4 w-4 text-destaque" />
                Nova mensalidade
              </button>
              <button
                type="button"
                onClick={() => {
                  definirVinculoEmEdicao(null);
                  definirAlunoSelecionado("");
                  definirTurmaSelecionada("");
                  navegarParaAba("vinculos");
                }}
                className="inline-flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-teal-50"
              >
                <LinkIcon className="h-4 w-4 text-destaque" />
                Vincular aluno
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => definirAcoesRapidasAbertas((aberto) => !aberto)}
            className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-destaque text-white shadow-[0_14px_28px_rgba(15,118,110,0.28)] ring-4 ring-white/80 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-teal-200"
            aria-label="Abrir acoes rapidas"
            aria-expanded={acoesRapidasAbertas}
          >
            <Plus className={`h-5 w-5 transition-transform duration-200 ${acoesRapidasAbertas ? "rotate-45" : ""}`} />
          </button>
        </div>
        </>
      )}
      {modalAntecipadoAberto && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label="Pagamento antecipado">
          <div className="min-h-full bg-white p-4 sm:mx-auto sm:min-h-0 sm:max-w-5xl sm:rounded-2xl sm:shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><h2 className="text-xl font-extrabold text-slate-950">Pagamento antecipado</h2><p className="text-sm text-slate-600">As competências serão criadas ou atualizadas individualmente e vinculadas ao mesmo lote.</p></div>
              <button type="button" onClick={() => definirModalAntecipadoAberto(false)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Fechar"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <SelecaoAluno valor={formAntecipado.alunoId} alterar={(alunoId) => definirFormAntecipado((atual) => ({ ...atual, alunoId }))} alunos={alunos.filter((aluno) => aluno.status === "Ativo")} />
              <SelecaoTurma valor={formAntecipado.turmaId} alterar={(turmaId) => definirFormAntecipado((atual) => ({ ...atual, turmaId }))} turmas={turmas.filter((turma) => turma.status === "Ativa")} />
              <Campo rotulo="Mês inicial"><select className="campo" value={formAntecipado.mes} onChange={(e) => definirFormAntecipado((atual) => ({ ...atual, mes: Number(e.target.value) }))}>{meses.map((mes, indice) => <option key={mes} value={indice + 1}>{mes}</option>)}</select></Campo>
              <Campo rotulo="Ano inicial"><input className="campo" type="number" value={formAntecipado.ano} onChange={(e) => definirFormAntecipado((atual) => ({ ...atual, ano: Number(e.target.value) }))} /></Campo>
              <Campo rotulo="Quantidade de meses"><input className="campo" min="1" max="24" step="1" type="number" value={formAntecipado.quantidade} onChange={(e) => definirFormAntecipado((atual) => ({ ...atual, quantidade: Number(e.target.value) }))} /></Campo>
              <Campo rotulo="Valor mensal"><input className="campo bg-slate-100" readOnly value={formatarMoeda(Number(turmaAntecipada?.valor_mensalidade ?? 0))} /></Campo>
              <div className="md:col-span-2 lg:col-span-3"><p className="mb-1 text-xs font-bold uppercase text-slate-600">Opções rápidas</p><div className="flex flex-wrap gap-2">{[3,4,6,12].map((quantidade) => <button key={quantidade} type="button" onClick={() => definirFormAntecipado((atual) => ({ ...atual, quantidade }))} className={`rounded-md border px-3 py-2 text-sm font-bold ${formAntecipado.quantidade === quantidade ? "border-destaque bg-teal-50 text-destaque" : "border-slate-200"}`}>{quantidade} meses</button>)}<span className="px-2 py-2 text-sm text-slate-500">Personalizado: de 1 a 24 meses</span></div></div>
              <Campo rotulo="Desconto"><select className="campo" value={formAntecipado.tipoDesconto} onChange={(e) => definirFormAntecipado((atual) => ({ ...atual, tipoDesconto: e.target.value as TipoDescontoAntecipado, desconto: "" }))}><option>Sem desconto</option><option>Percentual</option><option>Valor fixo</option></select></Campo>
              {formAntecipado.tipoDesconto !== "Sem desconto" && <Campo rotulo={formAntecipado.tipoDesconto === "Percentual" ? "Percentual" : "Valor fixo (R$)"}><input className="campo" min="0" type="number" step="0.01" value={formAntecipado.desconto} onChange={(e) => definirFormAntecipado((atual) => ({ ...atual, desconto: e.target.value }))} /></Campo>}
              <Campo rotulo="Forma de pagamento"><select className="campo" value={formAntecipado.formaPagamento} onChange={(e) => definirFormAntecipado((atual) => ({ ...atual, formaPagamento: e.target.value }))}><option>Dinheiro</option><option>PIX</option><option>Cartão</option><option>Transferência</option><option>Outro</option></select></Campo>
              <Campo rotulo="Data do pagamento"><input className="campo" type="date" value={formAntecipado.dataPagamento} onChange={(e) => definirFormAntecipado((atual) => ({ ...atual, dataPagamento: e.target.value }))} /></Campo>
              <div className="md:col-span-2 lg:col-span-3"><Campo rotulo="Observação"><textarea className="campo min-h-20" value={formAntecipado.observacao} onChange={(e) => definirFormAntecipado((atual) => ({ ...atual, observacao: e.target.value }))} /></Campo></div>
            </div>
            {conflitosAntecipados.some((item) => item.situacao === "Cancelada") && <label className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={formAntecipado.reativarCanceladas} onChange={(e) => definirFormAntecipado((atual) => ({ ...atual, reativarCanceladas: e.target.checked }))} /> Reativar mensalidades canceladas deste lote</label>}
            <div className="mt-5 rounded-xl border border-slate-200"><div className="border-b p-3"><h3 className="font-extrabold">Prévia das competências</h3></div><div className="hidden overflow-x-auto sm:block"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Competência</th><th>Vencimento</th><th>Original</th><th>Desconto</th><th>Final</th><th>Situação</th></tr></thead><tbody>{conflitosAntecipados.map((item) => <tr key={item.rotulo} className="border-t"><td className="p-3 font-semibold">{item.rotulo}</td><td>{formatarData(item.vencimento)}</td><td>{formatarMoeda(item.valorOriginal)}</td><td>{formatarMoeda(item.desconto)}</td><td>{formatarMoeda(item.valorFinal)}</td><td><Etiqueta status={item.situacao} /></td></tr>)}</tbody></table></div><div className="space-y-2 p-3 sm:hidden">{conflitosAntecipados.map((item) => <div key={item.rotulo} className="rounded-lg border p-3 text-sm"><div className="flex justify-between"><strong>{item.rotulo}</strong><Etiqueta status={item.situacao} /></div><p>Vence em {formatarData(item.vencimento)}</p><p>{formatarMoeda(item.valorOriginal)} − {formatarMoeda(item.desconto)} = <strong>{formatarMoeda(item.valorFinal)}</strong></p></div>)}</div></div>
            <div className="mt-4 grid gap-2 rounded-xl bg-teal-50 p-4 text-sm sm:grid-cols-3"><p><strong>{competenciasPrevia.length}</strong> mensalidades</p><p>Período: <strong>{competenciasPrevia[0]?.rotulo} a {competenciasPrevia.at(-1)?.rotulo}</strong></p><p>Subtotal: <strong>{formatarMoeda(competenciasPrevia.reduce((s, i) => s + i.valorOriginal, 0))}</strong></p><p>Desconto: <strong>{formatarMoeda(competenciasPrevia.reduce((s, i) => s + i.desconto, 0))}</strong></p><p>Total recebido: <strong>{formatarMoeda(competenciasPrevia.reduce((s, i) => s + i.valorFinal, 0))}</strong></p><p>Forma: <strong>{formAntecipado.formaPagamento}</strong></p></div>
            <div className="sticky bottom-0 mt-4 flex flex-col-reverse gap-2 border-t bg-white pt-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => definirModalAntecipadoAberto(false)} className="rounded-md border px-4 py-3 font-bold">Cancelar</button><button type="button" disabled={salvando || conflitosAntecipados.some((item) => item.situacao === "Bloqueada")} onClick={confirmarPagamentoAntecipado} className="rounded-md bg-destaque px-4 py-3 font-bold text-white disabled:opacity-50">{salvando ? "Salvando..." : "Confirmar pagamento antecipado"}</button></div>
          </div>
        </div>
      )}
      {detalheAntecipado && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"><div className="flex justify-between gap-3"><h2 className="text-lg font-extrabold">Detalhes do pagamento antecipado</h2><button onClick={() => definirDetalheAntecipado(null)}><XCircle /></button></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Lote</dt><dd className="break-all font-semibold">{detalheAntecipado.id}</dd></div><div><dt className="text-slate-500">Situação</dt><dd><Etiqueta status={detalheAntecipado.status} /></dd></div><div><dt className="text-slate-500">Período</dt><dd>{formatarData(detalheAntecipado.competencia_inicial)} a {formatarData(detalheAntecipado.competencia_final)}</dd></div><div><dt className="text-slate-500">Recebido em</dt><dd>{formatarData(detalheAntecipado.data_pagamento)} · {detalheAntecipado.forma_pagamento}</dd></div><div><dt className="text-slate-500">Original / desconto</dt><dd>{formatarMoeda(Number(detalheAntecipado.valor_original))} / {formatarMoeda(Number(detalheAntecipado.valor_desconto))}</dd></div><div><dt className="text-slate-500">Total</dt><dd className="font-bold">{formatarMoeda(Number(detalheAntecipado.valor_total_pago))}</dd></div></dl><div className="mt-3 rounded-md bg-slate-50 p-3 text-sm"><strong>Mensalidades vinculadas</strong><ul className="mt-1 space-y-1">{mensalidades.filter((item) => item.pagamento_antecipado_id === detalheAntecipado.id).map((item) => <li key={item.id}>{meses[item.mes_referencia - 1]}/{item.ano_referencia} — {formatarMoeda(Number(item.valor_pago ?? item.valor))}</li>)}</ul></div><p className="mt-3 rounded-md bg-slate-50 p-3 text-sm">{detalheAntecipado.observacao || "Sem observação."}</p>{detalheAntecipado.status === "Confirmado" && <button type="button" disabled={salvando} onClick={cancelarPagamentoAntecipado} className="mt-4 w-full rounded-md border border-red-200 px-4 py-3 font-bold text-red-700">Cancelar lote e registrar estorno interno</button>}</div></div>
      )}
      <InstallAppModal controle={controleInstalacao} />
    </main>
  );
}

function Campo({ rotulo, obrigatorio, children }: { rotulo: string; obrigatorio?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-600">
        {rotulo} {obrigatorio && <span className="text-perigo">*</span>}
      </span>
      {children}
    </label>
  );
}

function SecaoFormulario({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <legend className="px-1 text-xs font-extrabold uppercase text-destaque">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Formulario({ titulo, onSubmit, children }: { titulo: string; onSubmit: (evento: React.FormEvent<HTMLFormElement>) => void; children: React.ReactNode }) {
  return (
    <form onSubmit={onSubmit} className="surface-card space-y-3 p-3 sm:p-4">
      <h2 className="text-base font-extrabold text-slate-950 sm:text-lg">{titulo}</h2>
      {children}
    </form>
  );
}

function PainelLista({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-3 sm:p-4">
      <h2 className="mb-3 text-base font-extrabold text-slate-950 sm:text-lg">{titulo}</h2>
      {children}
    </div>
  );
}

function LinhaAlerta({
  Icone,
  titulo,
  valor,
  tom
}: {
  Icone: typeof AlertCircle;
  titulo: string;
  valor: string;
  tom: "amber" | "red" | "teal";
}) {
  const classes = {
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    teal: "bg-teal-100 text-destaque"
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${classes[tom]}`}>
          <Icone className="h-4 w-4" />
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-extrabold uppercase ${classes[tom]}`}>{titulo}</span>
      </div>
      <span className="min-w-0 text-right text-xs font-bold text-slate-800">{valor}</span>
    </div>
  );
}

function GraficoReceita({ dados, totalPeriodo }: { dados: ReceitaMensal[]; totalPeriodo: number }) {
  const [detalhesVisiveis, definirDetalhesVisiveis] = useState(false);
  const largura = 720;
  const altura = 260;
  const margem = { topo: 24, direita: 24, baixo: 46, esquerda: 70 };
  const larguraGrafico = largura - margem.esquerda - margem.direita;
  const alturaGrafico = altura - margem.topo - margem.baixo;
  const maiorValor = Math.max(...dados.map((item) => item.valor), 1);
  const pontos = dados.map((item, indice) => {
    const x = margem.esquerda + (larguraGrafico / Math.max(dados.length - 1, 1)) * indice;
    const y = margem.topo + alturaGrafico - (item.valor / maiorValor) * alturaGrafico;
    return { ...item, x, y };
  });
  const linha = pontos.map((ponto) => `${ponto.x},${ponto.y}`).join(" ");
  const area = `${margem.esquerda},${margem.topo + alturaGrafico} ${linha} ${margem.esquerda + larguraGrafico},${margem.topo + alturaGrafico}`;
  const linhasGrade = [0, 0.25, 0.5, 0.75, 1].map((percentual) => {
    const valor = maiorValor * (1 - percentual);
    const y = margem.topo + alturaGrafico * percentual;
    return { y, valor };
  });

  return (
    <div className="surface-card p-3 sm:p-4">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-destaque">Fluxo confirmado</p>
          <h2 className="text-base font-extrabold text-slate-950 sm:text-lg">Receita recebida</h2>
          <p className="text-xs font-medium text-slate-500">Ultimos 6 meses</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-destaque">
          <Banknote className="h-4 w-4" />
        </span>
      </div>

      <div className="mb-2 rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2">
        <p className="text-[0.68rem] font-bold uppercase text-teal-700">Total recebido no periodo</p>
        <strong className="block text-lg font-extrabold leading-tight text-teal-950">{formatarMoeda(totalPeriodo)}</strong>
      </div>

      <div className="overflow-hidden sm:overflow-x-auto">
        <svg className="h-[240px] w-full sm:h-auto sm:min-w-[680px]" viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label="Grafico de receita dos ultimos 6 meses">
          <defs>
            <linearGradient id="graficoReceita" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {linhasGrade.map((linhaGrade) => (
            <g key={linhaGrade.y}>
              <line
                x1={margem.esquerda}
                x2={largura - margem.direita}
                y1={linhaGrade.y}
                y2={linhaGrade.y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text x={12} y={linhaGrade.y + 4} className="fill-slate-500 text-xs">
                {formatarMoeda(linhaGrade.valor)}
              </text>
            </g>
          ))}

          <polyline points={area} fill="url(#graficoReceita)" stroke="none" />
          <polyline points={linha} fill="none" stroke="#0f766e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />

          {pontos.map((ponto) => (
            <g key={`${ponto.mes}-${ponto.ano}`}>
              <circle cx={ponto.x} cy={ponto.y} r="6" fill="#0f766e" />
              <circle cx={ponto.x} cy={ponto.y} r="3" fill="#ffffff" />
              <text x={ponto.x} y={altura - 18} textAnchor="middle" className="fill-slate-600 text-xs font-semibold">
                {ponto.rotulo}
              </text>
              <text x={ponto.x} y={Math.max(14, ponto.y - 12)} textAnchor="middle" className="fill-slate-900 text-xs font-bold">
                {formatarMoeda(ponto.valor)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <button
        type="button"
        onClick={() => definirDetalhesVisiveis((visivel) => !visivel)}
        className="mx-auto mt-2 flex min-h-8 items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-destaque hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-destaque focus:ring-offset-2"
        aria-expanded={detalhesVisiveis}
      >
        {detalhesVisiveis ? "Ocultar detalhes" : "Ver detalhes"}
        <ChevronDown className={`h-4 w-4 transition-transform ${detalhesVisiveis ? "rotate-180" : ""}`} />
      </button>

      {detalhesVisiveis && (
        <div className="mt-3 grid gap-2 transition-all sm:grid-cols-2 lg:grid-cols-3">
          {dados.map((item) => (
            <div key={`${item.mes}-${item.ano}`} className="flex items-center justify-between rounded-md border border-black/10 bg-slate-50 px-3 py-2 text-sm">
              <span className="font-semibold text-slate-700">{item.rotulo}</span>
              <span className="font-bold text-slate-900">{formatarMoeda(item.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BotaoSalvar({ salvando, texto }: { salvando: boolean; texto: string }) {
  return (
    <button disabled={salvando} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-destaque px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-destaque focus:ring-offset-2">
      {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {texto}
    </button>
  );
}

function Paginacao({
  paginaAtual,
  totalItens,
  itensPorPagina,
  alterarPagina
}: {
  paginaAtual: number;
  totalItens: number;
  itensPorPagina: number;
  alterarPagina: (pagina: number) => void;
}) {
  const totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));
  const inicio = totalItens === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1;
  const fim = Math.min(paginaAtual * itensPorPagina, totalItens);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-black/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        Mostrando {inicio} a {fim} de {totalItens} registros
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => alterarPagina(Math.max(1, paginaAtual - 1))}
          disabled={paginaAtual === 1}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="min-w-16 text-center text-sm font-semibold text-slate-700">
          {paginaAtual}/{totalPaginas}
        </span>
        <button
          type="button"
          onClick={() => alterarPagina(Math.min(totalPaginas, paginaAtual + 1))}
          disabled={paginaAtual === totalPaginas}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          Proxima
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CartaoResumo({
  rotulo,
  valor,
  tom,
  Icone
}: {
  rotulo: string;
  valor: string;
  tom: "verde" | "azul" | "amarelo" | "vermelho" | "cinza";
  Icone?: typeof Banknote;
}) {
  const classes = {
    verde: "border-teal-200 bg-teal-50 text-teal-950",
    azul: "border-sky-200 bg-sky-50 text-sky-950",
    amarelo: "border-amber-200 bg-amber-50 text-amber-950",
    vermelho: "border-red-200 bg-red-50 text-red-950",
    cinza: "border-slate-200 bg-white text-slate-950"
  };

  return (
    <div className={`cartao-interativo min-h-[82px] rounded-xl border p-2.5 shadow-sm sm:min-h-0 sm:p-4 ${classes[tom]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.64rem] font-bold uppercase leading-tight text-current/65 sm:text-sm">{rotulo}</p>
        {Icone && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/55 text-current/75">
            <Icone className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <strong className="mt-2 block break-words text-xl font-black leading-tight tracking-normal sm:text-2xl">{valor}</strong>
    </div>
  );
}

function Etiqueta({ status }: { status: string }) {
  const classe =
    status === "Pago" || status === "Ativo"
      ? "bg-teal-100 text-teal-800"
      : status === "Atrasado"
        ? "bg-red-100 text-red-800"
        : status === "Cancelado"
          ? "bg-slate-200 text-slate-700"
          : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold uppercase ${classe}`}>{status}</span>;
}

function corFaixaClasse(faixa: CorFaixa | null) {
  const classes: Record<CorFaixa, string> = {
    Branca: "border-slate-300 bg-white",
    Cinza: "border-slate-400 bg-slate-300",
    Amarela: "border-yellow-500 bg-yellow-300",
    Laranja: "border-orange-500 bg-orange-400",
    Verde: "border-emerald-600 bg-emerald-500",
    Azul: "border-blue-600 bg-blue-500",
    Roxa: "border-purple-700 bg-purple-600",
    Marrom: "border-amber-900 bg-amber-800",
    Preta: "border-slate-950 bg-slate-900"
  };

  return classes[faixa ?? "Branca"];
}

function SelecaoAluno({ valor, alterar, alunos }: { valor: string; alterar: (valor: string) => void; alunos: Aluno[] }) {
  return (
    <Campo rotulo="Aluno">
      <select className="campo" value={valor} onChange={(e) => alterar(e.target.value)} required>
        <option value="">Selecione</option>
        {alunos.map((aluno) => (
          <option key={aluno.id} value={aluno.id}>{aluno.nome_completo}</option>
        ))}
      </select>
    </Campo>
  );
}

function SelecaoTurma({ valor, alterar, turmas }: { valor: string; alterar: (valor: string) => void; turmas: Turma[] }) {
  return (
    <Campo rotulo="Turma">
      <select className="campo" value={valor} onChange={(e) => alterar(e.target.value)} required>
        <option value="">Selecione</option>
        {turmas.map((turma) => (
          <option key={turma.id} value={turma.id}>{turma.nome}</option>
        ))}
      </select>
    </Campo>
  );
}
