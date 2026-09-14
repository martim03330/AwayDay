import { View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { fontFamily } from '@/constants/theme';
import type { Clube } from '@/mocks/tipos';

type EscudoProps = {
  clube: Clube;
  size?: number;
};

const SHIELD = 'M18 1.5l15.5 5v11.3C33.5 28 27 35.2 18 38.5 9 35.2 2.5 28 2.5 17.8V6.5z';
/** Height over width of the 36x40 shield. */
const RATIO = 40 / 36;

/** Very light primaries (e.g. white) disappear on paper: those get an outline in the secondary colour. */
function isLight(hex: string) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return false;
  const [r, g, b] = match.slice(1).map((channel) => Number.parseInt(channel, 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 225;
}

/** Escudo genérico com as cores e a sigla do clube (não usa os escudos oficiais). */
export function Escudo({ clube, size = 40 }: EscudoProps) {
  const { primaria, secundaria } = clube.cores;
  const outline = isLight(primaria);

  return (
    <View
      accessible
      accessibilityLabel={`Escudo do ${clube.nomeCurto}`}
      style={{ width: size, height: size * RATIO }}>
      <Svg width={size} height={size * RATIO} viewBox="0 0 36 40">
        <Path
          d={SHIELD}
          fill={primaria}
          stroke={outline ? secundaria : undefined}
          strokeWidth={outline ? 1.5 : undefined}
          strokeLinejoin="round"
        />
        <SvgText
          x={18}
          y={24.5}
          textAnchor="middle"
          fontFamily={fontFamily('display', 800)}
          fontSize={clube.sigla.length > 3 ? 10 : 12.5}
          fill={secundaria}>
          {clube.sigla}
        </SvgText>
      </Svg>
    </View>
  );
}
