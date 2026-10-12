import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { useAbrirPerfil } from '@/hooks/use-abrir-perfil';
import { Spacing } from '@/constants/theme';
import type { FixturePlan } from '@/features/groups/plans';
import { useTheme } from '@/hooks/use-theme';
import { formatarDia, formatarHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Icon, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

type Boleia = NonNullable<FixturePlan['ride']>;

type CartaoDaBoleiaProps = {
  boleia: Boleia;
  fotoDoCondutor?: string | null;
  souCondutor: boolean;
  /** Quem convidou pode tirar a boleia do plano. */
  podeTirar: boolean;
  /** Já vais a este jogo com outro grupo: não dá para entrar neste carro. */
  vaisComOutroGrupo?: string | null;
  aTratar: boolean;
  onEntrar: () => void;
  onSair: () => void;
  onPublica: (ligar: boolean) => void;
  onVolta: (ligar: boolean) => void;
  onVer: () => void;
  onTirar: () => void;
};

/**
 * A boleia do plano, arrumada por importância: quem conduz, quando sai e quanto fica a cada um; os lugares,
 * desenhados; e uma só ação principal. Os interruptores só aparecem a quem conduz; o resto está nos detalhes.
 */
export function CartaoDaBoleia({
  boleia,
  fotoDoCondutor,
  souCondutor,
  podeTirar,
  vaisComOutroGrupo,
  aTratar,
  onEntrar,
  onSair,
  onPublica,
  onVolta,
  onVer,
  onTirar,
}: CartaoDaBoleiaProps) {
  const theme = useTheme();
  const abrirPerfil = useAbrirPerfil();
  const saida = new Date(boleia.departureAt);
  const livres = Math.max(0, boleia.seatsOffered - boleia.seatsTaken);
  const vou = boleia.myStatus === 'accepted';

  return (
    <Card style={styles.cartao}>
      <View style={styles.topo}>
        <Pressable
          onPress={() => abrirPerfil(boleia.driverId)}
          accessibilityRole="button"
          accessibilityLabel={`Ver o perfil de ${boleia.driverName}`}>
          <Avatar nome={boleia.driverName} url={fotoDoCondutor} size={44} />
        </Pressable>
        <View style={styles.flex}>
          <ThemedText style={styles.nome} numberOfLines={1}>
            {souCondutor ? 'O teu carro' : boleia.driverName}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`Sai às ${formatarHora(saida)} · ${formatarDia(saida)}`}
          </ThemedText>
        </View>
        <View style={styles.preco}>
          <ThemedText style={[styles.precoValor, { color: theme.accentInk }]}>
            {formatarCentimos(boleia.shareNowCents)}
          </ThemedText>
          <ThemedText style={[styles.precoLegenda, { color: theme.textSecondary }]}>
            cada
          </ThemedText>
        </View>
      </View>

      <View
        style={styles.lugares}
        accessible
        accessibilityLabel={`${plural(boleia.seatsOffered, 'lugar', 'lugares')}, ${livres === 0 ? 'carro cheio' : plural(livres, 'livre', 'livres')}`}>
        <View style={styles.bancos}>
          {Array.from({ length: boleia.seatsOffered }, (_, indice) => (
            <View
              key={indice}
              style={[
                styles.banco,
                indice < boleia.seatsTaken
                  ? { backgroundColor: theme.accent, borderColor: theme.accent }
                  : { borderColor: theme.borderStrong },
              ]}
            />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
          {[
            livres === 0 ? 'Carro cheio' : plural(livres, 'lugar livre', 'lugares livres'),
            souCondutor ? null : boleia.publica ? 'aberta ao público' : 'só a malta do plano',
          ]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
      </View>

      {souCondutor ? null : vou ? (
        <View style={styles.estado}>
          <Icon name={icons.selecionado} size={18} color={theme.accentInk} />
          <ThemedText type="smallBold" style={[styles.flex, { color: theme.accentInk }]}>
            Vais neste carro
          </ThemedText>
          <Pressable onPress={onSair} disabled={aTratar} hitSlop={8} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.dangerText }}>
              Sair
            </ThemedText>
          </Pressable>
        </View>
      ) : vaisComOutroGrupo ? (
        <ThemedText type="small" themeColor="textSecondary">
          {`Já vais a este jogo com «${vaisComOutroGrupo}».`}
        </ThemedText>
      ) : livres > 0 ? (
        <Button label="Vou nesta boleia" icon={icons.carro} disabled={aTratar} onPress={onEntrar} />
      ) : null}

      {souCondutor ? (
        <View style={[styles.definicoes, { borderTopColor: theme.backgroundSelected }]}>
          <Interruptor
            titulo="Aberta ao público"
            descricao="Quem não é do plano pode pedir lugar."
            value={boleia.publica}
            disabled={aTratar}
            onValueChange={onPublica}
          />
          {boleia.roundTrip ? (
            <Interruptor
              titulo="Volta aberta"
              descricao="Quem ficar sem transporte pede lugar no regresso."
              value={boleia.acceptsReturn}
              disabled={aTratar}
              onValueChange={onVolta}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.acoes}>
        <LinkTexto label="Ver detalhes" onPress={onVer} />
        {podeTirar ? (
          <LinkTexto neutro label="Tirar do plano" disabled={aTratar} onPress={onTirar} />
        ) : null}
      </View>
    </Card>
  );
}

function Interruptor({
  titulo,
  descricao,
  value,
  disabled,
  onValueChange,
}: {
  titulo: string;
  descricao: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (ligar: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.interruptor}>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{titulo}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {descricao}
        </ThemedText>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ true: theme.accent, false: theme.border }}
        ios_backgroundColor={theme.border}
        accessibilityLabel={titulo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.three,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  flex: {
    flex: 1,
  },
  nome: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 800,
  },
  preco: {
    alignItems: 'flex-end',
  },
  precoValor: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: 800,
  },
  precoLegenda: {
    fontSize: 12,
    lineHeight: 15,
  },
  lugares: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  bancos: {
    flexDirection: 'row',
    gap: 5,
  },
  banco: {
    width: 14,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
  },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  definicoes: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
  interruptor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
