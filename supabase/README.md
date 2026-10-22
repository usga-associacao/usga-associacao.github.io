# Supabase - USGA

Este diretorio guarda a base tecnica para ligar o site ao Supabase.

## 1. Criar a base de dados

Para um projeto Supabase novo:

1. Abrir `SQL Editor`.
2. Criar uma nova query.
3. Copiar o conteudo de `schema.sql`.
4. Executar a query.

Opcionalmente, executar depois o `seed.sql` para criar os eventos de exemplo que ja aparecem nas paginas HTML.

Para um projeto Supabase que ja tinha a versao anterior instalada:

1. Abrir `SQL Editor`.
2. Executar, por ordem de data, os ficheiros de `migrations/` que ainda nao foram aplicados.
3. Nao executar `schema.sql` por cima de uma base ja em uso, a menos que esteja a recriar tudo do zero.

**Atencao:** `schema.sql` esta desatualizado em relacao a base de dados em producao
(faltam, por exemplo, as tabelas `configuracoes` e `logs_email`, os triggers de email e
varias colunas acrescentadas pelo dashboard). As migracoes em `migrations/` foram escritas
a partir da estrutura real de producao, nao a partir de `schema.sql`.

Migracoes:

- `20261021_provas_documentos_grupos.sql` — provas por evento (`evento_provas`), documentos
  de informacao e resultados (`evento_documentos`), texto da contribuicao, inscricao de
  grupo (`criar_inscricao_grupo`, ate 5 participantes com um so pagamento).
- `20261022_emails_grupo.sql` — os triggers de email passam a enviar um so email por grupo.

**Emails de inscricao:** sao enviados pelo site (`js/main.js` e `admin.html` chamam a
Edge Function `enviar-email`). Os triggers `inscricoes_evento_email_*` existem mas estao
inativos, porque `edge_function_url_base` / `edge_function_service_key` nao estao
configurados (aparece um aviso nos logs da base de dados). Se um dia forem configurados,
retirar as chamadas do site para nao haver emails duplicados.

Isto cria as tabelas principais:

- `utilizadores`
- `pedidos_socio`
- `quotas`
- `eventos`
- `inscricoes_evento`
- `pagamentos`
- `mensagens_suporte`
- `audit_logs`

Tambem cria regras de seguranca com Row Level Security.

## 2. Modelo de estados

### Quotas

- `por_pagar`
- `pendente_validacao`
- `pago`
- `isento`
- `cancelado`

### Inscricoes em eventos

- `aguardando_pagamento`
- `confirmada`
- `rejeitada`
- `cancelada`

### Pagamentos

- `pendente`
- `em_validacao`
- `validado`
- `rejeitado`

Uma pessoa so deve aparecer na lista publica de inscritos quando a inscricao estiver:

- `estado = 'confirmada'`
- `pagamento_estado = 'validado'`

## 3. Ligacao ao associados.app

A tabela `quotas` ja tem campos para uma integracao futura:

- `associados_app_id`
- `associados_app_url`
- `origem`

Se o associados.app tiver API, estes campos podem guardar o identificador externo e o link direto da quota. Se nao tiver API, podem ser preenchidos por importacao CSV no back-office.

## 4. Proximo passo no site

Depois de executar `schema.sql`, o proximo passo e ligar:

- `login.html` ao `supabase.auth.signInWithPassword`
- `registar.html` ao `supabase.auth.signUp`
- `perfil.html` a `utilizadores`, `quotas` e `inscricoes_evento`

Essas funcoes ja estao preparadas em `js/supabase.js`.

## 5. Primeiro administrador

Depois de criares a tua conta pelo site, no SQL Editor do Supabase podes promover esse utilizador a admin:

```sql
update public.utilizadores
set role = 'admin'
where email = 'o-teu-email@example.com';
```

Depois disso, a pagina `admin.html` fica acessivel a essa conta.

## 6. Pagamentos e comprovativos

As inscricoes em eventos criam automaticamente um registo em `pagamentos`.

Fluxo recomendado:

1. Participante faz a inscricao.
2. A pagina de pagamento mostra valor, evento, referencia e estado.
3. Participante carrega o comprovativo.
4. O pagamento passa para `em_validacao`.
5. O admin valida ou rejeita no separador `Pagamentos`.

Os comprovativos usam o bucket privado `comprovativos`. O admin abre os ficheiros a partir do back-office atraves de URLs assinados temporarias.
