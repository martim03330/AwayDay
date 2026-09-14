/** A local file (e.g. a photo from the camera, `file://…`) as base64, using only what React Native ships. */
export async function lerFicheiroEmBase64(uri: string): Promise<string> {
  const resposta = await fetch(uri);
  const blob = await resposta.blob();

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Could not read the file.'));
    leitor.onload = () => {
      if (typeof leitor.result === 'string') resolve(leitor.result);
      else reject(new Error('Unexpected file reader result.'));
    };
    leitor.readAsDataURL(blob);
  });

  const virgula = dataUrl.indexOf(',');
  return virgula === -1 ? dataUrl : dataUrl.slice(virgula + 1);
}

/** Decodes base64 into bytes, for uploads that need an ArrayBuffer. */
export function base64ParaBytes(base64: string): ArrayBuffer {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice);
  }
  return bytes.buffer;
}
