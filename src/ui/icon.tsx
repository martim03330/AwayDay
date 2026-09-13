import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type IconName = SymbolViewProps['name'];

/** SF Symbols no iOS, Material Symbols no Android e na web. */
export const icons = {
  jogos: { ios: 'soccerball', android: 'sports_soccer', web: 'sports_soccer' },
  locais: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  perfil: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  estadio: { ios: 'sportscourt.fill', android: 'stadium', web: 'stadium' },
  metro: { ios: 'tram.fill', android: 'subway', web: 'subway' },
  autocarro: { ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' },
  comboio: { ios: 'train.side.front.car', android: 'train', web: 'train' },
  tvde: { ios: 'car.fill', android: 'local_taxi', web: 'local_taxi' },
  carro: { ios: 'car.rear.fill', android: 'directions_car', web: 'directions_car' },
  aPe: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
  sol: { ios: 'sun.max.fill', android: 'sunny', web: 'sunny' },
  limpo: { ios: 'moon.stars.fill', android: 'bedtime', web: 'bedtime' },
  nublado: { ios: 'cloud.fill', android: 'cloud', web: 'cloud' },
  aguaceiros: { ios: 'cloud.drizzle.fill', android: 'rainy', web: 'rainy' },
  chuva: { ios: 'cloud.rain.fill', android: 'thunderstorm', web: 'thunderstorm' },
  probabilidadeChuva: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' },
  vento: { ios: 'wind', android: 'air', web: 'air' },
  seguinte: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  visitado: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
  selecionado: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  checkIn: { ios: 'mappin.circle.fill', android: 'where_to_vote', web: 'where_to_vote' },
  checkInFeito: { ios: 'checkmark', android: 'check', web: 'check' },
  especialidade: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  horario: { ios: 'clock', android: 'schedule', web: 'schedule' },
  semJogos: { ios: 'calendar.badge.exclamationmark', android: 'event_busy', web: 'event_busy' },
  semLocais: { ios: 'mappin.slash', android: 'wrong_location', web: 'wrong_location' },
  naoEncontrado: { ios: 'questionmark.circle', android: 'help', web: 'help' },
  cobertura: { ios: 'umbrella.fill', android: 'umbrella', web: 'umbrella' },
  sombra: { ios: 'sun.haze.fill', android: 'wb_shade', web: 'wb_shade' },
  abrigo: { ios: 'house.fill', android: 'house', web: 'house' },
  aviso: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  rota: { ios: 'arrow.triangle.turn.up.right.diamond.fill', android: 'directions', web: 'directions' },
  aviao: { ios: 'airplane', android: 'flight', web: 'flight' },
  estrela: { ios: 'star.fill', android: 'star', web: 'star' },
  pontoEncontro: { ios: 'flag.fill', android: 'flag', web: 'flag' },
  fonte: { ios: 'doc.text', android: 'description', web: 'description' },
  ranking: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  tasco: { ios: 'mug.fill', android: 'sports_bar', web: 'sports_bar' },
  porVerificar: { ios: 'hourglass', android: 'hourglass_empty', web: 'hourglass_empty' },
  localizacao: { ios: 'location.fill', android: 'near_me', web: 'near_me' },
  casa: { ios: 'house.and.flag.fill', android: 'home_pin', web: 'home_pin' },
  fechar: { ios: 'xmark', android: 'close', web: 'close' },
  cidade: { ios: 'map.fill', android: 'map', web: 'map' },
  som: { ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' },
  notificacoes: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  wc: { ios: 'toilet.fill', android: 'wc', web: 'wc' },
  preco: { ios: 'eurosign.circle.fill', android: 'euro', web: 'euro' },
  acessivel: { ios: 'figure.roll', android: 'accessible', web: 'accessible' },
  acesso: { ios: 'ticket.fill', android: 'confirmation_number', web: 'confirmation_number' },
  quente: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  agua: { ios: 'waterbottle.fill', android: 'water_full', web: 'water_full' },
  missao: { ios: 'flag.checkered', android: 'sports_score', web: 'sports_score' },
  voltar: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  introducao: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  demo: { ios: 'wand.and.stars', android: 'science', web: 'science' },
  camara: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  album: { ios: 'photo.on.rectangle.angled', android: 'photo_library', web: 'photo_library' },
  microfone: { ios: 'mic.fill', android: 'mic', web: 'mic' },
  apagar: { ios: 'trash', android: 'delete', web: 'delete' },
} satisfies Record<string, IconName>;

type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorValue;
};

export function Icon({ name, size = 20, color }: IconProps) {
  const theme = useTheme();
  return <SymbolView name={name} size={size} tintColor={color ?? theme.text} />;
}

export function IconCircle({ name, size = 18 }: { name: IconName; size?: number }) {
  const theme = useTheme();
  const diameter = size * 2.2;

  return (
    <View
      style={[
        styles.circle,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: theme.backgroundSelected,
        },
      ]}>
      <Icon name={name} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
