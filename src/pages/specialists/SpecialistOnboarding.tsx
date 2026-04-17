import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const SpecialistOnboarding = () => (
  <div className="flex min-h-screen flex-col">
    <Navbar />
    <section className="flex flex-1 items-center justify-center py-16">
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-3 font-heading text-3xl text-foreground">Specialist onboarding</h1>
        <p className="mb-6 text-muted-foreground">
          New reviewers complete 15 calibration items (80% pass) and 20 shadow-review decisions before full access. The
          interactive flow lands once an admin seeds the calibration items.
        </p>
        <Link to="/"><Button variant="outline">Back home</Button></Link>
      </div>
    </section>
    <Footer />
  </div>
);

export default SpecialistOnboarding;
