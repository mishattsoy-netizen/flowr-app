import { toPng, toJpeg } from 'html-to-image';

export interface ExportOptions {
  pixelRatio?: number;
  backgroundColor?: string;
  format?: 'png' | 'jpg' | 'svg';
  ratio?: 'screen' | '16:9' | '4:3' | '1:1';
  orientation?: 'horizontal' | 'vertical';
}

export async function exportCanvasToPng(
  viewportEl: HTMLElement,
  filename: string,
  options?: ExportOptions
): Promise<void> {
  const scale = options?.pixelRatio ?? 2;
  const bgColor = options?.backgroundColor ?? '#141413';
  const format = options?.format ?? 'png';
  const ratio = options?.ratio ?? 'screen';
  const orientation = options?.orientation ?? 'horizontal';

  const captureOpts = {
    pixelRatio: scale,
    backgroundColor: bgColor,
    style: { transform: 'none', transformOrigin: '0 0' },
  };

  let dataUrl = format === 'jpg'
    ? await toJpeg(viewportEl, { ...captureOpts, quality: 0.92 })
    : await toPng(viewportEl, captureOpts);

  // Crop to aspect ratio
  if (ratio !== 'screen') {
    const [rw, rh] = ratio.split(':').map(Number);
    const targetRatio = rw / rh;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });
    let cropW = img.width, cropH = img.height;
    if (img.width / img.height > targetRatio) cropW = img.height * targetRatio;
    else cropH = img.width / targetRatio;
    const c = document.createElement('canvas');
    c.width = cropW;
    c.height = cropH;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, (img.width - cropW) / 2, (img.height - cropH) / 2, cropW, cropH, 0, 0, cropW, cropH);
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    dataUrl = c.toDataURL(mime, 0.92);
  }

  // Rotate for vertical orientation
  if (orientation === 'vertical') {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });
    const c = document.createElement('canvas');
    c.width = img.height;
    c.height = img.width;
    const ctx = c.getContext('2d')!;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(90 * Math.PI / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    dataUrl = c.toDataURL(mime, 0.92);
  }

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function copyCanvasToClipboard(
  viewportEl: HTMLElement,
  options?: ExportOptions
): Promise<void> {
  const scale = options?.pixelRatio ?? 2;
  const bgColor = options?.backgroundColor ?? '#141413';
  const format = options?.format ?? 'png';
  const ratio = options?.ratio ?? 'screen';
  const orientation = options?.orientation ?? 'horizontal';

  const captureOpts = {
    pixelRatio: scale,
    backgroundColor: bgColor,
    style: { transform: 'none', transformOrigin: '0 0' },
  };

  let dataUrl = format === 'jpg'
    ? await toJpeg(viewportEl, { ...captureOpts, quality: 0.92 })
    : await toPng(viewportEl, captureOpts);

  // Crop to aspect ratio
  if (ratio !== 'screen') {
    const [rw, rh] = ratio.split(':').map(Number);
    const targetRatio = rw / rh;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });
    let cropW = img.width, cropH = img.height;
    if (img.width / img.height > targetRatio) cropW = img.height * targetRatio;
    else cropH = img.width / targetRatio;
    const c = document.createElement('canvas');
    c.width = cropW;
    c.height = cropH;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, (img.width - cropW) / 2, (img.height - cropH) / 2, cropW, cropH, 0, 0, cropW, cropH);
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    dataUrl = c.toDataURL(mime, 0.92);
  }

  // Rotate for vertical orientation
  if (orientation === 'vertical') {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });
    const c = document.createElement('canvas');
    c.width = img.height;
    c.height = img.width;
    const ctx = c.getContext('2d')!;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(90 * Math.PI / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    dataUrl = c.toDataURL(mime, 0.92);
  }

  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
}
