# Ficha das lojas

Textos para colar no App Store Connect e na Google Play Console. Os limites de caracteres estão ao lado de cada campo
e foram contados. Tudo o que aqui se diz é coisa que a app faz hoje: se uma funcionalidade mudar, muda-se aqui também.

Não usar nomes nem emblemas de clubes nestes textos nem nas palavras-chave (são marcas registadas; a Apple recusa
palavras-chave com marcas de outros).

## App Store

| Campo | Texto | Caracteres |
|---|---|---|
| Nome | AwayDay | 7 / 30 |
| Subtítulo | Boleias e tascos para a bola | 28 / 30 |
| Palavras-chave | `futebol,estádio,adeptos,liga,jogo,partilha,despesas,dividir,contas,grupo,viagem,carimbo,ranking` | 95 / 100 |
| Categoria principal | Desporto | |
| Categoria secundária | Viagens | |
| Classificação etária | 17+ (ver `docs/LEGAL-E-LOJAS.md`) | |
| Preço | Grátis | |

As palavras-chave não repetem o nome nem o subtítulo: a Apple já os indexa juntos.

**Texto promocional** (138 / 170, pode mudar sem nova versão):

> Combina o jogo com a malta: quem leva o carro, quanto paga cada um, onde se come antes e quem deve a quem no fim. Tudo numa app, de graça.

**Descrição** (até 4000):

> Vamos à bola? O AwayDay trata do dia de jogo do princípio ao fim, para ti e para a tua malta.
>
> COMBINA COM A MALTA
> Cria um grupo, lança o jogo e cada um diz se vai. A boleia, a casa e a conversa ficam no mesmo sítio, sem perder nada no meio de cem mensagens.
>
> BOLEIAS A MEIAS
> Oferece lugar no teu carro ou encontra quem vá do teu lado. O custo não é inventado por ninguém: sai do combustível e das portagens do percurso, e baixa a cada pessoa que entra. As boleias dos teus amigos aparecem primeiro, e cada carro tem a sua conversa.
>
> O ESTÁDIO E O QUE HÁ À VOLTA
> Para cada jogo: a hora do apito, onde estacionar e a que horas chegar para ainda apanhares lugar, o caminho, a ficha do estádio e o WC mais próximo.
>
> OS TASCOS ANTES DO JOGO
> Os tascos a menos de 20 minutos a pé do estádio, com o que pedir e quanto custa, avaliados por quem lá foi. Faz check-in e vê quantos adeptos estão lá agora (só a partir de cinco pessoas, e a tua localização nunca é mostrada a ninguém).
>
> NO FIM, NINGUÉM DISCUTE CONTAS
> Durante a viagem, cada um junta o que pagou: a boleia, os bilhetes, as imperiais. A app faz as contas, diz quem deve a quem e guarda quem já pagou. Não mexe em dinheiro: só faz as contas.
>
> JOGOS LONGE
> Para jogos nas ilhas ou fora do país, alguém propõe a casa com o preço total e a malta junta-se até dar para reservar. Reservas sempre fora da app.
>
> PASSAPORTE E RANKING
> Carimba cada estádio onde vais, só lá dentro e só no dia do jogo. Ganha pontos pelo que a app confirma, sobe de nível, cumpre missões e desafios todas as semanas e compete na tua divisão.
>
> Feito em Portugal, para adeptos de qualquer clube. Sem anúncios.
>
> O AwayDay não tem ligação a nenhum clube, liga ou federação.

> Antes de publicar, confirma a frase «Sem anúncios»: só fica se a app continuar sem publicidade.

**Novidades desta versão:**

> A primeira versão do AwayDay. Boa viagem e bom jogo!

**Capturas**: `docs/promo/loja/app-store/` (10 imagens, 1320 × 2868, iPhone 6,9"). Pela ordem dos ficheiros: as três
primeiras são as que aparecem nos resultados de pesquisa.

**Vídeo de pré-visualização**: `docs/promo/anuncio/app-store-preview.mp4` (886 × 1920, 30 fps, com faixa de som). A
Apple pede que mostre só a app: são gravações do ecrã, com títulos curtos por cima.

## Google Play

| Campo | Texto | Caracteres |
|---|---|---|
| Nome da app | AwayDay: boleias e tascos | 25 / 30 |
| Descrição breve | Boleias a meias, tascos à volta do estádio e contas da viagem com a tua malta. | 78 / 80 |
| Categoria | Desporto | |
| Etiquetas | Futebol, Viagens | |

**Descrição completa**: a mesma da App Store.

**Imagens**: `docs/promo/loja/google-play/` (10 capturas 1080 × 1920 e `destaque.png` 1024 × 500).

## Onde estão os ficheiros

| O quê | Onde | Gerar outra vez |
|---|---|---|
| Capturas reais da app | `docs/promo/capturas-reais/` | ver `docs/promo/LEIA-ME.md` |
| Capturas das lojas | `docs/promo/loja/app-store/`, `docs/promo/loja/google-play/` | `node scripts/gerar-capturas-loja.mjs` |
| Títulos das capturas | `docs/promo/loja/capturas.html` (lista `CAPTURAS`) | |
