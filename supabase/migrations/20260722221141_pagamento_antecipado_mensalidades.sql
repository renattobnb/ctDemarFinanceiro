-- Pagamentos antecipados: cada competência continua em financeiro, vinculada a um lote.
alter table public.financeiro add column if not exists pagamento_antecipado_id uuid;
alter table public.financeiro add column if not exists valor_original numeric(10,2);
alter table public.financeiro add column if not exists valor_desconto numeric(10,2) not null default 0;
alter table public.financeiro add column if not exists valor_pago numeric(10,2);

create table if not exists public.pagamentos_antecipados (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete restrict,
  turma_id uuid not null references public.turmas(id) on delete restrict,
  quantidade_meses integer not null check (quantidade_meses between 1 and 24),
  competencia_inicial date not null,
  competencia_final date not null,
  valor_original numeric(10,2) not null check (valor_original >= 0),
  tipo_desconto varchar(20) not null default 'Sem desconto' check (tipo_desconto in ('Sem desconto', 'Percentual', 'Valor fixo')),
  valor_desconto numeric(10,2) not null default 0 check (valor_desconto >= 0),
  valor_total_pago numeric(10,2) not null check (valor_total_pago >= 0),
  forma_pagamento varchar(30) not null,
  data_pagamento date not null,
  observacao text,
  status varchar(20) not null default 'Confirmado' check (status in ('Confirmado', 'Cancelado', 'Estornado')),
  motivo_cancelamento text,
  cancelado_em timestamptz,
  cancelado_por uuid,
  criado_por uuid default auth.uid(),
  requisicao_id uuid not null unique,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.financeiro
  add constraint financeiro_pagamento_antecipado_fk
  foreign key (pagamento_antecipado_id) references public.pagamentos_antecipados(id) on delete restrict;

update public.financeiro
set valor_original = valor, valor_pago = case when status = 'Pago' then valor else null end
where valor_original is null;
alter table public.financeiro alter column valor_original set not null;

-- Reconcilia duplicidades legadas sem excluir registros: quando há uma cobrança paga,
-- ela é preservada; nas demais situações, preserva-se o lançamento mais antigo.
-- Duas cobranças já pagas exigem revisão manual para não suprimir receita histórica.
do $$
begin
  if exists (
    select 1
    from public.financeiro
    where status = 'Pago'
    group by aluno_id, turma_id, mes_referencia, ano_referencia
    having count(*) > 1
  ) then
    raise exception using
      message = 'Existem competências duplicadas com mais de uma mensalidade paga.',
      detail = 'Revise essas cobranças antes de aplicar a restrição de unicidade; nenhum registro foi alterado.';
  end if;
end $$;

with duplicadas as (
  select id,
    row_number() over (
      partition by aluno_id, turma_id, mes_referencia, ano_referencia
      order by case when status = 'Pago' then 0 else 1 end, created_at asc, id asc
    ) as posicao
  from public.financeiro
  where status <> 'Cancelado'
)
update public.financeiro financeiro
set status = 'Cancelado',
    data_pagamento = null,
    forma_pagamento = null,
    observacoes = concat_ws(E'\n', financeiro.observacoes, 'Cancelada automaticamente durante a migração: competência duplicada.')
from duplicadas
where financeiro.id = duplicadas.id
  and duplicadas.posicao > 1;

create unique index if not exists financeiro_competencia_ativa_unica
  on public.financeiro (aluno_id, turma_id, mes_referencia, ano_referencia)
  where status <> 'Cancelado';
create index if not exists financeiro_pagamento_antecipado_idx on public.financeiro (pagamento_antecipado_id);
create index if not exists pagamentos_antecipados_aluno_turma_idx on public.pagamentos_antecipados (aluno_id, turma_id, data_pagamento desc);

drop trigger if exists atualizar_pagamentos_antecipados_updated_at on public.pagamentos_antecipados;
create trigger atualizar_pagamentos_antecipados_updated_at before update on public.pagamentos_antecipados
for each row execute function public.atualizar_updated_at();

alter table public.pagamentos_antecipados enable row level security;
-- O projeto atual já usa a política pública legada em todas as tabelas. A política abaixo
-- mantém a mesma matriz de acesso sem ampliar privilégios. Ao adicionar autenticação,
-- substitua-a por políticas baseadas em perfis autorizados.
create policy "acesso_publico_pagamentos_antecipados" on public.pagamentos_antecipados for all using (true) with check (true);

create or replace function public.registrar_pagamento_antecipado(
  p_aluno_id uuid, p_turma_id uuid, p_mes_inicial integer, p_ano_inicial integer,
  p_quantidade_meses integer, p_tipo_desconto text, p_valor_desconto numeric,
  p_forma_pagamento text, p_data_pagamento date, p_observacao text,
  p_reativar_canceladas boolean, p_requisicao_id uuid
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_valor_mensal numeric(10,2); v_dia integer := 8; v_total_original numeric(10,2);
  v_desconto_total numeric(10,2); v_total_pago numeric(10,2); v_lote uuid;
  v_indice integer; v_data date; v_desconto_item numeric(10,2); v_resto_centavos integer;
  v_base_centavos integer; v_existente public.financeiro%rowtype; v_processadas integer := 0;
begin
  if p_quantidade_meses not between 1 and 24 or p_mes_inicial not between 1 and 12 or p_ano_inicial not between 2000 and 2100 then
    raise exception 'Dados do período inválidos.';
  end if;
  if p_requisicao_id is null then raise exception 'Identificador da solicitação é obrigatório.'; end if;
  select id into v_lote from pagamentos_antecipados where requisicao_id = p_requisicao_id;
  if v_lote is not null then return jsonb_build_object('id', v_lote, 'repetido', true); end if;
  select valor_mensalidade into v_valor_mensal from turmas where id = p_turma_id and status = 'Ativa';
  if v_valor_mensal is null or not exists (select 1 from aluno_turma where aluno_id = p_aluno_id and turma_id = p_turma_id) then
    raise exception 'Aluno sem vínculo ativo com a turma selecionada.';
  end if;
  select coalesce(extract(day from data_pagamento), extract(day from data_vencimento), 8)::integer into v_dia
  from financeiro where aluno_id=p_aluno_id and turma_id=p_turma_id and status='Pago'
  order by coalesce(data_pagamento, data_vencimento) desc limit 1;
  v_total_original := round(v_valor_mensal * p_quantidade_meses, 2);
  v_desconto_total := case p_tipo_desconto
    when 'Percentual' then round(v_total_original * greatest(0, p_valor_desconto) / 100, 2)
    when 'Valor fixo' then round(greatest(0, p_valor_desconto), 2) else 0 end;
  if p_tipo_desconto not in ('Sem desconto', 'Percentual', 'Valor fixo') or v_desconto_total > v_total_original then raise exception 'Desconto inválido.'; end if;
  -- Bloqueia todo o lote antes de inserir, evitando concorrência e duplicidade.
  for v_indice in 0..p_quantidade_meses-1 loop
    v_data := (make_date(p_ano_inicial, p_mes_inicial, 1) + (v_indice || ' months')::interval)::date;
    select * into v_existente from financeiro where aluno_id=p_aluno_id and turma_id=p_turma_id and mes_referencia=extract(month from v_data) and ano_referencia=extract(year from v_data) for update;
    if found and v_existente.status = 'Pago' then raise exception 'A mensalidade de %/% já está paga', extract(month from v_data), extract(year from v_data); end if;
    if found and v_existente.status = 'Cancelado' and not p_reativar_canceladas then raise exception 'A mensalidade de %/% está cancelada e requer reativação', extract(month from v_data), extract(year from v_data); end if;
  end loop;
  insert into pagamentos_antecipados (aluno_id,turma_id,quantidade_meses,competencia_inicial,competencia_final,valor_original,tipo_desconto,valor_desconto,valor_total_pago,forma_pagamento,data_pagamento,observacao,requisicao_id)
  values (p_aluno_id,p_turma_id,p_quantidade_meses,make_date(p_ano_inicial,p_mes_inicial,1),(make_date(p_ano_inicial,p_mes_inicial,1)+(p_quantidade_meses-1 || ' months')::interval)::date,v_total_original,p_tipo_desconto,v_desconto_total,v_total_original-v_desconto_total,p_forma_pagamento,p_data_pagamento,nullif(p_observacao,''),p_requisicao_id) returning id into v_lote;
  v_base_centavos := floor((v_desconto_total * 100) / p_quantidade_meses); v_resto_centavos := mod(round(v_desconto_total * 100)::integer, p_quantidade_meses);
  for v_indice in 0..p_quantidade_meses-1 loop
    v_data := (make_date(p_ano_inicial,p_mes_inicial,1)+(v_indice || ' months')::interval)::date;
    v_desconto_item := (v_base_centavos + case when v_indice < v_resto_centavos then 1 else 0 end) / 100.0;
    update financeiro set status='Pago', pagamento_antecipado_id=v_lote, valor_original=v_valor_mensal, valor_desconto=v_desconto_item, valor_pago=v_valor_mensal-v_desconto_item, valor=v_valor_mensal-v_desconto_item, data_pagamento=p_data_pagamento, forma_pagamento=p_forma_pagamento, observacoes=coalesce(nullif(p_observacao,''),observacoes)
    where aluno_id=p_aluno_id and turma_id=p_turma_id and mes_referencia=extract(month from v_data) and ano_referencia=extract(year from v_data);
    if not found then
      insert into financeiro (aluno_id,turma_id,mes_referencia,ano_referencia,valor,valor_original,valor_desconto,valor_pago,data_vencimento,data_pagamento,status,forma_pagamento,observacoes,pagamento_antecipado_id)
      values (p_aluno_id,p_turma_id,extract(month from v_data),extract(year from v_data),v_valor_mensal-v_desconto_item,v_valor_mensal,v_desconto_item,v_valor_mensal-v_desconto_item,make_date(extract(year from v_data)::integer,extract(month from v_data)::integer,least(v_dia,extract(day from (date_trunc('month',v_data)+interval '1 month - 1 day'))::integer)),p_data_pagamento,'Pago',p_forma_pagamento,nullif(p_observacao,''),v_lote);
    end if; v_processadas := v_processadas + 1;
  end loop;
  return jsonb_build_object('id',v_lote,'processadas',v_processadas,'total',v_total_original-v_desconto_total,'repetido',false);
end $$;

create or replace function public.cancelar_pagamento_antecipado(p_lote_id uuid, p_motivo text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if nullif(trim(p_motivo),'') is null then raise exception 'Informe o motivo do cancelamento.'; end if;
  update pagamentos_antecipados set status='Cancelado',motivo_cancelamento=trim(p_motivo),cancelado_em=now(),cancelado_por=auth.uid() where id=p_lote_id and status='Confirmado';
  if not found then raise exception 'Lote não encontrado ou já cancelado.'; end if;
  update financeiro set status='Cancelado', data_pagamento=null, forma_pagamento=null where pagamento_antecipado_id=p_lote_id and status='Pago';
end $$;
