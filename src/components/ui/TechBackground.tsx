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
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const cols = Math.ceil(w / 28);
      const rows = Math.ceil(h / 28);
      const spacingX = w / cols;
      const spacingY = h / rows;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacingX + spacingX / 2;
          const baseY = j * spacingY + spacingY / 2;

          // Flowing wave displacement
          const wave1 = Math.sin(i * 0.15 + time * 0.8) * 18;
          const wave2 = Math.sin(i * 0.08 - time * 0.5 + j * 0.1) * 12;
          const y = baseY + wave1 + wave2;

          // Distance from center for glow effect
          const cx = w * 0.35;
          const cy = h * 0.5;
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          const maxDist = Math.sqrt(cx ** 2 + cy ** 2);
          const brightness = Math.max(0.08, 1 - dist / maxDist);

          const radius = 1 + brightness * 1.2;
          const alpha = 0.15 + brightness * 0.5;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(96, 165, 250, ${alpha})`;
          ctx.fill();

          // Glow on bright dots
          if (brightness > 0.6) {
            ctx.beginPath();
            ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(96, 165, 250, ${(brightness - 0.6) * 0.3})`;
            ctx.fill();
          }
        }
      }

      time += 0.015;
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
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,7%)] via-[hsl(217,60%,12%)] to-[hsl(210,50%,8%)]" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.7 }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
    </div>
  );
};

export default TechBackground;
