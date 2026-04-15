import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Database, Users } from "lucide-react";

const HeroSection = () => (
  <section className="relative overflow-hidden py-20 md:py-32">
    {/* Gradient background */}
    <div className="absolute inset-0 gradient-hero opacity-[0.06]" />
    <div className="container relative mx-auto px-4">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
          <Shield className="h-3.5 w-3.5" />
          Open-source · Privacy-first · Patient-driven
        </div>
        <h1 className="mb-6 text-4xl leading-tight text-foreground md:text-6xl">
          One patient's story is anecdotal.{" "}
          <span className="text-primary">A million patients' stories are a dataset.</span>
        </h1>
        <p className="mb-10 text-lg text-muted-foreground md:text-xl">
          CrowdDx crowdsources real-world symptom and treatment data into open, global research.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link to="/submit">
            <Button size="lg" className="gap-2 px-8">
              Share Your Story <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/researchers">
            <Button variant="outline" size="lg" className="px-8">
              I'm a Researcher
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-auto mt-20 grid max-w-2xl grid-cols-3 gap-6">
        {[
          { icon: Users, label: "Conditions Tracked", value: "15+" },
          { icon: Database, label: "Open Dataset", value: "Free" },
          { icon: Shield, label: "Privacy", value: "Anonymous" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="text-center">
            <Icon className="mx-auto mb-2 h-5 w-5 text-primary" />
            <div className="font-heading text-2xl text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HeroSection;
