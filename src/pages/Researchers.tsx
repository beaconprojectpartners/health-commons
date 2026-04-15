import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Database, Download, Filter, Key } from "lucide-react";

const features = [
  { icon: Filter, title: "Advanced Filters", desc: "Filter by condition, symptom, treatment, lab result, region, and more." },
  { icon: Download, title: "CSV & JSON Export", desc: "Download filtered datasets with full data dictionaries included." },
  { icon: Key, title: "API Access", desc: "Programmatic access with rate-limited API keys for your research pipeline." },
  { icon: Database, title: "Open Data", desc: "No paywalls. Free forever. Attribution to workingTitle encouraged." },
];

const Researchers = () => (
  <div className="min-h-screen">
    <Navbar />
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-4 text-4xl text-foreground">For Researchers</h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Access crowdsourced patient data for your research. Create a free account
            to filter, explore, and export the full dataset.
          </p>
          <Link to="/auth?role=researcher">
            <Button size="lg" className="px-8">Create Free Account</Button>
          </Link>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-2">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <Icon className="mb-3 h-6 w-6 text-primary" />
              <h3 className="mb-2 font-heading text-lg text-card-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-2xl rounded-xl border border-border bg-secondary/30 p-6">
          <h3 className="mb-3 font-heading text-lg text-foreground">Data Use Terms</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Data is anonymized and must not be used for re-identification</li>
            <li>• Not for commercial resale</li>
            <li>• Attribution to workingTitle encouraged in publications</li>
            <li>• Each export includes schema version, timestamps, and audit trail</li>
          </ul>
        </div>
      </div>
    </section>
    <Footer />
  </div>
);

export default Researchers;
