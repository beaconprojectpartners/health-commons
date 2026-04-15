import { Shield, Lock, Eye } from "lucide-react";

const PrivacyBanner = () => (
  <section className="py-16">
    <div className="container mx-auto px-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-primary/10 bg-primary/5 p-8 text-center">
        <Shield className="mx-auto mb-4 h-8 w-8 text-primary" />
        <h2 className="mb-3 text-2xl text-foreground">Your Privacy Is Sacred</h2>
        <p className="mb-6 text-muted-foreground">
          We believe patients should control their data. No account required to submit.
          No identifying information is ever shared with researchers.
        </p>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            No account required
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            You choose your sharing level
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            PII stored separately, never exported
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default PrivacyBanner;
