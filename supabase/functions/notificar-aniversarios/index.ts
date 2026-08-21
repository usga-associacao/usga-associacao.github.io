// @ts-nocheck

// Edge Function: notificar-aniversarios
//
// Corre uma vez por dia (agendada via pg_cron, ver
// migration_aniversarios_automaticos.sql). Para cada sócio que:
//   - está com estado = 'ativo'
//   - faz anos hoje (mês e dia de data_nascimento coincidem com hoje)
//   - ainda não foi notificado este ano (ultimo_aniversario_notificado
//     é null ou diferente do ano atual)
// envia um email de parabéns, e marca ultimo_aniversario_notificado com o
// ano atual para nunca enviar duas vezes o mesmo aviso no mesmo ano.
//
// Precisa de duas secrets configuradas no projeto Supabase (Project Settings
// → Edge Functions → Secrets) -- as mesmas já usadas por
// notificar-quotas-expiradas:
//   RESEND_API_KEY       -- API key da conta Resend (https://resend.com)
//   RESEND_FROM_EMAIL    -- remetente verificado no Resend, ex: "USGA <geral@usga.pt>"
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já ficam disponíveis
// automaticamente em toda a Edge Function -- não é preciso configurá-los.
//
// IMPORTANTE: ao contrário do botão manual "🎉 Aniversário" em admin.html
// (que usa o template editável em Definições → Email), o texto abaixo está
// escrito diretamente no código. Para o alterar é preciso editar este
// ficheiro e voltar a fazer deploy:
//   supabase functions deploy notificar-aniversarios
//
// Nota sobre 29 de fevereiro: em anos que não são bissextos não existe esse
// dia, por isso quem nasceu a 29/02 não recebe o email nesses anos.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'USGA <onboarding@resend.dev>'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

  const hoje = new Date()
  const mesHoje = hoje.getUTCMonth() + 1
  const diaHoje = hoje.getUTCDate()
  const anoHoje = hoje.getUTCFullYear()

  const { data: socios, error } = await supabase
    .from('utilizadores')
    .select('id, nome, apelido, email, data_nascimento, ultimo_aniversario_notificado')
    .eq('estado', 'ativo')
    .not('data_nascimento', 'is', null)

  if (error) {
    console.error('Erro ao procurar socios:', error)
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
  }

  const aniversariantes = (socios || []).filter((s: { data_nascimento: string; ultimo_aniversario_notificado: number | null }) => {
    const nascimento = new Date(s.data_nascimento)
    const mesmoDia = nascimento.getUTCMonth() + 1 === mesHoje && nascimento.getUTCDate() === diaHoje
    const jaNotificadoEsteAno = s.ultimo_aniversario_notificado === anoHoje
    return mesmoDia && !jaNotificadoEsteAno
  })

  if (aniversariantes.length === 0) {
    return new Response(JSON.stringify({ ok: true, notificados: 0 }), { status: 200 })
  }

  const assunto = 'Feliz Aniversário! 🎉'
  let enviados = 0
  const falhas: string[] = []

  for (const socio of aniversariantes as { id: string; nome?: string; apelido?: string; email?: string }[]) {
    const email = socio.email
    if (!email) continue

    const nome = [socio.nome, socio.apelido].filter(Boolean).join(' ') || 'Sócio'

    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [email],
          subject: assunto,
          text: `Olá ${nome},\n\nEm nome de toda a Unidos por São Gens Ativo (USGA), desejamos-te um dia repleto de felicidade, saúde e momentos inesquecíveis.\n\nObrigado por fazeres parte do nosso clube. Agradecemos verdadeiramente o teu apoio e esperamos continuar a partilhar contigo muitas mais boas experiências.\n\nCom os melhores votos,\nA Equipa USGA`
        })
      })

      if (!resp.ok) {
        const corpo = await resp.text()
        falhas.push(`${email}: ${resp.status} ${corpo}`)
        await registarLog(supabase, email, assunto, 'erro', `${resp.status} ${corpo}`)
        continue
      }

      await supabase
        .from('utilizadores')
        .update({ ultimo_aniversario_notificado: anoHoje })
        .eq('id', socio.id)

      await registarLog(supabase, email, assunto, 'enviado', null)
      enviados++
    } catch (err) {
      falhas.push(`${email}: ${String(err)}`)
      await registarLog(supabase, email, assunto, 'erro', String(err))
    }
  }

  return new Response(JSON.stringify({ ok: true, notificados: enviados, falhas }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})