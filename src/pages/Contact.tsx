import { useState } from 'react';
import {
    Mail, Linkedin, Github, Twitter, Globe,
    MapPin, Clock, ChevronDown, ChevronUp, Send,
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const faqs = [
    {
        q: 'How do I enrol in a course?',
        a: 'Browse the Courses page, click on any course that interests you, and follow the enrolment or payment steps. Some courses are free; others require a one-time payment.',
    },
    {
        q: 'Can I become an instructor on Cradema?',
        a: 'Yes! Register or log in, then choose the "Instructor" role. You can create and publish courses from your Instructor Dashboard.',
    },
    {
        q: 'How do I reset my password?',
        a: 'Click "Forgot Password" on the login page, enter your email address, and follow the link we send you.',
    },
    {
        q: 'Is my payment information secure?',
        a: 'All payments are processed through Paystack, a PCI-DSS compliant payment provider. We never store your card details.',
    },
    {
        q: 'Can I access courses offline?',
        a: 'Not currently — a stable internet connection is required to stream course videos. We are exploring offline options for a future release.',
    },
];

const Contact = () => {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [sending, setSending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim() || !message.trim()) {
            toast({ title: 'Please fill in all fields', variant: 'destructive' });
            return;
        }
        setSending(true);
        // Simulate sending (replace with real API call if backend is set up)
        await new Promise((r) => setTimeout(r, 1200));
        setSending(false);
        toast({
            title: 'Message sent!',
            description: "Thanks for reaching out. We'll get back to you within 24 hours.",
        });
        setName('');
        setEmail('');
        setMessage('');
    };

    return (
        <Layout>
            {/* Hero */}
            <section className="relative overflow-hidden py-20 sm:py-28">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/20 blur-[100px]" />
                    <div className="absolute -right-40 top-20 h-80 w-80 rounded-full bg-accent/15 blur-[100px]" />
                </div>
                <div className="container relative mx-auto px-4 text-center">
                    <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary mb-6">
                        Get In Touch
                    </span>
                    <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground max-w-2xl mx-auto">
                        We'd Love to <span className="text-gradient">Hear From You</span>
                    </h1>
                    <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                        Have a question, partnership idea, or just want to say hello? Reach out and our team
                        will respond within one business day.
                    </p>
                </div>
            </section>

            <section className="py-12 sm:py-16">
                <div className="container mx-auto px-4">
                    <div className="grid gap-12 lg:grid-cols-2">

                        {/* Contact Info */}
                        <div className="space-y-8">
                            <div>
                                <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                                    Contact Info
                                </h2>

                                <div className="space-y-5">
                                    <a
                                        href="mailto:hello@cradema.com"
                                        className="flex items-center gap-4 group"
                                    >
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
                                            <Mail className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Email us at</p>
                                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                                                hello@cradema.com
                                            </p>
                                        </div>
                                    </a>

                                    <div className="flex items-center gap-4">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                                            <Clock className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Support hours</p>
                                            <p className="font-medium text-foreground">Mon – Fri, 9am – 6pm WAT</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                                            <MapPin className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Based in</p>
                                            <p className="font-medium text-foreground">Lagos, Nigeria 🇳🇬</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Social Links */}
                            <div>
                                <h3 className="font-semibold text-foreground mb-4">Follow Us</h3>
                                <div className="flex items-center gap-3">
                                    {[
                                        { icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn', color: 'hover:bg-blue-600' },
                                        { icon: Github, href: 'https://github.com', label: 'GitHub', color: 'hover:bg-gray-700' },
                                        { icon: Twitter, href: 'https://twitter.com', label: 'Twitter / X', color: 'hover:bg-sky-500' },
                                        { icon: Globe, href: 'https://cradema.com', label: 'Website', color: 'hover:bg-primary' },
                                    ].map(({ icon: Icon, href, label, color }) => (
                                        <a
                                            key={label}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={label}
                                            className={`flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:text-white ${color} transition-all duration-200`}
                                        >
                                            <Icon className="h-4 w-4" />
                                        </a>
                                    ))}
                                </div>
                            </div>

                            {/* FAQ */}
                            <div>
                                <h2 className="font-display text-2xl font-bold text-foreground mb-5">
                                    Frequently Asked Questions
                                </h2>
                                <div className="space-y-3">
                                    {faqs.map((faq, i) => (
                                        <div
                                            key={i}
                                            className="rounded-xl border border-border bg-card overflow-hidden"
                                        >
                                            <button
                                                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-secondary/50 transition-colors"
                                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                            >
                                                <span className="font-medium text-foreground text-sm">{faq.q}</span>
                                                {openFaq === i
                                                    ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                                            </button>
                                            {openFaq === i && (
                                                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                                                    {faq.a}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Contact Form */}
                        <div>
                            <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/5">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-1">
                                    Send a Message
                                </h2>
                                <p className="text-sm text-muted-foreground mb-8">
                                    Fill in the form and we'll get back to you shortly.
                                </p>

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <Label htmlFor="contact-name">Your Name</Label>
                                        <Input
                                            id="contact-name"
                                            placeholder="Jane Doe"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="contact-email">Email Address</Label>
                                        <Input
                                            id="contact-email"
                                            type="email"
                                            placeholder="jane@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="contact-message">Message</Label>
                                        <textarea
                                            id="contact-message"
                                            rows={6}
                                            placeholder="Tell us how we can help…"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            className="mt-2 w-full rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                        />
                                    </div>
                                    <Button type="submit" className="w-full h-11 font-semibold" disabled={sending}>
                                        {sending ? (
                                            <span className="flex items-center gap-2">
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                                Sending…
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <Send className="h-4 w-4" />
                                                Send Message
                                            </span>
                                        )}
                                    </Button>
                                </form>
                            </div>
                        </div>

                    </div>
                </div>
            </section>
        </Layout>
    );
};

export default Contact;
