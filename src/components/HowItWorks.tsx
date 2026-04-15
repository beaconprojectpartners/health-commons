import { ClipboardList, Database, Download } from "lucide-react";

const steps = [
  {
    icon: ClipboardList,
    title: "Patients Share",
    desc: "Submit your diagnosis journey, symptoms, treatments, and outcomes — anonymously, at your own pace.",
  },
  {
    icon: Database,
    title: "Specialists Define",
    desc: "Medical specialists build structured disease profiles — the labs, imaging, and criteria that matter for each condition.",
  },
  {
    icon: Download,
    title: "Researchers Access",
    desc: "Create a free account to filter, explore, and export the full dataset as CSV or JSON. No paywalls.",
  },
];

const HowItWorks = () => (
  <section className="border-y border-border bg-secondary/30 py-16">
    <div className="container mx-auto px-4">
      <h2 className="mb-12 text-center text-3xl text-foreground">How It Works</h2>
      <div className="grid gap-8 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, desc }, i) => (
          <div key={title} className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="mb-1 text-xs font-medium text-primary">Step {i + 1}</div>
            <h3 className="mb-2 font-heading text-xl text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
