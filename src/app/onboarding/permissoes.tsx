import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingPasso } from '@/components/onboarding-passo';
import { Spacing } from '@/constants/theme';
import { useAppState, type EstadoPermissao } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { IconCircle, icons, type IconName } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';

type CartaoPermissaoProps = {
  icon: IconName;
  titulo: string;
  paraQueServe: string;
  estado: EstadoPermissao;
  onEscolher: (estado: 'aceite' | 'recusada') => void;
};

function CartaoPermissao({ icon, titulo, paraQueServe, estado, onEscolher }: CartaoPermissaoProps) {
  return (
    <Card style={styles.cartao}>
      <ListRow leading={<IconCircle name={icon} />} title={titulo} subtitle={paraQueServe} />
      <View style={styles.botoes}>
        <View style={styles.botao}>
          <Button
            label={estado === 'aceite' ? 'Aceite' : 'Aceitar'}
            icon={estado === 'aceite' ? icons.selecionado : undefined}
            variant={estado === 'aceite' ? 'primary' : 'secondary'}
            onPress={() => onEscolher('aceite')}
          />
        </View>
        <View style={styles.botao}>
          <Button
            label="Continuar sem"
            icon={estado === 'recusada' ? icons.selecionado : undefined}
            variant={estado === 'recusada' ? 'primary' : 'secondary'}
            onPress={() => onEscolher('recusada')}
          />
        </View>
      </View>
    </Card>
  );
}

export default function OnboardingPermissoesScreen() {
  const { permissoes, concluirOnboarding } = useAppState();
  const [localizacao, setLocalizacao] = useState<EstadoPermissao>(permissoes.localizacao);
  const [notificacoes, setNotificacoes] = useState<EstadoPermissao>(permissoes.notificacoes);

  return (
    <OnboardingPasso
      passo={3}
      frase="Pedimos pouco: localização para os tascos e WC mais perto, e notificações para não perderes uma mudança de horário."
      rodape={
        <Button
          label="Bora lá"
          icon={icons.jogos}
          onPress={() =>
            // Quem não decide, continua sem: nada fica ligado por omissão.
            concluirOnboarding({
              localizacao: localizacao ?? 'recusada',
              notificacoes: notificacoes ?? 'recusada',
            })
          }
        />
      }>
      <CartaoPermissao
        icon={icons.localizacao}
        titulo="Localização"
        paraQueServe="Tascos e WC perto de ti."
        estado={localizacao}
        onEscolher={setLocalizacao}
      />
      <CartaoPermissao
        icon={icons.notificacoes}
        titulo="Notificações"
        paraQueServe="Horários, chuva e carimbos novos."
        estado={notificacoes}
        onEscolher={setNotificacoes}
      />
    </OnboardingPasso>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.three,
  },
  botoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  botao: {
    flex: 1,
  },
});
