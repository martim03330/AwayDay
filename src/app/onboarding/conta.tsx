import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingPasso } from '@/components/onboarding-passo';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';

export default function OnboardingContaScreen() {
  const router = useRouter();
  const sessao = useSession();
  const { permissoes, concluirOnboarding } = useAppState();
  const concluido = useRef(false);
  const contasDisponiveis = supabase !== null;

  // Quem entra ou cria conta a partir daqui acaba a introdução logo a seguir.
  useEffect(() => {
    if (sessao.status !== 'signed-in' || concluido.current) return;
    concluido.current = true;
    concluirOnboarding(permissoes);
  }, [sessao.status, permissoes, concluirOnboarding]);

  function continuarSemConta() {
    if (concluido.current) return;
    concluido.current = true;
    concluirOnboarding(permissoes);
  }

  return (
    <OnboardingPasso
      passo={4}
      frase="Guarda o teu passaporte: com conta, os teus clubes vêm contigo para qualquer telemóvel."
      rodape={
        <View style={styles.botoes}>
          {contasDisponiveis ? (
            <>
              <Button
                label="Criar conta"
                icon={icons.perfil}
                onPress={() => router.push('/conta/criar-conta')}
              />
              <Button
                label="Já tenho conta"
                variant="secondary"
                onPress={() => router.push('/conta/entrar')}
              />
            </>
          ) : null}
          <Button
            label={contasDisponiveis ? 'Agora não' : 'Bora lá'}
            icon={contasDisponiveis ? undefined : icons.jogos}
            variant={contasDisponiveis ? 'secondary' : 'primary'}
            onPress={continuarSemConta}
          />
        </View>
      }>
      <Card style={styles.cartao}>
        <ListRow
          leading={<IconCircle name={icons.visitado} />}
          title="Os teus clubes ficam guardados"
          subtitle="Mudas de telemóvel e continuam lá."
        />
        <ListRow
          leading={<IconCircle name={icons.perfil} />}
          title="O email é só para entrares"
          subtitle="Os outros adeptos veem o teu nome e o clube que apoias. Mais nada."
        />
        <ListRow
          leading={<IconCircle name={icons.introducao} />}
          title="Sem pressa"
          subtitle="Podes criar conta mais tarde, no Perfil."
        />
      </Card>
    </OnboardingPasso>
  );
}

const styles = StyleSheet.create({
  botoes: {
    gap: Spacing.two,
  },
  cartao: {
    gap: Spacing.three,
  },
});
