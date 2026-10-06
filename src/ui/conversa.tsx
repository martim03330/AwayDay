import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { fontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarHora } from '@/lib/datas';
import { Avatar } from '@/ui/avatar';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

// As peças de uma conversa, iguais em todo o lado: a do grupo e a do carro.

/** A data a meio da conversa («Hoje», «Ontem»). Por cima de um fundo escuro, a pastilha fica clara. */
export function PastilhaDeConversa({ texto, escuro = false }: { texto: string; escuro?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.pastilha,
        { backgroundColor: escuro ? 'rgba(255,255,255,0.85)' : theme.backgroundElement },
      ]}>
      <ThemedText type="small" style={{ color: escuro ? '#13241B' : theme.textSecondary }}>
        {texto}
      </ThemedText>
    </View>
  );
}

type BolhaProps = {
  nome: string;
  texto: string;
  /** ISO: a hora aparece no canto da bolha. */
  criadaEm: string;
  minha: boolean;
  /** A primeira de uma série da mesma pessoa leva a cara e o nome; as seguintes vão coladas. */
  mostrarQuem: boolean;
  fotoUrl?: string | null;
  onLongPress?: () => void;
};

/** Uma mensagem: verde e à direita se é tua, branca e à esquerda com a cara de quem a escreveu. */
export function BolhaDeConversa({
  nome,
  texto,
  criadaEm,
  minha,
  mostrarQuem,
  fotoUrl,
  onLongPress,
}: BolhaProps) {
  const theme = useTheme();

  return (
    <View style={[styles.linha, minha ? styles.direita : styles.esquerda]}>
      {!minha ? (
        <View style={styles.lugarAvatar}>
          {mostrarQuem ? <Avatar nome={nome} url={fotoUrl} size={30} /> : null}
        </View>
      ) : null}
      <Pressable
        onLongPress={onLongPress}
        accessibilityHint={
          onLongPress
            ? minha
              ? 'Toca sem largar para apagar.'
              : 'Toca sem largar para mais opções.'
            : undefined
        }
        style={[
          styles.bolha,
          minha
            ? { backgroundColor: theme.accent, borderBottomRightRadius: 6 }
            : { backgroundColor: theme.backgroundElement, borderBottomLeftRadius: 6 },
          !mostrarQuem && styles.seguida,
        ]}>
        {!minha && mostrarQuem ? (
          <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
            {nome}
          </ThemedText>
        ) : null}
        <ThemedText style={minha ? { color: theme.accentText } : undefined}>{texto}</ThemedText>
        <ThemedText
          type="small"
          style={[styles.hora, { color: minha ? theme.accentText : theme.textMuted }]}>
          {formatarHora(new Date(criadaEm))}
        </ThemedText>
      </Pressable>
    </View>
  );
}

type CaixaDeEscritaProps = {
  valor: string;
  onChange: (texto: string) => void;
  onEnviar: () => void;
  aEnviar: boolean;
  placeholder: string;
  accessibilityLabel: string;
};

/** A caixa de escrever e o botão de enviar, no fundo da conversa. */
export function CaixaDeEscrita({
  valor,
  onChange,
  onEnviar,
  aEnviar,
  placeholder,
  accessibilityLabel,
}: CaixaDeEscritaProps) {
  const theme = useTheme();
  const vazio = valor.trim().length === 0;

  return (
    <View style={styles.escrever}>
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        multiline
        maxLength={500}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.caixa,
          { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
        ]}
      />
      <Pressable
        onPress={onEnviar}
        disabled={aEnviar || vazio}
        accessibilityRole="button"
        accessibilityLabel="Enviar"
        style={({ pressed }) => [
          styles.enviar,
          {
            backgroundColor: pressed ? theme.accentPressed : theme.accent,
            opacity: aEnviar || vazio ? 0.45 : 1,
          },
        ]}>
        <Icon name={icons.enviar} size={19} color={theme.accentText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pastilha: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.twoAndHalf,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    marginVertical: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  esquerda: {
    justifyContent: 'flex-start',
    paddingRight: Spacing.six,
  },
  direita: {
    justifyContent: 'flex-end',
    paddingLeft: Spacing.six,
  },
  lugarAvatar: {
    width: 30,
  },
  bolha: {
    flexShrink: 1,
    paddingHorizontal: Spacing.twoAndHalf,
    paddingVertical: Spacing.two,
    borderRadius: 18,
    borderCurve: 'continuous',
    gap: 2,
    marginTop: Spacing.one,
  },
  seguida: {
    marginTop: 0,
  },
  hora: {
    alignSelf: 'flex-end',
    fontSize: 11,
    opacity: 0.75,
  },
  escrever: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  caixa: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    fontFamily: fontFamily('body', 500),
  },
  enviar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
