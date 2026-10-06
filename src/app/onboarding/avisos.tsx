import { StyleSheet } from 'react-native';

import { OnboardingPasso } from '@/components/onboarding-passo';
import { Spacing } from '@/constants/theme';
import { posicaoNaIntroducao } from '@/lib/introducao';
import { useSession } from '@/lib/session';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { IconCircle, icons, type IconName } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

const AVISOS: readonly { icon: IconName; titulo: string; detalhe: string; soComConta?: boolean }[] = [
  {
    icon: icons.horario,
    titulo: 'Os teus jogos',
    detalhe: 'Lembrete para planear a ida, com dias de antecedência, e a hora de sair no dia.',
  },
  {
    icon: icons.carro,
    titulo: 'As tuas boleias',
    detalhe: 'Quando alguém aceita o teu pedido ou te pede lugar.',
    soComConta: true,
  },
  {
    icon: icons.conversa,
    titulo: 'A tua malta',
    detalhe: 'Mensagens dos grupos, convites e pedidos de amizade.',
    soComConta: true,
  },
];

/**
 * O último passo: os avisos. Quem não escolhe fica sem eles — nada liga sozinho. A localização não se pede aqui:
 * pede-se no momento do check-in, quando se percebe para que serve.
 */
export default function OnboardingAvisosScreen() {
  const sessao = useSession();
  const { permissoes, concluirOnboarding } = useAppState();
  const comConta = sessao.status === 'signed-in';
  const { passo, total } = posicaoNaIntroducao('avisos', comConta);
  const avisos = AVISOS.filter((aviso) => comConta || !aviso.soComConta);

  function acabar(querAvisos: boolean) {
    concluirOnboarding({
      localizacao: permissoes.localizacao ?? 'recusada',
      notificacoes: querAvisos ? 'aceite' : 'recusada',
    });
  }

  return (
    <OnboardingPasso
      passo={passo}
      total={total}
      frase="Queres saber o que mexe nos teus jogos?"
      rodape={
        <>
          <Button label="Ligar avisos" variant="highlight" onPress={() => acabar(true)} />
          <LinkTexto neutro label="Agora não" onPress={() => acabar(false)} />
        </>
      }>
      <Card style={styles.lista}>
        {avisos.map((aviso, indice) => (
          <LinhaGrupo
            key={aviso.titulo}
            separador={indice < avisos.length - 1}
            leading={<IconCircle name={aviso.icon} />}
            title={aviso.titulo}
            subtitle={aviso.detalhe}
          />
        ))}
      </Card>
      <ThemedText type="small" themeColor="textSecondary" style={styles.nota}>
        Só isto, nada de publicidade. Escolhes um a um nas Definições.
      </ThemedText>
    </OnboardingPasso>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  nota: {
    paddingHorizontal: Spacing.one,
  },
});
