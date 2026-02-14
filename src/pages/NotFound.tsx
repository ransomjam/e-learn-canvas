import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted px-4 py-12 sm:py-20">
      <div className="text-center max-w-sm">
        <AlertCircle className="mx-auto h-16 w-16 text-muted-foreground sm:h-20 sm:w-20" />
        <h1 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl sm:mt-6">404</h1>
        <p className="mt-2 text-base text-muted-foreground sm:mt-3 sm:text-lg">Page not found</p>
        <p className="mt-2 text-sm text-muted-foreground">Sorry, the page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="w-full sm:w-auto mt-6 block">
          <Button className="w-full sm:w-auto h-11 font-semibold">Return to Home</Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
