import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarPreco, plural } from '@/lib/formatos';
import { destaquesDoMenu, type PratoComContagem } from '@/lib/pratos';
import type { Prato } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Icon, IconCircle, icons, type IconName } from '@/ui/icon';
import { LinhaDetalhes } from '@/ui/linha-detalhes';
import { ThemedText } from '@/ui/themed-text';

type Lembrete = { tipo: 'calor' | 'frio'; texto: string };

type DestaquesMenuProps = {
  pratos: readonly Prato[];
  recomendados: ReadonlySet<string>;
  /** Lembrete da meteorologia, mostrado no destaque do topo. */
  lembrete: Lembrete | null;
};

type Destaque = PratoComContagem & { rotulo: string; icon: IconName; detalhes: string[] };

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
      detalhes: [plural(maisRecomendado.recomendacoes, 'recomendação', 'recomendações')],
    },
    {
      ...maisBarato,
      rotulo: 'Mais barato',
      icon: icons.preco,
      detalhes: [`pronto em ${maisBarato.prato.minutosPreparacao} min`],
    },
    {
      ...maisRapido,
      rotulo: 'Mais rápido',
      icon: icons.horario,
      detalhes: [
        `pronto em ${maisRapido.prato.minutosPreparacao} min`,
        'para quem tem o jogo já a seguir',
      ],
    },
  ];

  return (
    <View style={styles.lista}>
      {itens.map((item, indice) => (
        <Card
          key={item.rotulo}
          style={styles.card}
          accessibilityLabel={`${item.rotulo}: ${item.prato.nome}, ${formatarPreco(item.prato.precoEuros)}, ${item.detalhes.join(', ')}`}>
          <View style={styles.linha}>
            <IconCircle name={item.icon} />
            <View style={styles.flex}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rotulo}>
                {item.rotulo}
              </ThemedText>
              <ThemedText type="smallBold" style={styles.nome}>
                {item.prato.nome}
              </ThemedText>
              <LinhaDetalhes partes={[formatarPreco(item.prato.precoEuros), ...item.detalhes]} />
            </View>
          </View>

          {indice === 0 && lembrete ? (
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
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.three,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  rotulo: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nome: {
    fontSize: 17,
    lineHeight: 24,
  },
  lembrete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 12,
  },
});
