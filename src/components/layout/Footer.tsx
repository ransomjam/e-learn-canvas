import { Link } from 'react-router-dom';
<<<<<<< HEAD
import Logo from '@/components/common/Logo';
=======
>>>>>>> 0a999ef1c7db9892e164ecf68d33fdccd5e26edb

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2">
<<<<<<< HEAD
            <Logo size="sm" className="h-7 w-7" />
            <span className="font-display text-lg font-bold">
              Crad<span className="text-primary">ema</span>
=======
            <img src="/logo.png" alt="Cradema" className="h-8 w-8 rounded-lg" />
            <span className="font-display text-lg font-bold">
              Cra<span className="text-primary">dema</span>
>>>>>>> 0a999ef1c7db9892e164ecf68d33fdccd5e26edb
            </span>
          </Link>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to="/courses" className="transition-colors hover:text-primary">Courses</Link>
            <Link to="/privacy" className="transition-colors hover:text-primary">Privacy</Link>
            <Link to="/terms" className="transition-colors hover:text-primary">Terms</Link>
          </nav>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Cradema. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
