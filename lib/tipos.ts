export type StatusAluno = "Ativo" | "Inativo";
export type StatusTurma = "Ativa" | "Inativa";
export type StatusFinanceiro = "Pendente" | "Pago" | "Atrasado" | "Cancelado";
export type CorFaixa = "Branca" | "Cinza" | "Amarela" | "Laranja" | "Verde" | "Azul" | "Roxa" | "Marrom" | "Preta";

export type Aluno = {
  id: string;
  nome_completo: string;
  telefone: string | null;
  data_nascimento: string | null;
  data_matricula: string;
  cor_faixa: CorFaixa;
  status: StatusAluno;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type Turma = {
  id: string;
  nome: string;
  dias_semana: string | null;
  horario: string | null;
  valor_mensalidade: number;
  status: StatusTurma;
  created_at: string;
  updated_at: string;
};

export type AlunoTurma = {
  id: string;
  aluno_id: string;
  turma_id: string;
  created_at: string;
};

export type Financeiro = {
  id: string;
  aluno_id: string;
  turma_id: string;
  mes_referencia: number;
  ano_referencia: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: StatusFinanceiro;
  forma_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type MensalidadeComDetalhes = Financeiro & {
  alunos: Pick<Aluno, "nome_completo" | "telefone"> | null;
  turmas: Pick<Turma, "nome"> | null;
};

export type ResumoFinanceiro = {
  total_recebido: number;
  total_pendente: number;
  total_atrasado: number;
  quantidade_alunos: number;
  quantidade_turmas: number;
};
