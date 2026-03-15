import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, Mail, Users, GraduationCap, BookOpen, UserCheck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

type RecipientType = 'all' | 'students' | 'instructors' | 'course' | 'custom';

interface SendEmailPayload {
    recipients: RecipientType;
    subject: string;
    message: string;
    courseId?: string;
    emails?: string[];
}

const AdminEmail = () => {
    const { toast } = useToast();
    const [recipients, setRecipients] = useState<RecipientType>('all');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [courseId, setCourseId] = useState('');
    const [customEmails, setCustomEmails] = useState('');

    // Fetch courses for the course dropdown
    const { data: coursesData } = useQuery({
        queryKey: ['adminCourses'],
        queryFn: async () => {
            const res = await api.get('/admin/courses', { params: { limit: 200 } });
            return res.data.data.courses;
        },
    });

    const sendEmailMutation = useMutation({
        mutationFn: async (payload: SendEmailPayload) => {
            const res = await api.post('/admin/send-email', payload);
            return res.data;
        },
        onSuccess: (data) => {
            toast({
                title: 'Email Sent Successfully',
                description: data.message,
            });
            setSubject('');
            setMessage('');
            setCustomEmails('');
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'Failed to send email',
                description: error?.response?.data?.message || 'Something went wrong',
            });
        },
    });

    const handleSend = () => {
        if (!subject.trim()) {
            toast({ variant: 'destructive', title: 'Subject is required' });
            return;
        }
        if (!message.trim()) {
            toast({ variant: 'destructive', title: 'Message body is required' });
            return;
        }
        if (recipients === 'course' && !courseId) {
            toast({ variant: 'destructive', title: 'Please select a course' });
            return;
        }
        if (recipients === 'custom' && !customEmails.trim()) {
            toast({ variant: 'destructive', title: 'Please enter at least one email address' });
            return;
        }

        const payload: SendEmailPayload = { recipients, subject, message };
        if (recipients === 'course') payload.courseId = courseId;
        if (recipients === 'custom') {
            payload.emails = customEmails.split(/[,;\n]+/).map(e => e.trim()).filter(Boolean);
        }
        sendEmailMutation.mutate(payload);
    };

    const recipientOptions: { value: RecipientType; label: string; description: string; icon: React.ElementType; color: string }[] = [
        { value: 'all', label: 'All Users', description: 'Everyone on the platform', icon: Users, color: 'text-blue-500' },
        { value: 'students', label: 'All Students', description: 'Learners only', icon: GraduationCap, color: 'text-emerald-500' },
        { value: 'instructors', label: 'All Instructors', description: 'Instructors only', icon: UserCheck, color: 'text-violet-500' },
        { value: 'course', label: 'Course Students', description: 'Students in a specific course', icon: BookOpen, color: 'text-amber-500' },
        { value: 'custom', label: 'Custom Emails', description: 'Enter specific addresses', icon: Mail, color: 'text-rose-500' },
    ];

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Mail className="h-5 w-5 text-primary" />
                        </div>
                        Send Email
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Compose and send branded emails to your users directly from the admin panel.
                    </p>
                </div>

                {/* Recipients Selection */}
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-foreground mb-4">Recipients</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {recipientOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setRecipients(opt.value)}
                                className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                                    recipients === opt.value
                                        ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                                        : 'border-border hover:border-primary/30 hover:bg-secondary/30'
                                }`}
                            >
                                <opt.icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${recipients === opt.value ? 'text-primary' : opt.color}`} />
                                <div>
                                    <p className={`text-sm font-semibold ${recipients === opt.value ? 'text-primary' : 'text-foreground'}`}>
                                        {opt.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Course selector */}
                    {recipients === 'course' && (
                        <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                            <label className="block text-sm font-medium text-foreground mb-2">Select Course</label>
                            <select
                                value={courseId}
                                onChange={(e) => setCourseId(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="">-- Choose a course --</option>
                                {coursesData?.map((course: any) => (
                                    <option key={course.id} value={course.id}>
                                        {course.title} ({course.enrollmentCount} students)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Custom emails */}
                    {recipients === 'custom' && (
                        <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Email Addresses
                                <span className="text-muted-foreground font-normal ml-1">(comma or newline separated)</span>
                            </label>
                            <Textarea
                                value={customEmails}
                                onChange={(e) => setCustomEmails(e.target.value)}
                                placeholder="user1@example.com, user2@example.com"
                                rows={3}
                                className="resize-none"
                            />
                            {customEmails.trim() && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {customEmails.split(/[,;\n]+/).map(e => e.trim()).filter(Boolean).length} email(s) entered
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Compose Email */}
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
                    <h2 className="text-lg font-semibold text-foreground mb-1">Compose Email</h2>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Subject</label>
                        <Input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Enter email subject..."
                            className="text-base"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Message</label>
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Write your message here... (supports line breaks)"
                            rows={10}
                            className="resize-y text-base leading-relaxed"
                        />
                        <p className="mt-1.5 text-xs text-muted-foreground">
                            Your message will be wrapped in the branded Cradema email template with logo, colors, and a "Visit Cradema" button.
                        </p>
                    </div>
                </div>

                {/* Send Button */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                            {recipients === 'custom'
                                ? `${customEmails.split(/[,;\n]+/).map(e => e.trim()).filter(Boolean).length || 0} recipients`
                                : recipients === 'course'
                                    ? `Course: ${coursesData?.find((c: any) => c.id === courseId)?.title || 'None selected'}`
                                    : recipientOptions.find(o => o.value === recipients)?.label
                            }
                        </Badge>
                    </div>
                    <Button
                        onClick={handleSend}
                        disabled={sendEmailMutation.isPending || !subject.trim() || !message.trim()}
                        size="lg"
                        className="gap-2 min-w-[160px]"
                    >
                        {sendEmailMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                Send Email
                            </>
                        )}
                    </Button>
                </div>

                {/* Result */}
                {sendEmailMutation.isSuccess && sendEmailMutation.data && (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 animate-in fade-in duration-300">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-emerald-400">{sendEmailMutation.data.message}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Sent: {sendEmailMutation.data.data.sent} • Failed: {sendEmailMutation.data.data.failed} • Total: {sendEmailMutation.data.data.totalRecipients}
                            </p>
                        </div>
                    </div>
                )}

                {sendEmailMutation.isError && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 animate-in fade-in duration-300">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="font-medium text-red-400">
                            {(sendEmailMutation.error as any)?.response?.data?.message || 'Failed to send email'}
                        </p>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminEmail;
