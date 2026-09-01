import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center bg-card border border-border rounded-2xl p-10 shadow-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <span className="text-2xl font-bold text-primary">404</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Stránka neexistuje</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Cesta <code className="font-mono text-xs bg-accent px-1.5 py-0.5 rounded">{location.pathname}</code> v wpBOX nie je dostupná.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-google-blue-hover transition-colors"
        >
          <ArrowLeft size={16} />
          Späť na wpBOX
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
