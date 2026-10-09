import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { base64ParaBytes } from '@/lib/ficheiros';
import { medidaParaEnviar } from '@/lib/medida-da-foto';

/** How much JPEG compression the re-encoded photo gets (the pickers already compress to about 0.7). */
const COMPRESSAO = 0.8;

/**
 * A photo ready to upload, without its metadata and no bigger than a phone needs. On Android the photo picker copies
 * the EXIF tags into the photo it returns, GPS included, so a profile photo taken at home would carry the home's
 * coordinates; re-encoding the pixels into a new JPEG drops every tag. The longest side is brought down to
 * `LADO_MAXIMO_PX` (a 12 MP photo goes from ~500 KB to ~150–200 KB), which loads faster on the stadium's mobile data
 * and spends less of the storage and traffic. Always JPEG, whatever the original was (PNG, HEIC).
 */
export async function fotoParaEnviar(uri: string): Promise<{ bytes: ArrayBuffer; mimeType: 'image/jpeg' }> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const medida = medidaParaEnviar(original.width, original.height);
  let imagem = original;
  if (medida) {
    original.release();
    imagem = await ImageManipulator.manipulate(uri).resize(medida).renderAsync();
  }
  try {
    const resultado = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: COMPRESSAO, base64: true });
    if (!resultado.base64) throw new Error('The photo could not be prepared.');
    return { bytes: base64ParaBytes(resultado.base64), mimeType: 'image/jpeg' };
  } finally {
    imagem.release();
  }
}
