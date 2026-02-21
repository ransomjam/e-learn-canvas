import Layout from '@/components/layout/Layout';

const Terms = () => {
    return (
        <Layout>
            <div className="container mx-auto px-4 py-16 md:py-24 max-w-4xl animate-fade-in">
                <h1 className="font-display text-4xl md:text-5xl font-bold mb-8 text-foreground text-gradient">Terms of Service</h1>

                <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-muted-foreground">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Acceptance of Terms</h2>
                    <p>
                        By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.
                        In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.
                        Any participation in this service will constitute acceptance of this agreement. If you do not agree to abide by the above, please do not use this service.
                    </p>

                    <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. User Accounts</h2>
                    <p>
                        When you create an account with us, you must provide us information that is accurate, complete, and current at all times.
                        Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                    </p>
                    <p>
                        You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password,
                        whether your password is with our Service or a third-party service.
                    </p>

                    <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. Intellectual Property Rights</h2>
                    <p>
                        The Service and its original content, features and functionality are and will remain the exclusive property of Cradema and its licensors.
                        The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries.
                        Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Cradema.
                    </p>

                    <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. Course Enrollment and Access</h2>
                    <p>
                        When you enroll in a course, you get a license from us to view it via the Cradema platform and no other use.
                        Don't try to transfer or resell courses in any way. We grant you a limited, non-exclusive, non-transferable license to
                        access and view the courses and associated content for which you have paid all required fees, solely for your personal,
                        non-commercial, educational purposes through the Services.
                    </p>

                    <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Instructor Terms</h2>
                    <p>
                        If you publish a course on the platform, you must also agree to the Instructor Terms.
                        You grant us a license to offer a license to the content to students. We have the right to sublicense the content to enrolled students.
                    </p>

                    <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Termination</h2>
                    <p>
                        We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever,
                        including without limitation if you breach the Terms.
                        Upon termination, your right to use the Service will immediately cease.
                    </p>

                    <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">7. Changes to Terms</h2>
                    <p>
                        We reserve the right, at our sole discretion, to modify or replace these Terms at any time.
                        If a revision is material we will try to provide at least 30 days notice prior to any new terms taking effect.
                        What constitutes a material change will be determined at our sole discretion.
                    </p>
                </div>
            </div>
        </Layout>
    );
};

export default Terms;
