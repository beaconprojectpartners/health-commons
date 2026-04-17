import Navbar from "@/components/Navbar";
import ConditionList from "@/components/ConditionList";
import Footer from "@/components/Footer";

const Conditions = () => (
  <div className="flex min-h-screen flex-col">
    <Navbar />
    <main className="flex-1 pt-8">
      <ConditionList />
    </main>
    <Footer />
  </div>
);

export default Conditions;
