/** Descarga `content` como fichero desde el navegador, sin pasar por el servidor (ADR 0026). */
export function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revocar en el mismo tick cancela la descarga en algunos navegadores.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
