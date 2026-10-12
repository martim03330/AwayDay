import { formatarCentimos, formatarCentimosCurto } from '@/lib/money';
import { useAppState } from '@/state/app-state';
import { ThemedText, type ThemedTextProps } from '@/ui/themed-text';

/** What every amount shows while «Esconder valores» is on. */
export const VALOR_ESCONDIDO = '•••• €';
/** What a screen reader says in its place. */
export const VALOR_ESCONDIDO_LEITOR = 'valor escondido';

export type FormatarDinheiro = {
  /** «Esconder valores» is on. */
  escondido: boolean;
  /** "3,50 €", or «•••• €» when hidden. */
  formatar: (centimos: number) => string;
  /** "50 €" / "3,50 €", or «•••• €» when hidden. */
  formatarCurto: (centimos: number) => string;
  /** For accessibility labels: the amount, or «valor escondido» when hidden. */
  dito: (centimos: number) => string;
  /** For accessibility labels built from already formatted text: swaps every «•••• €» for «valor escondido». */
  leitor: (texto: string) => string;
};

/** Formats amounts of money for display, respecting «Esconder valores». Money maths stays in `@/lib/money`. */
export function useFormatarDinheiro(): FormatarDinheiro {
  const { esconderValores } = useAppState();
  return formatadorDeDinheiro(esconderValores);
}

export function formatadorDeDinheiro(escondido: boolean): FormatarDinheiro {
  return {
    escondido,
    formatar: (centimos) => (escondido ? VALOR_ESCONDIDO : formatarCentimos(centimos)),
    formatarCurto: (centimos) => (escondido ? VALOR_ESCONDIDO : formatarCentimosCurto(centimos)),
    dito: (centimos) => (escondido ? VALOR_ESCONDIDO_LEITOR : formatarCentimos(centimos)),
    leitor: (texto) => (escondido ? texto.split(VALOR_ESCONDIDO).join(VALOR_ESCONDIDO_LEITOR) : texto),
  };
}

type ValorProps = Omit<ThemedTextProps, 'children'> & {
  cents: number;
  curto?: boolean;
  /** Text around the amount, e.g. `{ depois: ' cada' }`. */
  antes?: string;
  depois?: string;
};

/** One amount of money as text, hidden as «•••• €» (read as «valor escondido») while «Esconder valores» is on. */
export function Valor({ cents, curto = false, antes = '', depois = '', accessibilityLabel, ...rest }: ValorProps) {
  const dinheiro = useFormatarDinheiro();
  const texto = `${antes}${curto ? dinheiro.formatarCurto(cents) : dinheiro.formatar(cents)}${depois}`;
  return (
    <ThemedText accessibilityLabel={accessibilityLabel ?? dinheiro.leitor(texto)} {...rest}>
      {texto}
    </ThemedText>
  );
}
