import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Database, Users } from "lucide-react";

const HeroSection = () => (
  <section className="relative overflow-hidden py-20 md:py-32">
    {/* Gradient background */}
    <div className="absolute inset-0 gradient-hero opacity-[0.06]" />
    <div className="container relative mx-auto px-4">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary sm:rounded-full sm:px-4 sm:text-sm">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          <span>Open-source</span>
          <span aria-hidden="true">·</span>
          <span>Privacy-first</span>
          <span aria-hidden="true">·</span>
          <span>Patient-driven</span>
        </div>
        <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-foreground md:text-7xl lg:text-8xl" style={{ fontFamily: "'Righteous', cursive" }}>
          DxCommons
        </h1>
        <p className="mb-10 text-lg text-muted-foreground md:text-xl lg:text-2xl">
          One patient's story is anecdotal.{" "}
          <span className="text-primary font-semibold">A million patients' stories are a dataset.</span>
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
      {/* Stats */}
      <div className="mx-auto mt-16 flex max-w-3xl flex-wrap justify-center gap-3 sm:gap-4 md:mt-20">
        {[
          { icon: Users, label: "Conditions Tracked", value: "15+" },
          { icon: Database, label: "Open Dataset", value: "Free" },
          { icon: Shield, label: "Privacy", value: "Confidential" },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex min-w-[9rem] flex-1 basis-[9rem] flex-col items-center rounded-xl border border-border/50 bg-card/50 p-4 text-center sm:basis-[10rem]"
          >
            <Icon className="mb-2 h-5 w-5 text-primary" />
            <div className="font-heading text-xl text-foreground sm:text-2xl">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HeroSection;
