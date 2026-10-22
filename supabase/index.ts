// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.14'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const NOME_CLUBE = 'Unidos por São Gens Ativo (USGA)'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function preencherTemplate(texto: string, dados: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (match, chave) => dados[chave] ?? match)
}

const SITE_URL = 'https://usga-associacao.github.io'

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Versão HTML do email: o mesmo texto (dos modelos editáveis no admin) com o
// logótipo, links clicáveis e o rodapé da associação. O texto simples continua
// a ser enviado em paralelo para quem não vê HTML.
function construirHtmlEmail(texto: string): string {
  const corpo = escaparHtml(texto)
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" style="color:#4F8A34;font-weight:bold;word-break:break-all;">$1</a>')
    .replace(/\n/g, '<br>')
  return `<!doctype html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F9F3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F9F3;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
<tr><td align="center" style="padding:24px 24px 18px;border-bottom:4px solid #4F8A34;">
<img src="${SITE_URL}/images/logo-cabecalho.png" width="140" alt="USGA - Unidos por São Gens Ativo" style="display:block;width:140px;height:auto;border:0;">
</td></tr>
<tr><td style="padding:28px 28px 26px;font-size:15px;line-height:1.6;color:#333333;">${corpo}</td></tr>
<tr><td style="padding:18px 28px;background:#1a1a1a;color:#bbbbbb;font-size:12px;line-height:1.6;text-align:center;">
${escaparHtml(NOME_CLUBE)}<br><a href="${SITE_URL}" style="color:#ffffff;">usga-associacao.github.io</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

// Contribuição com o texto definido no evento (ex: "5 pedaladas"), nunca em euros.
function formatarContribuicao(valor: number | null, unidade: string | null): string {
  if (valor == null) return '-'
  const numero = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(valor)
  const texto = (unidade || '').trim()
  return texto ? `${numero} ${texto}` : numero
}

function formatarData(dataISO: string | null): string {
  if (!dataISO) return '-'
  return new Date(dataISO).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
}

function dominioEmail(email: string | undefined): string {
  return String(email || '').split('@')[1]?.trim().toLowerCase() || ''
}

// O Hotmail/Outlook/Sapo rejeitam ou mandam para o spam emails cujo remetente
// é de um domínio diferente da conta que autentica no SMTP (ex.: autenticar
// com @gmail.com e enviar como noreply@outro-dominio). Por isso o "noreply"
// só é usado quando é do mesmo domínio que smtp_user.
function obterRemetente(smtp: Record<string, string>): string {
  const noreplyValido = !!smtp.smtp_noreply_email && dominioEmail(smtp.smtp_noreply_email) === dominioEmail(smtp.smtp_user)
  const email = noreplyValido ? smtp.smtp_noreply_email : (smtp.smtp_from_email || smtp.smtp_user)
  const nome = (noreplyValido && smtp.smtp_noreply_name) || smtp.smtp_from_name
  return nome ? `${nome} <${email}>` : email
}

// As respostas dos sócios vão para o email principal da associação.
function obterResponderPara(smtp: Record<string, string>): string {
  return smtp.associacao_email_principal || smtp.smtp_from_email || smtp.smtp_user
}

async function obterConfigSmtp(supabase: ReturnType<typeof createClient>): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name', 'smtp_noreply_email', 'smtp_noreply_name', 'associacao_email_principal'])

  if (error) {
    console.error('Erro ao ler configuracoes:', error)
  }

  const resultado = Object.fromEntries((data || []).map((c: { chave: string; valor: string }) => [c.chave, c.valor]))

  console.log('Chaves encontradas em configuracoes:', Object.keys(resultado))
  console.log('smtp_host presente:', !!resultado.smtp_host)
  console.log('smtp_user presente:', !!resultado.smtp_user)
  console.log('smtp_password presente:', !!resultado.smtp_password)
  console.log('smtp_from_email presente:', !!resultado.smtp_from_email)

  return resultado
}

function smtpConfigurado(smtp: Record<string, string>): boolean {
  return !!(smtp.smtp_host && smtp.smtp_user && smtp.smtp_password)
}

async function enviarSmtp(smtp: Record<string, string>, opcoes: { to: string; subject: string; content: string; replyTo?: string }): Promise<void> {
  const transport = nodemailer.createTransport({
    host: smtp.smtp_host,
    port: Number(smtp.smtp_port) || 465,
    secure: smtp.smtp_secure === 'true',
    auth: {
      user: smtp.smtp_user,
      pass: smtp.smtp_password
    }
  })

  const remetente = obterRemetente(smtp)
  await transport.sendMail({
    from: remetente,
    to: opcoes.to,
    subject: opcoes.subject,
    text: opcoes.content,
    html: construirHtmlEmail(opcoes.content),
    replyTo: opcoes.replyTo || obterResponderPara(smtp)
  })
}

async function registarLog(supabase: ReturnType<typeof createClient>, tipo: string, destinatario: string, assunto: string, estado: 'enviado' | 'erro', erroDetalhe: string | null, inscricaoId: string | null = null): Promise<void> {
  await supabase.from('logs_email').insert({
    tipo, destinatario, assunto, estado, erro_detalhe: erroDetalhe, inscricao_id: inscricaoId
  })
}

async function processarInscricao(supabase: ReturnType<typeof createClient>, body: Record<string, string>): Promise<Response> {
  const tipo = body.tipo
  const inscricaoId = body.inscricao_id

  const { data: inscricao, error: inscricaoErr } = await supabase
    .from('inscricoes_evento')
    .select('nome, email, dorsal, public_token, pagamento_id, evento_provas(nome), eventos(titulo, data_evento, local, preco, contribuicao_unidade)')
    .eq('id', inscricaoId)
    .single()

  if (inscricaoErr || !inscricao) {
    await registarLog(supabase, tipo, 'desconhecido', '', 'erro', 'Inscrição não encontrada: ' + (inscricaoErr?.message || ''), inscricaoId)
    return jsonResponse({ ok: false, error: 'Inscrição não encontrada' })
  }

  // Numa inscrição de grupo o pagamento é partilhado; só o titular tem inscricao_evento_id.
  const { data: pagamento } = inscricao.pagamento_id
    ? await supabase.from('pagamentos').select('public_token, valor').eq('id', inscricao.pagamento_id).maybeSingle()
    : await supabase.from('pagamentos').select('public_token, valor').eq('inscricao_evento_id', inscricaoId).maybeSingle()

  const { data: grupo } = inscricao.pagamento_id
    ? await supabase
        .from('inscricoes_evento')
        .select('nome, dorsal, estado, evento_provas(nome)')
        .eq('pagamento_id', inscricao.pagamento_id)
        .order('data_inscricao', { ascending: true })
    : { data: null }

  const evento = inscricao.eventos as { titulo?: string; data_evento?: string; local?: string; preco?: number; contribuicao_unidade?: string } | null
  const prova = inscricao.evento_provas as { nome?: string } | null
  const participantes = (grupo || []) as { nome: string; dorsal: string | null; estado: string; evento_provas: { nome?: string } | null }[]
  const listaParticipantes = participantes
    .map(p => `- ${p.nome}${p.evento_provas?.nome ? ` (${p.evento_provas.nome})` : ''}${tipo === 'confirmada' && p.dorsal ? ` - dorsal ${p.dorsal}` : ''}`)
    .join('\n')

  const dadosTemplate: Record<string, string> = {
    nome: inscricao.nome || '',
    email: inscricao.email || '',
    evento: evento?.titulo || '',
    data_evento: formatarData(evento?.data_evento ?? null),
    local: evento?.local || '-',
    valor: formatarContribuicao(pagamento?.valor ?? evento?.preco ?? null, evento?.contribuicao_unidade ?? null),
    prova: prova?.nome || '-',
    participantes: listaParticipantes || inscricao.nome || '',
    dorsal: inscricao.dorsal || '-',
    link_estado: inscricao.public_token ? `https://usga-associacao.github.io/estado-inscricao.html?token=${inscricao.public_token}` : 'https://usga-associacao.github.io/estado-inscricao.html',
    link_pagamento: pagamento?.public_token ? `https://usga-associacao.github.io/pagamento-evento.html?token=${pagamento.public_token}` : 'https://usga-associacao.github.io/estado-inscricao.html'
  }

  const chaveAssunto = tipo === 'confirmada' ? 'template_confirmada_assunto' : tipo === 'rejeitada' ? 'template_rejeitada_assunto' : 'template_pendente_assunto'
  const chaveCorpo = tipo === 'confirmada' ? 'template_confirmada_corpo' : tipo === 'rejeitada' ? 'template_rejeitada_corpo' : 'template_pendente_corpo'

  const { data: configTemplates } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', [chaveAssunto, chaveCorpo])

  const mapaConfig = Object.fromEntries((configTemplates || []).map((c: { chave: string; valor: string }) => [c.chave, c.valor]))
  const assuntoTemplate = mapaConfig[chaveAssunto] || (tipo === 'rejeitada' ? `A sua inscrição em ${dadosTemplate.evento} não foi aceite` : `Atualização da sua inscrição - ${dadosTemplate.evento}`)
  const corpoTemplate = mapaConfig[chaveCorpo] || (tipo === 'rejeitada' ? 'Olá {{nome}}, lamentamos informar que a sua inscrição em {{evento}} não foi aceite. Se tiver dúvidas, contacte-nos através da página de suporte.' : 'Olá {{nome}}, a sua inscrição em {{evento}} foi atualizada. Pode consultar o estado da sua inscrição aqui: {{link_estado}}')

  const assunto = preencherTemplate(assuntoTemplate, dadosTemplate)
  let corpo = preencherTemplate(corpoTemplate, dadosTemplate)
  // Templates antigos não têm {{participantes}}: num grupo, a lista é acrescentada no fim.
  if (participantes.length > 1 && !corpoTemplate.includes('{{participantes}}')) {
    corpo += `\n\nParticipantes desta inscrição:\n${listaParticipantes}`
  }

  const smtp = await obterConfigSmtp(supabase)
  if (!smtpConfigurado(smtp)) {
    await registarLog(supabase, tipo, inscricao.email, assunto, 'erro', 'SMTP não configurado (falta host/utilizador/password/remetente em Definições → Email).', inscricaoId)
    return jsonResponse({ ok: false, error: 'SMTP não configurado' })
  }

  try {
    await enviarSmtp(smtp, { to: inscricao.email, subject: assunto, content: corpo })
    await registarLog(supabase, tipo, inscricao.email, assunto, 'enviado', null, inscricaoId)
    return jsonResponse({ ok: true })
  } catch (err) {
    await registarLog(supabase, tipo, inscricao.email, assunto, 'erro', String(err), inscricaoId)
    return jsonResponse({ ok: false, error: String(err) })
  }
}

async function processarSuporte(supabase: ReturnType<typeof createClient>, body: Record<string, string>): Promise<Response> {
  const mensagemId = body.mensagem_id

  const { data: mensagem, error: mensagemErr } = await supabase
    .from('mensagens_suporte')
    .select('nome, email, assunto, mensagem')
    .eq('id', mensagemId)
    .single()

  if (mensagemErr || !mensagem) {
    await registarLog(supabase, 'suporte', 'desconhecido', '', 'erro', 'Mensagem de suporte não encontrada: ' + (mensagemErr?.message || ''))
    return jsonResponse({ ok: false, error: 'Mensagem não encontrada' })
  }

  const smtp = await obterConfigSmtp(supabase)
  const destino = smtp.associacao_email_principal || 'usga.associacao@gmail.com'
  const assunto = `Novo pedido de suporte: ${mensagem.assunto}`
  const corpo = `Nome: ${mensagem.nome}\nEmail: ${mensagem.email}\n\nMensagem:\n${mensagem.mensagem}`

  if (!smtpConfigurado(smtp)) {
    await registarLog(supabase, 'suporte', destino, assunto, 'erro', 'SMTP não configurado (falta host/utilizador/password/remetente em Definições → Email).')
    return jsonResponse({ ok: false, error: 'SMTP não configurado' })
  }

  try {
    await enviarSmtp(smtp, { to: destino, subject: assunto, content: corpo, replyTo: `${mensagem.nome} <${mensagem.email}>` })
    await registarLog(supabase, 'suporte', destino, assunto, 'enviado', null)
    return jsonResponse({ ok: true })
  } catch (err) {
    await registarLog(supabase, 'suporte', destino, assunto, 'erro', String(err))
    return jsonResponse({ ok: false, error: String(err) })
  }
}

async function processarAniversario(req: Request, supabase: ReturnType<typeof createClient>, body: Record<string, string>): Promise<Response> {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '')

  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(jwt)
  if (userErr || !userData?.user) {
    return jsonResponse({ ok: false, error: 'Não autenticado' }, 401)
  }

  const { data: chamador } = await supabase
    .from('utilizadores')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (chamador?.role !== 'admin') {
    return jsonResponse({ ok: false, error: 'Sem permissão' }, 403)
  }

  const utilizadorId = body.utilizador_id

  const { data: membro, error: membroErr } = await supabase
    .from('utilizadores')
    .select('nome, apelido, email')
    .eq('id', utilizadorId)
    .single()

  if (membroErr || !membro?.email) {
    await registarLog(supabase, 'aniversario', 'desconhecido', '', 'erro', 'Sócio não encontrado ou sem email: ' + (membroErr?.message || ''))
    return jsonResponse({ ok: false, error: 'Sócio não encontrado ou sem email associado' })
  }

  const dadosTemplate: Record<string, string> = {
    nome: [membro.nome, membro.apelido].filter(Boolean).join(' ') || 'Sócio',
    email: membro.email,
    clube: NOME_CLUBE
  }

  const { data: configTemplates } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', ['template_aniversario_assunto', 'template_aniversario_corpo'])

  const mapaConfig = Object.fromEntries((configTemplates || []).map((c: { chave: string; valor: string }) => [c.chave, c.valor]))
  const assuntoTemplate = mapaConfig.template_aniversario_assunto || 'Feliz Aniversário! 🎉'
  const corpoTemplate = mapaConfig.template_aniversario_corpo || 'Olá {{nome}}, feliz aniversário da parte de {{clube}}!'

  const assunto = preencherTemplate(assuntoTemplate, dadosTemplate)
  const corpo = preencherTemplate(corpoTemplate, dadosTemplate)

  const smtp = await obterConfigSmtp(supabase)
  if (!smtpConfigurado(smtp)) {
    await registarLog(supabase, 'aniversario', membro.email, assunto, 'erro', 'SMTP não configurado (falta host/utilizador/password/remetente em Definições → Email).')
    return jsonResponse({ ok: false, error: 'SMTP não configurado. Vai a Definições → Email para o configurar.' })
  }

  try {
    await enviarSmtp(smtp, { to: membro.email, subject: assunto, content: corpo })
    await registarLog(supabase, 'aniversario', membro.email, assunto, 'enviado', null)
    return jsonResponse({ ok: true })
  } catch (err) {
    await registarLog(supabase, 'aniversario', membro.email, assunto, 'erro', String(err))
    return jsonResponse({ ok: false, error: String(err) })
  }
}

async function processarLembreteQuota(req: Request, supabase: ReturnType<typeof createClient>, body: Record<string, string>): Promise<Response> {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '')

  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(jwt)
  if (userErr || !userData?.user) {
    return jsonResponse({ ok: false, error: 'Não autenticado' }, 401)
  }

  const { data: chamador } = await supabase
    .from('utilizadores')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (chamador?.role !== 'admin') {
    return jsonResponse({ ok: false, error: 'Sem permissão' }, 403)
  }

  const quotaId = body.quota_id

  const { data: quota, error: quotaErr } = await supabase
    .from('quotas')
    .select('ano, data_expiracao, utilizadores(nome, apelido, email)')
    .eq('id', quotaId)
    .single()

  const membro = quota?.utilizadores as { nome?: string; apelido?: string; email?: string } | null

  if (quotaErr || !quota || !membro?.email) {
    await registarLog(supabase, 'lembrete_quota', 'desconhecido', '', 'erro', 'Quota não encontrada ou sócio sem email: ' + (quotaErr?.message || ''))
    return jsonResponse({ ok: false, error: 'Quota não encontrada ou sócio sem email associado' })
  }

  const dadosTemplate: Record<string, string> = {
    nome: [membro.nome, membro.apelido].filter(Boolean).join(' ') || 'Sócio',
    email: membro.email,
    clube: NOME_CLUBE,
    ano: String(quota.ano || ''),
    data_expiracao: formatarData(quota.data_expiracao ?? null)
  }

  const { data: configTemplates } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', ['template_lembrete_quota_assunto', 'template_lembrete_quota_corpo'])

  const mapaConfig = Object.fromEntries((configTemplates || []).map((c: { chave: string; valor: string }) => [c.chave, c.valor]))
  const assuntoTemplate = mapaConfig.template_lembrete_quota_assunto || 'A sua quota {{clube}} está prestes a expirar'
  const corpoTemplate = mapaConfig.template_lembrete_quota_corpo || 'Olá {{nome}}, a sua quota está ativa mas vai expirar em {{data_expiracao}}. Por favor renove o pagamento.'

  const assunto = preencherTemplate(assuntoTemplate, dadosTemplate)
  const corpo = preencherTemplate(corpoTemplate, dadosTemplate)

  const smtp = await obterConfigSmtp(supabase)
  if (!smtpConfigurado(smtp)) {
    await registarLog(supabase, 'lembrete_quota', membro.email, assunto, 'erro', 'SMTP não configurado (falta host/utilizador/password/remetente em Definições → Email).')
    return jsonResponse({ ok: false, error: 'SMTP não configurado. Vai a Definições → Email para o configurar.' })
  }

  try {
    await enviarSmtp(smtp, { to: membro.email, subject: assunto, content: corpo })
    await registarLog(supabase, 'lembrete_quota', membro.email, assunto, 'enviado', null)
    return jsonResponse({ ok: true })
  } catch (err) {
    await registarLog(supabase, 'lembrete_quota', membro.email, assunto, 'erro', String(err))
    return jsonResponse({ ok: false, error: String(err) })
  }
}

async function processarPedidoSocio(req: Request, supabase: ReturnType<typeof createClient>, body: Record<string, string>): Promise<Response> {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '')

  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(jwt)
  if (userErr || !userData?.user) {
    return jsonResponse({ ok: false, error: 'Não autenticado' }, 401)
  }

  const { data: chamador } = await supabase
    .from('utilizadores')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (chamador?.role !== 'admin') {
    return jsonResponse({ ok: false, error: 'Sem permissão' }, 403)
  }

  const tipo = body.tipo
  const pedidoId = body.pedido_id

  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos_socio')
    .select('nome, apelido, email')
    .eq('id', pedidoId)
    .single()

  if (pedidoErr || !pedido?.email) {
    await registarLog(supabase, 'socio_' + tipo, 'desconhecido', '', 'erro', 'Pedido não encontrado ou sem email: ' + (pedidoErr?.message || ''))
    return jsonResponse({ ok: false, error: 'Pedido não encontrado ou sem email associado' })
  }

  const dadosTemplate: Record<string, string> = {
    nome: [pedido.nome, pedido.apelido].filter(Boolean).join(' ') || 'Sócio',
    email: pedido.email,
    clube: NOME_CLUBE
  }

  const chaveAssunto = tipo === 'aprovado' ? 'template_socio_aprovado_assunto' : 'template_socio_rejeitado_assunto'
  const chaveCorpo = tipo === 'aprovado' ? 'template_socio_aprovado_corpo' : 'template_socio_rejeitado_corpo'

  const { data: configTemplates } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', [chaveAssunto, chaveCorpo])

  const mapaConfig = Object.fromEntries((configTemplates || []).map((c: { chave: string; valor: string }) => [c.chave, c.valor]))
  const assuntoTemplate = mapaConfig[chaveAssunto] || (tipo === 'aprovado' ? 'Bem-vindo à {{clube}}!' : 'O seu pedido de inscrição na {{clube}}')
  const corpoTemplate = mapaConfig[chaveCorpo] || (tipo === 'aprovado'
    ? 'Olá {{nome}}, o seu pedido para se tornar sócio da {{clube}} foi aprovado! Já pode aceder à sua área pessoal para consultar e pagar a sua quota.'
    : 'Olá {{nome}}, lamentamos informar que o seu pedido para se tornar sócio da {{clube}} não foi aceite. Se tiver dúvidas, contacte-nos através da página de suporte.')

  const assunto = preencherTemplate(assuntoTemplate, dadosTemplate)
  const corpo = preencherTemplate(corpoTemplate, dadosTemplate)

  const smtp = await obterConfigSmtp(supabase)
  if (!smtpConfigurado(smtp)) {
    await registarLog(supabase, 'socio_' + tipo, pedido.email, assunto, 'erro', 'SMTP não configurado (falta host/utilizador/password/remetente em Definições → Email).')
    return jsonResponse({ ok: false, error: 'SMTP não configurado. Vai a Definições → Email para o configurar.' })
  }

  try {
    await enviarSmtp(smtp, { to: pedido.email, subject: assunto, content: corpo })
    await registarLog(supabase, 'socio_' + tipo, pedido.email, assunto, 'enviado', null)
    return jsonResponse({ ok: true })
  } catch (err) {
    await registarLog(supabase, 'socio_' + tipo, pedido.email, assunto, 'erro', String(err))
    return jsonResponse({ ok: false, error: String(err) })
  }
}

async function processarFatura(req: Request, supabase: ReturnType<typeof createClient>, body: Record<string, string>): Promise<Response> {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '')

  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(jwt)
  if (userErr || !userData?.user) {
    return jsonResponse({ ok: false, error: 'Não autenticado' }, 401)
  }

  const { data: chamador } = await supabase
    .from('utilizadores')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (chamador?.role !== 'admin') {
    return jsonResponse({ ok: false, error: 'Sem permissão' }, 403)
  }

  const destinatarioEmail = body.destinatario_email
  const destinatarioNome = body.destinatario_nome || 'Sócio'
  const faturaPath = body.fatura_path

  if (!destinatarioEmail || !faturaPath) {
    return jsonResponse({ ok: false, error: 'Dados em falta' }, 400)
  }

  const { data: publicUrlData } = supabase.storage.from('faturas').getPublicUrl(faturaPath)
  const linkFatura = publicUrlData?.publicUrl || ''

  const assunto = 'A sua fatura já está disponível'
  const corpo = `Olá ${destinatarioNome},\n\nA sua fatura já está disponível para download:\n${linkFatura}\n\nObrigado,\n${NOME_CLUBE}`

  const smtp = await obterConfigSmtp(supabase)
  if (!smtpConfigurado(smtp)) {
    await registarLog(supabase, 'fatura', destinatarioEmail, assunto, 'erro', 'SMTP não configurado (falta host/utilizador/password/remetente em Definições → Email).')
    return jsonResponse({ ok: false, error: 'SMTP não configurado. Vai a Definições → Email para o configurar.' })
  }

  try {
    await enviarSmtp(smtp, { to: destinatarioEmail, subject: assunto, content: corpo })
    await registarLog(supabase, 'fatura', destinatarioEmail, assunto, 'enviado', null)
    return jsonResponse({ ok: true })
  } catch (err) {
    await registarLog(supabase, 'fatura', destinatarioEmail, assunto, 'erro', String(err))
    return jsonResponse({ ok: false, error: String(err) })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: Record<string, string> = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Pedido inválido' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const categoria = body.categoria

  if (categoria === 'inscricao') return processarInscricao(supabase, body)
  if (categoria === 'suporte') return processarSuporte(supabase, body)
  if (categoria === 'aniversario') return processarAniversario(req, supabase, body)
  if (categoria === 'fatura') return processarFatura(req, supabase, body)
  if (categoria === 'lembrete_quota') return processarLembreteQuota(req, supabase, body)
  if (categoria === 'pedido_socio') return processarPedidoSocio(req, supabase, body)

  return jsonResponse({ ok: false, error: 'Categoria desconhecida' }, 400)
})