import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { resolveReport } from '@/features/moderation/api';
import {
  usePendingReports,
  useRefreshAfterModeration,
} from '@/features/moderation/hooks/useModeration';
import {
  REPORT_REASON_LABELS,
  type PendingReport,
  type ReportAction,
  type ReportKind,
} from '@/features/moderation/types';
import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

const NOMES: Record<ReportKind, string> = {
  message: 'Mensagem num grupo',
  ride_message: 'Mensagem num carro',
  profile: 'Nome de uma pessoa',
  profile_photo: 'Foto de perfil',
  group: 'Grupo',
};

/** The action that fixes it, when there is one the app can do by itself. */
function acaoPrincipal(denuncia: PendingReport): { action: ReportAction; label: string } {
  if (denuncia.contentGone || denuncia.hidden) return { action: 'resolver', label: 'Fechar' };
  if (denuncia.kind === 'message' || denuncia.kind === 'ride_message') {
    return { action: 'esconder', label: 'Esconder a mensagem' };
  }
  if (denuncia.kind === 'profile_photo') return { action: 'tirar_foto', label: 'Tirar a foto' };
  return { action: 'resolver', label: 'Já tratei' };
}

/**
 * Admins go through what people reported. Each card is one thing (all its reports together), shown as it is now or as
 * it was when reported. Who reported it never shows here.
 */
export default function DenunciasScreen() {
  const router = useRouter();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const eAdmin = perfil.data?.isAdmin === true;
  const denuncias = usePendingReports(eAdmin);
  const refrescar = useRefreshAfterModeration();
  const [aTratar, setATratar] = useState<string | null>(null);

  async function decidir(reportId: string, action: ReportAction) {
    setATratar(reportId);
    try {
      await resolveReport(reportId, action);
      await refrescar();
    } catch {
      Alert.alert('Não foi possível', 'Verifica a ligação e tenta outra vez.');
    } finally {
      setATratar(null);
    }
  }

  function confirmar(denuncia: PendingReport) {
    const { action, label } = acaoPrincipal(denuncia);
    if (action !== 'esconder' && action !== 'tirar_foto') {
      void decidir(denuncia.reportId, action);
      return;
    }
    Alert.alert(
      action === 'esconder' ? 'Esconder para toda a gente?' : 'Tirar a foto?',
      action === 'esconder'
        ? 'A mensagem sai da conversa de todos, incluindo de quem a escreveu.'
        : 'A pessoa fica na app, só sem foto.',
      [
        { text: 'Deixa estar', style: 'cancel' },
        {
          text: label,
          style: 'destructive',
          onPress: () => void decidir(denuncia.reportId, action),
        },
      ]
    );
  }

  if (perfil.isLoading || denuncias.isLoading) {
    return (
      <Screen>
        <SkeletonCard lines={4} />
      </Screen>
    );
  }

  if (!eAdmin) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Só para administradores"
          message="Este ecrã serve para rever o que os adeptos denunciam."
          action={{ label: 'Voltar', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const lista = denuncias.data ?? [];
  if (lista.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={icons.selecionado}
          title="Tudo em ordem"
          message="Não há denúncias por rever. A malta anda bem-comportada."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Esconde o que passa das marcas (insultos, assédio, ameaças, spam). Se não for caso disso,
        rejeita. Quem denunciou não aparece aqui.
      </ThemedText>
      {lista.map((denuncia) => {
        const principal = acaoPrincipal(denuncia);
        const ePerfilOuGrupo = denuncia.kind === 'profile' || denuncia.kind === 'group';
        return (
          <Card key={denuncia.reportId} style={styles.card}>
            <View style={styles.cabecalho}>
              <ThemedText type="smallBold" style={styles.flex}>
                {NOMES[denuncia.kind]}
              </ThemedText>
              <Etiqueta
                label={plural(denuncia.reports, 'denúncia', 'denúncias')}
                tone={denuncia.reports > 1 ? 'aviso' : 'neutro'}
              />
            </View>

            {denuncia.kind === 'profile_photo' && denuncia.photoUrl ? (
              <Image
                source={{ uri: denuncia.photoUrl }}
                contentFit="cover"
                style={styles.foto}
                accessibilityLabel={`Foto de perfil de ${denuncia.reportedName ?? 'alguém'}`}
              />
            ) : denuncia.kind !== 'profile_photo' ? (
              <ThemedText style={styles.conteudo}>
                {denuncia.kind === 'message' || denuncia.kind === 'ride_message'
                  ? `«${denuncia.content ?? ''}»`
                  : (denuncia.content ?? '')}
              </ThemedText>
            ) : null}

            <ThemedText type="small" themeColor="textSecondary">
              {[
                denuncia.reportedName && denuncia.kind !== 'group'
                  ? `De ${denuncia.reportedName}`
                  : null,
                denuncia.context,
                formatarDiaEHora(new Date(denuncia.lastReportedAt)),
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
            <ThemedText type="small">
              {`Motivo: ${denuncia.reasons.map((razao) => REPORT_REASON_LABELS[razao]).join(', ')}`}
            </ThemedText>
            {denuncia.notes.map((nota, indice) => (
              <ThemedText key={indice} type="small" themeColor="textSecondary">
                {`«${nota}»`}
              </ThemedText>
            ))}
            {denuncia.contentGone ? (
              <ThemedText type="small" themeColor="textMuted">
                Já foi apagado (ou mudado) entretanto: estás a ver o que estava quando foi
                denunciado.
              </ThemedText>
            ) : null}
            {denuncia.hidden ? (
              <ThemedText type="small" themeColor="textMuted">
                Esta mensagem já está escondida.
              </ThemedText>
            ) : null}
            {ePerfilOuGrupo && !denuncia.contentGone ? (
              <ThemedText type="small" themeColor="textMuted">
                Nomes ainda se mudam à mão. Quando estiver tratado, fecha a denúncia.
              </ThemedText>
            ) : null}

            <View style={styles.botoes}>
              <View style={styles.flex}>
                <Button
                  label={principal.label}
                  variant={
                    principal.action === 'esconder' || principal.action === 'tirar_foto'
                      ? 'danger'
                      : 'primary'
                  }
                  disabled={aTratar !== null}
                  onPress={() => confirmar(denuncia)}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Rejeitar"
                  variant="secondary"
                  icon={icons.fechar}
                  disabled={aTratar !== null}
                  onPress={() => void decidir(denuncia.reportId, 'rejeitar')}
                />
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  conteudo: {
    fontSize: 16,
    lineHeight: 22,
  },
  foto: {
    width: 160,
    height: 160,
    borderRadius: Radius.button,
  },
  botoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
