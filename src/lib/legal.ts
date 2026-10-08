// The legal texts of the app: privacy policy, terms of use, and about & contacts. One source for the screens in the
// app and for the public pages the App Store and Google Play link to (scripts/legal/gerar-paginas.mjs). No imports:
// the page generator reads this file with Node directly.
//
// Not legal advice: written to describe what the app really does, to be reviewed by a lawyer before publishing.

export type BlocoLegal =
  | { tipo: 'paragrafo'; texto: string }
  | { tipo: 'lista'; itens: readonly string[] };

export type SeccaoLegal = { titulo: string; blocos: readonly BlocoLegal[] };

export type DocumentoLegal = {
  id: 'privacidade' | 'termos' | 'sobre';
  titulo: string;
  resumo: string;
  atualizadoEm: string;
  seccoes: readonly SeccaoLegal[];
};

/** Bump when the terms or the privacy policy change in a way people must accept again. */
export const VERSAO_DOS_TERMOS = '2026-10-06';

/**
 * Who provides the app. Shown in every document and on the about page (RGPD, art. 13.º: identity and contact).
 * No tax number: the app is free and not run as a business, so the trader duties of DL 7/2004 (art. 10.º) and of the
 * DSA do not apply, and a personal NIF has no business being public. Add it (and a business address) the day the app
 * earns money.
 */
export const RESPONSAVEL = {
  nome: 'Martim Henriques',
  /**
   * Postal address (an apartado or a business address — never the home address). `null` until there is one: the
   * contact is the email, which is enough for the GDPR (art. 13.º) for a free app run by one person.
   */
  morada: null as string | null,
  email: 'martim565@gmail.com',
} as const;

export const IDADE_MINIMA = 18;

const p = (texto: string): BlocoLegal => ({ tipo: 'paragrafo', texto });
const l = (...itens: string[]): BlocoLegal => ({ tipo: 'lista', itens });

const ATUALIZADO = '6 de outubro de 2026';

export const PRIVACIDADE: DocumentoLegal = {
  id: 'privacidade',
  titulo: 'Política de privacidade',
  resumo:
    'Que dados o AwayDay usa, para quê, com quem os partilha e como os podes ver, corrigir ou apagar.',
  atualizadoEm: ATUALIZADO,
  seccoes: [
    {
      titulo: 'Em poucas palavras',
      blocos: [
        l(
          'Usamos só o que é preciso para a app funcionar: a tua conta, o que fazes nos dias de jogo e o que partilhas com a tua malta.',
          'Não temos publicidade, não vendemos dados, não usamos ferramentas de análise nem de rastreio, e a app não usa cookies.',
          'A tua localização é lida no momento em que precisas dela e não fica guardada.',
          'Podes apagar a conta quando quiseres, dentro da app.'
        ),
      ],
    },
    {
      titulo: 'Quem é o responsável',
      blocos: [
        p(
          `O responsável pelo tratamento dos teus dados é ${RESPONSAVEL.nome}${RESPONSAVEL.morada ? `, ${RESPONSAVEL.morada}` : ''}. Para qualquer assunto de privacidade, escreve para ${RESPONSAVEL.email}.`
        ),
      ],
    },
    {
      titulo: 'Que dados usamos e para quê',
      blocos: [
        p('Para cada tipo de dados dizemos para que serve e a razão legal (artigo 6.º do RGPD).'),
        l(
          'Conta: email, password (guardada cifrada pelo nosso fornecedor; nós nunca a vemos) e o nome que escolhes. Serve para entrares e para os outros te reconhecerem. Base: execução do contrato (os termos de utilização).',
          'Perfil: foto (opcional) e o clube que apoias, que quem tem conta pode ver. Base: execução do contrato.',
          'De onde partes para os jogos e como costumas ir (opcional): o concelho, nunca a morada, e se vais de carro, à boleia ou de transportes. Só tu vês. Serve para pôr primeiro as boleias que saem perto de ti. Base: o teu consentimento, que retiras apagando estes dados no perfil.',
          'Atividade nos dias de jogo: jogos a que dizes que vais, estádios carimbados, check-ins em tascos, avaliações, pratos recomendados e medições do barulhómetro (só o nível; o som nunca é gravado). Serve para o passaporte, as missões, o ranking e as sugestões. Base: execução do contrato.',
          'Boleias: o ponto de encontro que escolhes (nome e local no mapa, visíveis a quem vê a boleia), a hora, os lugares, o consumo e o preço do combustível que indicas, os pedidos, as presenças, os imprevistos e a conversa do carro. Base: execução do contrato.',
          'Grupos e viagens: mensagens, fotos, planos, casas propostas, despesas e acertos de contas. Base: execução do contrato.',
          'Fotos: as das missões são privadas; as de tascos só aparecem depois de aprovadas e sem o teu nome; as do álbum da viagem só as vê quem foi e os grupos dessa viagem. Base: execução do contrato.',
          'Rankings: o teu nome só aparece se escolheres aparecer. Base: o teu consentimento, que retiras na aba Ranking.',
          'Notificações: o identificador do teu telemóvel para receberes avisos. Base: o teu consentimento, dado na permissão do telemóvel e nas Definições.',
          'Segurança e moderação: denúncias, bloqueios e limites de utilização, para proteger quem usa a app e travar abusos. Base: interesse legítimo.',
          'Relatórios de erro que nos envias: o texto que escreves, o modelo do telemóvel e a versão da app. Base: interesse legítimo em corrigir erros.'
        ),
      ],
    },
    {
      titulo: 'A tua localização',
      blocos: [
        p(
          'A app só lê a tua localização quando usas uma função que precisa dela: fazer check-in num tasco, carimbar o estádio, escolher o ponto de partida de uma boleia ou encontrar a casa de banho mais perto. Lê uma vez, e a posição não fica guardada.'
        ),
        l(
          'Guardamos o resultado, não a posição: por exemplo, que estiveste num estádio num certo dia.',
          'Os check-ins ativos apagam-se ao fim de 48 horas.',
          'Quem assinala «adeptos da casa aqui» fica guardado numa quadrícula de cerca de 150 metros, nunca no ponto exato, e o registo é apagado 48 horas depois do jogo.',
          'Nunca mostramos a outra pessoa onde estás. O mapa só mostra números agregados, e só a partir de várias pessoas.'
        ),
        p('Podes recusar a localização: as outras funções continuam a funcionar.'),
      ],
    },
    {
      titulo: 'Dicas do treinador e retrospetiva da época',
      blocos: [
        p(
          'Estes textos são escritos por inteligência artificial (modelo Claude, da Anthropic) a partir de factos do teu dia de jogo: o teu clube, os jogos, os locais e a tua atividade na app. Não enviamos o teu nome nem o teu email. Podes desligar as dicas e a retrospetiva em Definições, Notificações. Base: interesse legítimo em dar sugestões úteis, ao qual te podes opor desligando-as.'
        ),
      ],
    },
    {
      titulo: 'Quem mais vê os teus dados',
      blocos: [
        p('Outras pessoas com conta veem o que é público dentro da app: o teu nome, a foto, o clube que apoias, as boleias que ofereces e o que partilhas nos grupos onde estás.'),
        p('Para a app funcionar usamos estes fornecedores, que tratam dados em nosso nome e só para isso:'),
        l(
          'Supabase: base de dados, contas e ficheiros. Os dados ficam na União Europeia (Frankfurt, Alemanha).',
          'Expo, Apple e Google: entrega das notificações no teu telemóvel.',
          'Apple Maps (iPhone) e Google Maps (Android): desenho do mapa dentro da app.',
          'Anthropic: escrita das dicas e da retrospetiva (Estados Unidos).',
          'OpenStreetMap (Nominatim e serviços de percursos): pesquisa de moradas e cálculo de percursos. Enviamos o que pesquisas, não quem és.'
        ),
        p('O calendário dos jogos vem da football-data.org, que não recebe dados teus. Não partilhamos dados com clubes, ligas, anunciantes nem corretores de dados.'),
      ],
    },
    {
      titulo: 'Dados fora da União Europeia',
      blocos: [
        p(
          'Alguns fornecedores (Anthropic, Expo) estão nos Estados Unidos. Nesses casos, a transferência faz-se com as garantias previstas no RGPD, como as cláusulas contratuais-tipo da Comissão Europeia ou o Quadro de Privacidade de Dados UE-EUA.'
        ),
      ],
    },
    {
      titulo: 'Quanto tempo guardamos',
      blocos: [
        l(
          'Os dados da conta e o que fizeste na app, enquanto tiveres conta.',
          'Check-ins ativos: 48 horas. Assinalar adeptos da casa: até 48 horas depois do jogo.',
          'Quando apagas a conta, apagamos o teu perfil e o que está ligado a ti. As fotos de tascos já aprovadas podem ficar, sem o teu nome.',
          'Cópias de segurança do fornecedor podem guardar dados durante um período curto antes de serem substituídas.'
        ),
      ],
    },
    {
      titulo: 'Os teus direitos',
      blocos: [
        p(
          'Podes pedir acesso aos teus dados, corrigi-los, apagá-los, limitar ou opor-te ao tratamento, e recebê-los num formato que possas levar para outro serviço. Muitas destas coisas fazes na própria app (perfil, definições, apagar a conta); para as outras escreve para ' +
            RESPONSAVEL.email +
            '. Respondemos no prazo de um mês.'
        ),
        p(
          'Se achares que os teus dados não estão a ser bem tratados, podes apresentar queixa à Comissão Nacional de Proteção de Dados (CNPD), em www.cnpd.pt.'
        ),
      ],
    },
    {
      titulo: 'Idade',
      blocos: [
        p(
          `O AwayDay é para maiores de ${IDADE_MINIMA} anos: há boleias com pessoas que não conheces e muitos sítios onde se serve álcool. Se soubermos que uma conta é de alguém mais novo, apagamo-la.`
        ),
      ],
    },
    {
      titulo: 'Segurança',
      blocos: [
        p(
          'As ligações são cifradas, cada pessoa só tem acesso ao que lhe diz respeito (as regras ficam na base de dados, não no telemóvel), e as fotos privadas só se abrem com links temporários. Nenhum sistema é perfeito: se houver uma falha que ponha os teus dados em risco, avisamos-te e à CNPD, como a lei manda.'
        ),
      ],
    },
    {
      titulo: 'Alterações',
      blocos: [
        p('Se esta política mudar de forma importante, avisamos-te na app antes de a mudança contar.'),
      ],
    },
  ],
};

export const TERMOS: DocumentoLegal = {
  id: 'termos',
  titulo: 'Termos de utilização',
  resumo: 'As regras para usar o AwayDay: o que a app faz, o que não faz, e o que se espera de quem a usa.',
  atualizadoEm: ATUALIZADO,
  seccoes: [
    {
      titulo: 'Quem presta o serviço',
      blocos: [
        p(
          `O AwayDay é disponibilizado por ${RESPONSAVEL.nome}${RESPONSAVEL.morada ? `, ${RESPONSAVEL.morada}` : ''}, ${RESPONSAVEL.email}. Ao criar conta aceitas estes termos e a política de privacidade.`
        ),
      ],
    },
    {
      titulo: 'Quem pode usar',
      blocos: [
        p(`É preciso ter ${IDADE_MINIMA} anos ou mais. A conta é pessoal: uma pessoa, uma conta, com um nome verdadeiro ou pelo qual sejas conhecido.`),
      ],
    },
    {
      titulo: 'O que é o AwayDay',
      blocos: [
        p(
          'Uma app gratuita para ir à bola: jogos, estádios, tascos à volta, boleias com divisão de custos, grupos com a malta e contas da viagem. A app não cobra nada e não processa pagamentos, por isso não há compras nem reembolsos.'
        ),
      ],
    },
    {
      titulo: 'Boleias',
      blocos: [
        l(
          'As boleias são para partilhar os custos da viagem (combustível e portagens), nunca para ganhar dinheiro. O preço que a app mostra é uma estimativa desses custos.',
          'O AwayDay não é uma empresa de transporte nem uma plataforma de TVDE, e não é parte do acordo entre condutor e passageiros.',
          'Quem conduz é responsável por ter carta válida, seguro em dia, o carro em condições e cumprir o Código da Estrada. Nunca conduzas depois de beber.',
          'O pagamento entre condutor e passageiros é combinado entre eles, fora da app.',
          'Encontra-te sempre em sítios públicos. Se algo correr mal, usa «Tive um imprevisto» e, em caso de perigo, liga 112.'
        ),
      ],
    },
    {
      titulo: 'Contas da viagem',
      blocos: [
        p(
          'A app ajuda a registar despesas e a calcular quem deve a quem. Não move dinheiro. Confirma os valores antes de pagares: são registados por quem usa a app.'
        ),
      ],
    },
    {
      titulo: 'Informação sobre jogos, estádios e segurança',
      blocos: [
        p(
          'Horários, estacionamento, transportes, pontos de encontro e cuidados para adeptos visitantes são informação indicativa, recolhida de fontes públicas e de quem usa a app. Pode estar desatualizada: confirma junto das fontes oficiais e segue sempre as indicações da PSP e dos clubes no dia.'
        ),
        p(
          'O AwayDay não tem nenhuma relação oficial com clubes, com a Liga Portugal, com a FPF nem com a PSP. Os nomes e as cores dos clubes e competições pertencem aos seus donos e são usados só para os identificar.'
        ),
      ],
    },
    {
      titulo: 'Sítios de terceiros',
      blocos: [
        p(
          'Algumas ligações levam para fora da app (por exemplo, anúncios de casas ou sites dos clubes). Não controlamos esses sítios nem somos parte do que lá contratares.'
        ),
      ],
    },
    {
      titulo: 'Regras de conduta',
      blocos: [
        p('Não é permitido usar a app para:'),
        l(
          'insultar, ameaçar, assediar ou discriminar alguém;',
          'combinar ou incitar confrontos entre adeptos, ou qualquer violência;',
          'publicar conteúdo ilegal, sexual, ou fotos de pessoas sem autorização;',
          'enganar os outros (contas falsas, boleias falsas, despesas falsas) ou fazer spam;',
          'partilhar dados pessoais de outras pessoas.'
        ),
        p(
          'Podes denunciar mensagens e pessoas, e bloquear quem não queres ver. Revemos as denúncias e podemos esconder conteúdo, suspender ou apagar contas que não cumpram estas regras.'
        ),
      ],
    },
    {
      titulo: 'O que publicas',
      blocos: [
        p(
          'O que escreves e as fotos que envias continuam a ser teus. Dás-nos autorização para os guardar e mostrar dentro da app às pessoas que os podem ver, enquanto lá estiverem. As fotos de tascos aprovadas ficam visíveis a todos, sem o teu nome. Só envies o que tens direito a partilhar.'
        ),
      ],
    },
    {
      titulo: 'Responsabilidade',
      blocos: [
        p(
          'Fazemos o possível para a app funcionar bem e ter informação certa, mas pode haver falhas, interrupções ou erros. Na medida em que a lei o permite, não respondemos por danos causados pelo uso da app, por informação de terceiros ou por acordos entre utilizadores. Nada nestes termos limita os direitos que a lei do consumidor te dá.'
        ),
      ],
    },
    {
      titulo: 'Acabar',
      blocos: [
        p('Podes deixar de usar a app e apagar a conta a qualquer momento, em Perfil, Conta.'),
      ],
    },
    {
      titulo: 'Alterações e lei aplicável',
      blocos: [
        p(
          'Se estes termos mudarem de forma importante, avisamos-te na app antes de a mudança contar. Aplica-se a lei portuguesa. Em caso de litígio, podes recorrer a uma entidade de resolução alternativa de litígios de consumo (lista em www.consumidor.gov.pt) ou aos tribunais competentes.'
        ),
      ],
    },
  ],
};

export const SOBRE: DocumentoLegal = {
  id: 'sobre',
  titulo: 'Sobre e contactos',
  resumo: 'Quem faz o AwayDay, como nos contactar e de onde vêm os dados e as imagens.',
  atualizadoEm: ATUALIZADO,
  seccoes: [
    {
      titulo: 'Quem faz o AwayDay',
      blocos: [
        l(
          `Nome: ${RESPONSAVEL.nome}`,
          ...(RESPONSAVEL.morada ? [`Morada: ${RESPONSAVEL.morada}`] : []),
          `Email: ${RESPONSAVEL.email}`
        ),
        p('Para erros e ideias usa «Reportar um erro ou dar uma ideia», nas Definições. Para tudo o resto, incluindo privacidade e denúncias urgentes, escreve para o email acima.'),
      ],
    },
    {
      titulo: 'Sem ligação oficial',
      blocos: [
        p(
          'O AwayDay é independente: não tem relação oficial com clubes, com a Liga Portugal, com a FPF nem com a PSP. Os escudos na app são desenhos simples com as iniciais e as cores de cada clube, não os emblemas oficiais.'
        ),
      ],
    },
    {
      titulo: 'Dados e imagens de terceiros',
      blocos: [
        l(
          'Mapas e moradas: © contribuidores do OpenStreetMap, dados disponíveis sob a licença ODbL.',
          'Calendário de jogos: football-data.org.',
          'Concelhos e distritos: Carta Administrativa Oficial de Portugal (CAOP), da Direção-Geral do Território, via geoapi.pt.',
          'Foto do ecrã de boas-vindas: «Mezokovesd Zsory stadion», de Zemszo, Wikimedia Commons, licença CC BY-SA 4.0.',
          'Fotos de tascos de terceiros: Wikimedia Commons, com o autor e a licença indicados junto a cada foto.',
          'Letras: Big Shoulders e Figtree, licença SIL Open Font License.'
        ),
      ],
    },
  ],
};

export const DOCUMENTOS_LEGAIS: readonly DocumentoLegal[] = [PRIVACIDADE, TERMOS, SOBRE];
