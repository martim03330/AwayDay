import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingPasso } from '@/components/onboarding-passo';
import { OpcaoClube } from '@/components/opcao-clube';
import { Spacing } from '@/constants/theme';
import { formatarNumero } from '@/lib/formatos';
import { clubesPorDivisao, nomesDivisao, obterClube } from '@/mocks/clubes';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { SectionHeader } from '@/ui/section-header';

export default function OnboardingClubeScreen() {
  const router = useRouter();
  const { clubeFavoritoId, escolherClube, introducaoVista } = useAppState();
  // Na primeira vez nada vem escolhido; ao rever a introdução, mostra a escolha atual.
  const [selecionadoId, setSelecionadoId] = useState<string | null>(
    introducaoVista ? clubeFavoritoId : null
  );
  const selecionado = selecionadoId ? obterClube(selecionadoId) : undefined;

  return (
    <OnboardingPasso
      passo={1}
      frase="Primeiro o mais importante: de que clube és?"
      rodape={
        <Button
          label={selecionado ? `Continuar com ${selecionado.nomeCurto}` : 'Escolhe o teu clube'}
          disabled={!selecionado}
          onPress={() => {
            if (!selecionado) return;
            escolherClube(selecionado.id);
            router.push('/onboarding/clube-terra');
          }}
        />
      }>
      {clubesPorDivisao.map((grupo) => (
        <View key={grupo.divisao} style={styles.grupo}>
          <SectionHeader title={nomesDivisao[grupo.divisao]} />
          {grupo.clubes.map((clube) => (
            <OpcaoClube
              key={clube.id}
              clube={clube}
              detalhe={`${formatarNumero(clube.adeptosNaApp)} adeptos na app`}
              selecionado={clube.id === selecionadoId}
              onPress={() => setSelecionadoId(clube.id)}
            />
          ))}
        </View>
      ))}
    </OnboardingPasso>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: Spacing.two,
  },
});
