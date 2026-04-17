import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, Menu, X, LogOut, User } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user, loading, signOut } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" />
          <span className="font-heading text-xl text-foreground">DxCommons</span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-6 md:flex">
          <Link to="/conditions" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Conditions
          </Link>
          <Link to="/submit" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Submit Data
          </Link>
          <Link to="/community" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Community
          </Link>
          <Link to="/researchers" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            For Researchers
          </Link>
          {!loading && (
            user ? (
              <div className="flex items-center gap-3">
                <Link to="/profile">
                  <Button size="sm" variant="outline">
                    <User className="mr-1.5 h-4 w-4" /> Profile
                  </Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Link to="/auth">
                <Button size="sm">Sign In</Button>
              </Link>
            )
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-background p-4 md:hidden">
          <div className="flex flex-col gap-3">
            <Link to="/conditions" onClick={() => setOpen(false)} className="text-sm text-muted-foreground">Conditions</Link>
            <Link to="/submit" onClick={() => setOpen(false)} className="text-sm text-muted-foreground">Submit Data</Link>
            <Link to="/community" onClick={() => setOpen(false)} className="text-sm text-muted-foreground">Community</Link>
            <Link to="/researchers" onClick={() => setOpen(false)} className="text-sm text-muted-foreground">For Researchers</Link>
            {!loading && (
              user ? (
                <>
                  <Link to="/profile" onClick={() => setOpen(false)} className="text-sm text-muted-foreground">Profile</Link>
                  <Button size="sm" variant="ghost" onClick={() => { signOut(); setOpen(false); }}>Sign Out</Button>
                </>
              ) : (
                <Link to="/auth" onClick={() => setOpen(false)}>
                  <Button size="sm" className="w-full">Sign In</Button>
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
