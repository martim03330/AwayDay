# AwayDay

App móvel para adeptos em dia de jogo: próximos jogos, como chegar ao estádio, tascos à volta,
check-ins e um passaporte de estádios.

> **Estado: demo navegável, só frontend.** Não há backend, autenticação nem pedidos de rede.
> Todos os dados vêm de `src/mocks/` e o estado vive em memória: ao recarregar a app, tudo volta ao início.

## Funcionalidades

**Jogos**
- Próximos jogos agrupados por dia (hora de Lisboa), com filtros por competição e pelo teu clube.
- Liga Portugal Betclic, Liga 2, Liga 3, taças e competições europeias.
- Estados "a decorrer" e "terminado", com carregamento e vazios simulados.

**Ficha do jogo**
- Estádio com cobertura, sombra e abrigo, e aviso quando há chuva prevista e a cobertura não é total.
- WC mais próximo do estádio, com distância a pé, horário, preço, acessibilidade e tipo de acesso.
- Mapa da cidade com o escudo do clube da casa; ao tocar no escudo, faz zoom e mostra os tascos e os WC à volta.
- Meteorologia simulada, distância e tempo de carro a partir de uma localização simulada, e três opções de transporte.
- Ponto de encontro oficial para visitantes nos jogos europeus.
- Avaliação da visita (estádio, ambiente, acessos) a partir do fim do jogo.

**Locais**
- Tascos a menos de 20 minutos a pé do estádio, ordenados por distância.
- Cervejómetro, petiscómetro, contador de pessoas, check-in e a tua nota ao tasco.
- Menu com recomendações dos adeptos e três destaques: mais recomendado, mais barato e mais rápido, com um lembrete de água ou de algo quente conforme a meteorologia do próximo jogo.
- WC mais próximo do tasco.

**Perfil**
- Clube que apoias e clube da terra (a sugestão pela localização exige sempre confirmação).
- Passaporte de estádios com missões e distintivos, histórico de avaliações editáveis e de tascos verificados, e ranking.
- Definições de sons (desligados por omissão) e de notificações (só interface, nada é enviado).

## Stack

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) com React Native 0.86 e React 19.2
- TypeScript em modo strict, sem `any`
- Expo Router com tabs nativas
- `react-native-maps`, `react-native-reanimated` e `expo-audio`

## Requisitos

- Node 24: a versão está fixada em [`mise.toml`](mise.toml); com o [mise](https://mise.jdx.dev) instalado, basta `mise install`.
- npm
- No telemóvel, a app [Expo Go](https://expo.dev/go) compatível com o SDK 57. No iOS, é preciso ter sessão iniciada com a mesma conta Expo no terminal (`npx expo login`) e no Expo Go.
- Opcional: Xcode para o simulador iOS.

## Como correr

```bash
mise install
npm install
npx expo start
```

Lê o QR code com a câmara (iOS) ou com o Expo Go (Android). O telemóvel tem de estar na mesma rede que o computador.

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Arranca o servidor de desenvolvimento |
| `npm run ios` | Arranca e abre o simulador iOS |
| `npm run android` | Arranca e abre o emulador Android |
| `npm run web` | Arranca a versão web (sem mapa) |
| `npm run lint` | Corre o ESLint |
| `npx tsc --noEmit` | Verifica os tipos |

## Estrutura

```
src/
  app/          Ecrãs e navegação (Expo Router): jogos/, locais/, perfil/
  components/   Componentes da app (cartões, mapa, passaporte, formulários)
  ui/           Componentes base (texto, cartões, botões, chips, estados vazios)
  mocks/        Dados tipados: clubes, estádios, jogos, locais, avaliações, pontos de encontro
  lib/          Funções puras: datas, formatos, distâncias, meteorologia, filtros
  state/        Estado em memória (React Context) e sons
  hooks/        Hooks partilhados
assets/
  sounds/       Sons curtos de check-in e carimbo (placeholders)
```

## Sobre os dados

- **Clubes e estádios** são reais; capacidades e coordenadas são aproximadas. A Liga 2 e a Liga 3 têm uma seleção ilustrativa de clubes.
- **Tascos e bares são fictícios**, para não atribuir notas nem contadores inventados a negócios reais. Os pratos, as recomendações e os adeptos presentes em cada tasco também são mock.
- **Casas de banho** são mock: posições, preços e horários servem só a demo.
- **Missões** nunca pedem para trocar objetos pessoais nem contacto físico. A missão da foto com um adepto rival é confirmada pelo próprio utilizador, sem verificação.
- **Meteorologia, distâncias, tempos e preços** são simulados.
- **Pontos de encontro dos jogos europeus** usam informação real, publicada pelos clubes para jogos já disputados, e indicam sempre a fonte e o jogo original:
  - [FC Porto em Roma](https://www.fcporto.pt/pt/noticias/20250219-pt-informacoes-aos-adeptos-que-vao-a-roma-apoiar-o-fc-porto) (Liga Europa, fev. 2025)
  - [SL Benfica em Turim](https://www.slbenfica.pt/pt-pt/agora/noticias/2025/01/29/futebol-benfica-informacoes-adeptos-jogo-juventus-8-jornada-fase-de-liga-liga-dos-campeoes) (Liga dos Campeões, jan. 2025)
  - [FC Porto em Salzburgo](https://www.fcporto.pt/pt/noticias/20250924-pt-informacoes-aos-adeptos-que-vao-a-salzburgo-apoiar-o-fc-porto) (Liga Europa, set. 2025)
- Os escudos são gerados com as cores e a sigla de cada clube; não são os oficiais.

## Limitações conhecidas

- O fundo do mapa vem do Apple Maps (iOS) ou Google Maps (Android) e precisa de internet; os pontos são todos da demo.
- Uma build de produção para Android vai precisar de uma chave da Google Maps. No Expo Go não é preciso.
- Na web, o mapa é substituído por um aviso.
- Os sons são placeholders e as notificações são só interface.
