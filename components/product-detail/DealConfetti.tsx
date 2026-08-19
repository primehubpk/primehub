'use client';
import { useEffect, useRef } from 'react';
type Props = { liveDeal: boolean };
export default function DealConfetti({ liveDeal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!liveDeal || !canvasRef.current || typeof window === 'undefined') return;
    const canvas = canvasRef.current; const context = canvas.getContext('2d'); if (!context) return;
    let animationFrame = 0; const startedAt = performance.now(); const duration = 3000; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; rotation: number; rotationSpeed: number; gravity: number; drag: number; color: string; shape: number }> = [];
    const colors = ['#FFD166', '#FFB020', '#E1352B', '#0F6A5F', '#FFFFFF', '#FF6B35'];
    const resize = () => { canvas.width = Math.floor(window.innerWidth * dpr); canvas.height = Math.floor(window.innerHeight * dpr); canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`; context.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const burst = (originX: number, direction: number) => { for (let i = 0; i < 85; i += 1) { const angle = (-Math.PI / 2) + direction * (Math.random() * 0.95 - 0.48); const speed = 7 + Math.random() * 11; particles.push({ x: originX + (Math.random() - 0.5) * 16, y: window.innerHeight - 18, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 4 + Math.random() * 6, rotation: Math.random() * Math.PI, rotationSpeed: (Math.random() - 0.5) * 0.28, gravity: 0.2 + Math.random() * 0.12, drag: 0.985, color: colors[Math.floor(Math.random() * colors.length)], shape: Math.random() }); } };
    resize(); burst(window.innerWidth * 0.07, 1); burst(window.innerWidth * 0.93, -1); window.addEventListener('resize', resize);
    const draw = (now: number) => { const elapsed = now - startedAt; context.clearRect(0, 0, window.innerWidth, window.innerHeight); particles.forEach((particle) => { particle.vx *= particle.drag; particle.vy += particle.gravity; particle.x += particle.vx; particle.y += particle.vy; particle.rotation += particle.rotationSpeed; context.save(); context.translate(particle.x, particle.y); context.rotate(particle.rotation); context.globalAlpha = Math.max(0, Math.min(1, 1 - Math.max(0, elapsed - 1700) / 1300)); context.fillStyle = particle.color; if (particle.shape > 0.5) context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.62); else { context.beginPath(); context.arc(0, 0, particle.size / 2, 0, Math.PI * 2); context.fill(); } context.restore(); }); if (elapsed < duration) animationFrame = window.requestAnimationFrame(draw); else context.clearRect(0, 0, window.innerWidth, window.innerHeight); };
    animationFrame = window.requestAnimationFrame(draw);
    return () => { window.removeEventListener('resize', resize); window.cancelAnimationFrame(animationFrame); context.clearRect(0, 0, window.innerWidth, window.innerHeight); };
  }, [liveDeal]);
  if (!liveDeal) return null;
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[200] h-full w-full" />;
}
