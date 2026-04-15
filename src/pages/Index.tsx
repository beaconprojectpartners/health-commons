import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import ConditionList from "@/components/ConditionList";
import PrivacyBanner from "@/components/PrivacyBanner";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen">
    <Navbar />
    <HeroSection />
    <HowItWorks />
    <ConditionList />
    <PrivacyBanner />
    <Footer />
  </div>
);

export default Index;
