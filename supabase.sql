create extension if not exists pgcrypto;

create table if not exists alunos (
  id uuid primary key default gen_random_uuid(),
  nome_completo varchar(150) not null,
  telefone varchar(20),
  data_nascimento date,
  data_matricula date not null,
  cor_faixa varchar(20) default 'Branca',
  status varchar(20) default 'Ativo',
  observacoes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table alunos add column if not exists cor_faixa varchar(20) default 'Branca';

create table if not exists turmas (
  id uuid primary key default gen_random_uuid(),
  nome varchar(100) not null,
  dias_semana varchar(100),
  horario varchar(50),
  valor_mensalidade numeric(10,2) not null,
  status varchar(20) default 'Ativa',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists aluno_turma (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references alunos(id) on delete cascade,
  turma_id uuid references turmas(id) on delete restrict,
  created_at timestamp default now(),
  unique (aluno_id, turma_id)
);

create table if not exists financeiro (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references alunos(id) on delete cascade,
  turma_id uuid references turmas(id) on delete restrict,
  mes_referencia int not null,
  ano_referencia int not null,
  valor numeric(10,2) not null,
  data_vencimento date not null,
  data_pagamento date,
  status varchar(20) default 'Pendente',
  forma_pagamento varchar(30),
  observacoes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create or replace function atualizar_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists atualizar_alunos_updated_at on alunos;
create trigger atualizar_alunos_updated_at
before update on alunos
for each row execute function atualizar_updated_at();

drop trigger if exists atualizar_turmas_updated_at on turmas;
create trigger atualizar_turmas_updated_at
before update on turmas
for each row execute function atualizar_updated_at();

drop trigger if exists atualizar_financeiro_updated_at on financeiro;
create trigger atualizar_financeiro_updated_at
before update on financeiro
for each row execute function atualizar_updated_at();

alter table alunos enable row level security;
alter table turmas enable row level security;
alter table aluno_turma enable row level security;
alter table financeiro enable row level security;

drop policy if exists "acesso_publico_alunos" on alunos;
create policy "acesso_publico_alunos" on alunos for all using (true) with check (true);

drop policy if exists "acesso_publico_turmas" on turmas;
create policy "acesso_publico_turmas" on turmas for all using (true) with check (true);

drop policy if exists "acesso_publico_aluno_turma" on aluno_turma;
create policy "acesso_publico_aluno_turma" on aluno_turma for all using (true) with check (true);

drop policy if exists "acesso_publico_financeiro" on financeiro;
create policy "acesso_publico_financeiro" on financeiro for all using (true) with check (true);
