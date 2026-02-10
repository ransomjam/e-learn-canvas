import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, Save, User } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload the file
    uploadAvatarMutation.mutate(file);
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
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
