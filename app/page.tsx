"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  CircleCheck,
  Gift,
  GraduationCap,
  LayoutDashboard,
  LinkIcon,
  Loader2,
  MessageCircle,
  Pencil,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  XCircle,
  Trash2,
  Users
} from "lucide-react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import {
  anoAtual,
  dataAtualIso,
  formatarData,
  formatarMoeda,
  mesAtual,
  meses,
  numeroWhatsapp
} from "@/lib/formatadores";
import type { Aluno, AlunoTurma, CorFaixa, MensalidadeComDetalhes, ResumoFinanceiro, Turma } from "@/lib/tipos";

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

const turmaInicial = {
  nome: "",
  dias_semana: "",
  horario: "",
  valor_mensalidade: "",
  status: "Ativa"
};

const itensPorPagina = 5;
const diaVencimentoPadrao = 8;

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

export default function PaginaInicial() {
  const [abaAtiva, definirAbaAtiva] = useState<Aba>("dashboard");
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

  const resumo = useMemo<ResumoFinanceiro>(() => {
    const mesAtualReferencia = mesAtual();
    const anoAtualReferencia = anoAtual();

    return mensalidades.reduce(
      (acumulado, mensalidade) => {
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
        quantidade_alunos: alunos.length,
        quantidade_turmas: turmas.length
      }
    );
  }, [alunos.length, mensalidades, turmas.length]);

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

  async function lancarMensalidade(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirSalvando(true);

    const dadosMensalidade = {
      aluno_id: alunoSelecionado,
      turma_id: turmaSelecionada,
      mes_referencia: mesReferencia,
      ano_referencia: anoReferencia,
      valor: Number(turmaDoAlunoSelecionado?.valor_mensalidade ?? mensalidadeEmEdicao?.valor ?? 0),
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
        forma_pagamento: "Nao informado"
      })
      .eq("id", mensalidade.id);

    definirSalvando(false);
    if (error) return definirMensagem(`Erro ao registrar pagamento: ${error.message}`);
    definirMensagem("Pagamento registrado com sucesso.");
    carregarDados();
  }

  async function cancelarMensalidade(mensalidade: MensalidadeComDetalhes) {
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
    <main className="min-h-screen px-3 py-4 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-lg border border-black/5 bg-white/85 p-4 shadow-suave backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-destaque">CTDemar Financeiro</p>
            <h1 className="mt-1 text-2xl font-bold text-tinta sm:text-3xl">Controle de mensalidades</h1>
          </div>
          <button
            onClick={carregarDados}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-tinta px-4 py-2 text-sm font-semibold text-white"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
        </header>

        <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {abas.map(({ id, rotulo, Icone }) => (
            <button
              key={id}
              onClick={() => definirAbaAtiva(id)}
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

        <section className="mt-5">
          {abaAtiva === "dashboard" && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-5">
                <CartaoResumo rotulo="Recebido" valor={formatarMoeda(resumo.total_recebido)} tom="verde" />
                <CartaoResumo rotulo="Pendente" valor={formatarMoeda(resumo.total_pendente)} tom="amarelo" />
                <CartaoResumo rotulo="Atrasado" valor={formatarMoeda(resumo.total_atrasado)} tom="vermelho" />
                <CartaoResumo rotulo="Alunos" valor={String(resumo.quantidade_alunos)} tom="cinza" />
                <CartaoResumo rotulo="Turmas" valor={String(resumo.quantidade_turmas)} tom="cinza" />
              </div>

              <div className="rounded-lg border border-black/10 bg-white p-4 shadow-suave">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Este mes</p>
                    <h2 className="text-lg font-bold">Aniversariantes</h2>
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
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {aniversariantesDoMes.map((aluno) => (
                      <article key={aluno.id} className="rounded-md border border-black/10 bg-slate-50 p-3">
                        <h3 className="font-semibold">{aluno.nome_completo}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Aniversario em {formatarDiaMes(aluno.data_nascimento ?? "")}
                        </p>
                        {aluno.telefone && <p className="mt-1 text-sm text-slate-600">{aluno.telefone}</p>}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {abaAtiva === "alunos" && (
            <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
              <Formulario titulo={alunoEmEdicao ? "Alterar aluno" : "Cadastrar aluno"} onSubmit={salvarAluno}>
                <Campo rotulo="Nome completo" obrigatorio>
                  <input className="campo" value={formAluno.nome_completo} onChange={(e) => definirFormAluno({ ...formAluno, nome_completo: e.target.value })} required />
                </Campo>
                <Campo rotulo="Telefone">
                  <input className="campo" value={formAluno.telefone} onChange={(e) => definirFormAluno({ ...formAluno, telefone: e.target.value })} />
                </Campo>
                <Campo rotulo="Data de nascimento">
                  <input className="campo" type="date" value={formAluno.data_nascimento} onChange={(e) => definirFormAluno({ ...formAluno, data_nascimento: e.target.value })} />
                </Campo>
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
                <Campo rotulo="Observacoes">
                  <textarea className="campo min-h-24" value={formAluno.observacoes} onChange={(e) => definirFormAluno({ ...formAluno, observacoes: e.target.value })} />
                </Campo>
                <BotaoSalvar salvando={salvando} texto={alunoEmEdicao ? "Salvar alteracao" : "Salvar aluno"} />
                {alunoEmEdicao && (
                  <button
                    type="button"
                    onClick={cancelarEdicaoAluno}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
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
                    className={`mb-3 rounded-md border p-3 ${
                      alunoEmEdicao?.id === aluno.id ? "border-destaque bg-teal-50" : "border-black/10 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{aluno.nome_completo}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {aluno.telefone ?? "Sem telefone"} | Matricula: {formatarData(aluno.data_matricula)}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          Faixa: {faixasAlunos.find((faixa) => faixa.valor === aluno.cor_faixa)?.rotulo ?? "Branca ⚪"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => iniciarEdicaoAluno(aluno)}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-destaque bg-white px-3 py-2 text-sm font-semibold text-destaque"
                        >
                          <Pencil className="h-4 w-4" />
                          Alterar
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirAluno(aluno)}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
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
                <BotaoSalvar salvando={salvando} texto={turmaEmEdicao ? "Salvar alteracao" : "Salvar turma"} />
                {turmaEmEdicao && (
                  <button
                    type="button"
                    onClick={cancelarEdicaoTurma}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
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
                    className={`mb-3 rounded-md border p-3 ${
                      turmaEmEdicao?.id === turma.id ? "border-destaque bg-teal-50" : "border-black/10 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{turma.nome}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {turma.dias_semana ?? "Dias nao informados"} | {turma.horario ?? "Horario nao informado"} | {formatarMoeda(Number(turma.valor_mensalidade))}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => iniciarEdicaoTurma(turma)}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-destaque bg-white px-3 py-2 text-sm font-semibold text-destaque"
                        >
                          <Pencil className="h-4 w-4" />
                          Alterar
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirTurma(turma)}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
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
    </main>
  );
}

function Campo({ rotulo, obrigatorio, children }: { rotulo: string; obrigatorio?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {rotulo} {obrigatorio && <span className="text-perigo">*</span>}
      </span>
      {children}
    </label>
  );
}

function Formulario({ titulo, onSubmit, children }: { titulo: string; onSubmit: (evento: React.FormEvent<HTMLFormElement>) => void; children: React.ReactNode }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-black/10 bg-white p-4 shadow-suave">
      <h2 className="text-lg font-bold">{titulo}</h2>
      {children}
    </form>
  );
}

function PainelLista({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-suave">
      <h2 className="mb-4 text-lg font-bold">{titulo}</h2>
      {children}
    </div>
  );
}

function BotaoSalvar({ salvando, texto }: { salvando: boolean; texto: string }) {
  return (
    <button disabled={salvando} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-destaque px-4 py-3 text-sm font-semibold text-white">
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

function CartaoResumo({ rotulo, valor, tom }: { rotulo: string; valor: string; tom: "verde" | "amarelo" | "vermelho" | "cinza" }) {
  const classes = {
    verde: "border-teal-200 bg-teal-50 text-teal-900",
    amarelo: "border-amber-200 bg-amber-50 text-amber-900",
    vermelho: "border-red-200 bg-red-50 text-red-900",
    cinza: "border-slate-200 bg-white text-slate-900"
  };

  return (
    <div className={`rounded-lg border p-4 shadow-suave ${classes[tom]}`}>
      <p className="text-sm font-semibold">{rotulo}</p>
      <strong className="mt-2 block text-2xl">{valor}</strong>
    </div>
  );
}

function Etiqueta({ status }: { status: string }) {
  const classe = status === "Pago" ? "bg-teal-100 text-teal-800" : status === "Atrasado" ? "bg-red-100 text-red-800" : status === "Cancelado" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${classe}`}>{status}</span>;
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
