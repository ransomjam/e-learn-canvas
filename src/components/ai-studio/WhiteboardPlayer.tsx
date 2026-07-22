import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GraphScene, SceneGraph, SceneItem } from '@/types/aiStudio';

/**
 * WhiteboardPlayer — plays a deterministic scene graph produced by the
 * backend whiteboard compiler. Text is "written" (typewriter reveal),
 * paths are "drawn" (stroke-dashoffset), exactly per the timeline the
 * compiler scheduled. Same scene graph → identical playback every time.
 */

const HAND_FONT = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', 'Comic Sans', cursive";
const MONO_FONT = "'Cascadia Code', 'Consolas', monospace";

function itemProgress(item: SceneItem, t: number): number {
    if (t <= item.startTime) return 0;
    if (t >= item.startTime + item.duration) return 1;
    return (t - item.startTime) / item.duration;
}

function SceneItemView({ item, t }: { item: SceneItem; t: number }) {
    const p = itemProgress(item, t);
    if (p <= 0) return null;

    if (item.kind === 'text') {
        const text = item.text || '';
        const visibleChars = Math.ceil(text.length * p);
        return (
            <text
                x={item.x}
                y={item.y}
                fill={item.color}
                fontSize={item.fontSize || 30}
                fontWeight={item.weight === 'bold' ? 700 : 400}
                fontFamily={item.family === 'mono' ? MONO_FONT : HAND_FONT}
                style={{ userSelect: 'none' }}
            >
                {text.slice(0, visibleChars)}
            </text>
        );
    }

    if (item.kind === 'path') {
        return (
            <path
                d={item.d}
                stroke={item.color}
                strokeWidth={item.strokeWidth || 3}
                fill={item.fill && p >= 1 ? item.fill : 'none'}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - p}
            />
        );
    }

    if (item.kind === 'rect') {
        return (
            <rect
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                fill={item.fill || 'transparent'}
                opacity={p}
                rx={6}
            />
        );
    }
    return null;
}

interface WhiteboardPlayerProps {
    sceneGraph: SceneGraph;
    /** Optional per-scene action slot (e.g. a "Regenerate scene" button). */
    renderSceneActions?: (scene: GraphScene) => React.ReactNode;
    className?: string;
}

const WhiteboardPlayer = ({ sceneGraph, renderSceneActions, className }: WhiteboardPlayerProps) => {
    const scenes = sceneGraph.scenes || [];
    const [sceneIndex, setSceneIndex] = useState(0);
    const [time, setTime] = useState(0); // seconds within current scene
    const [playing, setPlaying] = useState(false);
    const rafRef = useRef<number>();
    const lastTickRef = useRef<number>(0);

    const scene = scenes[sceneIndex];
    const sceneDuration = scene?.durationSeconds || 0;

    // Items sorted so "behind" rects (highlights) render under the ink
    const orderedItems = useMemo(() => {
        if (!scene) return [];
        return [...scene.items].sort((a, b) => Number(b.behind || false) - Number(a.behind || false));
    }, [scene]);

    const stopLoop = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
    }, []);

    useEffect(() => {
        if (!playing) {
            stopLoop();
            return;
        }
        lastTickRef.current = performance.now();
        const loop = (now: number) => {
            const dt = (now - lastTickRef.current) / 1000;
            lastTickRef.current = now;
            setTime((prev) => {
                const next = prev + dt;
                if (next >= sceneDuration) {
                    if (sceneIndex < scenes.length - 1) {
                        setSceneIndex((i) => i + 1);
                        return 0;
                    }
                    setPlaying(false);
                    return sceneDuration;
                }
                return next;
            });
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return stopLoop;
    }, [playing, sceneDuration, sceneIndex, scenes.length, stopLoop]);

    // Reset time when jumping scenes manually
    const goToScene = (index: number) => {
        setSceneIndex(Math.max(0, Math.min(scenes.length - 1, index)));
        setTime(0);
    };

    if (!scene) {
        return <p className="text-sm text-muted-foreground">No whiteboard scenes to play.</p>;
    }

    const elapsedBefore = scenes.slice(0, sceneIndex).reduce((sum, s) => sum + s.durationSeconds, 0);
    const totalElapsed = elapsedBefore + Math.min(time, sceneDuration);
    const total = sceneGraph.totalDurationSeconds || scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

    return (
        <div className={className}>
            {/* Board */}
            <div className="rounded-xl border border-border overflow-hidden shadow-sm">
                <svg
                    viewBox={`0 0 ${sceneGraph.canvas.width} ${sceneGraph.canvas.height}`}
                    className="w-full block"
                    style={{ background: (sceneGraph.theme?.background as string) || '#fdfdfb' }}
                >
                    {orderedItems.map((item) => (
                        <SceneItemView key={item.id} item={item} t={time} />
                    ))}
                </svg>
                {/* Narration (subtitle style) */}
                {scene.narration && (
                    <div className="bg-secondary/60 border-t border-border px-4 py-3">
                        <p className="text-sm text-foreground/90 leading-relaxed">{scene.narration}</p>
                    </div>
                )}
            </div>

            {/* Transport controls */}
            <div className="mt-3 flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => goToScene(sceneIndex - 1)} disabled={sceneIndex === 0}>
                    <SkipBack className="h-4 w-4" />
                </Button>
                <Button size="icon" onClick={() => {
                    if (!playing && time >= sceneDuration) setTime(0);
                    setPlaying((prev) => !prev);
                }}>
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => goToScene(sceneIndex + 1)} disabled={sceneIndex >= scenes.length - 1}>
                    <SkipForward className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setTime(0); setPlaying(true); }} title="Replay scene">
                    <RotateCcw className="h-4 w-4" />
                </Button>

                {/* Seek within the whole video */}
                <div className="flex-1 mx-2">
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                            className="h-full bg-primary transition-[width]"
                            style={{ width: `${total ? (totalElapsed / total) * 100 : 0}%` }}
                        />
                    </div>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                    {fmt(totalElapsed)} / {fmt(total)}
                </span>
            </div>

            {/* Scene navigator */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {scenes.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => goToScene(i)}
                        className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors ${i === sceneIndex
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary'
                            }`}
                    >
                        {i + 1}. {s.title || s.type}
                    </button>
                ))}
            </div>

            {renderSceneActions && (
                <div className="mt-2">{renderSceneActions(scene)}</div>
            )}
        </div>
    );
};

export default WhiteboardPlayer;
