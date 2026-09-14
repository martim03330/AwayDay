import { ScrollView, StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarPreco, plural } from '@/lib/formatos';
import { destaquesDoMenu, type PratoComContagem } from '@/lib/pratos';
import type { Prato } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Icon, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type Lembrete = { tipo: 'calor' | 'frio'; texto: string };

type DestaquesMenuProps = {
  pratos: readonly Prato[];
  recomendados: ReadonlySet<string>;
  /** Lembrete da meteorologia, mostrado por baixo dos destaques. */
  lembrete: Lembrete | null;
};

type Tom = { fundo: string; tinta: string };

type Destaque = PratoComContagem & { rotulo: string; icon: IconName; tom: Tom; detalhes: string[] };

const TONS = {
  amarelo: { fundo: Colors.warningBackground, tinta: Colors.warning },
  verde: { fundo: Colors.successBackground, tinta: Colors.accentInk },
  azul: { fundo: Colors.infoBackground, tinta: Colors.infoText },
} satisfies Record<string, Tom>;

export function DestaquesMenu({ pratos, recomendados, lembrete }: DestaquesMenuProps) {
  const theme = useTheme();
  const destaques = destaquesDoMenu(pratos, recomendados);

  if (!destaques) {
    return (
      <Card>
        <EmptyState
          icon={icons.especialidade}
          title="Menu por descobrir"
          message="Ainda ninguém recomendou nada aqui. Estreia-te tu."
        />
      </Card>
    );
  }

  const { maisRecomendado, maisBarato, maisRapido } = destaques;
  const itens: Destaque[] = [
    {
      ...maisRecomendado,
      rotulo: 'Mais recomendado',
      icon: icons.estrela,
      tom: TONS.amarelo,
      detalhes: [plural(maisRecomendado.recomendacoes, 'recomendação', 'recomendações')],
    },
    {
      ...maisBarato,
      rotulo: 'Mais barato',
      icon: icons.preco,
      tom: TONS.verde,
      detalhes: [`pronto em ${maisBarato.prato.minutosPreparacao} min`],
    },
    {
      ...maisRapido,
      rotulo: 'Mais rápido',
      icon: icons.horario,
      tom: TONS.azul,
      detalhes: [
        `pronto em ${maisRapido.prato.minutosPreparacao} min`,
        'para quem tem o jogo já a seguir',
      ],
    },
  ];

  return (
    <View style={styles.lista}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        style={styles.scroll}
        contentContainerStyle={styles.fila}>
        {itens.map((item, indice) => (
          <Card
            key={item.rotulo}
            style={[styles.card, indice === 0 && { borderWidth: 2, borderColor: theme.highlight }]}
            accessibilityLabel={`${item.rotulo}: ${item.prato.nome}, ${formatarPreco(item.prato.precoEuros)}, ${item.detalhes.join(', ')}`}>
            <View style={[styles.azulejo, { backgroundColor: item.tom.fundo }]}>
              <Icon name={item.icon} size={18} color={item.tom.tinta} />
            </View>
            <ThemedText type="eyebrow" style={{ color: item.tom.tinta }}>
              {item.rotulo}
            </ThemedText>
            <ThemedText style={styles.nome}>{item.prato.nome}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.detalhes}>
              {[formatarPreco(item.prato.precoEuros), ...item.detalhes].join(' · ')}
            </ThemedText>
          </Card>
        ))}
      </ScrollView>

      {lembrete ? (
        <View
          accessible
          accessibilityLabel={lembrete.texto}
          style={[
            styles.lembrete,
            {
              backgroundColor:
                lembrete.tipo === 'calor' ? theme.warningBackground : theme.backgroundSelected,
            },
          ]}>
          <Icon
            name={lembrete.tipo === 'calor' ? icons.agua : icons.quente}
            size={16}
            color={lembrete.tipo === 'calor' ? theme.warning : theme.text}
          />
          <ThemedText type="small" style={styles.flex}>
            {lembrete.texto}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: Spacing.two,
  },
  scroll: {
    marginHorizontal: -Spacing.three,
    marginVertical: -Spacing.three,
  },
  fila: {
    gap: 10,
    paddingHorizontal: Spacing.three,
    // Room for the card shadow, which the scroll view would otherwise clip.
    paddingVertical: Spacing.three,
  },
  card: {
    width: 158,
    gap: Spacing.two,
    padding: 14,
  },
  azulejo: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderCurve: 'continuous',
  },
  nome: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: 800,
  },
  detalhes: {
    fontSize: 12,
    lineHeight: 16,
  },
  lembrete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: 10,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  flex: {
    flex: 1,
  },
});
