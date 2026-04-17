import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t border-border bg-secondary/50 py-12">
    <div className="container mx-auto px-4">
      <div className="grid gap-8 md:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <span className="font-heading text-lg text-foreground">DxCommons</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Crowdsourced medical data for researchers. Built by patients, for science.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">Navigate</h4>
          <div className="flex flex-col gap-2">
            <Link to="/conditions" className="text-sm text-muted-foreground hover:text-foreground">Conditions</Link>
            <Link to="/submit" className="text-sm text-muted-foreground hover:text-foreground">Submit Data</Link>
            <Link to="/researchers" className="text-sm text-muted-foreground hover:text-foreground">For Researchers</Link>
          </div>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">Open Data</h4>
          <p className="text-sm text-muted-foreground">
            All data is anonymized and freely available for medical research. Attribution encouraged.
          </p>
        </div>
      </div>
      <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} DxCommons · Open-source medical research data
      </div>
    </div>
  </footer>
);

export default Footer;
