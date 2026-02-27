import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Video, Upload, Loader2, CheckCircle, ImagePlus, Info,
    Play, RefreshCcw, ExternalLink, Trash2
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { adminService } from '@/services/admin.service';
import { resolveMediaUrl } from '@/lib/media';
import api from '@/lib/api';

// ── Tiny helper: upload a file through the existing /upload endpoint ─────────
async function uploadFileToServer(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.url as string;
}

const AdminPlatformVideo = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Form state
    const [videoUrl, setVideoUrl] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [title, setTitle] = useState('How to Use Our Platform');
    const [description, setDescription] = useState('');

    // Upload state
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [uploadingThumb, setUploadingThumb] = useState(false);

    const videoFileRef = useRef<HTMLInputElement>(null);
    const thumbFileRef = useRef<HTMLInputElement>(null);

    // Fetch existing video
    const { data: existingVideo, isLoading } = useQuery({
        queryKey: ['platformVideo'],
        queryFn: () => adminService.getPlatformVideo(),
    });

    // Populate form when data loads
    useEffect(() => {
        if (existingVideo) {
            setVideoUrl(existingVideo.videoUrl || '');
            setThumbnailUrl(existingVideo.thumbnailUrl || '');
            setTitle(existingVideo.title || 'How to Use Our Platform');
            setDescription(existingVideo.description || '');
        }
    }, [existingVideo]);

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: () => adminService.uploadPlatformVideo({
            videoUrl,
            thumbnailUrl: thumbnailUrl || undefined,
            title,
            description: description || undefined,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['platformVideo'] });
            toast({ title: 'Platform video updated', description: 'The homepage video has been saved successfully.' });
        },
        onError: (err: any) => {
            toast({
                title: 'Failed to save',
                description: err.response?.data?.message || 'Something went wrong.',
                variant: 'destructive'
            });
        },
    });

    // Video file upload
    const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingVideo(true);
        try {
            const url = await uploadFileToServer(file);
            setVideoUrl(url);
            toast({ title: 'Video uploaded', description: 'Video file ready. Click "Save" to apply.' });
        } catch (err: any) {
            toast({ title: 'Upload failed', description: err.response?.data?.message || err.message, variant: 'destructive' });
        } finally {
            setUploadingVideo(false);
        }
    };

    // Thumbnail file upload
    const handleThumbFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingThumb(true);
        try {
            const url = await uploadFileToServer(file);
            setThumbnailUrl(url);
            toast({ title: 'Thumbnail uploaded', description: 'Thumbnail ready. Click "Save" to apply.' });
        } catch (err: any) {
            toast({ title: 'Upload failed', description: err.response?.data?.message || err.message, variant: 'destructive' });
        } finally {
            setUploadingThumb(false);
        }
    };

    const resolvedVideo = resolveMediaUrl(videoUrl);
    const resolvedThumb = resolveMediaUrl(thumbnailUrl);

    return (
        <AdminLayout>
            <div className="space-y-8 max-w-4xl">
                {/* Header */}
                <div>
                    <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
                        <Video className="h-8 w-8 text-primary" />
                        Homepage Platform Video
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Upload the promotional video that appears on the homepage, showing new users how to use the platform.
                    </p>
                </div>

                {/* Info Banner */}
                <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                        The video and thumbnail will automatically appear in the <strong className="text-foreground">"How It Works"</strong> section on the homepage.
                        Uploading replaces the previous video. Supported formats: MP4, WebM, MOV.
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="grid gap-8 lg:grid-cols-2">
                        {/* ── Left: Upload Form ── */}
                        <div className="space-y-6 rounded-xl border border-border bg-card p-6">
                            <h2 className="font-semibold text-foreground text-lg">Upload Media</h2>

                            {/* Video Upload */}
                            <div className="space-y-2">
                                <Label htmlFor="video-url">Video URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="video-url"
                                        placeholder="https://... or leave blank to upload a file"
                                        value={videoUrl}
                                        onChange={(e) => setVideoUrl(e.target.value)}
                                        className="flex-1"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-xs text-muted-foreground">or</span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>
                                <input
                                    ref={videoFileRef}
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={handleVideoFileChange}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => videoFileRef.current?.click()}
                                    disabled={uploadingVideo}
                                >
                                    {uploadingVideo ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading video...</>
                                    ) : (
                                        <><Upload className="mr-2 h-4 w-4" /> Upload Video File</>
                                    )}
                                </Button>
                                {videoUrl && (
                                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                                        <CheckCircle className="h-3.5 w-3.5" /> Video URL set
                                    </p>
                                )}
                            </div>

                            {/* Thumbnail Upload */}
                            <div className="space-y-2">
                                <Label htmlFor="thumb-url">Thumbnail URL <span className="text-muted-foreground">(optional)</span></Label>
                                <Input
                                    id="thumb-url"
                                    placeholder="https://... or leave blank to upload an image"
                                    value={thumbnailUrl}
                                    onChange={(e) => setThumbnailUrl(e.target.value)}
                                />
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-xs text-muted-foreground">or</span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>
                                <input
                                    ref={thumbFileRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleThumbFileChange}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => thumbFileRef.current?.click()}
                                    disabled={uploadingThumb}
                                >
                                    {uploadingThumb ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading thumbnail...</>
                                    ) : (
                                        <><ImagePlus className="mr-2 h-4 w-4" /> Upload Thumbnail Image</>
                                    )}
                                </Button>
                                {thumbnailUrl && (
                                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                                        <CheckCircle className="h-3.5 w-3.5" /> Thumbnail URL set
                                    </p>
                                )}
                            </div>

                            {/* Title */}
                            <div className="space-y-2">
                                <Label htmlFor="video-title">Video Title</Label>
                                <Input
                                    id="video-title"
                                    placeholder="How to Use Our Platform"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="video-desc">Short Description <span className="text-muted-foreground">(optional)</span></Label>
                                <Textarea
                                    id="video-desc"
                                    placeholder="A quick overview of what students can expect..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            {/* Save */}
                            <Button
                                className="w-full"
                                onClick={() => saveMutation.mutate()}
                                disabled={!videoUrl || saveMutation.isPending || uploadingVideo || uploadingThumb}
                            >
                                {saveMutation.isPending ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                                ) : (
                                    <><CheckCircle className="mr-2 h-4 w-4" /> Save to Homepage</>
                                )}
                            </Button>
                        </div>

                        {/* ── Right: Preview ── */}
                        <div className="space-y-4">
                            <h2 className="font-semibold text-foreground text-lg">Preview</h2>

                            {/* Current video preview */}
                            {resolvedVideo ? (
                                <div className="space-y-3">
                                    <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black shadow-lg">
                                        <video
                                            key={resolvedVideo}
                                            src={resolvedVideo}
                                            poster={resolvedThumb || undefined}
                                            controls
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Play className="h-4 w-4 text-primary" />
                                        <span className="truncate font-medium text-foreground">{title}</span>
                                    </div>
                                    {description && (
                                        <p className="text-sm text-muted-foreground">{description}</p>
                                    )}
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open(resolvedVideo, '_blank')}
                                        >
                                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open Video
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setVideoUrl('');
                                                setThumbnailUrl('');
                                            }}
                                        >
                                            <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" /> Clear
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex aspect-video flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/20 text-center p-6">
                                    <Video className="h-12 w-12 text-muted-foreground/40 mb-3" />
                                    <p className="text-sm font-medium text-muted-foreground">No video uploaded yet</p>
                                    <p className="text-xs text-muted-foreground mt-1">Upload a video to see a preview here</p>
                                </div>
                            )}

                            {/* Thumbnail preview */}
                            {resolvedThumb && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Thumbnail</p>
                                    <img
                                        src={resolvedThumb}
                                        alt="Thumbnail preview"
                                        className="h-28 w-full object-cover rounded-lg border border-border"
                                    />
                                </div>
                            )}

                            {/* Status card */}
                            {existingVideo && (
                                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                                        <p className="text-sm font-medium text-emerald-400">Active on homepage</p>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Last updated: {new Date(existingVideo.updatedAt).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'long', day: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminPlatformVideo;
