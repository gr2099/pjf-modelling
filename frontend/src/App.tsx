import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Dashboard from "@/pages/Dashboard";
import CorporateModel from "@/pages/CorporateModel";
import ProjectFinance from "@/pages/ProjectFinance";
import Acquisition from "@/pages/Acquisition";
import Valuation from "@/pages/Valuation";
import RiskAnalysis from "@/pages/RiskAnalysis";
import MonteCarlo from "@/pages/MonteCarlo";
import Merger from "@/pages/Merger";
import RealEstate from "@/pages/RealEstate";

function Wrap({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Wrap><Dashboard /></Wrap>} />
              <Route path="/corporate" element={<Wrap><CorporateModel /></Wrap>} />
              <Route path="/project" element={<Wrap><ProjectFinance /></Wrap>} />
              <Route path="/acquisition" element={<Wrap><Acquisition /></Wrap>} />
              <Route path="/merger" element={<Wrap><Merger /></Wrap>} />
              <Route path="/real-estate" element={<Wrap><RealEstate /></Wrap>} />
              <Route path="/valuation" element={<Wrap><Valuation /></Wrap>} />
              <Route path="/risk" element={<Wrap><RiskAnalysis /></Wrap>} />
              <Route path="/monte-carlo" element={<Wrap><MonteCarlo /></Wrap>} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
