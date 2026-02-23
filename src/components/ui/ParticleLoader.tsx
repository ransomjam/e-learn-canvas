import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ParticleLoaderProps {
  className?: string;
  size?: number;
}

const ParticleLoader = ({ className, size = 32 }: ParticleLoaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const s = size;
    canvas.width = s * dpr;
    canvas.height = s * dpr;
    ctx.scale(dpr, dpr);

    let animationId: number;
    let time = 0;

    const particles: { x: number; y: number; alpha: number; size: number; life: number; maxLife: number; vx: number; vy: number }[] = [];

    const draw = () => {
      ctx.clearRect(0, 0, s, s);
      const cx = s / 2;
      const cy = s / 2;
      const radius = s * 0.36;

      // Spinning arc (the main loader)
      const arcStart = time * 3;
      const arcEnd = arcStart + Math.PI * 1.2;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, arcStart, arcEnd);
      ctx.strokeStyle = 'hsl(217, 91%, 60%)';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Emit particles from the tail of the arc
      const tailAngle = arcStart;
      const tailX = cx + Math.cos(tailAngle) * radius;
      const tailY = cy + Math.sin(tailAngle) * radius;

      // Spawn 1-2 particles per frame
      for (let i = 0; i < 2; i++) {
        const angle = tailAngle + Math.PI + (Math.random() - 0.5) * 1.5;
        const speed = 0.3 + Math.random() * 0.8;
        particles.push({
          x: tailX + (Math.random() - 0.5) * 3,
          y: tailY + (Math.random() - 0.5) * 3,
          alpha: 0.7 + Math.random() * 0.3,
          size: 0.6 + Math.random() * 1.2,
          life: 0,
          maxLife: 18 + Math.random() * 16,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        });
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;

        const progress = p.life / p.maxLife;
        const alpha = p.alpha * (1 - progress);
        const pSize = p.size * (1 - progress * 0.5);

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, pSize, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(217, 91%, 65%, ${alpha})`;
        ctx.fill();

        // Tiny glow
        if (alpha > 0.3) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, pSize + 2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(217, 91%, 65%, ${alpha * 0.15})`;
          ctx.fill();
        }
      }

      // Keep particle count bounded
      while (particles.length > 80) particles.shift();

      time += 0.016;
      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('inline-block', className)}
      style={{ width: size, height: size }}
    />
  );
};

export default ParticleLoader;
