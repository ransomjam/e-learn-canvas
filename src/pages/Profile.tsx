import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, Mail, Lock, Bell, CreditCard, 
  Shield, Globe, Camera, ChevronRight, Save
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Profile = () => {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'account', label: 'Account', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  return (
    <Layout>
      <div className="py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
            <p className="mt-1 text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>

          <Tabs defaultValue="profile" className="space-y-8">
            <TabsList className="w-full justify-start gap-2 overflow-x-auto border-b border-border bg-transparent p-0">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="relative whitespace-nowrap rounded-none border-b-2 border-transparent px-4 pb-4 pt-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <tab.icon className="mr-2 h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-8">
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold text-foreground">Profile Information</h2>
                <p className="text-sm text-muted-foreground">
                  Update your profile details and public information
                </p>

                <div className="mt-6 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                  <div className="relative">
                    <img
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop"
                      alt="Profile"
                      className="h-24 w-24 rounded-full object-cover"
                    />
                    <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Profile Photo</p>
                    <p className="text-sm text-muted-foreground">
                      JPG, GIF or PNG. Max size 2MB.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-6 md:grid-cols-2">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" defaultValue="Alex" className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" defaultValue="Thompson" className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" defaultValue="alex@example.com" className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" defaultValue="alexthompson" className="mt-2" />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="bio">Bio</Label>
                    <textarea
                      id="bio"
                      rows={4}
                      className="mt-2 w-full rounded-lg border border-border bg-secondary px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      defaultValue="Software developer passionate about learning new technologies."
                    />
                  </div>
                </div>

                <Button className="mt-6">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </TabsContent>

            {/* Account Tab */}
            <TabsContent value="account" className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold text-foreground">Password</h2>
                <p className="text-sm text-muted-foreground">
                  Change your password to keep your account secure
                </p>

                <div className="mt-6 max-w-md space-y-4">
                  <div>
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input id="currentPassword" type="password" className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input id="newPassword" type="password" className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input id="confirmPassword" type="password" className="mt-2" />
                  </div>
                  <Button>Update Password</Button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold text-foreground">Two-Factor Authentication</h2>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Authenticator App</p>
                      <p className="text-sm text-muted-foreground">Not configured</p>
                    </div>
                  </div>
                  <Button variant="outline">Enable</Button>
                </div>
              </div>

              <div className="rounded-xl border border-destructive/50 bg-card p-6">
                <h2 className="font-semibold text-destructive">Danger Zone</h2>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
                <Button variant="destructive" className="mt-4">
                  Delete Account
                </Button>
              </div>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold text-foreground">Email Notifications</h2>
                <p className="text-sm text-muted-foreground">
                  Manage what emails you receive from us
                </p>

                <div className="mt-6 space-y-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">Course Updates</p>
                      <p className="text-sm text-muted-foreground">
                        Get notified when courses you're enrolled in are updated
                      </p>
                    </div>
                    <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">Weekly Digest</p>
                      <p className="text-sm text-muted-foreground">
                        Receive a weekly summary of your learning progress
                      </p>
                    </div>
                    <Switch checked={weeklyDigest} onCheckedChange={setWeeklyDigest} />
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Get push notifications on your devices
                      </p>
                    </div>
                    <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Billing Tab */}
            <TabsContent value="billing" className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-foreground">Current Plan</h2>
                    <p className="text-sm text-muted-foreground">
                      You're currently on the Pro plan
                    </p>
                  </div>
                  <div className="rounded-lg bg-primary/10 px-4 py-2">
                    <span className="font-semibold text-primary">Pro</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Next billing date</p>
                    <p className="font-medium text-foreground">March 15, 2024</p>
                  </div>
                  <Link to="/pricing">
                    <Button variant="outline">
                      Change Plan
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold text-foreground">Payment Method</h2>
                <p className="text-sm text-muted-foreground">
                  Manage your payment methods
                </p>

                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <CreditCard className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">•••• •••• •••• 4242</p>
                      <p className="text-sm text-muted-foreground">Expires 12/2025</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Update
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold text-foreground">Billing History</h2>
                <div className="mt-4 space-y-3">
                  {[
                    { date: 'Feb 15, 2024', amount: '$29.00', status: 'Paid' },
                    { date: 'Jan 15, 2024', amount: '$29.00', status: 'Paid' },
                    { date: 'Dec 15, 2023', amount: '$29.00', status: 'Paid' },
                  ].map((invoice, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-foreground">{invoice.date}</p>
                        <p className="text-sm text-muted-foreground">Pro Plan - Monthly</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">{invoice.amount}</p>
                        <p className="text-sm text-accent">{invoice.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
