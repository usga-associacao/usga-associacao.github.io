// @ts-nocheck

// Edge Function: notificar-aniversarios
//
// Corre uma vez por dia (agendada via pg_cron, ver
// supabase/migrations/20261022_agendamentos_emails.sql). Para cada utilizador que:
//   - está com estado = 'ativo'
//   - faz anos hoje (dia e mês de data_nascimento, na hora de Portugal)
//   - ainda não foi notificado este ano (ultimo_aniversario_notificado
//     é null ou diferente do ano atual)
// envia um email de parabéns e marca ultimo_aniversario_notificado com o
// ano atual, para nunca enviar duas vezes o mesmo aviso no mesmo ano.
//
// Envia pelo mesmo servidor SMTP (Gmail) e com o mesmo modelo editável do
// botão manual "🎉 Aniversário": Admin → Definições → Email. Não precisa de
// secrets próprias -- SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem em
// todas as Edge Functions.
//
// Nota sobre 29 de fevereiro: em anos que não são bissextos não existe esse
// dia, por isso quem nasceu a 29/02 não recebe o email nesses anos.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.14'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const NOME_CLUBE = 'Unidos por São Gens Ativo (USGA)'

const ASSUNTO_PADRAO = 'Feliz Aniversário! 🎉'
const CORPO_PADRAO = 'Olá {{nome}},\n\nEm nome de toda a {{clube}}, desejamos-te um dia repleto de felicidade, saúde e momentos inesquecíveis.\n\nObrigado por fazeres parte do nosso clube. Agradecemos verdadeiramente o teu apoio e esperamos continuar a partilhar contigo muitas mais boas experiências.\n\nCom os melhores votos,\nA Equipa USGA'

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function preencherTemplate(texto: string, dados: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (match, chave) => dados[chave] ?? match)
}

// Dia, mês e ano de hoje em Portugal (o agendamento corre em UTC).
function hojeEmPortugal(): { ano: number; mes: number; dia: number } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date())
      .map(p => [p.type, p.value])
  )
  return { ano: Number(partes.year), mes: Number(partes.month), dia: Number(partes.day) }
}

function dominioEmail(email: string | undefined): string {
  return String(email || '').split('@')[1]?.trim().toLowerCase() || ''
}

// Igual a enviar-email: o "noreply" só é usado se for do domínio da conta SMTP.
function obterRemetente(smtp: Record<string, string>): string {
  const noreplyValido = !!smtp.smtp_noreply_email && dominioEmail(smtp.smtp_noreply_email) === dominioEmail(smtp.smtp_user)
  const email = noreplyValido ? smtp.smtp_noreply_email : (smtp.smtp_from_email || smtp.smtp_user)
  const nome = (noreplyValido && smtp.smtp_noreply_name) || smtp.smtp_from_name
  return nome ? `${nome} <${email}>` : email
}

async function lerConfiguracoes(supabase: ReturnType<typeof createClient>): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', [
      'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_password',
      'smtp_from_email', 'smtp_from_name', 'smtp_noreply_email', 'smtp_noreply_name',
      'associacao_email_principal', 'template_aniversario_assunto', 'template_aniversario_corpo'
    ])
  if (error) console.error('Erro ao ler configuracoes:', error)
  return Object.fromEntries((data || []).map((c: { chave: string; valor: string }) => [c.chave, c.valor]))
}

async function registarLog(
  supabase: ReturnType<typeof createClient>,
  destinatario: string,
  assunto: string,
  estado: 'enviado' | 'erro',
  erroDetalhe: string | null
): Promise<void> {
  await supabase.from('logs_email').insert({
    tipo: 'aniversario', destinatario, assunto, estado, erro_detalhe: erroDetalhe
  })
}

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { ano, mes, dia } = hojeEmPortugal()

  const { data: socios, error } = await supabase
    .from('utilizadores')
    .select('id, nome, apelido, email, data_nascimento, ultimo_aniversario_notificado')
    .eq('estado', 'ativo')
    .not('data_nascimento', 'is', null)

  if (error) {
    console.error('Erro ao procurar socios:', error)
    return jsonResponse({ ok: false, error: error.message }, 500)
  }

  // data_nascimento é uma data simples ("AAAA-MM-DD"): compara-se o texto,
  // sem converter para Date, para não haver desvios de fuso horário.
  const aniversariantes = (socios || []).filter((s: { data_nascimento: string; ultimo_aniversario_notificado: number | null }) => {
    const [, m, d] = String(s.data_nascimento).split('-').map(Number)
    return m === mes && d === dia && s.ultimo_aniversario_notificado !== ano
  })

  if (aniversariantes.length === 0) {
    return jsonResponse({ ok: true, notificados: 0 })
  }

  const config = await lerConfiguracoes(supabase)
  if (!config.smtp_host || !config.smtp_user || !config.smtp_password) {
    for (const socio of aniversariantes) {
      if (socio.email) await registarLog(supabase, socio.email, ASSUNTO_PADRAO, 'erro', 'SMTP não configurado (Admin → Definições → Email).')
    }
    return jsonResponse({ ok: false, error: 'SMTP não configurado' }, 500)
  }

  const transport = nodemailer.createTransport({
    host: config.smtp_host,
    port: Number(config.smtp_port) || 465,
    secure: config.smtp_secure === 'true',
    auth: { user: config.smtp_user, pass: config.smtp_password }
  })
  const remetente = obterRemetente(config)
  const responderPara = config.associacao_email_principal || config.smtp_from_email || config.smtp_user
  const assuntoTemplate = config.template_aniversario_assunto || ASSUNTO_PADRAO
  const corpoTemplate = config.template_aniversario_corpo || CORPO_PADRAO

  let enviados = 0
  const falhas: string[] = []

  for (const socio of aniversariantes as { id: string; nome?: string; apelido?: string; email?: string }[]) {
    const email = socio.email
    if (!email) continue

    const dados = {
      nome: [socio.nome, socio.apelido].filter(Boolean).join(' ') || 'Sócio',
      email,
      clube: NOME_CLUBE
    }
    const assunto = preencherTemplate(assuntoTemplate, dados)
    const corpo = preencherTemplate(corpoTemplate, dados)

    try {
      await transport.sendMail({ from: remetente, to: email, subject: assunto, text: corpo, replyTo: responderPara })

      await supabase
        .from('utilizadores')
        .update({ ultimo_aniversario_notificado: ano })
        .eq('id', socio.id)

      await registarLog(supabase, email, assunto, 'enviado', null)
      enviados++
    } catch (err) {
      falhas.push(`${email}: ${String(err)}`)
      await registarLog(supabase, email, assunto, 'erro', String(err))
    }
  }

  return jsonResponse({ ok: true, notificados: enviados, falhas })
})
