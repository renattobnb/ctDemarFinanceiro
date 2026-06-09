"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CalendarPlus,
  CheckCircle2,
  GraduationCap,
  LayoutDashboard,
  LinkIcon,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  Search,
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
import type { Aluno, AlunoTurma, MensalidadeComDetalhes, ResumoFinanceiro, Turma } from "@/lib/tipos";

type Aba = "dashboard" | "alunos" | "turmas" | "vinculos" | "mensalidades" | "inadimplentes";

const abas: Array<{ id: Aba; rotulo: string; Icone: typeof LayoutDashboard }> = [
  { id: "dashboard", rotulo: "Dashboard", Icone: LayoutDashboard },
  { id: "alunos", rotulo: "Alunos", Icone: Users },
  { id: "turmas", rotulo: "Turmas", Icone: GraduationCap },
  { id: "vinculos", rotulo: "Vinculos", Icone: LinkIcon },
  { id: "mensalidades", rotulo: "Mensalidades", Icone: Banknote },
  { id: "inadimplentes", rotulo: "Inadimplentes", Icone: AlertCircle }
];

const alunoInicial = {
  nome_completo: "",
  telefone: "",
  data_nascimento: "",
  data_matricula: dataAtualIso(),
  status: "Ativo",
  observacoes: ""
};

const turmaInicial = {
  nome: "",
  dias_semana: "",
  horario: "",
  valor_mensalidade: "",
  status: "Ativa"
};

export default function PaginaInicial() {
  const [abaAtiva, definirAbaAtiva] = useState<Aba>("dashboard");
  const [carregando, definirCarregando] = useState(false);
  const [salvando, definirSalvando] = useState(false);
  const [mensagem, definirMensagem] = useState("");
  const [busca, definirBusca] = useState("");
  const [alunos, definirAlunos] = useState<Aluno[]>([]);
  const [turmas, definirTurmas] = useState<Turma[]>([]);
  const [vinculos, definirVinculos] = useState<AlunoTurma[]>([]);
  const [mensalidades, definirMensalidades] = useState<MensalidadeComDetalhes[]>([]);
  const [formAluno, definirFormAluno] = useState(alunoInicial);
  const [formTurma, definirFormTurma] = useState(turmaInicial);
  const [alunoSelecionado, definirAlunoSelecionado] = useState("");
  const [turmaSelecionada, definirTurmaSelecionada] = useState("");
  const [mesReferencia, definirMesReferencia] = useState(mesAtual());
  const [anoReferencia, definirAnoReferencia] = useState(anoAtual());
  const [dataVencimento, definirDataVencimento] = useState(dataAtualIso());

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

  const resumo = useMemo<ResumoFinanceiro>(() => {
    return mensalidades.reduce(
      (acumulado, mensalidade) => {
        if (mensalidade.status === "Pago") acumulado.total_recebido += Number(mensalidade.valor);
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

  const mensalidadesInadimplentes = useMemo(() => {
    return mensalidades.filter((mensalidade) => mensalidade.status !== "Pago");
  }, [mensalidades]);

  const turmaDoAlunoSelecionado = turmas.find((turma) => turma.id === turmaSelecionada);

  async function salvarAluno(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirSalvando(true);

    const { error } = await supabase.from("alunos").insert({
      nome_completo: formAluno.nome_completo,
      telefone: formAluno.telefone || null,
      data_nascimento: formAluno.data_nascimento || null,
      data_matricula: formAluno.data_matricula,
      status: formAluno.status,
      observacoes: formAluno.observacoes || null
    });

    definirSalvando(false);
    if (error) return definirMensagem(`Erro ao salvar aluno: ${error.message}`);
    definirMensagem("Aluno cadastrado com sucesso.");
    definirFormAluno(alunoInicial);
    carregarDados();
  }

  async function salvarTurma(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirSalvando(true);

    const { error } = await supabase.from("turmas").insert({
      nome: formTurma.nome,
      dias_semana: formTurma.dias_semana || null,
      horario: formTurma.horario || null,
      valor_mensalidade: Number(formTurma.valor_mensalidade),
      status: formTurma.status
    });

    definirSalvando(false);
    if (error) return definirMensagem(`Erro ao salvar turma: ${error.message}`);
    definirMensagem("Turma cadastrada com sucesso.");
    definirFormTurma(turmaInicial);
    carregarDados();
  }

  async function vincularAlunoTurma(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirSalvando(true);

    const { error } = await supabase.from("aluno_turma").insert({
      aluno_id: alunoSelecionado,
      turma_id: turmaSelecionada
    });

    definirSalvando(false);
    if (error) return definirMensagem(`Erro ao criar vinculo: ${error.message}`);
    definirMensagem("Aluno vinculado a turma com sucesso.");
    definirAlunoSelecionado("");
    definirTurmaSelecionada("");
    carregarDados();
  }

  async function lancarMensalidade(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirSalvando(true);

    const { error } = await supabase.from("financeiro").insert({
      aluno_id: alunoSelecionado,
      turma_id: turmaSelecionada,
      mes_referencia: mesReferencia,
      ano_referencia: anoReferencia,
      valor: Number(turmaDoAlunoSelecionado?.valor_mensalidade ?? 0),
      data_vencimento: dataVencimento,
      status: "Pendente"
    });

    definirSalvando(false);
    if (error) return definirMensagem(`Erro ao lancar mensalidade: ${error.message}`);
    definirMensagem("Mensalidade lancada com sucesso.");
    carregarDados();
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

  async function marcarAtrasadas() {
    definirSalvando(true);
    const hoje = dataAtualIso();
    const { error } = await supabase
      .from("financeiro")
      .update({ status: "Atrasado" })
      .lt("data_vencimento", hoje)
      .neq("status", "Pago");

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

        <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
            <div className="grid gap-4 lg:grid-cols-5">
              <CartaoResumo rotulo="Recebido" valor={formatarMoeda(resumo.total_recebido)} tom="verde" />
              <CartaoResumo rotulo="Pendente" valor={formatarMoeda(resumo.total_pendente)} tom="amarelo" />
              <CartaoResumo rotulo="Atrasado" valor={formatarMoeda(resumo.total_atrasado)} tom="vermelho" />
              <CartaoResumo rotulo="Alunos" valor={String(resumo.quantidade_alunos)} tom="cinza" />
              <CartaoResumo rotulo="Turmas" valor={String(resumo.quantidade_turmas)} tom="cinza" />
            </div>
          )}

          {abaAtiva === "alunos" && (
            <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
              <Formulario titulo="Cadastrar aluno" onSubmit={salvarAluno}>
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
                <Campo rotulo="Observacoes">
                  <textarea className="campo min-h-24" value={formAluno.observacoes} onChange={(e) => definirFormAluno({ ...formAluno, observacoes: e.target.value })} />
                </Campo>
                <BotaoSalvar salvando={salvando} texto="Salvar aluno" />
              </Formulario>
              <PainelLista titulo="Alunos cadastrados">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input className="campo pl-9" placeholder="Buscar aluno" value={busca} onChange={(e) => definirBusca(e.target.value)} />
                </div>
                {alunosFiltrados.map((aluno) => (
                  <Linha key={aluno.id} titulo={aluno.nome_completo} detalhe={`${aluno.telefone ?? "Sem telefone"} | Matricula: ${formatarData(aluno.data_matricula)}`} />
                ))}
              </PainelLista>
            </div>
          )}

          {abaAtiva === "turmas" && (
            <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
              <Formulario titulo="Cadastrar turma" onSubmit={salvarTurma}>
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
                <BotaoSalvar salvando={salvando} texto="Salvar turma" />
              </Formulario>
              <PainelLista titulo="Turmas cadastradas">
                {turmas.map((turma) => (
                  <Linha key={turma.id} titulo={turma.nome} detalhe={`${turma.dias_semana ?? "Dias nao informados"} | ${turma.horario ?? "Horario nao informado"} | ${formatarMoeda(Number(turma.valor_mensalidade))}`} />
                ))}
              </PainelLista>
            </div>
          )}

          {abaAtiva === "vinculos" && (
            <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
              <Formulario titulo="Vincular aluno a turma" onSubmit={vincularAlunoTurma}>
                <SelecaoAluno valor={alunoSelecionado} alterar={definirAlunoSelecionado} alunos={alunos} />
                <SelecaoTurma valor={turmaSelecionada} alterar={definirTurmaSelecionada} turmas={turmas} />
                <BotaoSalvar salvando={salvando} texto="Vincular" />
              </Formulario>
              <PainelLista titulo="Vinculos cadastrados">
                {vinculos.length === 0 && (
                  <p className="rounded-md border border-black/10 bg-slate-50 p-3 text-sm text-slate-600">
                    Nenhum vinculo cadastrado.
                  </p>
                )}
                {vinculos.map((vinculo) => {
                  const aluno = alunos.find((item) => item.id === vinculo.aluno_id);
                  const turma = turmas.find((item) => item.id === vinculo.turma_id);

                  return (
                    <Linha
                      key={vinculo.id}
                      titulo={aluno?.nome_completo ?? "Aluno nao encontrado"}
                      detalhe={`${turma?.nome ?? "Turma nao encontrada"} | Vinculado em: ${formatarData(vinculo.created_at.slice(0, 10))}`}
                    />
                  );
                })}
              </PainelLista>
            </div>
          )}

          {abaAtiva === "mensalidades" && (
            <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
              <Formulario titulo="Lancar mensalidade" onSubmit={lancarMensalidade}>
                <SelecaoAluno valor={alunoSelecionado} alterar={definirAlunoSelecionado} alunos={alunos} />
                <SelecaoTurma valor={turmaSelecionada} alterar={definirTurmaSelecionada} turmas={turmas} />
                <Campo rotulo="Mes de referencia">
                  <select className="campo" value={mesReferencia} onChange={(e) => definirMesReferencia(Number(e.target.value))}>
                    {meses.map((mes, indice) => (
                      <option key={mes} value={indice + 1}>{mes}</option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Ano de referencia">
                  <input className="campo" type="number" value={anoReferencia} onChange={(e) => definirAnoReferencia(Number(e.target.value))} />
                </Campo>
                <Campo rotulo="Data de vencimento">
                  <input className="campo" type="date" value={dataVencimento} onChange={(e) => definirDataVencimento(e.target.value)} />
                </Campo>
                <BotaoSalvar salvando={salvando} texto="Lancar mensalidade" />
              </Formulario>
              <PainelLista titulo="Mensalidades">
                <button onClick={marcarAtrasadas} className="mb-3 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  <CalendarPlus className="h-4 w-4" />
                  Marcar vencidas como atrasadas
                </button>
                {mensalidades.map((mensalidade) => (
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
                        {mensalidade.status !== "Pago" && (
                          <button onClick={() => registrarPagamento(mensalidade)} className="inline-flex items-center gap-2 rounded-md bg-destaque px-3 py-2 text-sm font-semibold text-white">
                            <CheckCircle2 className="h-4 w-4" />
                            Pago
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </PainelLista>
            </div>
          )}

          {abaAtiva === "inadimplentes" && (
            <PainelLista titulo="Relatorio de inadimplentes">
              {mensalidadesInadimplentes.map((mensalidade) => {
                const telefone = numeroWhatsapp(mensalidade.alunos?.telefone ?? null);
                const texto = encodeURIComponent(`Ola, ${mensalidade.alunos?.nome_completo}. Identificamos a mensalidade de ${meses[mensalidade.mes_referencia - 1]}/${mensalidade.ano_referencia} em aberto no CTDemar. Valor: ${formatarMoeda(Number(mensalidade.valor))}.`);
                return (
                  <article key={mensalidade.id} className="mb-3 rounded-md border border-red-100 bg-white p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{mensalidade.alunos?.nome_completo ?? "Aluno nao encontrado"}</h3>
                        <p className="text-sm text-slate-600">
                          {mensalidade.turmas?.nome} | {formatarMoeda(Number(mensalidade.valor))} | vencimento {formatarData(mensalidade.data_vencimento)}
                        </p>
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

function Linha({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return (
    <article className="mb-3 rounded-md border border-black/10 bg-slate-50 p-3">
      <h3 className="font-semibold">{titulo}</h3>
      <p className="mt-1 text-sm text-slate-600">{detalhe}</p>
    </article>
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
  const classe = status === "Pago" ? "bg-teal-100 text-teal-800" : status === "Atrasado" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
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
