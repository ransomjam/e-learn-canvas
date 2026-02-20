import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Smartphone, Settings } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface CustomVideoPlayerProps {
    src: string;
    poster?: string;
    title?: string;
}

const formatTime = (timeInSeconds: number) => {
    const min = Math.floor(timeInSeconds / 60);
    const sec = Math.floor(timeInSeconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

export const CustomVideoPlayer = ({ src, poster, title }: CustomVideoPlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLandscape, setIsLandscape] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-hide controls
    const resetControlsTimeout = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000);
    }, [isPlaying]);

    useEffect(() => {
        resetControlsTimeout();
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [resetControlsTimeout, isPlaying]);

    const handlePlayPause = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                setShowControls(true); // Keep controls visible when paused
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (value: number[]) => {
        if (videoRef.current) {
            videoRef.current.currentTime = value[0];
            setCurrentTime(value[0]);
            resetControlsTimeout();
        }
    };

    const handleVolumeChange = (value: number[]) => {
        const newVol = value[0];
        setVolume(newVol);
        setIsMuted(newVol === 0);
        if (videoRef.current) {
            videoRef.current.volume = newVol;
            videoRef.current.muted = newVol === 0;
        }
        resetControlsTimeout();
    };

    const toggleMute = () => {
        if (videoRef.current) {
            const nextMuted = !isMuted;
            videoRef.current.muted = nextMuted;
            setIsMuted(nextMuted);
            if (!nextMuted && volume === 0) {
                const newVol = 1;
                setVolume(newVol);
                videoRef.current.volume = newVol;
            }
        }
        resetControlsTimeout();
    };

    const handlePlaybackRateChange = (rate: number) => {
        setPlaybackRate(rate);
        if (videoRef.current) {
            videoRef.current.playbackRate = rate;
        }
        resetControlsTimeout();
    };

    const toggleFullscreen = async () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(err => console.error(err));
            setIsFullscreen(true);
        } else {
            await document.exitFullscreen();
            setIsFullscreen(false);
        }
        resetControlsTimeout();
    };

    // Detect fullscreen change by OS/Escape key
    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleLandscape = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const next = !isLandscape;
        setIsLandscape(next);
        try {
            if (next && screen.orientation && 'lock' in screen.orientation) {
                await (screen.orientation as any).lock('landscape');
            } else if (!next && screen.orientation && 'unlock' in screen.orientation) {
                (screen.orientation as any).unlock();
            }
        } catch { /* Fallback to CSS transform below if API fails/unsupported */ }
        resetControlsTimeout();
    };

    useEffect(() => {
        // Reset playback state when source changes
        setIsPlaying(false);
        setCurrentTime(0);
        setShowControls(true);
    }, [src]);

    const displayLandscape = isLandscape && !isFullscreen;

    const content = (
        <div
            ref={containerRef}
            className={cn(
                "relative flex flex-col bg-black overflow-hidden group font-sans w-full h-full",
                displayLandscape && "fixed inset-0 z-[100]"
            )}
            onMouseMove={resetControlsTimeout}
            onTouchStart={resetControlsTimeout}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                className={cn(
                    "w-full h-full object-contain cursor-pointer",
                    displayLandscape ? "w-[100vh] h-[100vw]" : ""
                )}
                onClick={handlePlayPause}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                playsInline
                preload="auto"
                controls={false}
            />

            {/* Giant center play button when paused */}
            {!isPlaying && (
                <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20"
                >
                    <div className="bg-primary/80 text-primary-foreground p-5 rounded-full shadow-lg backdrop-blur-sm transform transition-transform hover:scale-105">
                        <Play className="h-10 w-10 ml-1" />
                    </div>
                </div>
            )}

            {/* Top Bar for landscape prominently */}
            <div className={cn(
                "absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 flex justify-between items-start",
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
                <span className="text-white/80 font-medium text-sm drop-shadow-md truncate pr-4">
                    {title || 'Video Lesson'}
                </span>

                <Button
                    variant="secondary"
                    size="sm"
                    onClick={toggleLandscape}
                    className="md:hidden flex items-center gap-1.5 h-8 bg-black/50 hover:bg-black/70 text-white border-none rounded-full"
                >
                    <Smartphone className={cn("h-4 w-4 transition-transform duration-300", isLandscape && "rotate-90")} />
                    <span className="text-xs font-semibold">{isLandscape ? 'Portrait' : 'Landscape view'}</span>
                </Button>
            </div>

            {/* Bottom Controls */}
            <div className={cn(
                "absolute bottom-0 left-0 right-0 px-4 pb-4 pt-12 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300",
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
                {/* Progress bar */}
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-white text-xs font-medium tabular-nums shadow-sm">{formatTime(currentTime)}</span>
                    <Slider
                        value={[currentTime]}
                        max={duration || 100}
                        step={1}
                        className="flex-1 cursor-pointer"
                        onValueChange={handleSeek}
                    />
                    <span className="text-white/80 text-xs font-medium tabular-nums shadow-sm">{formatTime(duration)}</span>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={handlePlayPause} className="text-white hover:bg-white/20 h-9 w-9">
                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        </Button>

                        <div className="hidden sm:flex items-center gap-2 group/volume w-8 hover:w-32 transition-all duration-300 overflow-hidden">
                            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20 h-9 w-9 shrink-0">
                                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                            </Button>
                            <Slider
                                value={[isMuted ? 0 : volume]}
                                max={1}
                                step={0.05}
                                onValueChange={handleVolumeChange}
                                className="w-20 opacity-0 group-hover/volume:opacity-100 transition-opacity"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-9 w-9">
                                    <Settings className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32 bg-black/90 text-white border-white/20">
                                <div className="px-2 py-1.5 text-xs font-semibold text-white/50">Playback Speed</div>
                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                    <DropdownMenuItem
                                        key={rate}
                                        onClick={() => handlePlaybackRateChange(rate)}
                                        className={cn(
                                            "focus:bg-white/20 cursor-pointer text-sm",
                                            playbackRate === rate && "bg-primary/40 focus:bg-primary/50"
                                        )}
                                    >
                                        {rate}x {rate === 1 && '(Normal)'}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleFullscreen}
                            className="text-white hover:bg-white/20 h-9 w-9"
                        >
                            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    if (displayLandscape) {
        return (
            <div className="fixed inset-0 z-[100] bg-black">
                <div
                    style={{
                        transform: 'rotate(90deg)',
                        transformOrigin: 'center center',
                        width: '100vh',
                        height: '100vw',
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        marginTop: 'calc(-50vw)',
                        marginLeft: 'calc(-50vh)'
                    }}
                >
                    {content}
                </div>
            </div>
        );
    }

    return content;
};

export default CustomVideoPlayer;
