const STYLE_PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "opacity", "font-size", "font-family", "font-weight", "text-anchor", "dominant-baseline", "visibility", "display"];

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, type = "text/plain") {
  downloadBlob(new Blob([text], { type }), filename);
}

function inlineStyles(source: SVGSVGElement): { markup: string; width: number; height: number } {
  const clone = source.cloneNode(true) as SVGSVGElement;
  const from = [source, ...source.querySelectorAll("*")];
  const to = [clone, ...clone.querySelectorAll("*")];
  from.forEach((node, index) => {
    const target = to[index];
    if (!(target instanceof Element)) return;
    const computed = window.getComputedStyle(node);
    const style = STYLE_PROPS.map((prop) => `${prop}:${computed.getPropertyValue(prop)}`).join(";");
    target.setAttribute("style", style);
  });
  clone.querySelectorAll("animate, animateTransform, animateMotion").forEach((node) => node.remove());
  const box = source.viewBox.baseVal;
  const width = box && box.width ? box.width : source.clientWidth || 600;
  const height = box && box.height ? box.height : source.clientHeight || 400;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  return { markup: new XMLSerializer().serializeToString(clone), width, height };
}

export function downloadSvg(svg: SVGSVGElement, filename: string) {
  downloadText(inlineStyles(svg).markup, filename, "image/svg+xml");
}

export function downloadPng(svg: SVGSVGElement, filename: string, background = "#0b1220") {
  const { markup, width, height } = inlineStyles(svg);
  const scale = Math.max(2, Math.ceil(1600 / width));
  const image = new Image();
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename);
    }, "image/png");
  };
  image.src = url;
}

export function largestSvg(root: Element | null): SVGSVGElement | null {
  if (!root) return null;
  let best: SVGSVGElement | null = null;
  let area = 0;
  for (const svg of Array.from(root.querySelectorAll("svg"))) {
    if (svg.closest(".vlsi-term, button")) continue;
    const rect = svg.getBoundingClientRect();
    if (rect.width * rect.height > area) {
      area = rect.width * rect.height;
      best = svg;
    }
  }
  return best;
}

export function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((row) => row.map((cell) => {
    const text = String(cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(",")).join("\n");
}
