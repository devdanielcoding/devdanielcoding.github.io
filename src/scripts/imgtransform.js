document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('pngInput');
  const canvas = document.getElementById('canvas');
  const downloadBtn = document.getElementById('downloadBtn');
  const preview = document.getElementById('preview');

  if (!(input instanceof HTMLInputElement) || !(canvas instanceof HTMLCanvasElement) || !downloadBtn || !preview) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      preview.innerHTML = '';
      downloadBtn.style.display = 'none';
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string') return;
      img.src = result;
    };

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const jpgData = canvas.toDataURL('image/jpeg', 0.85);
      preview.innerHTML = `<img src="${jpgData}" alt="Vista previa del JPG" loading="lazy" />`;

      downloadBtn.style.display = 'inline-flex';
      downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.download = 'convertido.jpg';
        link.href = jpgData;
        link.click();
      };
    };

    reader.readAsDataURL(file);
  });
});
