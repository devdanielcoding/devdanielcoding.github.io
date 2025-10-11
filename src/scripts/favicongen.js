document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const button = document.getElementById('convertButton');
  const output = document.getElementById('output');
  const canvas = document.getElementById('canvas');

  if (!(fileInput instanceof HTMLInputElement) || !button || !output || !(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const image = new Image();

  fileInput.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const file = target.files?.[0];
    if (!file) {
      output.innerHTML = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result;
      if (typeof result !== 'string') return;

      image.src = result;
      image.onload = () => {
        output.innerHTML = `
          <p>Vista previa:</p>
          <img id="preview" src="${result}" alt="Vista previa del favicon" loading="lazy" />
        `;
      };
    };
    reader.readAsDataURL(file);
  });

  button.addEventListener('click', () => {
    if (!image.src) {
      output.innerHTML = '<p class="muted">Selecciona primero un archivo PNG.</p>';
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const link = document.createElement('a');
      link.download = 'favicon.ico';
      link.href = URL.createObjectURL(blob);
      link.addEventListener('click', () => {
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      });
      link.click();
    }, 'image/x-icon');
  });
});
