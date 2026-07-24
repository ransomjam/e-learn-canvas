import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Smartphone, Settings, SkipBack, SkipForward, RotateCw, Loader2, AlertTriangle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api';

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

type VideoErrorKind = 'processing' | 'failed' | 'unplayable';

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
    const [errorKind, setErrorKind] = useState<VideoErrorKind>('unplayable');
    // While a Bunny video is still transcoding, show a real progress % instead
    // of a misleading error, and re-init the stream once it becomes playable.
    const [processing, setProcessing] = useState<{ active: boolean; percent: number }>({ active: false, percent: 0 });
    const [retryKey, setRetryKey] = useState(0);
    const autoRetryCountRef = useRef(0);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Touch/coarse-pointer detection, independent of viewport WIDTH. Rotating a
    // phone into landscape widens the viewport past the CSS breakpoints, which is
    // why width-based `sm:hidden` gating used to hide the rotate/mute buttons.
    const [isTouch, setIsTouch] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(pointer: coarse)');
        const update = () =>
            setIsTouch(mq.matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0);
        update();
        mq.addEventListener?.('change', update);
        return () => mq.removeEventListener?.('change', update);
    }, []);

    const isExternal = src.startsWith('http://') || src.startsWith('https://');

    // HLS streams (Bunny Stream `.m3u8` playlists): Safari/iOS play them natively;
    // everywhere else we attach hls.js. The <source> element is skipped for HLS —
    // the source is wired up in the effect below instead.
    const isHls = /\.m3u8($|\?)/i.test(src);

    // Ask the backend whether the video is simply still encoding (Bunny returns
    // 403 on the playlist until transcoding finishes). Returns { ready, failed,
    // encodeProgress, unknown }. On any failure we assume "ready" so we never
    // block a video that is actually fine.
    const checkEncodingStatus = useCallback(async (): Promise<{
        ready?: boolean; failed?: boolean; encodeProgress?: number; unknown?: boolean;
    }> => {
        try {
            const res = await fetch(`${API_BASE_URL}/upload/video-status?url=${encodeURIComponent(src)}`);
            const json = await res.json();
            return json?.data ?? { ready: true, unknown: true };
        } catch {
            return { ready: true, unknown: true };
        }
    }, [src]);

    // Called when the <video> element or hls.js reports a load error.
    const handleMediaError = useCallback(async () => {
        const st = await checkEncodingStatus();

        if (st?.failed) {
            setProcessing({ active: false, percent: 0 });
            setErrorKind('failed');
            setVideoError(true);
            return;
        }

        if (st && st.ready === false) {
            // Still transcoding — show progress and let the poll effect re-init
            // the player once it's ready.
            setVideoError(false);
            setProcessing({ active: true, percent: st.encodeProgress || 0 });
            return;
        }

        // Ready/unknown but still failed — could be a transient CDN/network blip.
        // Retry a couple of times automatically before giving up.
        if (autoRetryCountRef.current < 2) {
            autoRetryCountRef.current += 1;
            setTimeout(() => setRetryKey((k) => k + 1), 1500);
            return;
        }

        setProcessing({ active: false, percent: 0 });
        setErrorKind('unplayable');
        setVideoError(true);
    }, [checkEncodingStatus]);

    // Poll Bunny while the video is transcoding, then re-init when it's playable.
    useEffect(() => {
        if (!processing.active) return;
        let cancelled = false;
        const tick = async () => {
            const st = await checkEncodingStatus();
            if (cancelled) return;
            if (st?.failed) {
                setProcessing({ active: false, percent: 0 });
                setErrorKind('failed');
                setVideoError(true);
                return;
            }
            if (st && st.ready === false) {
                setProcessing((p) => ({ active: true, percent: st.encodeProgress ?? p.percent }));
                return;
            }
            // Ready — reload the stream.
            setProcessing({ active: false, percent: 0 });
            autoRetryCountRef.current = 0;
            setRetryKey((k) => k + 1);
        };
        const interval = setInterval(tick, 8000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [processing.active, checkEncodingStatus]);

    // Wire up the HLS source (re-runs on retry).
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !isHls) return;

        // Native HLS support (Safari, iOS browsers)
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
            video.load();
            return;
        }

        let hls: { destroy: () => void } | null = null;
        let cancelled = false;
        import('hls.js').then(({ default: Hls }) => {
            if (cancelled || !videoRef.current) return;
            if (Hls.isSupported()) {
                const instance = new Hls({ maxBufferLength: 30 });
                instance.loadSource(src);
                instance.attachMedia(videoRef.current);
                instance.on(Hls.Events.ERROR, (_evt, data) => {
                    if (data.fatal) handleMediaError();
                });
                hls = instance;
            } else {
                setErrorKind('unplayable');
                setVideoError(true);
            }
        });

        return () => {
            cancelled = true;
            if (hls) hls.destroy();
        };
    }, [src, isHls, retryKey, handleMediaError]);

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
            if (videoRef.current.paused) {
                videoRef.current.play().catch(error => {
                    console.error("Video play failed:", error);
                });
            } else {
                videoRef.current.pause();
                setShowControls(true); // Keep controls visible when paused
            }
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

    const retryPlayback = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setVideoError(false);
        setProcessing({ active: false, percent: 0 });
        autoRetryCountRef.current = 0;
        setRetryKey((k) => k + 1);
    };

    useEffect(() => {
        // Reset playback state when source changes
        setIsPlaying(false);
        setCurrentTime(0);
        setShowControls(true);
        setVideoError(false);
        setProcessing({ active: false, percent: 0 });
        setErrorKind('unplayable');
        autoRetryCountRef.current = 0;
    }, [src]);

    const displayLandscape = isLandscape && !isFullscreen;

    const content = (
        <div
            ref={containerRef}
            className="relative flex flex-col bg-black overflow-hidden group font-sans w-full h-full"
            onMouseMove={resetControlsTimeout}
            onTouchStart={resetControlsTimeout}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            <video
                ref={videoRef}
                poster={poster}
                crossOrigin={isExternal ? 'anonymous' : undefined}
                className="w-full h-full object-contain cursor-pointer"
                onClick={handlePlayPause}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                onError={handleMediaError}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                playsInline
                // @ts-ignore — webkit attribute required for older iOS Safari inline playback
                webkit-playsinline="true"
                // @ts-ignore — x5 attributes for Android WebView / QQ / WeChat browsers
                x5-video-player-type="h5"
                x5-playsinline="true"
                preload="metadata"
                controls={false}
            >
                {!isHls && <source src={src} type={getMimeType(src)} />}
                Your browser does not support this video format.
            </video>

            {/* Still-encoding overlay — Bunny transcodes after upload */}
            {processing.active && !videoError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 text-white gap-4 p-6 text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <div className="space-y-1">
                        <p className="text-sm sm:text-base font-medium text-white/90">
                            This video is still being processed
                        </p>
                        <p className="text-xs text-white/60">
                            It will start playing automatically once ready
                            {processing.percent > 0 ? ` — ${Math.round(processing.percent)}%` : '…'}
                        </p>
                    </div>
                    {processing.percent > 0 && (
                        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/15">
                            <div
                                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                                style={{ width: `${Math.min(100, Math.round(processing.percent))}%` }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Error fallback */}
            {videoError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 text-white gap-4 p-6 text-center">
                    <div className="bg-white/10 p-4 rounded-full">
                        <AlertTriangle className="h-9 w-9 text-white/70" />
                    </div>
                    <p className="text-sm sm:text-base font-medium text-white/80 max-w-md">
                        {errorKind === 'failed'
                            ? 'This video could not be processed. Please try re-uploading it.'
                            : "This video couldn't be played. It may still be processing — try again in a moment."}
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={retryPlayback}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-colors"
                        >
                            <RotateCw className="h-4 w-4" />
                            Try again
                        </button>
                        {isExternal && (
                            <a
                                href={src}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                <Play className="h-4 w-4" />
                                Open Video
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Central play button when paused */}
            {!isPlaying && !videoError && !processing.active && (
                <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/20 group/play"
                    onClick={handlePlayPause}
                >
                    <div className="bg-primary/90 text-primary-foreground p-3 sm:p-4 rounded-full shadow-[0_0_20px_hsla(var(--primary)/0.4)] backdrop-blur-md transform transition-all duration-300 group-hover/play:scale-110 group-hover/play:bg-primary group-hover/play:shadow-[0_0_30px_hsla(var(--primary)/0.6)]">
                        <Play className="h-6 w-6 sm:h-8 sm:w-8 ml-1" />
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
                isTouch ? "px-2.5 pb-2 pt-10" : "px-4 pb-4 pt-12"
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

                        {/* Skip back/forward — always visible for quick navigation */}
                        <Button variant="ghost" size="icon" onClick={() => skipTime(-10)} className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9">
                            <SkipBack className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => skipTime(10)} className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9">
                            <SkipForward className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>

                        {/* Volume — pointer devices only (expandable) */}
                        {!isTouch && (
                            <div className="flex items-center gap-1 group/volume w-8 hover:w-32 transition-all duration-300 overflow-hidden">
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
                        )}
                    </div>

                    {/* Right controls */}
                    <div className="flex items-center gap-0.5 sm:gap-2">
                        {/* Mute toggle for touch devices */}
                        {isTouch && (
                            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20 h-8 w-8">
                                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4 text-white stroke-[2.5px]" /> : <Volume2 className="h-4 w-4 text-white stroke-[2.5px]" />}
                            </Button>
                        )}

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

                        {/* Settings (pointer devices) */}
                        {!isTouch && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-9 w-9">
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
                        )}

                        {/* Fullscreen */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleFullscreen}
                            className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9"
                        >
                            {isFullscreen ? <Minimize className="h-4 w-4 sm:h-5 sm:w-5 text-white stroke-[2.5px]" /> : <Maximize className="h-4 w-4 sm:h-5 sm:w-5 text-white stroke-[2.5px]" />}
                        </Button>

                        {/* Landscape toggle — touch devices only, prominent and far right */}
                        {isTouch && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleLandscape}
                                className="text-white hover:bg-white/20 h-10 w-auto px-2 gap-1 rounded-md"
                            >
                                <RotateCw className="h-4 w-4 text-white stroke-[2.5px]" />
                                <Smartphone className={cn("h-6 w-6 text-white stroke-[2px] transition-transform duration-300", isLandscape && "rotate-90")} />
                            </Button>
                        )}
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
