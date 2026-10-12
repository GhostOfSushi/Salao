/* =========================================================
   Depoimentos
   1) "Ler mais / Ler menos" nos comentários com mais de 3 linhas
   2) Rolagem contínua da direita para a esquerda
   Os textos ficam no index.html (seção "Quem treina com a gente").
   ========================================================= */
(() => {
  const VELOCIDADE = 45; // pixels por segundo

  const janela = document.querySelector('.depoimentos-janela');
  const lista = document.querySelector('.depoimentos');
  if (!janela || !lista) return;

  const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- "Ler mais": só aparece se o texto passar de 3 linhas ---------- */
  function prepararLerMais() {
    [...lista.children].forEach((li, i) => {
      li.dataset.idx = i; // os clones da rolagem herdam o número, para abrirem juntos

      const cartao = li.querySelector('.depoimento');
      const citacao = cartao && cartao.querySelector('blockquote');
      const texto = citacao && citacao.querySelector('p');
      if (!texto || !texto.textContent.trim()) return;

      // aplica o recorte, mede e só mantém se o texto realmente passou de 3 linhas
      cartao.classList.add('depoimento--recortado');
      if (texto.scrollHeight <= texto.clientHeight + 1) {
        cartao.classList.remove('depoimento--recortado');
        return;
      }

      const bloco = document.createElement('div');
      bloco.className = 'depoimento__texto';
      citacao.before(bloco);
      bloco.append(citacao);

      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'depoimento__mais';
      botao.textContent = 'Ler mais';
      botao.setAttribute('aria-expanded', 'false');
      bloco.append(botao);
    });
  }

  // Um único ouvinte cuida de todos os botões (inclusive os dos clones)
  lista.addEventListener('click', (e) => {
    const botao = e.target.closest('.depoimento__mais');
    if (!botao) return;

    const abrir = botao.getAttribute('aria-expanded') !== 'true';
    const idx = botao.closest('li').dataset.idx;

    lista.querySelectorAll(`li[data-idx="${idx}"]`).forEach((li) => {
      li.querySelector('.depoimento').classList.toggle('depoimento--aberto', abrir);
      const b = li.querySelector('.depoimento__mais');
      b.setAttribute('aria-expanded', String(abrir));
      b.textContent = abrir ? 'Ler menos' : 'Ler mais';
    });

    // para a rolagem enquanto houver comentário aberto
    lista.classList.toggle('pausado', !!lista.querySelector('.depoimento--aberto'));
  });

  /* ---------- Rolagem contínua ---------- */
  function iniciarRolagem() {
    const originais = [...lista.children];

    const clonarPara = (itens) => itens.forEach((li) => {
      const copia = li.cloneNode(true);
      copia.setAttribute('aria-hidden', 'true');   // leitores de tela leem só os originais
      copia.querySelectorAll('a, button').forEach((el) => { el.tabIndex = -1; });
      lista.append(copia);
    });

    // 1) completa um "conjunto" mais largo que a tela, para não aparecer vão
    const minimo = Math.max(janela.clientWidth, window.screen.width);
    while (lista.offsetWidth < minimo) clonarPara(originais);
    const larguraDoConjunto = lista.offsetWidth;

    // 2) duplica o conjunto: a animação anda metade (-50%) e recomeça sem salto
    clonarPara([...lista.children]);

    lista.style.setProperty('--duracao', (larguraDoConjunto / VELOCIDADE) + 's');
  }

  function iniciar() {
    if (!lista.children.length) return;

    if (reduzMovimento) {
      // sem rolagem: carrossel de arrastar (CSS); só o "Ler mais"
      prepararLerMais();
      return;
    }

    // ativa o layout da faixa ANTES de medir, porque a largura do cartão
    // define quantas linhas o texto ocupa
    janela.classList.add('ativa');
    lista.classList.add('rolando');
    prepararLerMais();
    iniciarRolagem();
  }

  // espera as fontes carregarem: elas mudam a quebra de linha
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(iniciar);
})();