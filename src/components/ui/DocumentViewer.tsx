import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2, Maximize, Minimize, RotateCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

interface DocumentViewerProps {
    url: string;
    type: string; // 'pdf' | 'ppt' | 'doc'
    title?: string;
    className?: string;
}

const DocumentViewer = ({ url, type, title, className }: DocumentViewerProps) => {
    // Download helper — routes through backend proxy for reliable cross-origin downloads
    const triggerDownload = () => {
        const downloadName = title || 'download';
        const proxyUrl = `/api/v1/upload/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(downloadName)}`;
        const token = localStorage.getItem('accessToken');
        fetch(proxyUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
            .then(r => {
                if (!r.ok) throw new Error('Download failed');
                return r.blob();
            })
            .then(blob => {
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = downloadName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            })
            .catch(() => window.open(url, '_blank'));
    };
    // PDF State
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [pageNum, setPageNum] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.0);
    const [autoScale, setAutoScale] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLandscape, setIsLandscape] = useState(false);
    const [showToolbar, setShowToolbar] = useState(true);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerAreaRef = useRef<HTMLDivElement>(null);
    const renderTaskRef = useRef<any>(null);
    const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Pinch-to-zoom refs
    const lastTouchDistRef = useRef<number | null>(null);
    const pinchBaseScaleRef = useRef<number>(1.0);

    // Auto-hide toolbar after inactivity
    const resetToolbarTimer = useCallback(() => {
        setShowToolbar(true);
        if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
        toolbarTimerRef.current = setTimeout(() => setShowToolbar(false), 4000);
    }, []);

    useEffect(() => {
        resetToolbarTimer();
        return () => {
            if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
        };
    }, [resetToolbarTimer]);

    // Initial load for PDF
    useEffect(() => {
        if (type === 'pdf') {
            setLoading(true);
            setError(null);
            setPdfDoc(null);
            setPageNum(1);
            const loadingTask = pdfjsLib.getDocument(url);

            loadingTask.promise
                .then((doc) => {
                    setPdfDoc(doc);
                    setNumPages(doc.numPages);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error('Error loading PDF:', err);
                    setError('Failed to load PDF document.');
                    setLoading(false);
                });
        }
    }, [url, type]);

    // Compute a scale that fits the PDF page width into the container
    const computeFitScale = useCallback(async () => {
        if (!pdfDoc || !viewerAreaRef.current) return;
        try {
            const page = await pdfDoc.getPage(pageNum);
            const defaultViewport = page.getViewport({ scale: 1.0 });
            const containerWidth = viewerAreaRef.current.clientWidth - 8; // minimal padding
            const fitScale = containerWidth / defaultViewport.width;
            setAutoScale(fitScale);
            setScale(fitScale);
        } catch { /* ignore */ }
    }, [pdfDoc, pageNum]);

    // Auto-fit on load and resize
    useEffect(() => {
        if (!pdfDoc) return;
        computeFitScale();

        const handleResize = () => computeFitScale();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [pdfDoc, computeFitScale]);

    // Render PDF page with high-DPI support
    useEffect(() => {
        if (!pdfDoc || !canvasRef.current || type !== 'pdf') return;

        const renderPage = async () => {
            try {
                // Cancel previous render if any
                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                const page = await pdfDoc.getPage(pageNum);
                const dpr = window.devicePixelRatio || 1;
                const viewport = page.getViewport({ scale: scale * dpr });
                const displayViewport = page.getViewport({ scale });
                const canvas = canvasRef.current!;
                const context = canvas.getContext('2d')!;

                // Render at high resolution
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // Display at logical size (CSS)
                canvas.style.width = `${displayViewport.width}px`;
                canvas.style.height = `${displayViewport.height}px`;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                };

                const renderTask = page.render(renderContext);
                renderTaskRef.current = renderTask;

                await renderTask.promise;
            } catch (err: any) {
                if (err.name !== 'RenderingCancelledException') {
                    console.error('Error rendering page:', err);
                }
            }
        };

        renderPage();
    }, [pdfDoc, pageNum, scale, type]);

    // Navigation
    const changePage = (offset: number) => {
        setPageNum((prev) => Math.min(Math.max(1, prev + offset), numPages));
    };

    const zoom = (factor: number) => {
        setScale((prev) => Math.max(0.25, Math.min(4.0, prev * factor)));
        resetToolbarTimer();
    };

    const resetZoom = () => {
        if (autoScale) setScale(autoScale);
        resetToolbarTimer();
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
        resetToolbarTimer();
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Pinch-to-zoom for mobile
    useEffect(() => {
        const viewer = viewerAreaRef.current;
        if (!viewer || type !== 'pdf') return;

        const getTouchDistance = (touches: TouchList) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                lastTouchDistRef.current = getTouchDistance(e.touches);
                pinchBaseScaleRef.current = scale;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
                e.preventDefault();
                const dist = getTouchDistance(e.touches);
                const ratio = dist / lastTouchDistRef.current;
                const newScale = Math.max(0.25, Math.min(4.0, pinchBaseScaleRef.current * ratio));
                setScale(newScale);
            }
        };

        const handleTouchEnd = () => {
            lastTouchDistRef.current = null;
        };

        viewer.addEventListener('touchstart', handleTouchStart, { passive: false });
        viewer.addEventListener('touchmove', handleTouchMove, { passive: false });
        viewer.addEventListener('touchend', handleTouchEnd);

        return () => {
            viewer.removeEventListener('touchstart', handleTouchStart);
            viewer.removeEventListener('touchmove', handleTouchMove);
            viewer.removeEventListener('touchend', handleTouchEnd);
        };
    }, [type, scale]);

    // Landscape toggle with Screen Orientation API fallback
    const toggleLandscape = async () => {
        const next = !isLandscape;
        setIsLandscape(next);
        try {
            if (next && screen.orientation && (screen.orientation as any).lock) {
                await (screen.orientation as any).lock('landscape');
            } else if (!next && screen.orientation && (screen.orientation as any).unlock) {
                (screen.orientation as any).unlock();
            }
        } catch { /* orientation lock not supported – CSS fallback used */ }
        // Force re-render of current page to avoid black screen on landscape toggle
        if (pdfDoc && type === 'pdf') {
            setTimeout(() => {
                computeFitScale();
            }, 100);
        }
    };

    if (type === 'ppt' || type === 'doc' || type === 'pptx' || type === 'docx') {
        // Use Google Docs Viewer for Office files (works with publicly accessible URLs)
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;

        const content = (
            <div
                ref={containerRef}
                className={cn("flex flex-col h-full bg-black overflow-hidden", className)}
                onMouseMove={resetToolbarTimer}
                onTouchStart={resetToolbarTimer}
            >
                {isLocalhost ? (
                    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center h-full bg-neutral-900">
                        <Download className="h-12 w-12 text-primary mb-4" />
                        <h3 className="text-lg font-semibold text-white">Local Preview Unavailable</h3>
                        <div className="text-sm text-neutral-400 mb-6 max-w-sm space-y-2">
                            <p>Microsoft Office files cannot be previewed on localhost due to browser security restrictions.</p>
                            <p className="font-medium text-white">Tip: Upload PDF files for instant preview.</p>
                        </div>
                        <Button onClick={triggerDownload}>
                            Download File
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col h-full w-full">
                        <iframe
                            src={googleViewerUrl}
                            className="w-full flex-1 border-none"
                            style={{ minHeight: '100%' }}
                            title={title || "Document Viewer"}
                            allowFullScreen
                        />
                        {/* Minimal bottom bar */}
                        <div className={cn(
                            "flex items-center justify-between px-2 py-1.5 bg-black/80 backdrop-blur-sm transition-opacity duration-300",
                            showToolbar ? "opacity-100" : "opacity-0"
                        )}>
                            <span className="text-xs text-neutral-400 truncate pl-2">{title || 'Document'}</span>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 hover:bg-neutral-800 text-neutral-400">
                                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="sm" className="text-neutral-400 hover:bg-neutral-800 h-8 text-xs gap-1 mr-2" onClick={triggerDownload}>
                                    <Download className="h-4 w-4" />
                                    Download
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleLandscape}
                                    className="md:hidden text-neutral-300 hover:text-white hover:bg-neutral-800 h-9 w-auto px-2 gap-1 rounded-md bg-neutral-900 border border-neutral-800"
                                >
                                    <RotateCw className="h-4 w-4 stroke-[2.5px]" />
                                    <Smartphone className={cn("h-5 w-5 stroke-[2px] transition-transform duration-300", isLandscape && "rotate-90")} />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );

        if (isLandscape) {
            return (
                <div className="fixed inset-0 z-50 bg-black">
                    <div className="w-screen h-screen" style={{ transform: 'rotate(90deg)', transformOrigin: 'center center', width: '100vh', height: '100vw', position: 'absolute', top: '50%', left: '50%', marginTop: 'calc(-50vw)', marginLeft: 'calc(-50vh)' }}>
                        {content}
                    </div>
                </div>
            );
        }
        return content;
    }

    const pdfContent = (
        <div
            ref={containerRef}
            className={cn("flex flex-col bg-black overflow-hidden relative", isLandscape && "h-full", className)}
            onMouseMove={resetToolbarTimer}
            onTouchStart={resetToolbarTimer}
        >
            {/* Minimal Toolbar — auto-hides */}
            <div className={cn(
                "absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-2 py-1 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
                showToolbar ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
                <div className="flex items-center gap-1">
                    {numPages > 1 && (
                        <span className="text-[10px] text-neutral-400">
                            {pageNum}/{numPages}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-0">
                    <Button variant="ghost" size="icon" onClick={() => zoom(0.8)} className="h-7 w-7 hover:bg-white/10 text-neutral-300">
                        <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <button onClick={resetZoom} className="text-[10px] w-10 text-center text-neutral-400 hover:text-white transition-colors" title="Reset zoom">
                        {Math.round(scale * 100)}%
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => zoom(1.25)} className="h-7 w-7 hover:bg-white/10 text-neutral-300">
                        <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-7 w-7 hover:bg-white/10 text-neutral-300">
                        {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10 text-neutral-300" onClick={triggerDownload}>
                        <Download className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Viewer Area — with padding so toolbars don't cover content */}
            <div
                ref={viewerAreaRef}
                className="flex-1 overflow-auto flex justify-center bg-black min-h-[300px] relative pt-9 pb-9"
                style={{ touchAction: 'manipulation' }}
            >
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                {error && (
                    <div className="flex flex-col items-center justify-center text-center p-8 text-neutral-400">
                        <p className="mb-4">{error}</p>
                        <Button variant="outline" onClick={triggerDownload}>
                            Download instead
                        </Button>
                    </div>
                )}

                <div className="relative">
                    <canvas ref={canvasRef} className="block max-w-full" />
                </div>
            </div>

            {/* Minimal Footer / Pagination and Landscape — auto-hides */}
            <div className={cn(
                "absolute bottom-0 left-0 right-0 z-20 flex items-center px-2 py-1.5 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
                showToolbar ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
                <div className="flex-1" />

                {numPages > 1 ? (
                    <div className="flex items-center justify-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => changePage(-1)}
                            disabled={pageNum <= 1}
                            className="hover:bg-white/10 text-neutral-300 h-8 text-xs"
                        >
                            <ChevronLeft className="h-4 w-4 mr-0.5" />
                            Prev
                        </Button>
                        <span className="text-xs font-semibold text-neutral-400 min-w-[3rem] text-center">
                            {pageNum} / {numPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => changePage(1)}
                            disabled={pageNum >= numPages}
                            className="hover:bg-white/10 text-neutral-300 h-8 text-xs"
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-0.5" />
                        </Button>
                    </div>
                ) : <div className="flex-[2]" />}

                <div className="flex-1 flex justify-end items-center px-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleLandscape}
                        className="md:hidden text-white hover:bg-white/20 h-10 w-auto px-2 gap-1 rounded-md"
                    >
                        <RotateCw className="h-4 w-4 text-white stroke-[2.5px]" />
                        <Smartphone className={cn("h-6 w-6 text-white stroke-[2px] transition-transform duration-300", isLandscape && "rotate-90")} />
                    </Button>
                </div>
            </div>
        </div>
    );

    if (isLandscape) {
        return (
            <div className="fixed inset-0 z-50 bg-black">
                <div className="w-screen h-screen" style={{ transform: 'rotate(90deg)', transformOrigin: 'center center', width: '100vh', height: '100vw', position: 'absolute', top: '50%', left: '50%', marginTop: 'calc(-50vw)', marginLeft: 'calc(-50vh)' }}>
                    {pdfContent}
                </div>
            </div>
        );
    }

    return pdfContent;
};

export default DocumentViewer;
