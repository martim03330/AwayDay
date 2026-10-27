import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ConfirmacaoInline } from '@/ui/confirmacao-inline';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

export type GrupoDoPlano = { id: string; name: string; aberto: boolean };

type GruposDoPlanoProps = {
  grupos: readonly GrupoDoPlano[];
  /** Who invited, while the plan is open: sends the plan to a group or takes it back. Everyone else only sees. */
  podeGerir: boolean;
  aTratar: boolean;
  onMandar: (grupoId: string) => void;
  /** Resolves to whether it worked, so the confirmation only closes when the plan really left. */
  onRetirar: (grupoId: string) => Promise<boolean>;
};

function animar() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
}

/**
 * The other groups and where the plan stands with each: one row per group, with its state on the right («Aberto» or
 * «Mandar»). Taking the plan back is confirmed in the row itself, with what it means for the people there.
 */
export function GruposDoPlano({ grupos, podeGerir, aTratar, onMandar, onRetirar }: GruposDoPlanoProps) {
  const theme = useTheme();
  const [aConfirmar, setAConfirmar] = useState<string | null>(null);

  const alternar = (grupoId: string) => {
    animar();
    setAConfirmar((atual) => (atual === grupoId ? null : grupoId));
  };

  return (
    <View>
      {grupos.map((grupo, indice) => {
        const confirmar = aConfirmar === grupo.id;
        const separador = indice < grupos.length - 1;
        return (
          <View
            key={grupo.id}
            style={[styles.bloco, separador && { borderBottomWidth: 1, borderBottomColor: theme.backgroundSelected }]}>
            <Pressable
              disabled={!podeGerir || !grupo.aberto}
              onPress={() => alternar(grupo.id)}
              accessibilityRole={podeGerir && grupo.aberto ? 'button' : undefined}
              accessibilityLabel={
                grupo.aberto
                  ? `${grupo.name}: convidado para este plano.${podeGerir ? ' Toca para retirar o convite.' : ''}`
                  : `${grupo.name}: ainda não foi convidado.`
              }
              style={({ pressed }) => [styles.linha, pressed && styles.premido]}>
              <IconCircle name={icons.malta} tone={grupo.aberto ? 'green' : 'neutral'} />
              <ThemedText style={[styles.corpo, styles.nome]} numberOfLines={1}>
                {grupo.name}
              </ThemedText>
              {grupo.aberto ? (
                <View style={styles.estado}>
                  <View style={[styles.pilula, { backgroundColor: theme.successBackground }]}>
                    <Icon name={icons.checkInFeito} size={14} color={theme.accentInk} />
                    <ThemedText style={[styles.pilulaTexto, { color: theme.accentInk }]}>Convidado</ThemedText>
                  </View>
                  {podeGerir ? (
                    <Icon
                      name={confirmar ? icons.fechar : icons.seguinte}
                      size={16}
                      color={theme.textMuted}
                    />
                  ) : null}
                </View>
              ) : podeGerir ? (
                <Pressable
                  onPress={() => onMandar(grupo.id)}
                  disabled={aTratar}
                  accessibilityRole="button"
                  accessibilityLabel={`Convidar a malta do ${grupo.name}`}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.pilula,
                    styles.mandar,
                    { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
                    aTratar && styles.desligado,
                  ]}>
                  <Icon name={icons.enviar} size={14} color={theme.text} />
                  <ThemedText style={styles.pilulaTexto}>Convidar</ThemedText>
                </Pressable>
              ) : null}
            </Pressable>

            {confirmar ? (
              <View style={styles.confirmacao}>
                <ConfirmacaoInline
                  perigo
                  aTratar={aTratar}
                  mensagem={`O convite sai da conversa de «${grupo.name}» e quem de lá disse que ia deixa de contar. Os lugares já aceites no carro e na casa ficam. Os dois grupos são avisados.`}
                  cancelar="Manter o convite"
                  confirmar="Retirar o convite"
                  onCancelar={() => alternar(grupo.id)}
                  onConfirmar={() =>
                    void onRetirar(grupo.id).then((feito) => {
                      if (!feito) return;
                      animar();
                      setAConfirmar(null);
                    })
                  }
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: {
    paddingVertical: Spacing.one,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
    paddingVertical: Spacing.two,
  },
  premido: {
    opacity: 0.7,
  },
  corpo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  nome: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 700,
  },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  mandar: {
    borderWidth: 1,
  },
  pilulaTexto: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: 700,
  },
  desligado: {
    opacity: 0.4,
  },
  confirmacao: {
    paddingBottom: Spacing.two,
  },
});
