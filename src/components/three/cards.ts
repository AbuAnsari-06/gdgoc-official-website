import * as THREE from "three";
import { COLOR_HEX, type GColor } from "../../data/content";

export const CARD_WIDTH = 2.5;
export const CARD_HEIGHT = 3.5;
export const CARD_DEPTH = 0.035;

const CORNER = 0.16;
const TEXTURE_WIDTH = 1000;
const TEXTURE_HEIGHT = 1400;
const INK = "#202124";
const STOCK = "#fbf8f2";
const BACK = "#16171a";

const SUIT_PATHS: Record<string, string> = {
  diamond: "M12 2 19.5 12 12 22 4.5 12Z",
  heart: "M12 21.3C4.8 14.6 2.6 9.8 6 6.6c2.6-2.4 5.4-.6 6 1 .6-1.6 3.4-3.4 6-1 3.4 3.2 1.2 8-6 14.7Z",
  spade:
    "M12 2c3.8 4.8 8 7.8 8 11.4 0 2.8-2.2 4.5-4.6 3.8.8 2 1.9 3.1 3.2 3.8H5.4c1.3-.7 2.4-1.8 3.2-3.8C6.2 17.9 4 16.2 4 13.4 4 9.8 8.2 6.8 12 2Z",
};

const SUIT_OF: Record<GColor, string> = {
  gblue: "spade",
  gred: "heart",
  gyellow: "diamond",
  ggreen: "club",
};

function roundedRect(width: number, height: number, radius: number) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

export function createFaceGeometry() {
  const geometry = new THREE.ShapeGeometry(roundedRect(CARD_WIDTH, CARD_HEIGHT, CORNER), 8);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;

  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, position.getX(i) / CARD_WIDTH + 0.5, position.getY(i) / CARD_HEIGHT + 0.5);
  }
  uv.needsUpdate = true;
  return geometry;
}

export function createEdgeGeometry() {
  const geometry = new THREE.ExtrudeGeometry(roundedRect(CARD_WIDTH, CARD_HEIGHT, CORNER), {
    depth: CARD_DEPTH,
    bevelEnabled: false,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -CARD_DEPTH / 2);
  return geometry;
}

function drawSuit(ctx: CanvasRenderingContext2D, suit: string, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;

  if (suit === "club") {
    for (const [cx, cy] of [
      [12, 6.8],
      [6.8, 13],
      [17.2, 13],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fill(new Path2D("M10.2 14.5 9 21.5h6l-1.2-7Z"));
  } else {
    ctx.fill(new Path2D(SUIT_PATHS[suit]));
  }
  ctx.restore();
}

function paperGrain(ctx: CanvasRenderingContext2D, base: string, strength: number) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const image = ctx.getImageData(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * strength;
    image.data[i] += noise;
    image.data[i + 1] += noise;
    image.data[i + 2] += noise;
  }
  ctx.putImageData(image, 0, 0);
}

function roundedFrame(ctx: CanvasRenderingContext2D, inset: number, radius: number, color: string, width: number) {
  const w = TEXTURE_WIDTH - inset * 2;
  const h = TEXTURE_HEIGHT - inset * 2;
  ctx.beginPath();
  ctx.roundRect(inset, inset, w, h, radius);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function cornerIndex(ctx: CanvasRenderingContext2D, rank: string, suit: string, hex: string, ink = INK) {
  const draw = () => {
    ctx.fillStyle = ink;
    ctx.font = "700 92px 'Bricolage Grotesque', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(rank, 128, 196);
    drawSuit(ctx, suit, 128, 262, 62, hex);
  };

  draw();
  ctx.save();
  ctx.translate(TEXTURE_WIDTH, TEXTURE_HEIGHT);
  ctx.rotate(Math.PI);
  draw();
  ctx.restore();
}

export type CardFace = { map: THREE.Texture; foil: THREE.Texture };

type Palette = { foil: boolean; ink: string; muted: string; accent: string };

function palette(foil: boolean, hex: string): Palette {
  if (foil) {
    return { foil, ink: "#000000", muted: "#000000", accent: "#ffffff" };
  }
  return { foil, ink: INK, muted: "rgba(32,33,36,0.72)", accent: hex };
}

function paintFace(draw: (ctx: CanvasRenderingContext2D, colors: Palette) => void, hex: string, base: string, grain: number): CardFace {
  const textures = [false, true].map((foil) => {
    const { canvas, ctx } = createCanvas();
    const colors = palette(foil, hex);
    if (foil) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    } else {
      paperGrain(ctx, base, grain);
    }
    draw(ctx, colors);
    const texture = toTexture(canvas);
    if (foil) {
      texture.colorSpace = THREE.NoColorSpace;
    }
    return texture;
  });

  return { map: textures[0], foil: textures[1] };
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unavailable");
  }
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

export function createFrontTexture(color: GColor, rank: string, title: string): CardFace {
  const hex = COLOR_HEX[color];
  const suit = SUIT_OF[color];

  return paintFace(
    (ctx, colors) => {
      if (!colors.foil) {
        roundedFrame(ctx, 46, 34, "rgba(32,33,36,0.22)", 3);
      }
      cornerIndex(ctx, rank, suit, colors.accent, colors.ink);
      drawSuit(ctx, suit, TEXTURE_WIDTH / 2, 600, 300, colors.accent);

      ctx.fillStyle = colors.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = "800 104px 'Bricolage Grotesque', system-ui, sans-serif";
      const lines = wrapLines(ctx, title, TEXTURE_WIDTH - 300);
      lines.forEach((line, i) => {
        ctx.fillText(line, TEXTURE_WIDTH / 2, 1010 + i * 108 - (lines.length - 1) * 54);
      });

      ctx.fillStyle = colors.accent;
      ctx.fillRect(TEXTURE_WIDTH / 2 - 60, 1110, 120, 8);
    },
    hex,
    STOCK,
    10,
  );
}

export function createStatTexture(color: GColor, rank: string, value: string, label: string): CardFace {
  const hex = COLOR_HEX[color];
  const suit = SUIT_OF[color];

  return paintFace(
    (ctx, colors) => {
      if (!colors.foil) {
        roundedFrame(ctx, 46, 34, "rgba(32,33,36,0.22)", 3);
        ctx.globalAlpha = 0.1;
        drawSuit(ctx, suit, TEXTURE_WIDTH / 2, 560, 520, hex);
        ctx.globalAlpha = 1;
      }
      cornerIndex(ctx, rank, suit, colors.accent, colors.ink);

      ctx.fillStyle = colors.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = "800 260px 'Bricolage Grotesque', system-ui, sans-serif";
      ctx.fillText(value, TEXTURE_WIDTH / 2, 760);

      ctx.fillStyle = colors.accent;
      ctx.fillRect(TEXTURE_WIDTH / 2 - 60, 840, 120, 8);

      ctx.fillStyle = colors.muted;
      ctx.font = "600 64px 'Bricolage Grotesque', system-ui, sans-serif";
      ctx.fillText(label, TEXTURE_WIDTH / 2, 960);
    },
    hex,
    STOCK,
    10,
  );
}

export function createBackTexture(): CardFace {
  const pattern: GColor[] = ["gblue", "gred", "gyellow", "ggreen"];
  const center = { x: TEXTURE_WIDTH / 2, y: TEXTURE_HEIGHT / 2 - 40 };

  return paintFace(
    (ctx, colors) => {
      if (!colors.foil) {
        ctx.globalAlpha = 0.09;
        for (let row = 0; row < 14; row++) {
          for (let col = 0; col < 10; col++) {
            const color = pattern[(row + col) % 4];
            drawSuit(ctx, SUIT_OF[color], 70 + col * 96 + (row % 2) * 48, 80 + row * 96, 34, "#ffffff");
          }
        }
        ctx.globalAlpha = 1;
      }

      roundedFrame(ctx, 46, 34, colors.foil ? "#ffffff" : "rgba(255,255,255,0.35)", 3);
      roundedFrame(ctx, 66, 24, colors.foil ? "#ffffff" : "rgba(255,255,255,0.14)", 2);

      ctx.fillStyle = colors.foil ? "#000000" : BACK;
      ctx.beginPath();
      ctx.arc(center.x, center.y, 210, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors.foil ? "#ffffff" : "rgba(255,255,255,0.35)";
      ctx.lineWidth = 3;
      ctx.stroke();

      pattern.forEach((color, i) => {
        const angle = -Math.PI / 2 + (i * Math.PI) / 2;
        const tint = colors.foil ? "#ffffff" : COLOR_HEX[color];
        drawSuit(ctx, SUIT_OF[color], center.x + Math.cos(angle) * 105, center.y + Math.sin(angle) * 105, 92, tint);
      });

      ctx.fillStyle = colors.foil ? "#ffffff" : "rgba(255,255,255,0.8)";
      ctx.font = "600 44px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("G D G o C   ·   P S I T", TEXTURE_WIDTH / 2, TEXTURE_HEIGHT / 2 + 290);
    },
    "#ffffff",
    BACK,
    6,
  );
}
