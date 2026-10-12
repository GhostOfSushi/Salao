/* =========================================================
   Avaliações do Google Maps + rolagem contínua (direita → esquerda)

   COMO CONFIGURAR
   1. No Google Cloud, ative "Maps JavaScript API" e "Places API (New)".
   2. Crie uma chave de API e RESTRINJA por referenciador HTTP
      (o endereço do seu site), pois a chave fica visível no navegador.
   3. Descubra o Place ID da academia (ferramenta "Place ID Finder").
   4. Preencha CONFIG abaixo.

   Enquanto CONFIG não estiver preenchido (ou se o Google falhar),
   a página mostra os cartões reserva do HTML, também com a rolagem.
   ========================================================= */
(() => {
  const CONFIG = {
    apiKey: 'SUA_CHAVE_AQUI',
    placeId: 'SEU_PLACE_ID_AQUI',
    maxAvaliacoes: 5,          // a API do Google devolve no máximo 5
    pixelsPorSegundo: 45,      // velocidade da rolagem
    minutosDeCache: 30         // evita chamadas repetidas na mesma sessão
  };

  const janela = document.querySelector('.depoimentos-janela');
  const lista = document.querySelector('.depoimentos');
  const resumo = document.getElementById('avaliacoes-resumo');
  if (!janela || !lista) return;

  const configurado =
    CONFIG.apiKey && !CONFIG.apiKey.startsWith('SUA_') &&
    CONFIG.placeId && !CONFIG.placeId.startsWith('SEU_');
  const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Utilidades ---------- */
  const el = (tag, classe, texto) => {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto != null) n.textContent = texto;
    return n;
  };

  const estrelas = (nota) => {
    const cheias = Math.round(nota);
    const p = el('p', 'estrelas');
    p.setAttribute('role', 'img');
    p.setAttribute('aria-label', `Nota ${cheias} de 5`);
    for (let i = 1; i <= 5; i++) {
      p.append(el('span', i <= cheias ? '' : 'estrela--vazia', '★'));
    }
    return p;
  };

  /* ---------- Cartão de uma avaliação ---------- */
  function criarCartao(av) {
    const li = el('li');
    const figura = el('figure', 'depoimento');

    const corpo = el('div', 'depoimento__corpo');
    corpo.append(estrelas(av.nota));
    const citacao = el('blockquote');
    citacao.append(el('p', '', av.texto));
    corpo.append(citacao);

    const legenda = el('figcaption', 'depoimento__autor');
    if (av.foto) {
      const img = el('img', 'avatar avatar--foto');
      img.src = av.foto;
      img.alt = '';
      img.width = 48;
      img.height = 48;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      legenda.append(img);
    } else {
      const vazio = el('span', 'avatar');
      vazio.setAttribute('aria-hidden', 'true');
      legenda.append(vazio);
    }

    const quem = el('span', 'depoimento__quem');
    if (av.perfil) {
      const a = el('a', '', av.autor || 'Cliente do Google');
      a.href = av.perfil;
      a.target = '_blank';
      a.rel = 'noopener';
      quem.append(a);
    } else {
      quem.append(el('span', '', av.autor || 'Cliente do Google'));
    }
    if (av.quando) quem.append(el('small', '', av.quando));
    legenda.append(quem);

    figura.append(corpo, legenda);
    li.append(figura);
    return li;
  }

  /* ---------- Busca no Google (Maps JavaScript API, biblioteca Places) ---------- */
  function carregarScriptDoGoogle() {
    return new Promise((resolve, reject) => {
      if (window.google && google.maps && google.maps.importLibrary) return resolve();
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' +
              encodeURIComponent(CONFIG.apiKey) + '&v=weekly&loading=async&libraries=places';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Não foi possível carregar a API do Google.'));
      document.head.append(s);
    });
  }

  const chaveCache = 'avaliacoes-google-' + CONFIG.placeId;

  function lerCache() {
    try {
      const salvo = JSON.parse(sessionStorage.getItem(chaveCache));
      if (salvo && Date.now() - salvo.em < CONFIG.minutosDeCache * 60000) return salvo.dados;
    } catch (e) { /* sessionStorage indisponível: segue sem cache */ }
    return null;
  }

  function salvarCache(dados) {
    try {
      sessionStorage.setItem(chaveCache, JSON.stringify({ em: Date.now(), dados }));
    } catch (e) { /* ignora */ }
  }

  async function buscarAvaliacoes() {
    const emCache = lerCache();
    if (emCache) return emCache;

    await carregarScriptDoGoogle();
    const { Place } = await google.maps.importLibrary('places');
    const lugar = new Place({ id: CONFIG.placeId });
    await lugar.fetchFields({
      fields: ['rating', 'userRatingCount', 'googleMapsURI', 'reviews']
    });

    const dados = {
      nota: lugar.rating,
      total: lugar.userRatingCount,
      url: lugar.googleMapsURI,
      avaliacoes: (lugar.reviews || [])
        .filter(r => r.text)                       // só as que têm comentário
        .slice(0, CONFIG.maxAvaliacoes)
        .map(r => ({
          autor: r.authorAttribution && r.authorAttribution.displayName,
          foto: r.authorAttribution && r.authorAttribution.photoURI,
          perfil: r.authorAttribution && r.authorAttribution.uri,
          nota: r.rating,
          texto: r.text,
          quando: r.relativePublishTimeDescription
        }))
    };
    salvarCache(dados);
    return dados;
  }

  function mostrarResumo(dados) {
    if (!resumo || !dados.nota) return;
    const nota = dados.nota.toFixed(1).replace('.', ',');
    const total = dados.total ? ` · ${dados.total} avaliações` : '';
    resumo.replaceChildren(
      el('span', 'estrelas', '★'),
      el('strong', '', nota),
      el('span', '', `${total} no Google Maps`)
    );
    if (dados.url) resumo.href = dados.url;
    resumo.hidden = false;
  }

  /* ---------- Rolagem contínua ---------- */
  function iniciarRolagem() {
    if (reduzMovimento.matches) return;      // respeita quem prefere menos movimento

    const originais = [...lista.children];
    if (!originais.length) return;

    janela.classList.add('ativa');
    lista.classList.add('rolando');

    const clonar = () => originais.forEach(li => {
      const copia = li.cloneNode(true);
      copia.setAttribute('aria-hidden', 'true');
      copia.querySelectorAll('a').forEach(a => { a.tabIndex = -1; });
      lista.append(copia);
    });

    // 1) completa um "conjunto" mais largo que a tela, para não aparecer vão
    const minimo = Math.max(janela.clientWidth, window.screen.width);
    while (lista.offsetWidth < minimo) clonar();
    const larguraDoConjunto = lista.offsetWidth;

    // 2) duplica o conjunto: a animação anda metade (-50%) e recomeça sem salto
    const conjunto = [...lista.children];
    conjunto.forEach(li => {
      const copia = li.cloneNode(true);
      copia.setAttribute('aria-hidden', 'true');
      copia.querySelectorAll('a').forEach(a => { a.tabIndex = -1; });
      lista.append(copia);
    });

    lista.style.setProperty('--duracao', (larguraDoConjunto / CONFIG.pixelsPorSegundo) + 's');
  }

  /* ---------- Início ---------- */
  async function iniciar() {
    if (configurado) {
      janela.classList.add('carregando');
      lista.setAttribute('aria-busy', 'true');
      try {
        const limite = new Promise((_, rej) => setTimeout(() => rej(new Error('Tempo esgotado.')), 8000));
        const dados = await Promise.race([buscarAvaliacoes(), limite]);
        if (dados.avaliacoes.length) {
          lista.replaceChildren(...dados.avaliacoes.map(criarCartao));
          mostrarResumo(dados);
        }
      } catch (erro) {
        console.warn('Avaliações do Google indisponíveis:', erro.message);
      } finally {
        lista.removeAttribute('aria-busy');
        janela.classList.remove('carregando');
      }
    }
    iniciarRolagem();
  }

  iniciar();
})();