import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { pricingPlans } from '@/data/mockData';

const Pricing = () => {
  return (
    <Layout>
      <section className="py-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="accent" className="mb-4">
              <Sparkles className="mr-1 h-3 w-3" />
              Simple Pricing
            </Badge>
            <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">
              Choose Your <span className="text-gradient">Learning Path</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free, upgrade when you're ready. Cancel anytime.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-8 transition-all ${
                  plan.highlighted
                    ? 'border-primary bg-card shadow-glow scale-105'
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary px-4 py-1">Most Popular</Badge>
                  </div>
                )}

                <div className="text-center">
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    {plan.name}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

                  <div className="mt-6">
                    <span className="font-display text-5xl font-bold text-foreground">
                      ${plan.price}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground">/{plan.period}</span>
                    )}
                  </div>
                </div>

                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/auth?mode=signup" className="mt-8 block">
                  <Button
                    variant={plan.highlighted ? 'default' : 'outline'}
                    size="lg"
                    className="w-full"
                  >
                    {plan.price === 0 ? 'Get Started Free' : 'Start Free Trial'}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          {/* FAQ Teaser */}
          <div className="mt-20 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Frequently Asked Questions
            </h2>
            <div className="mx-auto mt-8 grid max-w-3xl gap-6 text-left md:grid-cols-2">
              {[
                {
                  q: 'Can I switch plans later?',
                  a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.',
                },
                {
                  q: 'Is there a free trial?',
                  a: 'Pro and Team plans include a 7-day free trial. No credit card required to start.',
                },
                {
                  q: 'What payment methods do you accept?',
                  a: 'We accept all major credit cards, PayPal, and bank transfers for annual plans.',
                },
                {
                  q: 'Can I get a refund?',
                  a: 'Yes, we offer a 30-day money-back guarantee on all paid plans.',
                },
              ].map((item, index) => (
                <div key={index} className="rounded-xl border border-border bg-card p-6">
                  <h3 className="font-semibold text-foreground">{item.q}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-20 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 p-12 text-center">
            <h2 className="font-display text-3xl font-bold text-foreground">
              Need a custom plan for your organization?
            </h2>
            <p className="mt-2 text-muted-foreground">
              We offer custom enterprise solutions for teams of 50+
            </p>
            <Button size="lg" variant="accent" className="mt-6">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Pricing;
