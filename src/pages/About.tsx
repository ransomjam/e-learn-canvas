import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, Zap, Star, Globe, Heart } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';

const values = [
    {
        icon: BookOpen,
        title: 'Expert-Led Learning',
        description:
            'Every course is crafted and reviewed by real industry practitioners, ensuring you learn skills that are actually used on the job.',
    },
    {
        icon: Users,
        title: 'Community First',
        description:
            'Learning is better together. Our platform fosters peer discussion, project sharing, and collaborative growth.',
    },
    {
        icon: Zap,
        title: 'Practical & Project-Based',
        description:
            'No fluff. Every course includes hands-on projects, quizzes, and real-world challenges to cement your understanding.',
    },
    {
        icon: Globe,
        title: 'Accessible Anywhere',
        description:
            'Learn on any device, at your own pace.  Whether you have 10 minutes or 10 hours, Cradema fits your schedule.',
    },
    {
        icon: Star,
        title: 'Quality Guaranteed',
        description:
            'Our editorial team rigorously vets every instructor and curriculum to maintain the highest standards of education.',
    },
    {
        icon: Heart,
        title: 'Built with Passion',
        description:
            'We are educators and developers who believe that access to great education should be simple, affordable, and joyful.',
    },
];

const About = () => {
    return (
        <Layout>
            {/* Hero */}
            <section className="relative overflow-hidden py-20 sm:py-28">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
                    <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-accent/15 blur-[100px]" />
                </div>

                <div className="container relative mx-auto px-4 text-center">
                    <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary mb-6">
                        Our Story
                    </span>
                    <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-foreground max-w-3xl mx-auto">
                        We Are{' '}
                        <span className="text-gradient">Cradema</span>
                    </h1>
                    <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
                        Cradema is an e-learning platform built by educators for learners. Our mission is to
                        make world-class technical education accessible, engaging, and career-ready — for everyone.
                    </p>
                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/courses">
                            <Button size="lg" className="font-semibold h-11 w-full sm:w-auto">
                                Explore Courses <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                        <Link to="/contact">
                            <Button variant="outline" size="lg" className="font-semibold h-11 w-full sm:w-auto">
                                Contact Us
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Mission & Vision */}
            <section className="py-16 sm:py-20 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
                <div className="container mx-auto px-4">
                    <div className="grid gap-8 md:grid-cols-2">
                        {/* Mission */}
                        <div className="rounded-2xl border border-border bg-card p-8 hover:border-primary/40 transition-colors">
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                                <Zap className="h-6 w-6 text-primary" />
                            </div>
                            <h2 className="font-display text-2xl font-bold text-foreground mb-3">Our Mission</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                To empower individuals across the globe with practical, high-quality digital skills
                                that open doors to better opportunities, higher income, and more fulfilling careers —
                                regardless of background or geography.
                            </p>
                        </div>

                        {/* Vision */}
                        <div className="rounded-2xl border border-border bg-card p-8 hover:border-primary/40 transition-colors">
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                                <Globe className="h-6 w-6 text-accent" />
                            </div>
                            <h2 className="font-display text-2xl font-bold text-foreground mb-3">Our Vision</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                A world where anyone with an internet connection can acquire job-ready skills from
                                the best teachers on the planet — and where instructors are empowered to share their
                                expertise and build a sustainable teaching career.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="py-16 sm:py-20">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
                            What We Stand For
                        </h2>
                        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                            Six core values that guide every decision we make at Cradema.
                        </p>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {values.map((v) => (
                            <div
                                key={v.title}
                                className="group rounded-xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                            >
                                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                    <v.icon className="h-5 w-5 text-primary" />
                                </div>
                                <h3 className="font-semibold text-foreground mb-2">{v.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="relative overflow-hidden py-16 sm:py-20">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
                </div>
                <div className="container relative mx-auto px-4 text-center">
                    <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground max-w-xl mx-auto">
                        Ready to Start Your Journey?
                    </h2>
                    <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
                        Join thousands of learners who are already levelling up their careers with Cradema.
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/auth?mode=signup">
                            <Button size="lg" className="font-semibold h-11 w-full sm:w-auto">
                                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                        <Link to="/courses">
                            <Button variant="outline" size="lg" className="font-semibold h-11 w-full sm:w-auto">
                                Browse Courses
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>
        </Layout>
    );
};

export default About;
