import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, Save, User } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { resolveMediaUrl } from '@/lib/media';
import api from '@/lib/api';

const Profile = () => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState('avatar.jpg');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [selectedImageDimensions, setSelectedImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewSize = 256;

  const resetEditor = () => {
    setSelectedImageSrc(null);
    setSelectedImageDimensions(null);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setIsEditorOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const createEditedAvatarFile = async () => {
    if (!selectedImageSrc || !selectedImageDimensions) return null;

    const image = new Image();
    image.src = selectedImageSrc;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const outputSize = 512;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;

    const context = canvas.getContext('2d');
    if (!context) return null;

    const baseScale = Math.max(outputSize / selectedImageDimensions.width, outputSize / selectedImageDimensions.height);
    const drawWidth = image.width * baseScale * zoom;
    const drawHeight = image.height * baseScale * zoom;
    const drawX = (outputSize - drawWidth) / 2 + (offsetX * outputSize) / previewSize;
    const drawY = (outputSize - drawHeight) / 2 + (offsetY * outputSize) / previewSize;

    context.clearRect(0, 0, outputSize, outputSize);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });

    if (!blob) return null;

    const baseName = selectedImageName.replace(/\.[^.]+$/, '') || 'avatar';
    return new File([blob], `${baseName}-edited.jpg`, { type: 'image/jpeg' });
  };

  const movementLimits = useMemo(() => {
    if (!selectedImageDimensions) {
      return { x: 0, y: 0 };
    }

    const baseScale = Math.max(
      previewSize / selectedImageDimensions.width,
      previewSize / selectedImageDimensions.height,
    );

    const drawWidth = selectedImageDimensions.width * baseScale * zoom;
    const drawHeight = selectedImageDimensions.height * baseScale * zoom;

    return {
      x: Math.max(0, (drawWidth - previewSize) / 2),
      y: Math.max(0, (drawHeight - previewSize) / 2),
    };
  }, [previewSize, selectedImageDimensions, zoom]);

  const previewImageStyle = useMemo(() => {
    if (!selectedImageDimensions) return undefined;
    const baseScale = Math.max(
      previewSize / selectedImageDimensions.width,
      previewSize / selectedImageDimensions.height,
    );
    const imgW = selectedImageDimensions.width * baseScale;
    const imgH = selectedImageDimensions.height * baseScale;
    return {
      position: 'absolute' as const,
      width: `${imgW}px`,
      height: `${imgH}px`,
      left: `${(previewSize - imgW) / 2}px`,
      top: `${(previewSize - imgH) / 2}px`,
    };
  }, [previewSize, selectedImageDimensions]);

  useEffect(() => {
    setOffsetX((current) => Math.min(movementLimits.x, Math.max(-movementLimits.x, current)));
    setOffsetY((current) => Math.min(movementLimits.y, Math.max(-movementLimits.y, current)));
  }, [movementLimits.x, movementLimits.y]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put('/users/profile', data);
      return response.data;
    },
    onSuccess: () => {
      refreshUser();
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Update failed',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (data) => {
      const avatarUrl = data.data.url;
      // Update profile with new avatar URL
      updateProfileMutation.mutate({ firstName, lastName, bio, avatarUrl });
    },
    onError: () => {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload photo. Please try again.',
        variant: 'destructive',
      });
      setAvatarPreview(null);
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedImageName(file.name);

    // Show editor with selected image
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageSrc = reader.result as string;
      const image = new Image();
      image.onload = () => {
        setSelectedImageDimensions({ width: image.naturalWidth, height: image.naturalHeight });
        setSelectedImageSrc(imageSrc);
        setIsEditorOpen(true);
      };
      image.src = imageSrc;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditedAvatar = async () => {
    const editedFile = await createEditedAvatarFile();
    if (!editedFile) {
      toast({
        title: 'Image processing failed',
        description: 'Unable to prepare your photo. Please try another image.',
        variant: 'destructive',
      });
      return;
    }

    const previewUrl = URL.createObjectURL(editedFile);
    setAvatarPreview(previewUrl);
    setIsEditorOpen(false);
    uploadAvatarMutation.mutate(editedFile);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ firstName, lastName, bio });
  };

  const resolvedAvatar = avatarPreview || resolveMediaUrl(user?.avatarUrl);

  return (
    <Layout>
      <div className="py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold text-foreground">Profile Settings</h1>
            <p className="mt-1 text-muted-foreground">
              Manage your profile information
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold text-foreground">Profile Information</h2>
            <p className="text-sm text-muted-foreground">
              Update your profile details
            </p>

            <div className="mt-6 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="relative">
                {resolvedAvatar ? (
                  <img
                    src={resolvedAvatar}
                    alt="Profile"
                    className="h-24 w-24 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary border-2 border-border">
                    <User className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={uploadAvatarMutation.isPending}
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              <div>
                <p className="font-medium text-foreground">Profile Photo</p>
                <p className="text-sm text-muted-foreground">
                  {uploadAvatarMutation.isPending
                    ? 'Uploading...'
                    : 'Click the camera icon to update. JPG, PNG, GIF or WebP. Max 2MB.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-secondary px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <Button type="submit" disabled={updateProfileMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </div>

          <Dialog
            open={isEditorOpen}
            onOpenChange={(isOpen) => {
              if (!isOpen) resetEditor();
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adjust Profile Photo</DialogTitle>
                <DialogDescription>
                  Move and zoom your photo so your face fits perfectly inside the profile icon.
                </DialogDescription>
              </DialogHeader>

              {selectedImageSrc && (
                <div className="space-y-5">
                  <div className="relative mx-auto h-64 w-64 overflow-hidden rounded-full border border-border bg-secondary">
                    <img
                      src={selectedImageSrc}
                      alt="Profile crop preview"
                      style={{
                        ...previewImageStyle,
                        transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
                        transformOrigin: 'center',
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Zoom</Label>
                    <Slider
                      min={1}
                      max={2.8}
                      step={0.05}
                      value={[zoom]}
                      onValueChange={(value) => setZoom(value[0])}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Move Left / Right</Label>
                    <Slider
                      min={-movementLimits.x}
                      max={movementLimits.x}
                      step={1}
                      value={[offsetX]}
                      onValueChange={(value) => setOffsetX(value[0])}
                      disabled={movementLimits.x === 0}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Move Up / Down</Label>
                    <Slider
                      min={-movementLimits.y}
                      max={movementLimits.y}
                      step={1}
                      value={[offsetY]}
                      onValueChange={(value) => setOffsetY(value[0])}
                      disabled={movementLimits.y === 0}
                    />
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={resetEditor}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveEditedAvatar}
                  disabled={uploadAvatarMutation.isPending}
                >
                  Save Photo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
