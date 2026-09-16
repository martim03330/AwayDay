import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  AREAS,
  FeedbackRefused,
  sendFeedback,
  type AreaFeedback,
  type NaturezaFeedback,
} from '@/features/feedback/api';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/** Como se diz cada sítio da app, na lista. */
const NOME_DA_AREA: Record<AreaFeedback, string> = {
  jogos: 'Jogos',
  boleias: 'Boleias',
  contas: 'Contas',
  locais: 'Tascos e locais',
  mapa: 'Mapa',
  perfil: 'Perfil',
  grupos: 'Grupos e amigos',
  outro: 'Outra coisa',
};

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof FeedbackRefused)) return 'Não deu para enviar. Tenta outra vez.';
  switch (erro.reason) {
    case 'bad_body':
      return 'Escreve um pouco mais: com duas palavras não se percebe o que aconteceu.';
    case 'rate_limited':
      return 'Já enviaste bastante por hoje. Continua amanhã.';
    default:
      return 'Não deu para enviar. Tenta outra vez.';
  }
}

/**
 * Dizer que alguma coisa não está bem, ou que podia ter mais.
 *
 * Não é preciso conta: um erro não espera por um registo. Vai o que a pessoa escrever, mais o modelo do telemóvel e
 * a versão da app — sem isso, metade dos erros não se conseguem reproduzir. Não vai localização nem nada que não
 * tenha sido escrito.
 */
export default function AjudarScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [natureza, setNatureza] = useState<NaturezaFeedback>('erro');
  const [area, setArea] = useState<AreaFeedback>('jogos');
  const [texto, setTexto] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    setErro(null);
    setAEnviar(true);
    try {
      await sendFeedback({ kind: natureza, area, body: texto });
      setEnviado(true);
      setTexto('');
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setAEnviar(false);
    }
  }

  if (enviado) {
    return (
      <Screen>
        <SectionHeader title="Obrigado" />
        <Card style={styles.cartao}>
          <ThemedText>
            {natureza === 'erro'
              ? 'Ficou registado. Se for um erro que se consiga reproduzir, é meio caminho andado para ficar resolvido.'
              : 'Ficou registado. As ideias que aparecem mais do que uma vez são as primeiras a entrar.'}
          </ThemedText>
          <Button label="Escrever outra coisa" onPress={() => setEnviado(false)} />
          <LinkTexto label="Voltar às definições" onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader title="O que se passa?" />
      <Card style={styles.cartao}>
        <View style={styles.escolhas}>
          <Chip
            label="Alguma coisa não está bem"
            selected={natureza === 'erro'}
            emCartao
            onPress={() => setNatureza('erro')}
          />
          <Chip
            label="Tenho uma ideia"
            selected={natureza === 'ideia'}
            emCartao
            onPress={() => setNatureza('ideia')}
          />
        </View>

        <ThemedText type="smallBold">Onde?</ThemedText>
        <View style={styles.escolhas}>
          {AREAS.map((nome) => (
            <Chip
              key={nome}
              label={NOME_DA_AREA[nome]}
              selected={area === nome}
              emCartao
              onPress={() => setArea(nome)}
            />
          ))}
        </View>

        <Campo
          label={natureza === 'erro' ? 'O que aconteceu' : 'O que podia ter'}
          value={texto}
          onChangeText={setTexto}
          placeholder={
            natureza === 'erro'
              ? 'Abri a boleia e o preço apareceu a zero'
              : 'Era bom poder ver as boleias de um jogo sem entrar na conta'
          }
          maxLength={1000}
          ajuda={
            natureza === 'erro'
              ? 'Diz o que fizeste antes de acontecer: é o que permite repetir o erro deste lado.'
              : undefined
          }
        />

        {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

        <Button
          label={aEnviar ? 'A enviar…' : 'Enviar'}
          icon={icons.partilhar}
          disabled={aEnviar || texto.trim().length < 10}
          onPress={() => void enviar()}
        />
      </Card>

      <ThemedText type="small" themeColor="textMuted">
        Vai o que escreveres, mais o modelo do telemóvel e a versão da app. Não vai a tua
        localização nem nada que não tenhas escrito aqui.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.twoAndHalf,
  },
  escolhas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
