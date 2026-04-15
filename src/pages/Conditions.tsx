import Navbar from "@/components/Navbar";
import ConditionList from "@/components/ConditionList";
import Footer from "@/components/Footer";

const Conditions = () => (
  <div className="min-h-screen">
    <Navbar />
    <div className="pt-8">
      <ConditionList />
    </div>
    <Footer />
  </div>
);

export default Conditions;
