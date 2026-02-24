import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Camera, Save, User, Linkedin, Github, Twitter, Globe,
  Plus, X, Pencil, BriefcaseIcon,
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
const ROLE_LABELS: Record<string, string> = {
  learner: 'Student',
  instructor: 'Instructor',
  admin: 'Admin',
};

const ROLE_COLORS: Record<string, string> = {
  learner: 'bg-blue-500/10 text-blue-500',
  instructor: 'bg-primary/10 text-primary',
  admin: 'bg-red-500/10 text-red-500',
};

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
const Profile = () => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  /* ----------- basic fields ----------- */
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [headline, setHeadline] = useState(user?.headline || '');
  const [bio, setBio] = useState(user?.bio || '');

  /* ----------- social links ----------- */
  const [linkedinUrl, setLinkedinUrl] = useState(user?.linkedinUrl || '');
  const [githubUrl, setGithubUrl] = useState(user?.githubUrl || '');
  const [twitterUrl, setTwitterUrl] = useState(user?.twitterUrl || '');
  const [websiteUrl, setWebsiteUrl] = useState(user?.websiteUrl || '');

  /* ----------- skills ----------- */
  const [skills, setSkills] = useState<string[]>(user?.skills || []);
  const [newSkill, setNewSkill] = useState('');

  /* ----------- avatar / photo editor ----------- */
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

  /* ----------------------------------------------------------------- */
  /*  Photo editor helpers (unchanged from original)                    */
  /* ----------------------------------------------------------------- */
  const resetEditor = () => {
    setSelectedImageSrc(null);
    setSelectedImageDimensions(null);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setIsEditorOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const createEditedAvatarFile = async () => {
    if (!selectedImageSrc || !selectedImageDimensions) return null;
    const image = new Image();
    image.src = selectedImageSrc;
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
    const outputSize = 512;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize; canvas.height = outputSize;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const baseScale = Math.max(outputSize / selectedImageDimensions.width, outputSize / selectedImageDimensions.height);
    const drawWidth = image.width * baseScale * zoom;
    const drawHeight = image.height * baseScale * zoom;
    const drawX = (outputSize - drawWidth) / 2 + (offsetX * outputSize) / previewSize;
    const drawY = (outputSize - drawHeight) / 2 + (offsetY * outputSize) / previewSize;
    context.clearRect(0, 0, outputSize, outputSize);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return null;
    const baseName = selectedImageName.replace(/\.[^.]+$/, '') || 'avatar';
    return new File([blob], `${baseName}-edited.jpg`, { type: 'image/jpeg' });
  };

  const movementLimits = useMemo(() => {
    if (!selectedImageDimensions) return { x: 0, y: 0 };
    const baseScale = Math.max(previewSize / selectedImageDimensions.width, previewSize / selectedImageDimensions.height);
    const drawWidth = selectedImageDimensions.width * baseScale * zoom;
    const drawHeight = selectedImageDimensions.height * baseScale * zoom;
    return { x: Math.max(0, (drawWidth - previewSize) / 2), y: Math.max(0, (drawHeight - previewSize) / 2) };
  }, [previewSize, selectedImageDimensions, zoom]);

  const previewImageStyle = useMemo(() => {
    if (!selectedImageDimensions) return undefined;
    const baseScale = Math.max(previewSize / selectedImageDimensions.width, previewSize / selectedImageDimensions.height);
    const imgW = selectedImageDimensions.width * baseScale;
    const imgH = selectedImageDimensions.height * baseScale;
    return {
      position: 'absolute' as const,
      width: `${imgW}px`, height: `${imgH}px`,
      left: `${(previewSize - imgW) / 2}px`, top: `${(previewSize - imgH) / 2}px`,
    };
  }, [previewSize, selectedImageDimensions]);

  useEffect(() => {
    setOffsetX((c) => Math.min(movementLimits.x, Math.max(-movementLimits.x, c)));
    setOffsetY((c) => Math.min(movementLimits.y, Math.max(-movementLimits.y, c)));
  }, [movementLimits.x, movementLimits.y]);

  /* ----------------------------------------------------------------- */
  /*  Mutations                                                          */
  /* ----------------------------------------------------------------- */
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put('/users/profile', data);
      return response.data;
    },
    onSuccess: () => {
      refreshUser();
      toast({ title: 'Profile updated', description: 'Your profile has been updated successfully.' });
    },
    onError: () => {
      toast({ title: 'Update failed', description: 'Failed to update profile. Please try again.', variant: 'destructive' });
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      return response.data;
    },
    onSuccess: (data) => {
      const avatarUrl = data.data.url;
      updateProfileMutation.mutate({ firstName, lastName, headline, bio, linkedinUrl, githubUrl, twitterUrl, websiteUrl, skills, avatarUrl });
    },
    onError: () => {
      toast({ title: 'Upload failed', description: 'Failed to upload photo. Please try again.', variant: 'destructive' });
      setAvatarPreview(null);
    },
  });

  /* ----------------------------------------------------------------- */
  /*  Handlers                                                           */
  /* ----------------------------------------------------------------- */
  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please select an image under 2MB.', variant: 'destructive' });
      return;
    }
    setSelectedImageName(file.name);
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
      toast({ title: 'Image processing failed', description: 'Unable to prepare your photo. Please try another image.', variant: 'destructive' });
      return;
    }
    const previewUrl = URL.createObjectURL(editedFile);
    setAvatarPreview(previewUrl);
    setIsEditorOpen(false);
    uploadAvatarMutation.mutate(editedFile);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ firstName, lastName, headline, bio, linkedinUrl, githubUrl, twitterUrl, websiteUrl, skills });
  };

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
    }
    setNewSkill('');
  };

  const handleRemoveSkill = (skill: string) => setSkills(skills.filter((s) => s !== skill));

  const resolvedAvatar = avatarPreview || resolveMediaUrl(user?.avatarUrl);
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

  /* ----------------------------------------------------------------- */
  /*  Render                                                             */
  /* ----------------------------------------------------------------- */
  return (
    <Layout>
      <div className="pb-16">

        {/* ── Cover / Hero ── */}
        <div
          className="relative h-40 sm:h-52 w-full bg-gradient-to-r from-primary/80 via-primary to-accent/70"
          style={{ backgroundSize: '200% 200%' }}
        >
          {/* subtle animated shimmer */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
        </div>

        {/* ── Profile Header Card ── */}
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="-mt-16 sm:-mt-20 relative z-10">
            <div className="rounded-2xl border border-border bg-card shadow-xl shadow-black/10 p-6 sm:p-8">

              {/* Avatar + Edit row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 mb-6">
                <div className="relative shrink-0">
                  <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full ring-4 ring-card overflow-hidden bg-secondary border border-border">
                    {resolvedAvatar ? (
                      <img src={resolvedAvatar} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <User className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={uploadAvatarMutation.isPending}
                    className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
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

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground truncate">
                      {fullName || 'Your Name'}
                    </h1>
                    {user?.role && (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[user.role] || 'bg-secondary text-muted-foreground'}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    )}
                  </div>
                  {(user?.headline || headline) && (
                    <p className="mt-1 text-muted-foreground text-sm">{headline || user?.headline}</p>
                  )}
                  {user?.email && (
                    <p className="mt-1 text-xs text-muted-foreground/70">{user.email}</p>
                  )}
                </div>
              </div>

              {/* ── Edit Form ── */}
              <form onSubmit={handleSubmit} className="space-y-8">

                {/* Basic Info */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Pencil className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold text-foreground">Basic Information</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-2" />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-2" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={user?.email || ''} disabled className="mt-2 opacity-60" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="headline">Headline / Tagline</Label>
                      <Input
                        id="headline"
                        placeholder="e.g. Full-Stack Developer & Educator"
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                  </div>
                </section>

                <div className="border-t border-border/50" />

                {/* About */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold text-foreground">About</h2>
                  </div>
                  <div className="relative">
                    <textarea
                      id="bio"
                      rows={5}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell your story — who you are, what you do, and what drives you…"
                      className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    <span className="absolute bottom-2.5 right-3 text-[11px] text-muted-foreground/60">
                      {bio.length} chars
                    </span>
                  </div>
                </section>

                <div className="border-t border-border/50" />

                {/* Social Links */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold text-foreground">Social Links</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { id: 'linkedin', icon: Linkedin, label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/you', value: linkedinUrl, set: setLinkedinUrl },
                      { id: 'github', icon: Github, label: 'GitHub URL', placeholder: 'https://github.com/you', value: githubUrl, set: setGithubUrl },
                      { id: 'twitter', icon: Twitter, label: 'Twitter / X URL', placeholder: 'https://twitter.com/you', value: twitterUrl, set: setTwitterUrl },
                      { id: 'website', icon: Globe, label: 'Personal Website', placeholder: 'https://yoursite.com', value: websiteUrl, set: setWebsiteUrl },
                    ].map(({ id, icon: Icon, label, placeholder, value, set }) => (
                      <div key={id}>
                        <Label htmlFor={id}>{label}</Label>
                        <div className="relative mt-2">
                          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id={id}
                            type="url"
                            placeholder={placeholder}
                            value={value}
                            onChange={(e) => set(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="border-t border-border/50" />

                {/* Skills */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <BriefcaseIcon className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold text-foreground">Skills</h2>
                  </div>

                  {/* Chips */}
                  <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="hover:text-red-500 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {skills.length === 0 && (
                      <p className="text-xs text-muted-foreground/60 italic">No skills added yet.</p>
                    )}
                  </div>

                  {/* Add skill input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a skill (e.g. React, Python, UX Design)"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={handleAddSkill}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </section>

                {/* Save */}
                <div className="pt-2">
                  <Button type="submit" disabled={updateProfileMutation.isPending} className="h-11 px-8 font-semibold">
                    <Save className="mr-2 h-4 w-4" />
                    {updateProfileMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ── Photo Editor Dialog (unchanged logic) ── */}
      <Dialog open={isEditorOpen} onOpenChange={(isOpen) => { if (!isOpen) resetEditor(); }}>
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
                <Slider min={1} max={2.8} step={0.05} value={[zoom]} onValueChange={(v) => setZoom(v[0])} />
              </div>
              <div className="space-y-1">
                <Label>Move Left / Right</Label>
                <Slider min={-movementLimits.x} max={movementLimits.x} step={1} value={[offsetX]} onValueChange={(v) => setOffsetX(v[0])} disabled={movementLimits.x === 0} />
              </div>
              <div className="space-y-1">
                <Label>Move Up / Down</Label>
                <Slider min={-movementLimits.y} max={movementLimits.y} step={1} value={[offsetY]} onValueChange={(v) => setOffsetY(v[0])} disabled={movementLimits.y === 0} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={resetEditor}>Cancel</Button>
            <Button type="button" onClick={handleSaveEditedAvatar} disabled={uploadAvatarMutation.isPending}>
              Save Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Profile;
