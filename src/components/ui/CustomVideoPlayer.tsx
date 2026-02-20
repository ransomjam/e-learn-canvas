import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Smartphone, Settings, SkipBack, SkipForward, RotateCw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

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

/**
 * Determine the MIME type from a video URL extension.
 * Providing the correct type on <source> helps mobile browsers decide
 * quickly whether they can decode the file, avoiding unnecessary downloads.
 */
const getMimeType = (url: string): string => {
    const lower = url.toLowerCase().split('?')[0]; // strip query params
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.ogg') || lower.endsWith('.ogv')) return 'video/ogg';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.avi')) return 'video/x-msvideo';
    if (lower.endsWith('.mkv')) return 'video/x-matroska';
    // Default to mp4 — it's the most universally supported format
    return 'video/mp4';
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
    const [videoError, setVideoError] = useState(false);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMobile = useIsMobile();

    const isExternal = src.startsWith('http://') || src.startsWith('https://');

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

    const skipTime = (seconds: number) => {
        if (videoRef.current) {
            const newTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
            // Force the video to seek properly on mobile
            if (videoRef.current.paused) {
                videoRef.current.play().then(() => {
                    videoRef.current!.pause();
                    videoRef.current!.currentTime = newTime;
                }).catch(() => { });
            }
            resetControlsTimeout();
        }
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
        // Capture current playback state before toggling
        const wasPlaying = isPlaying;
        const savedTime = videoRef.current?.currentTime || 0;
        setIsLandscape(next);
        try {
            if (next && screen.orientation && 'lock' in screen.orientation) {
                await (screen.orientation as any).lock('landscape');
            } else if (!next && screen.orientation && 'unlock' in screen.orientation) {
                (screen.orientation as any).unlock();
            }
        } catch { /* Fallback to CSS transform below if API fails/unsupported */ }
        // Restore video position and playback after landscape toggle
        setTimeout(() => {
            if (videoRef.current) {
                videoRef.current.currentTime = savedTime;
                if (wasPlaying) {
                    videoRef.current.play().catch(() => { });
                }
            }
        }, 100);
        resetControlsTimeout();
    };

    useEffect(() => {
        // Reset playback state when source changes
        setIsPlaying(false);
        setCurrentTime(0);
        setShowControls(true);
        setVideoError(false);
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
                poster={poster}
                crossOrigin={isExternal ? 'anonymous' : undefined}
                className={cn(
                    "w-full h-full object-contain cursor-pointer",
                    displayLandscape ? "w-[100vh] h-[100vw]" : ""
                )}
                onClick={handlePlayPause}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                onError={() => setVideoError(true)}
                playsInline
                // @ts-ignore — webkit attribute required for older iOS Safari inline playback
                webkit-playsinline="true"
                // @ts-ignore — x5 attributes for Android WebView / QQ / WeChat browsers
                x5-video-player-type="h5"
                x5-playsinline="true"
                preload="metadata"
                controls={false}
            >
                <source src={src} type={getMimeType(src)} />
                Your browser does not support this video format.
            </video>

            {/* Error fallback for external videos that cannot be played inline */}
            {videoError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 text-white gap-4 p-6 text-center">
                    <div className="bg-white/10 p-4 rounded-full">
                        <Play className="h-10 w-10 text-white/60" />
                    </div>
                    <p className="text-sm sm:text-base font-medium text-white/80 max-w-md">
                        This video is hosted externally and cannot be played in the built-in player.
                    </p>
                    <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors"
                    >
                        <Play className="h-4 w-4" />
                        Open Video
                    </a>
                </div>
            )}

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

            {/* Top Bar — title only */}
            <div className={cn(
                "absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 flex justify-between items-start",
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
                <span className="text-white/80 font-medium text-xs sm:text-sm drop-shadow-md truncate pr-4">
                    {title || 'Video Lesson'}
                </span>
            </div>

            {/* Bottom Controls */}
            <div className={cn(
                "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300",
                showControls ? "opacity-100" : "opacity-0 pointer-events-none",
                isMobile ? "px-2.5 pb-2 pt-10" : "px-4 pb-4 pt-12"
            )}>
                {/* Progress bar */}
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <span className="text-white text-[10px] sm:text-xs font-medium tabular-nums shadow-sm min-w-[32px] text-center">{formatTime(currentTime)}</span>
                    <Slider
                        value={[currentTime]}
                        max={duration || 100}
                        step={1}
                        className="flex-1 cursor-pointer"
                        onValueChange={handleSeek}
                    />
                    <span className="text-white/80 text-[10px] sm:text-xs font-medium tabular-nums shadow-sm min-w-[32px] text-center">{formatTime(duration)}</span>
                </div>

                {/* Controls row */}
                <div className="flex items-center justify-between gap-1">
                    {/* Left controls */}
                    <div className="flex items-center gap-0.5 sm:gap-1">
                        {/* Play/Pause */}
                        <Button variant="ghost" size="icon" onClick={handlePlayPause} className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9">
                            {isPlaying ? <Pause className="h-4 w-4 sm:h-5 sm:w-5" /> : <Play className="h-4 w-4 sm:h-5 sm:w-5" />}
                        </Button>

                        {/* Skip back/forward — always visible on mobile for quick navigation */}
                        <Button variant="ghost" size="icon" onClick={() => skipTime(-10)} className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9">
                            <SkipBack className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => skipTime(10)} className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9">
                            <SkipForward className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>

                        {/* Volume — desktop only (expandable) */}
                        <div className="hidden sm:flex items-center gap-1 group/volume w-8 hover:w-32 transition-all duration-300 overflow-hidden">
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

                    {/* Right controls */}
                    <div className="flex items-center gap-0.5 sm:gap-2">
                        {/* Mute toggle for mobile */}
                        <Button variant="ghost" size="icon" onClick={toggleMute} className="sm:hidden text-white hover:bg-white/20 h-8 w-8">
                            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4 text-white stroke-[2.5px]" /> : <Volume2 className="h-4 w-4 text-white stroke-[2.5px]" />}
                        </Button>

                        {/* Playback speed */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9 text-xs font-extrabold tabular-nums">
                                    {playbackRate}x
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

                        {/* Settings (desktop) */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="hidden sm:flex text-white hover:bg-white/20 h-9 w-9">
                                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-white stroke-[2.5px]" />
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

                        {/* Fullscreen */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleFullscreen}
                            className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9"
                        >
                            {isFullscreen ? <Minimize className="h-4 w-4 sm:h-5 sm:w-5 text-white stroke-[2.5px]" /> : <Maximize className="h-4 w-4 sm:h-5 sm:w-5 text-white stroke-[2.5px]" />}
                        </Button>

                        {/* Landscape toggle — mobile only, prominent and far right */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleLandscape}
                            className="sm:hidden text-white hover:bg-white/20 h-10 w-auto px-2 gap-1 rounded-md"
                        >
                            <RotateCw className="h-4 w-4 text-white stroke-[2.5px]" />
                            <Smartphone className={cn("h-6 w-6 text-white stroke-[2px] transition-transform duration-300", isLandscape && "rotate-90")} />
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
