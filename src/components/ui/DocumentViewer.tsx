import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2, Maximize, Minimize, RotateCw } from 'lucide-react';
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
    // PDF State
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [pageNum, setPageNum] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.0);
    const [autoScale, setAutoScale] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerAreaRef = useRef<HTMLDivElement>(null);
    const renderTaskRef = useRef<any>(null);

    // Initial load for PDF
    useEffect(() => {
        if (type === 'pdf') {
            setLoading(true);
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
            const containerWidth = viewerAreaRef.current.clientWidth - 32; // minus padding
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

    // Render PDF page
    useEffect(() => {
        if (!pdfDoc || !canvasRef.current || type !== 'pdf') return;

        const renderPage = async () => {
            try {
                // Cancel previous render if any
                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current!;
                const context = canvas.getContext('2d')!;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

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
    };

    const resetZoom = () => {
        if (autoScale) setScale(autoScale);
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
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    if (type === 'ppt' || type === 'doc' || type === 'pptx' || type === 'docx') {
        // Use Google Docs Viewer for Office files (works with publicly accessible URLs)
        // For localhost/dev, show a download fallback since external viewers can't reach local URLs.
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;

        return (
            <div className={cn("flex flex-col h-full bg-secondary/20 rounded-lg overflow-hidden", className)}>
                {isLocalhost ? (
                    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center h-full">
                        <Download className="h-12 w-12 text-primary mb-4" />
                        <h3 className="text-lg font-semibold">Local Preview Unavailable</h3>
                        <div className="text-sm text-muted-foreground mb-6 max-w-sm space-y-2">
                            <p>Microsoft Office files cannot be previewed on localhost due to browser security restrictions.</p>
                            <p className="font-medium text-foreground">Tip: Upload PDF files for instant preview.</p>
                        </div>
                        <Button asChild>
                            <a href={url} download>Download File</a>
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col h-full w-full">
                        <iframe
                            src={googleViewerUrl}
                            className="w-full flex-1 min-h-[400px] sm:min-h-[500px] border-none"
                            title={title || "Document Viewer"}
                            allowFullScreen
                        />
                        {/* Fallback download button for mobile */}
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-t border-slate-700">
                            <span className="text-xs text-slate-400 truncate">{title || 'Document'}</span>
                            <Button variant="ghost" size="sm" asChild className="text-slate-300 hover:bg-slate-700 h-8 text-xs gap-1.5">
                                <a href={url} download target="_blank" rel="noopener noreferrer">
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                </a>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={cn("flex flex-col bg-slate-900 rounded-lg overflow-hidden shadow-lg", className)}
        >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 text-slate-200">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {type}
                    </span>
                    {title && (
                        <span className="text-sm font-medium truncate max-w-[200px]" title={title}>
                            {title}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => zoom(0.8)} className="h-8 w-8 hover:bg-slate-700 text-slate-300">
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <button onClick={resetZoom} className="text-xs w-12 text-center hover:text-white transition-colors" title="Reset zoom">
                        {Math.round(scale * 100)}%
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => zoom(1.25)} className="h-8 w-8 hover:bg-slate-700 text-slate-300">
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-4 bg-slate-700 mx-2" />
                    <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 hover:bg-slate-700 text-slate-300">
                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 hover:bg-slate-700 text-slate-300">
                        <a href={url} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                        </a>
                    </Button>
                </div>
            </div>

            {/* Viewer Area */}
            <div ref={viewerAreaRef} className="flex-1 overflow-auto p-2 sm:p-4 flex justify-center bg-slate-900/50 min-h-[300px] sm:min-h-[500px] relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                {error && (
                    <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400">
                        <p className="mb-4">{error}</p>
                        <Button variant="outline" asChild>
                            <a href={url} download>Download instead</a>
                        </Button>
                    </div>
                )}

                <div className="relative shadow-2xl" style={{ touchAction: 'pan-x pan-y' }}>
                    <canvas ref={canvasRef} className="max-w-full block" style={{ width: '100%', height: 'auto' }} />
                </div>
            </div>

            {/* Footer / Pagination */}
            {numPages > 1 && (
                <div className="flex items-center justify-center gap-4 py-3 bg-slate-800 border-t border-slate-700 text-slate-200">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => changePage(-1)}
                        disabled={pageNum <= 1}
                        className="hover:bg-slate-700 text-slate-300"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Prev
                    </Button>
                    <span className="text-sm font-medium">
                        Page {pageNum} of {numPages}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => changePage(1)}
                        disabled={pageNum >= numPages}
                        className="hover:bg-slate-700 text-slate-300"
                    >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            )}
        </div>
    );
};

export default DocumentViewer;
