import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { base64ParaBytes } from '@/lib/ficheiros';

/** How much JPEG compression the re-encoded photo gets (the pickers already compress to about 0.7). */
const COMPRESSAO = 0.85;

/**
 * A photo ready to upload, without its metadata. On Android the photo picker copies the EXIF tags into the photo it
 * returns, GPS included, so a profile photo taken at home would carry the home's coordinates. Re-encoding the pixels
 * into a new JPEG drops every tag. Always JPEG, whatever the original was (PNG, HEIC).
 */
export async function fotoParaEnviar(uri: string): Promise<{ bytes: ArrayBuffer; mimeType: 'image/jpeg' }> {
  const imagem = await ImageManipulator.manipulate(uri).renderAsync();
  try {
    const resultado = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: COMPRESSAO, base64: true });
    if (!resultado.base64) throw new Error('The photo could not be prepared.');
    return { bytes: base64ParaBytes(resultado.base64), mimeType: 'image/jpeg' };
  } finally {
    imagem.release();
  }
}
