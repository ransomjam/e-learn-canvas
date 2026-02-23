import { useEffect, useRef } from 'react';

const TechBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const dpr = window.devicePixelRatio;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // --- Flowing dot wave grid ---
      const spacing = 16;
      const cols = Math.ceil(w / spacing) + 1;
      const rows = Math.ceil(h / spacing) + 1;

      // Store positions for connection lines
      const points: { x: number; y: number; brightness: number }[] = [];

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const baseX = i * spacing;
          const baseY = j * spacing;

          // Multi-layered wave displacement
          const wave1 = Math.sin(i * 0.12 + time * 0.6) * 14;
          const wave2 = Math.cos(j * 0.08 + time * 0.4 + i * 0.05) * 10;
          const wave3 = Math.sin((i + j) * 0.06 - time * 0.3) * 8;

          const x = baseX;
          const y = baseY + wave1 + wave2 + wave3;

          // Two glow centers for depth
          const cx1 = w * 0.3, cy1 = h * 0.45;
          const cx2 = w * 0.75, cy2 = h * 0.55;
          const dist1 = Math.sqrt((x - cx1) ** 2 + (y - cy1) ** 2);
          const dist2 = Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2);
          const maxDist = w * 0.5;
          const b1 = Math.max(0, 1 - dist1 / maxDist);
          const b2 = Math.max(0, 1 - dist2 / maxDist) * 0.6;
          const brightness = Math.min(1, b1 + b2);

          // Pulsing brightness
          const pulse = 0.85 + 0.15 * Math.sin(time * 1.2 + i * 0.3 + j * 0.2);
          const finalBrightness = brightness * pulse;

          const radius = 0.5 + finalBrightness * 1.0;
          const alpha = 0.06 + finalBrightness * 0.55;

          if (alpha > 0.08) {
            points.push({ x, y, brightness: finalBrightness });
          }

          // Dot
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
          ctx.fill();

          // Glow halo on bright dots
          if (finalBrightness > 0.5) {
            const glowAlpha = (finalBrightness - 0.5) * 0.2;
            ctx.beginPath();
            ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(80, 160, 255, ${glowAlpha})`;
            ctx.fill();
          }
        }
      }

      // --- Connection lines between nearby bright dots ---
      ctx.lineWidth = 0.3;
      const connDist = spacing * 1.8;
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        if (a.brightness < 0.3) continue;
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j];
          if (b.brightness < 0.3) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connDist) {
            const lineAlpha = (1 - dist / connDist) * Math.min(a.brightness, b.brightness) * 0.25;
            if (lineAlpha > 0.02) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `rgba(80, 160, 255, ${lineAlpha})`;
              ctx.stroke();
            }
          }
        }
      }

      // --- Floating accent particles ---
      for (let i = 0; i < 20; i++) {
        const px = (w * 0.1) + ((i * 7919 + time * 8) % (w * 0.8));
        const py = h * 0.2 + Math.sin(time * 0.5 + i * 2.1) * h * 0.3 + (i * 3571 % (h * 0.3));
        const pAlpha = 0.15 + 0.2 * Math.sin(time + i * 1.7);
        const pRadius = 1.5 + Math.sin(time * 0.8 + i) * 0.8;

        ctx.beginPath();
        ctx.arc(px % w, py % h, pRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120, 200, 255, ${pAlpha})`;
        ctx.fill();

        // Soft glow
        ctx.beginPath();
        ctx.arc(px % w, py % h, pRadius + 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 180, 255, ${pAlpha * 0.15})`;
        ctx.fill();
      }

      time += 0.012;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,5%)] via-[hsl(217,60%,10%)] to-[hsl(210,50%,7%)]" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
    </div>
  );
};

export default TechBackground;
