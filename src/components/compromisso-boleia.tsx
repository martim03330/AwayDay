import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CONFIRMAR_HORAS_DEPOIS, PEDIDOS_FECHAM_HORAS_ANTES } from '@/lib/regras-boleia';
import { Button } from '@/ui/button';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type CompromissoBoleiaProps = {
  visivel: boolean;
  papel: 'condutor' | 'passageiro';
  onAceitar: () => void;
  onFechar: () => void;
};

function Regra({ texto }: { texto: string }) {
  const theme = useTheme();
  return (
    <View style={styles.regra}>
      <View style={[styles.ponto, { backgroundColor: theme.dangerText }]} />
      <ThemedText style={styles.flex}>{texto}</ThemedText>
    </View>
  );
}

/**
 * The big warning before offering a ride or asking for a seat. There is no payment in the app, so the promise is the
 * guarantee: nothing goes ahead until the fan says they understood what a no-show costs.
 */
export function CompromissoBoleia({ visivel, papel, onAceitar, onFechar }: CompromissoBoleiaProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [percebi, setPercebi] = useState(false);
  const condutor = papel === 'condutor';

  function fechar() {
    setPercebi(false);
    onFechar();
  }

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={fechar}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.conteudo, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={[styles.alerta, { backgroundColor: theme.dangerBackground }]}>
          <Icon name={icons.aviso} size={40} color={theme.dangerText} />
          <ThemedText
            type="title"
            style={[styles.titulo, { color: theme.dangerText }]}
            accessibilityRole="header">
            {condutor ? 'Vais levar pessoas reais' : 'Alguém conta contigo'}
          </ThemedText>
          <ThemedText style={{ color: theme.dangerText }}>
            {condutor
              ? 'Quem aceitares vai organizar o dia de jogo à volta da tua boleia. Se não apareceres, fica em terra.'
              : 'O condutor guarda-te um lugar e divide o custo contigo. Se não apareceres, paga mais e perde a viagem de outra pessoa.'}
          </ThemedText>
        </View>

        <View style={styles.regras}>
          <ThemedText type="section" accessibilityRole="header">
            As regras
          </ThemedText>
          <Regra
            texto={`Podes cancelar sem problema até ${PEDIDOS_FECHAM_HORAS_ANTES} h antes da saída.`}
          />
          <Regra
            texto={
              condutor
                ? 'Cancelar depois disso, ou não aparecer, conta como falta.'
                : 'Sair depois disso, ou não aparecer no ponto de encontro, conta como falta.'
            }
          />
          <Regra
            texto={`Depois da saída, quem foi na boleia confirma quem apareceu (até ${CONFIRMAR_HORAS_DEPOIS} h).`}
          />
          <Regra texto="2 faltas em 6 meses: 30 dias sem boleias. 3 faltas: 6 meses." />
          <Regra texto="As faltas ficam visíveis no teu perfil para quem dá ou pede boleia." />
        </View>

        <View style={[styles.imprevisto, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.destaque}>E se tiver um imprevisto?</ThemedText>
          <ThemedText themeColor="textSecondary">
            Carrega em «Tive um imprevisto» e diz o que aconteceu. Quem ia na boleia decide se
            aceita a justificação; se a aceitar, ou se não houver votos contra, não fica falta.
          </ThemedText>
        </View>

        <View style={[styles.aceitar, { borderColor: theme.border }]}>
          <ThemedText style={styles.flex}>
            {condutor
              ? 'Percebi: se cancelar tarde ou não aparecer, fico com uma falta e posso ser suspenso.'
              : 'Percebi: se sair tarde ou não aparecer, fico com uma falta e posso ser suspenso.'}
          </ThemedText>
          <Switch
            value={percebi}
            onValueChange={setPercebi}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={theme.accentText}
            ios_backgroundColor={theme.border}
            accessibilityLabel="Percebi as regras das boleias"
          />
        </View>

        <Button
          label={condutor ? 'Aceito e publico a boleia' : 'Aceito e peço lugar'}
          icon={icons.selecionado}
          disabled={!percebi}
          onPress={() => {
            setPercebi(false);
            onAceitar();
          }}
        />
        <Button label="Voltar" variant="secondary" onPress={fechar} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Spacing.three,
    padding: 20,
  },
  alerta: {
    gap: Spacing.two,
    padding: 20,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  titulo: {
    fontSize: 30,
    lineHeight: 34,
  },
  regras: {
    gap: Spacing.two,
  },
  regra: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  ponto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  flex: {
    flex: 1,
  },
  imprevisto: {
    gap: 4,
    padding: 14,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  destaque: {
    fontWeight: 800,
  },
  aceitar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 14,
    borderWidth: 1.5,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
});
