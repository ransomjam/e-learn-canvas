import { Link } from 'react-router-dom';
import { Linkedin, Github, Twitter, Globe } from 'lucide-react';
import Logo from '@/components/common/Logo';

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-10">

        {/* Top: Brand + link columns */}
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">

          {/* Brand */}
          <div className="flex flex-col gap-3 max-w-xs">
            <Link to="/" className="flex items-center gap-2 w-fit">
              <Logo size="sm" className="h-7 w-7" />
              <span className="font-display text-lg font-bold">
                Cra<span className="text-primary">dema</span>
              </span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Expert-led courses that turn curiosity into career-ready skills.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-2 mt-1">
              {[
                { icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' },
                { icon: Github, href: 'https://github.com', label: 'GitHub' },
                { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
                { icon: Globe, href: '/', label: 'Website' },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          <div className="flex flex-wrap gap-10 text-sm">
            {/* Platform */}
            <div>
              <p className="mb-3 font-semibold text-foreground text-xs uppercase tracking-widest">Platform</p>
              <nav className="flex flex-col gap-2 text-muted-foreground">
                <Link to="/courses" className="transition-colors hover:text-primary">Courses</Link>
                <Link to="/about" className="transition-colors hover:text-primary">About</Link>
                <Link to="/contact" className="transition-colors hover:text-primary">Contact</Link>
              </nav>
            </div>

            {/* Legal */}
            <div>
              <p className="mb-3 font-semibold text-foreground text-xs uppercase tracking-widest">Legal</p>
              <nav className="flex flex-col gap-2 text-muted-foreground">
                <Link to="/privacy" className="transition-colors hover:text-primary">Privacy Policy</Link>
                <Link to="/terms" className="transition-colors hover:text-primary">Terms of Service</Link>
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t border-border pt-5">
          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Cradema. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
