import { toPng } from 'html-to-image';

export async function exportCanvasToPng(
  viewportEl: HTMLElement,
  filename: string
): Promise<void> {
  const dataUrl = await toPng(viewportEl, {
    backgroundColor: '#141413',
    pixelRatio: 2,
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function copyCanvasToClipboard(viewportEl: HTMLElement): Promise<void> {
  const dataUrl = await toPng(viewportEl, { backgroundColor: '#141413', pixelRatio: 2 });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
