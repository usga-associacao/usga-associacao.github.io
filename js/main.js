document.addEventListener('DOMContentLoaded', async function () {
  document.querySelectorAll('input[type="password"]').forEach(function (input) {
    const wrapper = document.createElement('div')
    wrapper.style.position = 'relative'
    input.parentNode.insertBefore(wrapper, input)
    wrapper.appendChild(input)
    input.style.paddingRight = '42px'

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.textContent = 'Ver'
    toggle.setAttribute('aria-label', 'Mostrar password')
    toggle.style.cssText = 'position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:12px;font-weight:600;color:#666;padding:6px 8px;'
    wrapper.appendChild(toggle)

    toggle.addEventListener('click', function () {
      const isPassword = input.type === 'password'
      input.type = isPassword ? 'text' : 'password'
      toggle.textContent = isPassword ? 'Ocultar' : 'Ver'
      toggle.setAttribute('aria-label', isPassword ? 'Ocultar password' : 'Mostrar password')
    })
  })

  // ── Navbar Mobile (Hamburguer) — reconstruído de raiz ───────────
  // O <nav> original (usado no desktop) deixa de ser reaproveitado em
  // mobile. Em vez disso, é criado um painel novo e totalmente
  // independente, anexado diretamente ao <body>. Isto evita de vez
  // qualquer problema de "contexto de empilhamento" do CSS: um
  // elemento colocado dentro do .header fica sempre limitado ao
  // z-index do .header como um todo, não havendo forma fiável de o
  // pôr por cima de outra camada só ajustando o seu próprio z-index.
  // Construindo o painel do zero, fora do .header, este problema
  // deixa de poder acontecer.
  ;(function construirMenuMobile() {
    const header = document.querySelector('.header')
    const headerContainer = document.querySelector('.header-container')
    const navOriginal = document.querySelector('.nav')
    if (!header || !headerContainer || !navOriginal) return

    // Botão hamburguer (mantido no header, junto ao botão de login)
    const navToggle = document.createElement('button')
    navToggle.type = 'button'
    navToggle.className = 'nav-toggle'
    navToggle.setAttribute('aria-label', 'Abrir menu')
    navToggle.setAttribute('aria-expanded', 'false')
    navToggle.innerHTML = '<span></span><span></span><span></span>'
    const loginBtn = headerContainer.querySelector('.btn-primary')
    headerContainer.insertBefore(navToggle, loginBtn)

    // Overlay + painel novos, anexados diretamente ao <body>
    const overlay = document.createElement('div')
    overlay.className = 'mobile-nav-overlay'

    const panel = document.createElement('nav')
    panel.className = 'mobile-nav-panel'
    panel.setAttribute('aria-hidden', 'true')

    const list = document.createElement('ul')
    list.className = 'mobile-nav-list'

    // Copia os links a partir do <nav> de desktop (mesmo texto, mesmo href)
    navOriginal.querySelectorAll('a').forEach(originalLink => {
      const item = document.createElement('li')
      const linkClone = originalLink.cloneNode(true)
      linkClone.className = ''
      const hrefPagina = (linkClone.getAttribute('href') || '').split('?')[0].split('#')[0]
      if (hrefPagina && isPagina(hrefPagina)) {
        linkClone.classList.add('active')
      }
      item.appendChild(linkClone)
      list.appendChild(item)
    })

    panel.appendChild(list)
    document.body.appendChild(overlay)
    document.body.appendChild(panel)

    // O painel começa mesmo por baixo do cabeçalho, para que o botão
    // hamburguer nunca fique tapado pelo overlay/painel.
    function ajustarAlturaHeader() {
      document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px')
    }
    ajustarAlturaHeader()
    window.addEventListener('resize', ajustarAlturaHeader)

    function abrirMenu() {
      overlay.classList.add('open')
      panel.classList.add('open')
      navToggle.classList.add('open')
      navToggle.setAttribute('aria-label', 'Fechar menu')
      navToggle.setAttribute('aria-expanded', 'true')
      panel.setAttribute('aria-hidden', 'false')
      document.body.style.overflow = 'hidden'
    }

    function fecharMenu() {
      overlay.classList.remove('open')
      panel.classList.remove('open')
      navToggle.classList.remove('open')
      navToggle.setAttribute('aria-label', 'Abrir menu')
      navToggle.setAttribute('aria-expanded', 'false')
      panel.setAttribute('aria-hidden', 'true')
      document.body.style.overflow = ''
    }

    navToggle.addEventListener('click', () => {
      panel.classList.contains('open') ? fecharMenu() : abrirMenu()
    })

    overlay.addEventListener('click', fecharMenu)

    list.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function (event) {
        const href = this.getAttribute('href')
        const target = this.getAttribute('target')

        if (!href || target === '_blank') return

        if (href.startsWith('#')) {
          event.preventDefault()
          fecharMenu()
          return
        }

        // Não faz preventDefault: a navegação segue o seu curso normal,
        // apenas fechamos visualmente o painel.
        fecharMenu()
      })
    })

    window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fecharMenu() })
    window.addEventListener('resize', () => { if (window.innerWidth > 768 && panel.classList.contains('open')) fecharMenu() })
    window.addEventListener('orientationchange', fecharMenu)
  })()
  // ────────────────────────────────────────────────────────────────


  let api = null

  try {
    api = await import('./supabase.js')
  } catch (error) {
    console.error('Nao foi possivel carregar o Supabase.', error)
  }

  const sessao = api ? await api.getSessao() : null
  const loginBtn = document.querySelector('header .btn-primary')

  if (loginBtn && sessao) {
    loginBtn.textContent = 'O meu Perfil'
    loginBtn.href = 'perfil.html'
    loginBtn.style.backgroundColor = '#333'
  }

  if (isPagina('perfil.html') && api && !sessao) {
    window.location.href = 'login.html'
    return
  }

  configurarLogin(api)
  configurarRegisto(api)
  configurarPedidoSocio(api)
  configurarPerfil(api, sessao)
  configurarInscricaoEvento(api)
  configurarEventoPublico(api)
  await configurarPagamentoEvento(api)
  configurarEstadoInscricao(api)
  configurarAdmin(api)
  configurarLogout(api)
  configurarPreviewFoto()
  configurarSuporte(api)

  // Populate public events listing when on eventos.html
  configurarListaEventos(api)
  configurarProximosEventosHome(api)
  configurarTodosEventos(api)

  // Populate event detail pages (futuro / passado)
  configurarDetalheEvento(api)
})

async function configurarTodosEventos(api) {
  if (!api) return

  const grid = document.getElementById('eventosGrid')
  const noResults = document.getElementById('noResults')
  if (!grid) return

  let data = null
  let error = null
  let destino = 'evento-futuro.html'

  if (isPagina('todos-eventos-futuros.html')) {
    ;({ data, error } = await api.getEventosFuturos())
    destino = 'evento-futuro.html'
  } else if (isPagina('todos-eventos-passados.html')) {
    ;({ data, error } = await api.getEventosPassados())
    destino = 'evento-passado.html'
  } else {
    return
  }

  if (error) {
    grid.innerHTML = '<p>Erro ao carregar eventos.</p>'
    if (noResults) noResults.style.display = 'none'
    return
  }

  if (!data || data.length === 0) {
    grid.innerHTML = ''
    if (noResults) noResults.style.display = 'block'
    return
  }

  if (noResults) noResults.style.display = 'none'
  grid.innerHTML = data.map(ev => renderCardEvento(ev, destino)).join('')
}

function configurarLogin(api) {
  const loginForm = document.querySelector('#loginForm')
  if (!loginForm || !api) return

  mostrarMensagemQuery(loginForm)

  loginForm.addEventListener('submit', async function (event) {
    event.preventDefault()

    const email = loginForm.email.value.trim()
    const password = loginForm.password.value
    const submitBtn = loginForm.querySelector('button[type="submit"]')

    if (!email.includes('@')) {
      mostrarMensagem(loginForm, 'Para ja, entre com o email associado a sua conta.', 'erro')
      return
    }

    bloquearBotao(submitBtn, true, 'A entrar...')

    const { error } = await api.login(email, password)

    bloquearBotao(submitBtn, false, 'Entrar')

    if (error) {
      mostrarMensagem(loginForm, traduzirErroAuth(error.message), 'erro')
      return
    }

    // Se veio de uma página que exige sessão (ex.: estatutos.html), volta para lá;
    // caso contrário, segue para o perfil como antes. Só aceita caminhos relativos
    // internos, para evitar redireccionar para um site externo.
    const params = new URLSearchParams(window.location.search)
    const redirect = params.get('redirect')
    const destino = (redirect && !redirect.startsWith('http') && !redirect.startsWith('//')) ? redirect : 'perfil.html'
    window.location.href = destino
  })

  const linkEsqueceu = document.getElementById('linkEsqueceuPassword')
  const linkVoltar = document.getElementById('linkVoltarLogin')
  const formRecuperar = document.getElementById('formRecuperarPassword')

  if (linkEsqueceu && formRecuperar) {
    linkEsqueceu.addEventListener('click', function (event) {
      event.preventDefault()
      loginForm.style.display = 'none'
      formRecuperar.style.display = 'block'
    })
  }

  if (linkVoltar && formRecuperar) {
    linkVoltar.addEventListener('click', function (event) {
      event.preventDefault()
      formRecuperar.style.display = 'none'
      loginForm.style.display = ''
    })
  }

  if (formRecuperar) {
    formRecuperar.addEventListener('submit', async function (event) {
      event.preventDefault()

      const email = formRecuperar.emailRecuperar.value.trim()
      const submitBtn = formRecuperar.querySelector('button[type="submit"]')

      if (!email.includes('@')) {
        mostrarMensagem(formRecuperar, 'Introduza um email válido.', 'erro')
        return
      }

      bloquearBotao(submitBtn, true, 'A enviar...')

      await api.pedirRedefinicaoPassword(email)

      bloquearBotao(submitBtn, false, 'Enviar Link de Redefinição')

      mostrarMensagem(formRecuperar, 'Se este email estiver associado a uma conta, vai receber um link para definir uma nova password.', 'sucesso')
      formRecuperar.reset()
    })
  }
}

function configurarRegisto(api) {
  const registerForm = document.querySelector('#registerForm')
  if (!registerForm || !api) return

  registerForm.addEventListener('submit', async function (event) {
    event.preventDefault()

    const nome = registerForm.nome.value.trim()
    const apelido = registerForm.apelido.value.trim()
    const email = registerForm.email.value.trim()
    const password = registerForm.pass.value
    const confirmPassword = registerForm['confirm-pass'].value
    const submitBtn = registerForm.querySelector('button[type="submit"]')

    if (password !== confirmPassword) {
      mostrarMensagem(registerForm, 'As passwords não coincidem.', 'erro')
      return
    }

    if (password.length < 6) {
      mostrarMensagem(registerForm, 'A password deve ter pelo menos 6 caracteres.', 'erro')
      return
    }

    bloquearBotao(submitBtn, true, 'A criar conta...')

    const { error } = await api.registar(nome, apelido, email, password)

    bloquearBotao(submitBtn, false, 'Criar Conta')

    if (error) {
      mostrarMensagem(registerForm, traduzirErroAuth(error.message), 'erro')
      return
    }

    window.location.href = 'login.html?registo=sucesso'
  })
}

function configurarPedidoSocio(api) {
  if (!isPagina('registo-socio.html') || !api) return

  // Prefer selecting the form by its action attribute, but fall back to the known id
  // (the form's action attribute was removed in favour of id="registoSocioForm").
  let form = document.querySelector('form[action="pagamento-quota.html"]')
  if (!form) form = document.getElementById('registoSocioForm')
  if (!form) return

  form.addEventListener('submit', async function (event) {
    event.preventDefault()

    if (form.website && form.website.value.trim()) return

    const submitBtn = form.querySelector('button[type="submit"]')
    bloquearBotao(submitBtn, true, 'A guardar pedido...')

    const dados = {
      nome: form.nome.value.trim(),
      apelido: form.apelido.value.trim(),
      data_nascimento: form.nascimento.value || null,
      cidade: form.cidade.value.trim(),
      sexo: form.sexo.value,
      localidade: form.localidade.value.trim(),
      cc: form.cc.value.trim(),
      nif: form.nif.value.trim(),
      telefone: form.telefone.value.trim(),
      email: form.email.value.trim()
    }

    const { data, error } = await api.criarPedidoSocio(dados)

    bloquearBotao(submitBtn, false, 'Tornar-me Sócio')

    if (error) {
      mostrarMensagem(form, 'Não foi possível guardar o pedido. Confirme os dados e tente novamente.', 'erro')
      return
    }

    sessionStorage.setItem('usga_pedido_socio_id', data.id)

    // Se quem submeteu já tem sessão iniciada, cria-se logo a quota do ano
    // corrente e segue-se diretamente para o pagamento -- tal como pedido:
    // pagar a quota imediatamente no registo, sem esperar pela aprovação do
    // pedido pelo admin. Sem sessão, não há conta a associar à quota ainda,
    // por isso o pedido segue o caminho normal de aprovação manual (que já
    // cria a quota automaticamente ao atribuir o número de sócio).
    const sessaoAtual = await api.getSessao()
    if (sessaoAtual) {
      const { data: quotaData, error: quotaErr } = await api.garantirQuotaAtual()
      if (!quotaErr && quotaData?.quota_id) {
        window.location.href = `pagamento-quota.html?quota=${encodeURIComponent(quotaData.quota_id)}`
        return
      }
    }

    mostrarMensagem(form, 'Pedido registado com sucesso. A nossa equipa vai analisar o seu pedido em breve.', 'sucesso')
    form.reset()
  })
}

function configurarSuporte(api) {
  if (!isPagina('suporte.html') || !api) return

  const form = document.getElementById('suporteForm')
  if (!form) return

  form.addEventListener('submit', async function (event) {
    event.preventDefault()

    if (form.website && form.website.value.trim()) return

    const submitBtn = form.querySelector('button[type="submit"]')
    bloquearBotao(submitBtn, true, 'A enviar...')

    const dados = {
      nome: form.nome.value.trim(),
      email: form.email.value.trim(),
      assunto: form.assunto.value,
      mensagem: form.mensagem.value.trim()
    }

    const { data, error } = await api.criarMensagemSuporte(dados)

    if (error) {
      bloquearBotao(submitBtn, false, 'Enviar Mensagem')
      mostrarMensagem(form, 'Não foi possível enviar a mensagem. Tente novamente.', 'erro')
      return
    }

    // A mensagem já está guardada (e visível no admin); o email é um aviso extra.
    await api.dispararEmailSuporte(data.id)
    bloquearBotao(submitBtn, false, 'Enviar Mensagem')

    mostrarMensagem(form, 'Mensagem enviada com sucesso. Entraremos em contacto brevemente.', 'sucesso')
    form.reset()
  })
}

async function configurarPerfil(api, sessao) {
  if (!isPagina('perfil.html') || !api || !sessao) return

  const { data: perfil, error } = await api.getPerfil(sessao.user.id)
  if (error || !perfil) return

  const nomeCompleto = [perfil.nome, perfil.apelido].filter(Boolean).join(' ')
  const primeiroNome = perfil.nome || 'Socio'

  const heroTitle = document.querySelector('.hero-content h1')
  const profileName = document.querySelector('.profile-name')
  const profileType = document.querySelector('.profile-type')
  const inputNome = document.getElementById('inputNome')
  const inputEmail = document.getElementById('inputEmail')
  const inputTelefone = document.getElementById('inputTelefone')
  const inputNif = document.getElementById('inputNif')
  const inputDataNascimento = document.getElementById('inputDataNascimento')
  const inputCidade = document.getElementById('inputCidade')

  if (heroTitle) heroTitle.textContent = `Olá, ${primeiroNome}`
  if (profileName) profileName.textContent = nomeCompleto || perfil.email
  if (profileType) {
    profileType.textContent = perfil.numero_socio
      ? `Sócio n.º ${perfil.numero_socio}`
      : 'Conta registada'
  }

  if (inputNome) inputNome.value = nomeCompleto
  if (inputEmail) inputEmail.value = perfil.email || ''
  if (inputTelefone) inputTelefone.value = perfil.telefone || ''
  if (inputNif) inputNif.value = perfil.nif || ''
  if (inputDataNascimento) inputDataNascimento.value = perfil.data_nascimento || ''
  if (inputCidade) inputCidade.value = perfil.cidade || ''

  if (perfil.role === 'admin') adicionarLinkAdminPerfil()

  configurarEdicaoPerfil(api, sessao, perfil)

  await carregarQuotasPerfil(api, sessao.user.id)
  await carregarEventosPerfil(api, sessao.user.id)
}

function configurarEdicaoPerfil(api, sessao, perfil) {
  const form = document.getElementById('formDados')
  const btnEditar = document.getElementById('btnEditar')
  const btnCancelar = document.getElementById('btnCancelar')
  const botoesEdicao = document.getElementById('botoesEdicao')
  const inputNome = document.getElementById('inputNome')
  const inputTelefone = document.getElementById('inputTelefone')
  const inputNif = document.getElementById('inputNif')
  const inputDataNascimento = document.getElementById('inputDataNascimento')
  const inputCidade = document.getElementById('inputCidade')

  if (!form || !btnEditar || !botoesEdicao) return

  // O email e o Cartao de Cidadao nao sao editaveis por este formulario: o
  // email exige um fluxo proprio de verificacao no Supabase Auth, e o CC e
  // um documento de identificacao que nao deve ser alterado livremente pelo
  // proprio utilizador, por isso ficam sempre desativados.
  const editaveis = [inputNome, inputTelefone, inputNif, inputDataNascimento, inputCidade].filter(Boolean)

  function entrarModoEdicao() {
    editaveis.forEach(input => { input.disabled = false })
    botoesEdicao.style.display = 'flex'
    btnEditar.style.display = 'none'
    if (editaveis[0]) editaveis[0].focus()
  }

  function sairModoEdicao() {
    editaveis.forEach(input => { input.disabled = true })
    botoesEdicao.style.display = 'none'
    btnEditar.style.display = ''
  }

  function repor() {
    const nomeCompleto = [perfil.nome, perfil.apelido].filter(Boolean).join(' ')
    if (inputNome) inputNome.value = nomeCompleto
    if (inputTelefone) inputTelefone.value = perfil.telefone || ''
    if (inputNif) inputNif.value = perfil.nif || ''
    if (inputDataNascimento) inputDataNascimento.value = perfil.data_nascimento || ''
    if (inputCidade) inputCidade.value = perfil.cidade || ''
  }

  btnEditar.addEventListener('click', entrarModoEdicao)

  if (btnCancelar) {
    btnCancelar.addEventListener('click', () => {
      repor()
      sairModoEdicao()
    })
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault()

    const submitBtn = form.querySelector('button[type="submit"]')
    bloquearBotao(submitBtn, true, 'A guardar...')

    const partesNome = (inputNome?.value || '').trim().split(/\s+/).filter(Boolean)
    const dados = {
      nome: partesNome[0] || perfil.nome,
      apelido: partesNome.slice(1).join(' ') || null,
      telefone: inputTelefone?.value.trim() || null,
      nif: inputNif?.value.trim() || null,
      data_nascimento: inputDataNascimento?.value || null,
      cidade: inputCidade?.value.trim() || null
    }

    const { error } = await api.atualizarPerfil(sessao.user.id, dados)

    bloquearBotao(submitBtn, false, 'Guardar')

    if (error) {
      mostrarMensagem(form, 'Não foi possível guardar as alterações. Tente novamente.', 'erro')
      return
    }

    perfil.nome = dados.nome
    perfil.apelido = dados.apelido
    perfil.telefone = dados.telefone
    perfil.nif = dados.nif

    mostrarMensagem(form, 'Perfil atualizado com sucesso.', 'sucesso')
    sairModoEdicao()
  })
}

async function carregarQuotasPerfil(api, utilizadorId) {
  const quotaBox = Array.from(document.querySelectorAll('.content-box'))
    .find(box => box.textContent.includes('Estado das Quotas'))
  const tbody = quotaBox?.querySelector('tbody')
  const badgeEstado = quotaBox?.querySelector('.box-header .badge')

  if (!tbody) return

  const { data: quotas, error } = await api.getMinhasQuotas(utilizadorId)

  if (error) {
    tbody.innerHTML = '<tr><td colspan="8">Não foi possível carregar as quotas.</td></tr>'
    return
  }

  if (!quotas || quotas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">Ainda não existem quotas registadas.</td></tr>'
    if (badgeEstado) {
      badgeEstado.textContent = 'Sem quotas'
      badgeEstado.className = 'badge badge-pendente'
    }
    return
  }

  const temQuotaPendente = quotas.some(quota => ['por_pagar', 'pendente_validacao'].includes(quota.estado))

  if (badgeEstado) {
    badgeEstado.textContent = temQuotaPendente ? 'Quota pendente' : 'Sócio Ativo'
    badgeEstado.className = temQuotaPendente ? 'badge badge-pendente' : 'badge badge-socio'
  }

  const temQuotaAtiva = quotas.some(quota => {
    if (quota.estado === 'isento') return true
    if (quota.estado !== 'pago') return false
    const validade = api.calcularValidadeQuota(quota)
    return validade && validade.diasRestantes >= 0
  })

  const btnRenovar = document.getElementById('btnRenovarQuota')
  if (btnRenovar) {
    btnRenovar.style.display = temQuotaAtiva ? 'none' : 'inline-block'
    btnRenovar.addEventListener('click', async function () {
      btnRenovar.disabled = true
      btnRenovar.textContent = 'A preparar...'
      const { data: quotaData, error: quotaErr } = await api.garantirQuotaAtual()
      if (quotaErr || !quotaData?.quota_id) {
        alert('Não foi possível preparar a renovação. Tente novamente.')
        btnRenovar.disabled = false
        btnRenovar.textContent = 'Renovar Quota'
        return
      }
      window.location.href = `pagamento-quota.html?quota=${encodeURIComponent(quotaData.quota_id)}`
    })
  }

  tbody.innerHTML = quotas.map(quota => {
    const pago = quota.estado === 'pago' || quota.estado === 'isento'
    const estadoLabel = estadoQuotaLabel(quota.estado)
    const faturaUrl = quota.fatura_url ? api.getFaturaUrl(quota.fatura_url) : null
    const fatura = faturaUrl
      ? `<a href="${faturaUrl}" target="_blank" rel="noopener" style="color: var(--accent-color);">Download</a>`
      : quota.associados_app_url
        ? `<a href="${quota.associados_app_url}" target="_blank" rel="noopener" style="color: var(--accent-color);">Abrir</a>`
        : '-'

    const validade = api.calcularValidadeQuota(quota)
    let validadeCelula = '-'
    if (validade) {
      if (validade.diasRestantes < 0) {
        validadeCelula = '<span class="badge badge-nao-socio">Expirada</span>'
      } else if (validade.diasRestantes <= 30) {
        validadeCelula = `<span class="badge badge-pendente">Expira em ${validade.diasRestantes} dia(s)</span>`
      } else {
        validadeCelula = api.formatarData(validade.dataExpiracao.toISOString())
      }
    }

    const acao = quota.estado === 'por_pagar' || quota.estado === 'pendente_validacao'
      ? `<a href="pagamento-quota.html?quota=${encodeURIComponent(quota.id)}" class="btn btn-small btn-primary">Pagar</a>`
      : '-'

    return `
      <tr>
        <td><strong>${quota.ano}</strong></td>
        <td>${quota.data_limite ? api.formatarData(quota.data_limite) : '-'}</td>
        <td>${api.formatarMoeda(quota.valor)}</td>
        <td>${validadeCelula}</td>
        <td>${quota.data_pagamento ? api.formatarData(quota.data_pagamento) : '-'}</td>
        <td><span class="badge ${pago ? 'badge-pago' : 'badge-pendente'}">${estadoLabel}</span></td>
        <td>${fatura}</td>
        <td>${acao}</td>
      </tr>
    `
  }).join('')
}

async function carregarEventosPerfil(api, utilizadorId) {
  const container = document.getElementById('listaEventos')
  if (!container) return

  const { data: inscricoes, error } = await api.getMinhasInscricoes(utilizadorId)

  if (error) {
    container.innerHTML = '<p style="color:#c00; text-align:center;">Não foi possível carregar os seus eventos.</p>'
    return
  }

  if (!inscricoes || inscricoes.length === 0) {
    container.innerHTML = '<p style="color:#999; text-align:center;">Ainda não se inscreveu em nenhum evento.</p>'
    return
  }

  const estadoBadge = {
    confirmada: '<span class="badge badge-pago">Confirmada</span>',
    pendente: '<span class="badge badge-pendente">Pendente</span>',
    rejeitada: '<span class="badge badge-nao-socio">Rejeitada</span>',
    cancelada: '<span class="badge badge-nao-socio">Cancelada</span>'
  }

  container.innerHTML = inscricoes.map(inscricao => {
    const evento = inscricao.eventos
    const badge = estadoBadge[inscricao.estado] || inscricao.estado
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:16px; border:1px solid var(--border-color); border-radius:8px; flex-wrap:wrap;">
        <div style="min-width:0;">
          <strong>${escapeHtml(evento?.titulo) || 'Evento'}</strong>${inscricao.evento_provas?.nome ? ` <span style="color:#777;">&middot; ${escapeHtml(inscricao.evento_provas.nome)}</span>` : ''}<br>
          <span style="color:#999; font-size:13px;">${evento?.data_evento ? api.formatarData(evento.data_evento) : '-'}</span>
        </div>
        <div>${badge}</div>
      </div>
    `
  }).join('')
}

const MAX_PARTICIPANTES = 5

async function configurarInscricaoEvento(api) {
  if (!isPagina('inscricao-evento.html') || !api) return

  const form = document.getElementById('inscricaoForm')
  const lista = document.getElementById('listaParticipantes')
  const tpl = document.getElementById('tplParticipante')
  const btnAdicionar = document.getElementById('btnAdicionarParticipante')
  const resumo = document.getElementById('resumoTotal')
  if (!form || !lista || !tpl) return

  const submitBtn = form.querySelector('button[type="submit"]')
  const tituloEvento = document.getElementById('nomeEvento')
  const evento = await carregarEventoAtual(api)

  let provas = []
  if (evento) {
    const { data } = await api.getProvasEvento(evento.id)
    provas = data || []
  }

  if (tituloEvento) tituloEvento.textContent = evento ? (evento.titulo || 'Evento') : 'Evento não encontrado'

  if (!evento || provas.length === 0 || evento.estado !== 'aberto') {
    if (btnAdicionar) btnAdicionar.style.display = 'none'
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.style.opacity = '0.6'
      submitBtn.textContent = evento?.estado === 'brevemente' ? 'Inscrições brevemente disponíveis' : 'Inscrições indisponíveis'
    }
    return
  }

  const multiplas = !!evento.permite_multiplas_provas
  const unidade = evento.contribuicao_unidade
  let contador = 0

  function provasSelecionadas(bloco) {
    return Array.from(bloco.querySelectorAll('.provas-opcoes input:checked')).map(i => i.value)
  }

  function renderOpcoesProva(bloco, uid) {
    const container = bloco.querySelector('.provas-opcoes')
    const titulo = bloco.querySelector('.participante-provas-titulo')

    // Uma só prova: fica escolhida automaticamente.
    if (provas.length === 1) {
      const p = provas[0]
      titulo.textContent = 'Prova'
      container.innerHTML = `
        <input type="checkbox" value="${escapeHtml(p.id)}" checked hidden>
        <div class="prova-unica"><strong>${escapeHtml(p.nome)}</strong> &mdash; ${escapeHtml(api.formatarContribuicao(p.valor, unidade))}</div>`
      return
    }

    titulo.textContent = multiplas ? 'Provas * (pode escolher mais do que uma)' : 'Prova *'
    const tipo = multiplas ? 'checkbox' : 'radio'
    container.innerHTML = provas.map(p => `
      <label class="prova-opcao">
        <input type="${tipo}" name="provas_${uid}" value="${escapeHtml(p.id)}">
        <span class="prova-opcao-texto">
          <strong>${escapeHtml(p.nome)}</strong>
          ${p.descricao ? `<small>${escapeHtml(p.descricao)}</small>` : ''}
        </span>
        <span class="prova-opcao-valor">${escapeHtml(api.formatarContribuicao(p.valor, unidade))}</span>
      </label>`).join('')
  }

  function renumerar() {
    Array.from(lista.children).forEach((bloco, indice) => {
      bloco.querySelector('.participante-num').textContent = indice + 1
      // O 1.º participante usa o contacto do formulário; os restantes podem ter o seu.
      bloco.querySelector('.participante-remover').style.display = indice === 0 ? 'none' : ''
      bloco.querySelector('.participante-contacto').style.display = indice === 0 ? 'none' : ''
    })
    if (btnAdicionar) btnAdicionar.style.display = lista.children.length >= MAX_PARTICIPANTES ? 'none' : ''
  }

  function atualizarTotal() {
    if (!resumo) return
    let total = 0
    const linhas = []
    Array.from(lista.children).forEach((bloco, indice) => {
      const nome = bloco.querySelector('[data-campo="nome"]').value.trim() || `Participante ${indice + 1}`
      provasSelecionadas(bloco).forEach(provaId => {
        const prova = provas.find(p => p.id === provaId)
        if (!prova) return
        total += Number(prova.valor) || 0
        linhas.push(`<div class="inscricao-total-linha"><span>${escapeHtml(nome)} &middot; ${escapeHtml(prova.nome)}</span><span>${escapeHtml(api.formatarContribuicao(prova.valor, unidade))}</span></div>`)
      })
    })
    resumo.innerHTML = linhas.join('') +
      `<div class="inscricao-total-valor"><span>Contribuição total</span><strong>${escapeHtml(api.formatarContribuicao(total, unidade))}</strong></div>`
  }

  function adicionarParticipante() {
    if (lista.children.length >= MAX_PARTICIPANTES) return
    const uid = ++contador
    const bloco = tpl.content.firstElementChild.cloneNode(true)
    bloco.querySelectorAll('[data-campo]').forEach(el => { el.id = `${el.dataset.campo}_${uid}` })
    bloco.querySelectorAll('label[data-para]').forEach(label => { label.htmlFor = `${label.dataset.para}_${uid}` })
    renderOpcoesProva(bloco, uid)
    bloco.querySelector('.participante-remover').addEventListener('click', () => {
      bloco.remove()
      renumerar()
      atualizarTotal()
    })
    lista.appendChild(bloco)
    renumerar()
    atualizarTotal()
    if (uid > 1) bloco.querySelector('[data-campo="nome"]').focus()
  }

  lista.addEventListener('input', atualizarTotal)
  lista.addEventListener('change', atualizarTotal)
  if (btnAdicionar) btnAdicionar.addEventListener('click', adicionarParticipante)
  adicionarParticipante()

  form.addEventListener('submit', async function (event) {
    event.preventDefault()

    if (form.website && form.website.value.trim()) return

    const blocos = Array.from(lista.children)
    const semProva = blocos.findIndex(bloco => provasSelecionadas(bloco).length === 0)
    if (semProva !== -1) {
      mostrarMensagem(form, `Escolha a prova do participante ${semProva + 1}.`, 'erro')
      blocos[semProva].scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const campo = (bloco, nome) => bloco.querySelector(`[data-campo="${nome}"]`).value.trim()
    const dados = {
      evento_id: evento.id,
      email: form.email.value.trim(),
      telefone: form.telefone.value.trim(),
      nif: form.nif.value.trim(),
      pedido_fatura: form.pedido_fatura.checked,
      participantes: blocos.map((bloco, indice) => ({
        nome: campo(bloco, 'nome'),
        data_nascimento: campo(bloco, 'nascimento') || null,
        sexo: campo(bloco, 'sexo'),
        pais: campo(bloco, 'pais'),
        localidade: campo(bloco, 'localidade'),
        equipa: campo(bloco, 'equipa') || null,
        bi: campo(bloco, 'bi'),
        tamanho_tshirt: campo(bloco, 'tamanho_tshirt') || null,
        email: indice === 0 ? null : (campo(bloco, 'email') || null),
        telefone: indice === 0 ? null : (campo(bloco, 'telefone') || null),
        provas: provasSelecionadas(bloco)
      }))
    }

    bloquearBotao(submitBtn, true, 'A guardar inscrição...')
    const { data, error } = await api.criarInscricaoGrupo(dados)
    bloquearBotao(submitBtn, false, 'Seguir para Pagamento')

    if (error) {
      // P0001 = mensagem escrita por nós na função criar_inscricao_grupo
      const texto = error.code === 'P0001' && error.message
        ? error.message
        : 'Não foi possível guardar a inscrição. Tente novamente.'
      mostrarMensagem(form, texto, 'erro')
      form.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    // Um só email para o contacto; a função enviar-email junta a lista do grupo.
    // Espera pelo envio (no máximo 8 s) antes de mudar para a página de pagamento:
    // se a página mudar logo, o browser cancela o pedido e o email não é enviado.
    bloquearBotao(submitBtn, true, 'A enviar email de confirmação...')
    await Promise.race([
      api.dispararEmailInscricao(data.inscricao_id, 'pendente'),
      new Promise(resolve => setTimeout(resolve, 8000))
    ])

    const pagamentoToken = data.pagamento_token || data.public_token

    sessionStorage.setItem('usga_inscricao_evento_id', data.inscricao_id)
    sessionStorage.setItem('usga_inscricao_evento_token', pagamentoToken)
    if (data.pagamento_id) sessionStorage.setItem('usga_pagamento_id', data.pagamento_id)
    sessionStorage.setItem('usga_pagamento_token', pagamentoToken)

    const params = new URLSearchParams({
      inscricao: data.inscricao_id,
      token: pagamentoToken
    })

    window.location.href = `pagamento-evento.html?${params.toString()}`
  })
}

async function configurarEventoPublico(api) {
  if (!isPagina('evento-futuro.html') || !api) return

  const evento = await carregarEventoAtual(api)
  atualizarLinkInscricaoEvento()

  if (!evento) return

  const [{ data: inscritos, error }, { data: provas }] = await Promise.all([
    api.getInscritosConfirmados(evento.id),
    api.getProvasEvento(evento.id)
  ])
  const tbody = document.querySelector('#participantsTable tbody')
  const stats = document.querySelectorAll('.stat-number')

  if (!tbody) return

  // A coluna "Prova" só aparece quando o evento tem mais do que uma prova.
  const mostrarProva = (provas || []).length > 1
  document.querySelectorAll('#participantsTable th.col-prova').forEach(th => { th.style.display = mostrarProva ? '' : 'none' })
  const colunas = mostrarProva ? 6 : 5

  if (error) {
    tbody.innerHTML = `<tr><td colspan="${colunas}">Não foi possível carregar a lista de inscritos.</td></tr>`
    return
  }

  if (!inscritos || inscritos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colunas}">Ainda não existem inscrições para este evento.</td></tr>`
  } else {
    tbody.innerHTML = inscritos.map((inscrito, index) => {
      const confirmado = inscrito.estado_publico === 'confirmada'
      const badge = confirmado
        ? '<span class="badge badge-pago">Confirmado</span>'
        : '<span class="badge badge-pendente">Pendente</span>'
      const dorsal = confirmado ? (inscrito.dorsal || String(index + 1).padStart(3, '0')) : '-'
      return `
      <tr>
        <td style="font-weight:bold; color: #666;">${abreviarPais(inscrito.pais)}</td>
        <td>${escapeHtml(inscrito.nome)}</td>
        ${mostrarProva ? `<td>${escapeHtml(inscrito.prova_nome) || '-'}</td>` : ''}
        <td>${escapeHtml(inscrito.equipa) || '-'}</td>
        <td><strong>${dorsal}</strong></td>
        <td>${badge}</td>
      </tr>
    `
    }).join('')
  }

  if (stats.length >= 3) {
    const confirmados = inscritos?.filter(i => i.estado_publico === 'confirmada').length || 0
    const total = inscritos?.length || 0
    stats[0].textContent = total
    stats[1].textContent = confirmados
    stats[2].textContent = total - confirmados
  }
}

async function configurarPagamentoEvento(api) {
  if (!isPagina('pagamento-evento.html')) return
  configurarAjudasPagamento()
  if (!api) return

  const params = new URLSearchParams(window.location.search)
  const token = params.get('token') || sessionStorage.getItem('usga_inscricao_evento_token')
  if (!token) return

  const valorEl = document.getElementById('valorPagar')
  const eventoEl = document.getElementById('nomeEvento')
  const inscritoEl = document.getElementById('nomeInscrito')
  const estadoEl = document.getElementById('estadoPagamento')
  const referenciaEl = document.getElementById('referencia')
  const comprovativoForm = document.getElementById('comprovativoForm')
  const mensagemBox = document.getElementById('mensagemComprovativo')

  try {
    const { data: pagamentoData, error: pagamentoError } = await api.getPagamentoPublico(token)

    let dataToUse = null
    let pagamentoDataFetched = null

    if (!pagamentoError && pagamentoData) {
      dataToUse = pagamentoData
      pagamentoDataFetched = pagamentoData
    } else {
      const { data: estadoData, error: estadoError } = await api.getEstadoInscricao(token)
      if (estadoError || !estadoData) {
        if (valorEl) valorEl.textContent = 'A carregar...'
        if (eventoEl) eventoEl.textContent = 'Evento não encontrado'
        if (inscritoEl) inscritoEl.textContent = '-'
        if (estadoEl) estadoEl.textContent = '-'
        if (referenciaEl) referenciaEl.textContent = '-'

        if (comprovativoForm) {
          comprovativoForm.querySelectorAll('input, button').forEach(i => i.disabled = true)
          if (mensagemBox) {
            mensagemBox.style.display = 'block'
            mensagemBox.style.background = '#fee2e2'
            mensagemBox.style.border = '1px solid #fca5a5'
            mensagemBox.style.color = '#991b1b'
            mensagemBox.textContent = 'Não foi possível localizar a inscrição. Verifique o código e tente novamente.'
          }
        }
        return
      }
      dataToUse = estadoData
    }

    const titulo = dataToUse.evento_titulo || dataToUse.evento?.titulo || dataToUse.titulo || '-'
    const nome = dataToUse.nome || dataToUse.inscrito_nome || '-'
    const pagamentoEstado = dataToUse.pagamento_estado || dataToUse.estado || dataToUse.estado || '-'
    const estadoInscricao = dataToUse.estado || '-'
    let valor = dataToUse.valor || dataToUse.pagamento_valor || dataToUse.valor_pagamento || null

    if (!valor) {
      const inscricaoId = dataToUse.inscricao_id || dataToUse.inscricao || sessionStorage.getItem('usga_inscricao_evento_id')
      if (inscricaoId) {
        const { data: inscricao, error: insErr } = await api.getInscricaoById(inscricaoId)
        if (!insErr && inscricao) {
          const ev = inscricao.eventos || inscricao.evento || null
          if (ev) {
            valor = ev.preco ?? null
            if (!titulo && ev.titulo) dataToUse.evento_titulo = ev.titulo
            if (!nome && inscricao.nome) dataToUse.nome = inscricao.nome
          }
        }

        if (!valor) {
          const { data: pagamentoByInscricao, error: pbiErr } = await api.getPagamentoByInscricao(inscricaoId)
          if (!pbiErr && pagamentoByInscricao) {
            valor = pagamentoByInscricao.valor || null
            pagamentoDataFetched = pagamentoByInscricao
            if (!titulo && pagamentoByInscricao.evento_titulo) dataToUse.evento_titulo = pagamentoByInscricao.evento_titulo
            if (!nome && pagamentoByInscricao.inscrito_nome) dataToUse.nome = pagamentoByInscricao.inscrito_nome
          }
        }
      }
    }

    // Participantes ligados a este pagamento (1 numa inscrição individual, até 5 num grupo)
    const { data: grupo } = await api.getParticipantesGrupo(token)
    const unidade = grupo?.[0]?.contribuicao_unidade || null

    if (valorEl) valorEl.textContent = valor ? api.formatarContribuicao(valor, unidade) : 'A aguardar valor'
    if (eventoEl) eventoEl.textContent = titulo
    if (inscritoEl) {
      if (grupo && grupo.length > 0) {
        inscritoEl.innerHTML = grupo
          .map(g => `${escapeHtml(g.nome)}${g.prova_nome ? ` <small style="font-weight:400;color:#777;">(${escapeHtml(g.prova_nome)})</small>` : ''}`)
          .join('<br>')
      } else {
        inscritoEl.textContent = nome
      }
    }

    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      let debugDiv = document.getElementById('debugPagamento')
      if (!debugDiv) {
        debugDiv = document.createElement('pre')
        debugDiv.id = 'debugPagamento'
        debugDiv.style.background = '#f7f7f7'
        debugDiv.style.border = '1px solid #eee'
        debugDiv.style.padding = '10px'
        debugDiv.style.marginTop = '12px'
        const container = document.querySelector('.payment-box') || document.body
        container.appendChild(debugDiv)
      }
      debugDiv.textContent = `token: ${token}\npagamentoPublico: ${JSON.stringify(pagamentoDataFetched, null, 2)}\nestadoData: ${JSON.stringify(dataToUse, null, 2)}`
    }

    if (estadoEl) {
      if (pagamentoEstado === 'validado') estadoEl.textContent = 'Validado'
      else if (pagamentoEstado === 'em_validacao' || pagamentoEstado === 'em_validacao') estadoEl.textContent = 'Em validação'
      else if (estadoInscricao === 'confirmada') estadoEl.textContent = 'Inscrição confirmada'
      else if (estadoInscricao === 'aguardando_pagamento') estadoEl.textContent = 'A aguardar pagamento'
      else estadoEl.textContent = (pagamentoEstado || estadoInscricao || '-').toString()
    }
    if (pagamentoEstado === 'em_validacao' || pagamentoEstado === 'validado') marcarPassoPagamento(3)

    if (referenciaEl) referenciaEl.textContent = `${nome} + ${titulo}`

    const radiosMetodoPagamento = document.querySelectorAll('input[name="metodoPagamento"]')
    const grupoTelefoneMbway = document.getElementById('grupoTelefoneMbway')
    if (radiosMetodoPagamento.length && grupoTelefoneMbway && comprovativoForm) {
      radiosMetodoPagamento.forEach(radio => {
        radio.addEventListener('change', () => {
          grupoTelefoneMbway.style.display = comprovativoForm.metodoPagamento.value === 'mbway' ? 'block' : 'none'
        })
      })
    }

    if (comprovativoForm) {
      comprovativoForm.addEventListener('submit', async function (e) {
        e.preventDefault()
        const fileInput = document.getElementById('ficheiroComprovativo')
        const referenciaInput = document.getElementById('referenciaPagamento')
        const btnEnviar = document.getElementById('btnEnviarComprovativo')
        const metodo = comprovativoForm.metodoPagamento.value
        const telefoneMbwayInput = document.getElementById('telefoneMbway')

        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
          mostrarMensagem(comprovativoForm, 'Por favor selecione um ficheiro de comprovativo.', 'erro')
          return
        }

        if (metodo === 'mbway' && (!telefoneMbwayInput || !telefoneMbwayInput.value.trim())) {
          mostrarMensagem(comprovativoForm, 'Indique o telemóvel usado no MB WAY.', 'erro')
          return
        }

        const file = fileInput.files[0]

        const LIMITE_MB = 15
        if (file.size > LIMITE_MB * 1024 * 1024) {
          mostrarMensagem(comprovativoForm, `O ficheiro é demasiado grande (máx. ${LIMITE_MB}MB).`, 'erro')
          return
        }

        bloquearBotao(btnEnviar, true, 'A enviar comprovativo...')

        try {
          const { data: uploadData, error: uploadErr } = await api.uploadComprovativo(token, file)
          if (uploadErr || !uploadData) {
            console.error('Erro ao enviar ficheiro:', uploadErr)
            mostrarMensagem(comprovativoForm, 'Erro ao enviar o ficheiro. Tente novamente.', 'erro')
            mostrarPopup('Não foi possível enviar o ficheiro. Tente novamente.', 'erro')
            bloquearBotao(btnEnviar, false, 'Enviar Comprovativo')
            return
          }

          const referencia = referenciaInput ? referenciaInput.value.trim() : null
          const telefoneMbway = metodo === 'mbway' && telefoneMbwayInput ? telefoneMbwayInput.value.trim() : null
          const { error: submitErr } = await api.submeterComprovativoPagamento(token, uploadData.path, referencia, metodo, telefoneMbway)
          if (submitErr) {
            console.error('Erro ao submeter comprovativo:', submitErr)
            if (/j[aá] validado/i.test(submitErr.message || '')) {
              mostrarMensagem(comprovativoForm, 'O seu pagamento já foi validado pela nossa equipa. Não é necessário submeter novamente.', 'sucesso')
              mostrarPopup('O seu pagamento já foi validado pela nossa equipa. Não é necessário submeter novamente.', 'sucesso')
              if (estadoEl) estadoEl.textContent = 'Validado'
              bloquearBotao(btnEnviar, true, 'Já Validado')
              marcarPassoPagamento(3)
              return
            }
            mostrarMensagem(comprovativoForm, 'Erro ao registar o comprovativo. Tente novamente.', 'erro')
            mostrarPopup('Não foi possível registar o comprovativo. Tente novamente.', 'erro')
            bloquearBotao(btnEnviar, false, 'Enviar Comprovativo')
            return
          }

          mostrarMensagem(comprovativoForm, 'Comprovativo enviado com sucesso. Aguarde validação da equipa.', 'sucesso')
          mostrarPopup('Comprovativo enviado com sucesso. Aguarde a validação da nossa equipa.', 'sucesso')
          if (estadoEl) estadoEl.textContent = 'Em validação'
          bloquearBotao(btnEnviar, false, 'Enviar Comprovativo')
          marcarPassoPagamento(3)
        } catch (err) {
          console.error(err)
          mostrarMensagem(comprovativoForm, 'Ocorreu um erro. Tente novamente mais tarde.', 'erro')
          mostrarPopup('Ocorreu um erro inesperado. Tente novamente mais tarde.', 'erro')
          bloquearBotao(btnEnviar, false, 'Enviar Comprovativo')
        }
      })
    }

  } catch (err) {
    console.error('Erro ao carregar estado da inscrição:', err)
  }
}

// Página de pagamento: botões "Copiar", nome do ficheiro escolhido e atalho
// do telemóvel para o passo 2 (muita gente pagava e não enviava o comprovativo).
function configurarAjudasPagamento() {
  document.querySelectorAll('.btn-copiar').forEach(botao => {
    botao.addEventListener('click', async () => {
      const texto = botao.dataset.copiar
      try {
        await navigator.clipboard.writeText(texto)
      } catch (err) {
        const campo = document.createElement('textarea')
        campo.value = texto
        document.body.appendChild(campo)
        campo.select()
        document.execCommand('copy')
        campo.remove()
      }
      botao.textContent = 'Copiado ✓'
      botao.classList.add('copiado')
      setTimeout(() => {
        botao.textContent = 'Copiar'
        botao.classList.remove('copiado')
      }, 2000)
    })
  })

  const ficheiro = document.getElementById('ficheiroComprovativo')
  const nomeFicheiro = document.getElementById('nomeFicheiroComprovativo')
  if (ficheiro && nomeFicheiro) {
    const textoOriginal = nomeFicheiro.textContent
    ficheiro.addEventListener('change', () => {
      const escolhido = ficheiro.files?.[0]
      nomeFicheiro.textContent = escolhido ? `✓ ${escolhido.name}` : textoOriginal
      ficheiro.closest('.area-upload')?.classList.toggle('com-ficheiro', !!escolhido)
      if (escolhido) marcarPassoPagamento(2)
    })
  }

  const atalho = document.getElementById('ctaComprovativoMobile')
  const form = document.getElementById('comprovativoForm')
  if (atalho && form) {
    atalho.hidden = false
    document.body.classList.add('com-cta-mobile')
    // Quando o formulário já está à vista, o atalho deixa de ser preciso.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entrada]) => {
        atalho.style.visibility = entrada.isIntersecting ? 'hidden' : ''
      }).observe(form)
    }
  }
}

// Passos da página de pagamento: 1 = pagar, 2 = enviar comprovativo, 3 = comprovativo enviado.
function marcarPassoPagamento(passo) {
  const passo1 = document.getElementById('indicadorPasso1')
  const passo2 = document.getElementById('indicadorPasso2')
  if (!passo1 || !passo2) return
  passo1.classList.toggle('ativo', passo === 1)
  passo1.classList.toggle('concluido', passo > 1)
  passo2.classList.toggle('ativo', passo === 2)
  passo2.classList.toggle('concluido', passo > 2)

  if (passo === 3) {
    const aviso = document.getElementById('avisoComprovativo')
    if (aviso) {
      aviso.classList.add('concluido')
      aviso.innerHTML = '<strong>✓ Comprovativo enviado</strong><span>A equipa USGA vai validar o pagamento e enviar-lhe um email de confirmação.</span>'
    }
    const atalho = document.getElementById('ctaComprovativoMobile')
    if (atalho) {
      atalho.hidden = true
      document.body.classList.remove('com-cta-mobile')
    }
  }
}

async function configurarEstadoInscricao(api) {
  if (!isPagina('estado-inscricao.html') || !api) return

  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  const form = document.getElementById('statusForm')
  const resultBox = document.getElementById('statusResult')

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault()
      const value = form.token.value.trim()
      if (value) window.location.href = `estado-inscricao.html?token=${encodeURIComponent(value)}`
    })
  }

  if (!token || !resultBox) return

  const { data, error } = await api.getEstadoInscricao(token)

  if (error || !data) {
    resultBox.innerHTML = '<p>Não encontrámos nenhuma inscrição com este código.</p>'
    return
  }

  const faturaUrl = data.fatura_url ? api.getFaturaUrl(data.fatura_url) : null

  // Restantes participantes inscritos com o mesmo pagamento (inscrição de grupo)
  const { data: grupo } = await api.getParticipantesGrupo(token)
  const proprio = (grupo || []).find(g => g.nome === data.nome)
  const tabelaGrupo = grupo && grupo.length > 1 ? `
    <h3 style="margin: 30px 0 12px;">Participantes desta inscrição</h3>
    <div class="participants-table-wrapper">
      <table class="participants-table">
        <thead><tr><th>Nome</th><th>Prova</th><th>Estado</th><th>Dorsal</th></tr></thead>
        <tbody>
          ${grupo.map(g => `
            <tr>
              <td>${escapeHtml(g.nome)}</td>
              <td>${escapeHtml(g.prova_nome) || '-'}</td>
              <td><span class="badge ${g.estado === 'confirmada' ? 'badge-pago' : 'badge-pendente'}">${estadoInscricaoLabel(g.estado)}</span></td>
              <td>${escapeHtml(g.dorsal) || '-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''

  resultBox.innerHTML = `
    <div class="participants-table-wrapper">
      <table class="participants-table">
        <tbody>
          <tr><th>Evento</th><td>${escapeHtml(data.evento_titulo)}</td></tr>
          <tr><th>Nome</th><td>${escapeHtml(data.nome)}</td></tr>
          ${proprio?.prova_nome ? `<tr><th>Prova</th><td>${escapeHtml(proprio.prova_nome)}</td></tr>` : ''}
          <tr><th>Inscrição</th><td><span class="badge ${data.estado === 'confirmada' ? 'badge-pago' : 'badge-pendente'}">${estadoInscricaoLabel(data.estado)}</span></td></tr>
          <tr><th>Pagamento</th><td><span class="badge ${data.pagamento_estado === 'validado' ? 'badge-pago' : 'badge-pendente'}">${estadoPagamentoLabel(data.pagamento_estado)}</span></td></tr>
          <tr><th>Dorsal</th><td>${data.dorsal || '-'}</td></tr>
          <tr><th>Data</th><td>${api.formatarData(data.data_inscricao)}</td></tr>
          ${faturaUrl ? `<tr><th>Fatura</th><td><a href="${faturaUrl}" target="_blank" rel="noopener" style="color: var(--accent-color);">Descarregar</a></td></tr>` : ''}
        </tbody>
      </table>
    </div>
    ${tabelaGrupo}
  `
}

async function configurarAdmin(api) {
  if (!isPagina('admin.html') || !api) return

  // Guarda de acesso: garante que so administradores acedem a esta pagina.
  // O preenchimento do painel (pedidos, inscricoes, quotas) e feito pelo
  // script inline em admin.html, que usa os ids reais tbl-pedidos /
  // tbl-inscricoes / tbl-quotas.
  await api.requireAdmin()
}

function configurarLogout(api) {
  const logoutBtn = document.getElementById('logoutBtn')
  if (!logoutBtn || !api) return

  logoutBtn.addEventListener('click', async function (event) {
    event.preventDefault()
    await api.logout('index.html')
  })
}

function estadoQuotaLabel(estado) {
  const labels = {
    por_pagar: 'Por Pagar',
    pendente_validacao: 'Pendente',
    pago: 'Pago',
    isento: 'Isento',
    cancelado: 'Cancelado'
  }

  return labels[estado] || estado
}

async function carregarEventoAtual(api) {
  const slug = getSlugEventoAtual()
  const { data } = await api.getEvento(slug)

  return data
}

function getSlugEventoAtual() {
  const params = new URLSearchParams(window.location.search)
  return params.get('evento') || 'caminhada-da-primavera'
}

function atualizarLinkInscricaoEvento() {
  const link = document.querySelector('.event-sidebar a[href="inscricao-evento.html"]')
  if (!link) return

  link.href = `inscricao-evento.html?evento=${encodeURIComponent(getSlugEventoAtual())}`
}

function adicionarLinkAdminPerfil() {
  const card = document.querySelector('.profile-card')
  if (!card || card.querySelector('[data-admin-link]')) return

  const link = document.createElement('a')
  link.href = 'admin.html'
  link.className = 'btn-outline'
  link.dataset.adminLink = 'true'
  link.textContent = 'Back-office'

  card.appendChild(link)
}

// Populate the public events listing on eventos.html
async function configurarListaEventos(api) {
  if (!isPagina('eventos.html') || !api) return

  const futureWrap = document.getElementById('futureEventsList')
  const pastWrap = document.getElementById('pastEventsList')
  const noFuture = document.getElementById('noFutureResults')
  const noPast = document.getElementById('noPastResults')
  if (!futureWrap || !pastWrap) return

  const [{ data: futuros, error: errF }, { data: passados, error: errP }] = await Promise.all([
    api.getEventosFuturos(),
    api.getEventosPassados()
  ])

  if (errF) {
    futureWrap.innerHTML = '<p>Erro ao carregar eventos futuros.</p>'
  } else if (!futuros || futuros.length === 0) {
    futureWrap.innerHTML = ''
    noFuture.style.display = 'block'
  } else {
    noFuture.style.display = 'none'
    futureWrap.innerHTML = futuros.map(ev => renderCardEvento(ev, 'evento-futuro.html')).join('')
  }

  if (errP) {
    pastWrap.innerHTML = '<p>Erro ao carregar eventos realizados.</p>'
  } else if (!passados || passados.length === 0) {
    pastWrap.innerHTML = ''
    noPast.style.display = 'block'
  } else {
    noPast.style.display = 'none'
    pastWrap.innerHTML = passados.map(ev => renderCardEvento(ev, 'evento-passado.html')).join('')
  }
}

const ESTADOS_CARTAO = {
  aberto: { texto: 'Inscrições abertas', classe: 'estado-aberto' },
  brevemente: { texto: 'Brevemente', classe: 'estado-brevemente' },
  fechado: { texto: 'Inscrições fechadas', classe: 'estado-fechado' },
  cancelado: { texto: 'Cancelado', classe: 'estado-cancelado' }
}

function renderCardEvento(ev, destino) {
  const imagem = ev.imagem_url || ''
  const dataFmt = ev.data_evento ? new Date(ev.data_evento).toLocaleDateString('pt-PT', { day:'2-digit', month:'short', year:'numeric' }) : ''
  const dataBadge = ev.data_evento ? new Date(ev.data_evento).toLocaleDateString('pt-PT', { day:'2-digit', month:'short' }).toUpperCase() : ''
  const slug = ev.slug || ''
  const pagina = destino || 'evento-futuro.html'
  // O estado só interessa nos eventos que ainda vão acontecer.
  const estado = pagina === 'evento-futuro.html' ? ESTADOS_CARTAO[ev.estado] : null
  return `
    <a href="${pagina}?evento=${encodeURIComponent(slug)}" class="project-card">
      <div class="project-image${imagem ? '' : ' sem-imagem'}"${imagem ? ` style="background-image: url('${escapeHtml(imagem)}');"` : ''}>
        ${dataBadge ? `<span class="project-date-badge">${dataBadge}</span>` : ''}
        ${estado ? `<span class="project-estado-badge ${estado.classe}">${estado.texto}</span>` : ''}
      </div>
      <div class="project-info">
        <h3>${escapeHtml(ev.titulo)}</h3>
        <small style="color:#777;">${dataFmt}</small>
        <p style="margin-top:8px;color:#555;">${escapeHtml((ev.descricao_curta || '').slice(0,120))}</p>
      </div>
    </a>
  `
}

// Página inicial: os 3 próximos eventos (sem os cancelados).
async function configurarProximosEventosHome(api) {
  const lista = document.getElementById('proximosEventosHome')
  if (!lista || !api) return

  const { data, error } = await api.getEventosFuturos()
  const proximos = (data || []).filter(ev => ev.estado !== 'cancelado').slice(0, 3)

  if (error || proximos.length === 0) {
    lista.classList.remove('projects-grid-3')
    lista.innerHTML = `
      <div class="proximos-eventos-vazio">
        <p><strong>Novos eventos em breve.</strong></p>
        <p>Acompanhe as novidades no nosso <a href="https://www.facebook.com/share/1Bium9wSUh/?mibextid=wwXIfr" target="_blank" rel="noopener">Facebook</a> e <a href="https://www.instagram.com/usga_associacao?igsh=cmhpNHltaDZwd2dt" target="_blank" rel="noopener">Instagram</a>.</p>
      </div>`
    return
  }

  lista.innerHTML = proximos.map(ev => renderCardEvento(ev, 'evento-futuro.html')).join('')
}

// Populate event detail pages (futuro / passado)
async function configurarDetalheEvento(api) {
  if (!api) return
  if (!isPagina('evento-futuro.html') && !isPagina('evento-passado.html')) return

  const evento = await carregarEventoAtual(api)
  if (!evento) {
    document.getElementById('heroTitulo') && (document.getElementById('heroTitulo').textContent = 'Evento não encontrado')
    document.getElementById('heroSubtitulo') && (document.getElementById('heroSubtitulo').textContent = '')
    return
  }

  // Common elements
  const heroTitulo = document.getElementById('heroTitulo')
  const heroSub = document.getElementById('heroSubtitulo')
  const heroDesc = document.getElementById('heroDescricao')
  const descricaoEl = document.getElementById('descricaoEvento')
  const recomendacoesBox = document.getElementById('recomendacoesBox')
  const recomendacoesEl = document.getElementById('recomendacoesEvento')
  const imagem = document.getElementById('imagemEvento')
  const dataEl = document.getElementById('dataEvento')
  const fimInscricoesEl = document.getElementById('fimInscricoesEvento')
  const localEl = document.getElementById('localEvento')
  const precoEl = document.getElementById('precoEvento')
  const btnReg = document.getElementById('btnRegulamento')
  const areaInscricao = document.getElementById('areaInscricao')

  if (heroTitulo) heroTitulo.textContent = evento.titulo || ''
  if (heroSub) heroSub.textContent = evento.categoria || ''
  if (heroDesc) heroDesc.textContent = evento.descricao_curta || ''
  if (descricaoEl) descricaoEl.textContent = evento.descricao || evento.descricao_curta || ''
  if (recomendacoesBox && recomendacoesEl) {
    if (evento.recomendacoes) {
      recomendacoesEl.textContent = evento.recomendacoes
      recomendacoesBox.style.display = 'block'
    } else {
      recomendacoesBox.style.display = 'none'
    }
  }
  if (imagem) imagem.style.backgroundImage = evento.imagem_url ? `url('${evento.imagem_url}')` : ''
  if (imagem) imagem.classList.toggle('sem-imagem', !evento.imagem_url)
  if (dataEl) dataEl.textContent = api.formatarData(evento.data_evento)
  if (fimInscricoesEl) fimInscricoesEl.textContent = evento.data_fim_inscricoes ? api.formatarData(evento.data_fim_inscricoes) : '-'
  if (localEl) {
    if (evento.local) {
      const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evento.local)}`
      localEl.innerHTML = `${escapeHtml(evento.local)}<a href="${mapa}" target="_blank" rel="noopener" class="link-mapa">Ver no mapa ↗</a>`
    } else {
      localEl.textContent = '-'
    }
  }
  const [{ data: provasData }, { data: documentosData }] = await Promise.all([
    api.getProvasEvento(evento.id),
    api.getDocumentosEvento(evento.id)
  ])
  const provas = provasData || []
  const documentos = documentosData || []
  const unidade = evento.contribuicao_unidade

  if (precoEl) {
    if (provas.length === 0) {
      precoEl.textContent = '-'
    } else if (provas.length === 1) {
      precoEl.textContent = api.formatarContribuicao(provas[0].valor, unidade)
    } else {
      precoEl.innerHTML = provas
        .map(p => `<span style="display:block;">${escapeHtml(p.nome)}: <strong>${escapeHtml(api.formatarContribuicao(p.valor, unidade))}</strong></span>`)
        .join('')
    }
  }

  // Provas com descrição (página de evento futuro)
  const provasBox = document.getElementById('provasBox')
  const listaProvas = document.getElementById('listaProvas')
  if (provasBox && listaProvas) {
    if (provas.length > 1 || provas.some(p => p.descricao)) {
      listaProvas.innerHTML = provas.map(p => `
        <div class="prova-evento">
          <div class="prova-evento-topo">
            <span>${escapeHtml(p.nome)}</span>
            <span>${escapeHtml(api.formatarContribuicao(p.valor, unidade))}</span>
          </div>
          ${p.descricao ? `<p>${escapeHtml(p.descricao)}</p>` : ''}
        </div>`).join('')
      provasBox.style.display = 'block'
    } else {
      provasBox.style.display = 'none'
    }
  }

  // Lista de provas na barra lateral (página de evento passado)
  const provasSidebarItem = document.getElementById('provasSidebarItem')
  const provasEventoEl = document.getElementById('provasEvento')
  if (provasSidebarItem && provasEventoEl && provas.length > 1) {
    provasEventoEl.innerHTML = provas.map(p => `<span style="display:block;">${escapeHtml(p.nome)}</span>`).join('')
    provasSidebarItem.style.display = 'block'
  }

  if (btnReg) {
    if (evento.regulamento_url) {
      btnReg.href = evento.regulamento_url
      btnReg.style.display = 'inline-block'
    } else {
      btnReg.style.display = 'none'
    }
  }

  // Informação adicional (mapa, percurso...) e resultados (classificações,
  // participantes...), agrupados por prova. Tabela evento_documentos.
  const infoBox = document.getElementById('infoAdicionalBox')
  const infoLista = document.getElementById('listaInfoAdicional')
  if (infoBox && infoLista) {
    const info = documentos.filter(d => d.seccao === 'informacao')
    infoLista.innerHTML = renderDocumentosPorProva(info, provas)
    infoBox.style.display = info.length > 0 ? 'block' : 'none'
  }

  const listaResultados = document.getElementById('listaResultados')
  if (listaResultados) {
    const resultados = documentos.filter(d => d.seccao === 'resultados')
    listaResultados.innerHTML = resultados.length > 0
      ? renderDocumentosPorProva(resultados, provas)
      : '<p style="color:#999;">Os resultados e documentos deste evento ainda não foram publicados.</p>'
  }

  // If future event page: add inscription button if estado is 'aberto'
  if (isPagina('evento-futuro.html') && areaInscricao) {
    if (evento.estado === 'aberto') {
      areaInscricao.innerHTML = `<a href="inscricao-evento.html?evento=${encodeURIComponent(evento.slug)}" class="btn btn-primary">Inscrever-me</a>`
      mostrarBarraInscricaoMobile(evento, provas, unidade, api)
    } else if (evento.estado === 'brevemente') {
      areaInscricao.innerHTML = `<div style="padding:10px;background:#fff;border-radius:6px;color:#666;">Inscrições brevemente disponíveis</div>`
    } else {
      areaInscricao.innerHTML = `<div style="padding:10px;background:#fff;border-radius:6px;color:#666;">Inscrições fechadas</div>`
    }
    atualizarLinkInscricaoEvento()
  }

  // If past event page: show gallery link if available
  if (isPagina('evento-passado.html')) {
    const btnGaleria = document.getElementById('btnGaleria')
    if (btnGaleria) {
      if (evento.galeria_url) {
        btnGaleria.href = evento.galeria_url
        btnGaleria.style.display = 'inline-block'
      } else {
        btnGaleria.style.display = 'none'
      }
    }
  }
}

// Barra fixa no fundo do ecrã (só telemóvel, ver CSS) com o botão de inscrição,
// para não ser preciso voltar à barra lateral depois de ler a página.
function mostrarBarraInscricaoMobile(evento, provas, unidade, api) {
  if (document.querySelector('.cta-inscricao-mobile')) return
  const valores = provas.map(p => Number(p.valor) || 0)
  const contribuicao = valores.length
    ? (valores.length > 1 ? 'desde ' : '') + api.formatarContribuicao(Math.min(...valores), unidade)
    : ''
  const barra = document.createElement('div')
  barra.className = 'cta-inscricao-mobile'
  barra.innerHTML = `
    <div class="cta-inscricao-texto">
      <strong>${escapeHtml(evento.titulo)}</strong>
      ${contribuicao ? `<small>${escapeHtml(contribuicao)}</small>` : ''}
    </div>
    <a href="inscricao-evento.html?evento=${encodeURIComponent(evento.slug)}" class="btn btn-primary">Inscrever-me</a>`
  document.body.appendChild(barra)
  document.body.classList.add('com-cta-mobile')
}

// Agrupa documentos por prova ("Geral" primeiro, depois pela ordem das provas).
// O título de cada grupo só aparece quando há documentos de alguma prova.
function renderDocumentosPorProva(documentos, provas) {
  if (!documentos.length) return ''
  const grupos = [{ id: null, nome: 'Geral' }, ...provas]
    .map(g => ({ nome: g.nome, docs: documentos.filter(d => (d.prova_id || null) === g.id) }))
    .filter(g => g.docs.length > 0)
  const mostrarTitulos = grupos.some(g => g.nome !== 'Geral')

  return grupos.map(g => `
    <div class="documentos-grupo">
      ${mostrarTitulos ? `<h4>${escapeHtml(g.nome)}</h4>` : ''}
      <ul class="documentos-lista">
        ${g.docs.map(d => `
          <li>
            <a href="${escapeHtml(urlSegura(d.url))}" target="_blank" rel="noopener">
              <span aria-hidden="true">${iconeDocumento(d)}</span>
              <span>${escapeHtml(d.titulo || d.url)}</span>
            </a>
          </li>`).join('')}
      </ul>
    </div>`).join('')
}

function iconeDocumento(doc) {
  if (doc.tipo === 'link') return '🔗'
  const extensao = (String(doc.url || '').split('?')[0].split('.').pop() || '').toLowerCase()
  if (extensao === 'pdf') return '📄'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(extensao)) return '📊'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(extensao)) return '🖼️'
  return '📎'
}

function urlSegura(url) {
  return /^https?:\/\//i.test(String(url || '').trim()) ? String(url).trim() : '#'
}

// Nome do país (como vem do formulário, ex: "Portugal") -> código ISO ("PT").
// Usa os nomes em português do próprio browser; se não reconhecer o nome,
// mostra as três primeiras letras.
let codigosPaises = null

// Nomes da lista do formulário que diferem dos nomes do browser.
const CODIGOS_PAISES_EXTRA = {
  'bahamas': 'BS', 'congo': 'CG', 'costa do marfim': 'CI', 'el salvador': 'SV',
  'estados unidos da america': 'US', 'eswatini': 'SZ', 'kiribati': 'KI', 'kuwait': 'KW',
  'myanmar': 'MM', 'oma': 'OM', 'republica checa': 'CZ', 'republica democratica do congo': 'CD',
  'sri lanka': 'LK', 'vaticano': 'VA'
}

function normalizarNomePais(nome) {
  return String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function abreviarPais(pais) {
  if (!pais) return '-'
  if (/^[A-Za-z]{2,3}$/.test(pais)) return pais.toUpperCase()

  if (!codigosPaises) {
    codigosPaises = { ...CODIGOS_PAISES_EXTRA }
    try {
      const nomes = new Intl.DisplayNames(['pt-PT'], { type: 'region' })
      const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      for (const a of letras) {
        for (const b of letras) {
          const nome = nomes.of(a + b)
          if (nome && nome !== a + b) codigosPaises[normalizarNomePais(nome)] = a + b
        }
      }
    } catch (e) {
      // Browser sem Intl.DisplayNames: fica só a regra de recurso abaixo.
    }
  }

  return codigosPaises[normalizarNomePais(pais)] || pais.slice(0, 3).toUpperCase()
}

function estadoInscricaoLabel(estado) {
  const labels = {
    aguardando_pagamento: 'A aguardar pagamento',
    confirmada: 'Confirmada',
    rejeitada: 'Rejeitada',
    cancelada: 'Cancelada'
  }

  return labels[estado] || estado
}

function estadoPagamentoLabel(estado) {
  const labels = {
    pendente: 'Pendente',
    em_validacao: 'Em Validação',
    validado: 'Validado',
    rejeitado: 'Rejeitado'
  }

  return labels[estado] || estado
}

function configurarPreviewFoto() {
  const photoInput = document.getElementById('photoInput')
  const profileImg = document.getElementById('profileImg')

  if (profileImg) {
    const savedPhoto = localStorage.getItem('usga_photo')
    if (savedPhoto) profileImg.src = savedPhoto
  }

  if (!photoInput || !profileImg) return

  photoInput.addEventListener('change', function () {
    const file = this.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = function (event) {
      profileImg.src = event.target.result
      localStorage.setItem('usga_photo', event.target.result)
    }
    reader.readAsDataURL(file)
  })
}

function mostrarPopup(texto, tipo) {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;'

  const card = document.createElement('div')
  card.style.cssText = 'background:#fff;border-radius:12px;padding:36px 32px;max-width:380px;width:100%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.25);'

  const icone = document.createElement('div')
  icone.style.cssText = 'font-size:48px;margin-bottom:16px;'
  icone.textContent = tipo === 'erro' ? '❌' : '✅'

  const msg = document.createElement('p')
  msg.style.cssText = 'font-size:15px;color:#333;margin-bottom:24px;line-height:1.5;'
  msg.textContent = texto

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'btn btn-primary'
  btn.style.width = '100%'
  btn.textContent = 'OK'
  btn.addEventListener('click', () => overlay.remove())

  card.appendChild(icone)
  card.appendChild(msg)
  card.appendChild(btn)
  overlay.appendChild(card)
  overlay.addEventListener('click', function (event) { if (event.target === overlay) overlay.remove() })
  document.body.appendChild(overlay)
}

function mostrarPromptTemConta() {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;'

  const card = document.createElement('div')
  card.style.cssText = 'background:#fff;border-radius:12px;padding:36px 32px;max-width:380px;width:100%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.25);'

  const titulo = document.createElement('p')
  titulo.style.cssText = 'font-size:17px;font-weight:600;color:#333;margin-bottom:24px;'
  titulo.textContent = 'Já tem conta na plataforma?'

  const linhaBotoes = document.createElement('div')
  linhaBotoes.style.cssText = 'display:flex;gap:12px;'

  const btnSim = document.createElement('button')
  btnSim.type = 'button'
  btnSim.className = 'btn btn-primary'
  btnSim.style.flex = '1'
  btnSim.textContent = 'Sim'
  btnSim.addEventListener('click', () => { window.location.href = 'registo-socio.html' })

  const btnNao = document.createElement('button')
  btnNao.type = 'button'
  btnNao.className = 'btn'
  btnNao.style.cssText = 'flex:1;background:#eee;color:#333;'
  btnNao.textContent = 'Não'
  btnNao.addEventListener('click', () => { window.location.href = 'registar.html' })

  linhaBotoes.appendChild(btnSim)
  linhaBotoes.appendChild(btnNao)
  card.appendChild(titulo)
  card.appendChild(linhaBotoes)
  overlay.appendChild(card)
  overlay.addEventListener('click', function (event) { if (event.target === overlay) overlay.remove() })
  document.body.appendChild(overlay)
}

function mostrarMensagemQuery(form) {
  const params = new URLSearchParams(window.location.search)
  if (params.get('registo') === 'sucesso') {
    mostrarMensagem(form, 'Conta criada. Verifique o seu email para confirmar a conta antes de entrar.', 'sucesso')
  }
}

function mostrarMensagem(form, texto, tipo) {
  let message = form.querySelector('.form-message')

  if (!message) {
    message = document.createElement('p')
    message.className = 'form-message'
    message.style.marginBottom = '20px'
    message.style.fontSize = '14px'
    message.style.fontWeight = '500'
    form.prepend(message)
  }

  message.textContent = texto
  message.style.color = tipo === 'erro' ? '#d32f2f' : '#2e7d32'
}

function bloquearBotao(button, bloqueado, texto) {
  if (!button) return

  button.disabled = bloqueado
  button.textContent = texto
  button.style.opacity = bloqueado ? '0.7' : ''
  button.style.cursor = bloqueado ? 'not-allowed' : ''
}

function traduzirErroAuth(message) {
  const erro = String(message || '').toLowerCase()

  if (erro.includes('invalid login credentials')) return 'Email ou password incorretos.'
  if (erro.includes('email not confirmed')) return 'Confirme o seu email antes de iniciar sessão.'
  if (erro.includes('user already registered')) return 'Ja existe uma conta com este email.'
  if (erro.includes('password')) return 'A password não cumpre os requisitos mínimos.'

  return 'Não foi possível concluir a operação. Tente novamente.'
}

function escapeHtml(valor) {
  if (valor === null || valor === undefined) return ''
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isPagina(nomeFicheiro) {
  return window.location.pathname.toLowerCase().endsWith(nomeFicheiro.toLowerCase())
}