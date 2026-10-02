/**
 * Pre-compiled Path2D static icons for offline Canvas rendering.
 * Zero network dependencies during frame evaluation loops.
 */

export interface IconDefinition {
  viewBox: [number, number, number, number];
  draw: (ctx: CanvasRenderingContext2D, size: number, color: string) => void;
}

export const ICONS: Record<string, IconDefinition> = {
  mascot: {
    viewBox: [0, 0, 100, 100],
    draw: (ctx, size, color) => {
      ctx.save();
      const scale = size / 100;
      ctx.scale(scale, scale);

      // Horns
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(22, 24); ctx.lineTo(38, 32); ctx.lineTo(34, 42); ctx.lineTo(20, 34); ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(78, 24); ctx.lineTo(62, 32); ctx.lineTo(66, 42); ctx.lineTo(80, 34); ctx.closePath();
      ctx.fill();

      // Head structure
      ctx.beginPath();
      ctx.moveTo(30, 36); ctx.lineTo(70, 36); ctx.lineTo(74, 54); ctx.lineTo(26, 54); ctx.closePath();
      ctx.fill();

      // Muzzle Block
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(24, 58, 52, 24, 12);
        ctx.fill();
      } else {
        ctx.fillRect(24, 58, 52, 24);
      }

      // Eyes cutout
      ctx.fillStyle = '#131315';
      ctx.fillRect(36, 42, 7, 7);
      ctx.fillRect(57, 42, 7, 7);

      // Nostrils
      ctx.fillRect(38, 66, 6, 8);
      ctx.fillRect(56, 66, 6, 8);

      ctx.restore();
    }
  },

  zap: {
    viewBox: [0, 0, 24, 24],
    draw: (ctx, size, color) => {
      ctx.save();
      const scale = size / 24;
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(13, 2);
      ctx.lineTo(3, 14);
      ctx.lineTo(12, 14);
      ctx.lineTo(11, 22);
      ctx.lineTo(21, 10);
      ctx.lineTo(12, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  brain: {
    viewBox: [0, 0, 24, 24],
    draw: (ctx, size, color) => {
      ctx.save();
      const scale = size / 24;
      ctx.scale(scale, scale);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.arc(8, 8, 4, 0, Math.PI * 2);
      ctx.arc(16, 8, 4, 0, Math.PI * 2);
      ctx.arc(8, 15, 3.5, 0, Math.PI * 2);
      ctx.arc(16, 15, 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },

  sparkles: {
    viewBox: [0, 0, 24, 24],
    draw: (ctx, size, color) => {
      ctx.save();
      const scale = size / 24;
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      // Main 4-point star
      ctx.beginPath();
      ctx.moveTo(12, 2);
      ctx.quadraticCurveTo(12, 10, 20, 10);
      ctx.quadraticCurveTo(12, 10, 12, 18);
      ctx.quadraticCurveTo(12, 10, 4, 10);
      ctx.quadraticCurveTo(12, 10, 12, 2);
      ctx.fill();
      ctx.restore();
    }
  },

  flame: {
    viewBox: [0, 0, 24, 24],
    draw: (ctx, size, color) => {
      ctx.save();
      const scale = size / 24;
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(12, 2);
      ctx.bezierCurveTo(10, 7, 5, 11, 5, 16);
      ctx.bezierCurveTo(5, 20, 8, 23, 12, 23);
      ctx.bezierCurveTo(16, 23, 19, 20, 19, 16);
      ctx.bezierCurveTo(19, 12, 16, 8, 12, 2);
      ctx.fill();
      ctx.restore();
    }
  },

  code: {
    viewBox: [0, 0, 24, 24],
    draw: (ctx, size, color) => {
      ctx.save();
      const scale = size / 24;
      ctx.scale(scale, scale);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(7, 8); ctx.lineTo(3, 12); ctx.lineTo(7, 16);
      ctx.moveTo(17, 8); ctx.lineTo(21, 12); ctx.lineTo(17, 16);
      ctx.moveTo(14, 4); ctx.lineTo(10, 20);
      ctx.stroke();
      ctx.restore();
    }
  }
};

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  iconName: string = 'mascot',
  x: number,
  y: number,
  size: number,
  color: string = '#84cc16'
) {
  const icon = ICONS[iconName] || ICONS.mascot;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  icon.draw(ctx, size, color);
  ctx.restore();
}
