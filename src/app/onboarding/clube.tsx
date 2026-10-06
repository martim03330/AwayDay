import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingPasso } from '@/components/onboarding-passo';
import { OpcaoClube } from '@/components/opcao-clube';
import { Spacing } from '@/constants/theme';
import { useClubSupporterCounts } from '@/features/profile/hooks/useMyProfile';
import { textoAdeptosNaApp } from '@/lib/clubes';
import { passoSeguinte, posicaoNaIntroducao } from '@/lib/introducao';
import { useSession } from '@/lib/session';
import { clubesParaEscolher, nomesDivisao, obterClube } from '@/mocks/clubes';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

export default function OnboardingClubeScreen() {
  const adeptos = useClubSupporterCounts();
  const router = useRouter();
  const { clubeFavoritoId, escolherClube, introducaoVista } = useAppState();
  // Na primeira vez nada vem escolhido; ao rever a introdução, mostra a escolha atual.
  const [selecionadoId, setSelecionadoId] = useState<string | null>(
    introducaoVista ? clubeFavoritoId : null
  );
  const selecionado = selecionadoId ? obterClube(selecionadoId) : undefined;
  const comConta = useSession().status === 'signed-in';
  const { passo, total } = posicaoNaIntroducao('clube', comConta);

  function seguir() {
    // The clube da terra step is out for now (MOSTRAR_CLUBE_DA_TERRA).
    router.push(`/onboarding/${passoSeguinte('clube', comConta) ?? 'avisos'}`);
  }

  return (
    <OnboardingPasso
      passo={passo}
      total={total}
      frase="Primeiro o mais importante: de que clube és?"
      rodape={
        <>
          <Button
            label={selecionado ? `Continuar com ${selecionado.nomeCurto}` : 'Escolhe o teu clube'}
            variant="highlight"
            disabled={!selecionado}
            onPress={() => {
              if (!selecionado) return;
              escolherClube(selecionado.id);
              seguir();
            }}
          />
          <LinkTexto neutro label="Faço isto depois" onPress={seguir} />
        </>
      }>
      {clubesParaEscolher().map((grupo) => (
        <View key={grupo.divisao} style={styles.grupo}>
          <ThemedText
            type="eyebrow"
            themeColor="textSecondary"
            style={styles.divisao}
            accessibilityRole="header">
            {nomesDivisao[grupo.divisao]}
          </ThemedText>
          {grupo.clubes.map((clube) => (
            <OpcaoClube
              key={clube.id}
              clube={clube}
              detalhe={textoAdeptosNaApp(adeptos.data?.[clube.id])}
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
    marginBottom: Spacing.three,
  },
  divisao: {
    paddingHorizontal: 6,
    paddingBottom: Spacing.one,
  },
});
