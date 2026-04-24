import { ClipboardList, Database, Download, Users, FlaskConical, HandHeart } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const pathways = [
  {
    role: "Patient",
    icon: HandHeart,
    color: "text-primary",
    bg: "bg-primary/10",
    steps: [
      "Create a free account",
      "Choose your condition(s)",
      "Share symptoms, treatments & outcomes",
      "Optionally enable your profile to connect with others",
    ],
    cta: { label: "Share Your Story", to: "/submit" },
  },
  {
    role: "Specialist",
    icon: FlaskConical,
    color: "text-fuchsia-500",
    bg: "bg-fuchsia-500/10",
    steps: [
      "Sign in and request specialist access",
      "Select a condition to define",
      "Build structured disease profiles (labs, imaging, criteria)",
      "Submit for review and community use",
    ],
    cta: { label: "Apply as Specialist", to: "/specialists/apply" },
  },
  {
    role: "Researcher",
    icon: Download,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    steps: [
      "Register with your institution details",
      "Browse conditions and anonymized submissions",
      "Use the AI-powered dataset discovery tool",
      "Export filtered data as CSV or JSON — free",
    ],
    cta: { label: "Access the Data", to: "/researchers" },
  },
];

const HowItWorks = () => (
  <section className="border-y border-border bg-secondary/30 py-16">
    <div className="container mx-auto px-4">
      <h2 className="mb-4 text-center text-3xl text-foreground">Your Pathway</h2>
      <p className="mb-12 text-center text-muted-foreground">Choose the journey that fits your role</p>
      <div className="grid gap-8 md:grid-cols-3">
        {pathways.map(({ role, icon: Icon, color, bg, steps, cta }) => (
          <div key={role} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl ${bg}`}>
              <Icon className={`h-6 w-6 ${color}`} />
            </div>
            <h3 className="mb-4 text-center font-heading text-xl text-foreground">{role}</h3>
            <ol className="mb-6 space-y-3">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${color === "text-primary" ? "bg-primary" : color === "text-fuchsia-500" ? "bg-fuchsia-500" : "bg-blue-500"}`}>
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <Link to={cta.to} className="block">
              <Button variant="outline" className="w-full">{cta.label}</Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
