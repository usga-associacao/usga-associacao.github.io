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
      mostrarMensagem(registerForm, 'As passwords nao coincidem.', 'erro')
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

    bloquearBotao(submitBtn, false, 'Tornar-me Socio')

    if (error) {
      mostrarMensagem(form, 'Nao foi possivel guardar o pedido. Confirme os dados e tente novamente.', 'erro')
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

    const { error } = await api.criarMensagemSuporte(dados)

    bloquearBotao(submitBtn, false, 'Enviar Mensagem')

    if (error) {
      mostrarMensagem(form, 'Nao foi possivel enviar a mensagem. Tente novamente.', 'erro')
      return
    }

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

  if (heroTitle) heroTitle.textContent = `Ola, ${primeiroNome}`
  if (profileName) profileName.textContent = nomeCompleto || perfil.email
  if (profileType) {
    profileType.textContent = perfil.numero_socio
      ? `Socio n. ${perfil.numero_socio}`
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
      mostrarMensagem(form, 'Nao foi possivel guardar as alteracoes. Tente novamente.', 'erro')
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
    tbody.innerHTML = '<tr><td colspan="8">Nao foi possivel carregar as quotas.</td></tr>'
    return
  }

  if (!quotas || quotas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">Ainda nao existem quotas registadas.</td></tr>'
    if (badgeEstado) {
      badgeEstado.textContent = 'Sem quotas'
      badgeEstado.className = 'badge badge-pendente'
    }
    return
  }

  const temQuotaPendente = quotas.some(quota => ['por_pagar', 'pendente_validacao'].includes(quota.estado))

  if (badgeEstado) {
    badgeEstado.textContent = temQuotaPendente ? 'Quota pendente' : 'Socio Ativo'
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
    container.innerHTML = '<p style="color:#c00; text-align:center;">Nao foi possivel carregar os seus eventos.</p>'
    return
  }

  if (!inscricoes || inscricoes.length === 0) {
    container.innerHTML = '<p style="color:#999; text-align:center;">Ainda nao se inscreveu em nenhum evento.</p>'
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
          <strong>${evento?.titulo || 'Evento'}</strong><br>
          <span style="color:#999; font-size:13px;">${evento?.data_evento ? api.formatarData(evento.data_evento) : '-'}</span>
        </div>
        <div>${badge}</div>
      </div>
    `
  }).join('')
}

async function configurarInscricaoEvento(api) {
  if (!isPagina('inscricao-evento.html') || !api) return

  let form = document.querySelector('form[action="pagamento-evento.html"]')
  if (!form) form = document.getElementById('inscricaoForm')
  if (!form) return

  const evento = await carregarEventoAtual(api)
  const tituloEvento = document.getElementById('nomeEvento') || document.querySelector('.contact-form p')

  if (evento) {
    if (tituloEvento) tituloEvento.textContent = evento.titulo || 'Evento'
  } else {
    if (tituloEvento) tituloEvento.textContent = 'Evento não encontrado'
    const submitBtn = form.querySelector('button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.style.opacity = '0.6'
      submitBtn.textContent = 'Inscrições indisponíveis'
    }
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault()

    if (form.website && form.website.value.trim()) return

    if (!evento) {
      mostrarMensagem(form, 'Este evento ainda nao esta disponivel para inscricoes online.', 'erro')
      return
    }

    const submitBtn = form.querySelector('button[type="submit"]')
    bloquearBotao(submitBtn, true, 'A guardar inscricao...')

    const dados = {
      evento_id: evento.id,
      nome: form.nome.value.trim(),
      data_nascimento: form.nascimento.value || null,
      sexo: form.sexo.value,
      pais: form.pais.value.trim(),
      localidade: form.localidade.value.trim(),
      equipa: form.equipa.value.trim() || null,
      telefone: form.telefone.value.trim(),
      email: form.email.value.trim(),
      bi: form.bi.value.trim(),
      nif: form.nif.value.trim(),
      tamanho_tshirt: form.tamanho_tshirt.value || null,
      pedido_fatura: form.pedido_fatura.checked
    }

    const { data, error } = await api.criarInscricaoEvento(dados)

    bloquearBotao(submitBtn, false, 'Seguir para Pagamento')

    if (error) {
      mostrarMensagem(form, 'Nao foi possivel guardar a inscricao. Verifique se ja existe uma inscricao com este nome, email e numero de documento para este evento.', 'erro')
      return
    }

    api.dispararEmailInscricao(data.inscricao_id, 'pendente')

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

  const { data: inscritos, error } = await api.getInscritosConfirmados(evento.id)
  const tbody = document.querySelector('#participantsTable tbody')
  const stats = document.querySelectorAll('.stat-number')

  if (!tbody) return

  if (error) {
    tbody.innerHTML = '<tr><td colspan="5">Nao foi possivel carregar a lista de inscritos.</td></tr>'
    return
  }

  if (!inscritos || inscritos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Ainda nao existem inscricoes para este evento.</td></tr>'
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

    if (valorEl) valorEl.innerHTML = valor ? api.formatarContribuicao(valor) : 'A aguardar valor'
    if (eventoEl) eventoEl.textContent = titulo
    if (inscritoEl) inscritoEl.textContent = nome

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
    resultBox.innerHTML = '<p>Nao encontramos nenhuma inscricao com este codigo.</p>'
    return
  }

  const faturaUrl = data.fatura_url ? api.getFaturaUrl(data.fatura_url) : null

  resultBox.innerHTML = `
    <div class="participants-table-wrapper">
      <table class="participants-table">
        <tbody>
          <tr><th>Evento</th><td>${data.evento_titulo}</td></tr>
          <tr><th>Nome</th><td>${escapeHtml(data.nome)}</td></tr>
          <tr><th>Inscricao</th><td><span class="badge ${data.estado === 'confirmada' ? 'badge-pago' : 'badge-pendente'}">${estadoInscricaoLabel(data.estado)}</span></td></tr>
          <tr><th>Pagamento</th><td><span class="badge ${data.pagamento_estado === 'validado' ? 'badge-pago' : 'badge-pendente'}">${estadoPagamentoLabel(data.pagamento_estado)}</span></td></tr>
          <tr><th>Dorsal</th><td>${data.dorsal || '-'}</td></tr>
          <tr><th>Data</th><td>${api.formatarData(data.data_inscricao)}</td></tr>
          ${faturaUrl ? `<tr><th>Fatura</th><td><a href="${faturaUrl}" target="_blank" rel="noopener" style="color: var(--accent-color);">Descarregar</a></td></tr>` : ''}
        </tbody>
      </table>
    </div>
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

function renderCardEvento(ev, destino) {
  const imagem = ev.imagem_url || ''
  const dataFmt = ev.data_evento ? new Date(ev.data_evento).toLocaleDateString('pt-PT', { day:'2-digit', month:'short', year:'numeric' }) : ''
  const slug = ev.slug || ''
  const pagina = destino || 'evento-futuro.html'
  return `
    <a href="${pagina}?evento=${encodeURIComponent(slug)}" class="project-card">
      <div class="project-image" style="background-image: url('${imagem}');"></div>
      <div class="project-body">
        <h3>${ev.titulo || ''}</h3>
        <small style="color:#777;">${dataFmt}</small>
        <p style="margin-top:8px;color:#555;">${(ev.descricao_curta || '').slice(0,120)}</p>
      </div>
    </a>
  `
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
  if (dataEl) dataEl.textContent = api.formatarData(evento.data_evento)
  if (fimInscricoesEl) fimInscricoesEl.textContent = evento.data_fim_inscricoes ? api.formatarData(evento.data_fim_inscricoes) : '-'
  if (localEl) localEl.textContent = evento.local || '-'
  if (precoEl) precoEl.innerHTML = typeof api.formatarContribuicao === 'function' ? api.formatarContribuicao(evento.preco || 0) : (evento.preco || '-')

  if (btnReg) {
    if (evento.regulamento_url) {
      btnReg.href = evento.regulamento_url
      btnReg.style.display = 'inline-block'
    } else {
      btnReg.style.display = 'none'
    }
  }

  // Informação adicional: lista de links (percurso, fotos, resultados, documentos...),
  // distinta da descrição do evento. Visível para todos (anónimos e autenticados),
  // já que a tabela "eventos" já é de leitura pública.
  const infoBox = document.getElementById('infoAdicionalBox')
  const infoLista = document.getElementById('listaInfoAdicional')
  if (infoBox && infoLista) {
    const links = Array.isArray(evento.links_adicionais) ? evento.links_adicionais.filter(l => l?.url) : []
    if (links.length > 0) {
      infoLista.innerHTML = links.map(l => `
        <li style="margin-bottom:10px;">
          <a href="${l.url}" target="_blank" rel="noopener" style="color: var(--accent-color); font-weight:600; display:flex; align-items:center; gap:8px;">
            🔗 ${l.titulo || l.url}
          </a>
        </li>
      `).join('')
      infoBox.style.display = 'block'
    } else {
      infoBox.style.display = 'none'
    }
  }

  // If future event page: add inscription button if estado is 'aberto'
  if (isPagina('evento-futuro.html') && areaInscricao) {
    if (evento.estado === 'aberto') {
      areaInscricao.innerHTML = `<a href="inscricao-evento.html?evento=${encodeURIComponent(evento.slug)}" class="btn btn-primary">Inscrever-me</a>`
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

function abreviarPais(pais) {
  if (!pais) return '-'
  if (pais.length <= 3) return pais.toUpperCase()

  return pais.slice(0, 2).toUpperCase()
}

function estadoInscricaoLabel(estado) {
  const labels = {
    aguardando_pagamento: 'Aguardando Pagamento',
    confirmada: 'Confirmada',
    rejeitada: 'Rejeitada',
    cancelada: 'Cancelada'
  }

  return labels[estado] || estado
}

function estadoPagamentoLabel(estado) {
  const labels = {
    pendente: 'Pendente',
    em_validacao: 'Em Validacao',
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
    mostrarMensagem(form, 'Conta criada. Se o Supabase pedir confirmacao, verifique o seu email antes de entrar.', 'sucesso')
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
  if (erro.includes('email not confirmed')) return 'Confirme o seu email antes de iniciar sessao.'
  if (erro.includes('user already registered')) return 'Ja existe uma conta com este email.'
  if (erro.includes('password')) return 'A password nao cumpre os requisitos minimos.'

  return 'Nao foi possivel concluir a operacao. Tente novamente.'
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