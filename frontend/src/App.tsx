import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import Dashboard from "@/pages/Dashboard";
import CorporateModel from "@/pages/CorporateModel";
import ProjectFinance from "@/pages/ProjectFinance";
import Acquisition from "@/pages/Acquisition";
import Valuation from "@/pages/Valuation";
import RiskAnalysis from "@/pages/RiskAnalysis";
import MonteCarlo from "@/pages/MonteCarlo";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/corporate" element={<CorporateModel />} />
              <Route path="/project" element={<ProjectFinance />} />
              <Route path="/acquisition" element={<Acquisition />} />
              <Route path="/valuation" element={<Valuation />} />
              <Route path="/risk" element={<RiskAnalysis />} />
              <Route path="/monte-carlo" element={<MonteCarlo />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
