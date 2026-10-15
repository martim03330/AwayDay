import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

import { SegundoFatorAdmin } from "@/features/profile/components/SegundoFatorAdmin";
import { useMyProfile } from "@/features/profile/hooks/useMyProfile";
import { useTheme } from "@/hooks/use-theme";
import { useUserId } from "@/lib/session";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import { Icon, icons } from "@/ui/icon";
import { LinhaGrupo } from "@/ui/linha-grupo";
import { Screen } from "@/ui/screen";
import { SkeletonCard } from "@/ui/skeleton";

/**
 * Admin tools, kept out of the settings so normal users never see them. Opened by a long press on the app version
 * in Definições (admins only), behind the authenticator code. Each tool also checks on the server.
 */
export default function AdministracaoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const chevron = (
    <Icon name={icons.seguinte} size={18} color={theme.textMuted} />
  );

  if (perfil.isLoading) {
    return (
      <Screen>
        <SkeletonCard lines={4} />
      </Screen>
    );
  }

  if (!perfil.data?.isAdmin) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Só para administradores"
          message="Este ecrã não está disponível na tua conta."
          action={{ label: "Voltar", onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SegundoFatorAdmin>
        <Card style={styles.grupo}>
          <LinhaGrupo
            separador
            onPress={() => router.push("/perfil/pontos-de-encontro")}
            accessibilityLabel="Pontos de encontro por confirmar. Toca para abrir."
            leading={
              <Icon
                name={icons.pontoEncontro}
                size={20}
                color={theme.accentInk}
              />
            }
            title="Pontos de encontro por confirmar"
            subtitle="Encontrados nas notícias dos clubes"
            trailing={chevron}
          />
          <LinhaGrupo
            separador
            onPress={() => router.push("/perfil/fotos-por-aprovar")}
            accessibilityLabel="Fotos de tascos por aprovar. Toca para abrir."
            leading={
              <Icon name={icons.tasco} size={20} color={theme.accentInk} />
            }
            title="Fotos de tascos por aprovar"
            trailing={chevron}
          />
          <LinhaGrupo
            separador
            onPress={() => router.push("/perfil/denuncias")}
            accessibilityLabel="Denúncias por rever. Toca para abrir."
            leading={
              <Icon name={icons.aviso} size={20} color={theme.accentInk} />
            }
            title="Denúncias por rever"
            trailing={chevron}
          />
          <LinhaGrupo
            onPress={() => router.push("/perfil/feedback")}
            accessibilityLabel="Erros e ideias recebidos. Toca para abrir."
            leading={
              <Icon name={icons.lista} size={20} color={theme.accentInk} />
            }
            title="Erros e ideias recebidos"
            trailing={chevron}
          />
        </Card>
      </SegundoFatorAdmin>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: 0,
    paddingVertical: 4,
  },
});
