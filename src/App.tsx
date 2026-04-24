import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import Conditions from "./pages/Conditions";
import ConditionDetail from "./pages/ConditionDetail";
import Submit from "./pages/Submit";
import Researchers from "./pages/Researchers";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Community from "./pages/Community";
import NotFound from "./pages/NotFound";
import { SessionGuard } from "./components/auth/SessionGuard";
import SpecialistApply from "./pages/specialists/Apply";
import SpecialistsHub from "./pages/specialists/SpecialistsHub";
import Panels from "./pages/specialists/Panels";
import Clusters from "./pages/specialists/Clusters";
import Governance from "./pages/governance/Governance";
import TransparencyLog from "./pages/governance/TransparencyLog";
import Elections from "./pages/governance/Elections";
import Juries from "./pages/governance/Juries";
import AdminSpecialists from "./pages/admin/AdminSpecialists";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionGuard />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/conditions" element={<Conditions />} />
          <Route path="/conditions/:slug" element={<ConditionDetail />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/researchers" element={<Researchers />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/community" element={<Community />} />
          <Route path="/specialists" element={<SpecialistsHub />} />
          <Route path="/specialists/apply" element={<SpecialistApply />} />
          <Route path="/specialists/panels" element={<Panels />} />
          <Route path="/specialists/clusters" element={<Clusters />} />
          <Route path="/governance" element={<Governance />} />
          <Route path="/governance/log" element={<TransparencyLog />} />
          <Route path="/governance/elections" element={<Elections />} />
          <Route path="/governance/juries" element={<Juries />} />
          <Route path="/admin/specialists" element={<AdminSpecialists />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
