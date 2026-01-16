export async function fetchFile(source) {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);

  if (source instanceof Blob) {
    const buffer = await source.arrayBuffer();
    return new Uint8Array(buffer);
  }

  if (typeof source === "string") {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el archivo: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  throw new Error("Tipo de archivo no soportado para fetchFile");
}

export async function toBlobURL(url, mimeType) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${url}: ${response.status}`);
  }
  const blob = await response.blob();
  const typedBlob = mimeType ? new Blob([blob], { type: mimeType }) : blob;
  return URL.createObjectURL(typedBlob);
}
