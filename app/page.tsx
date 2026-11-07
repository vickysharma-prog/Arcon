import { Hero, LandingHeader } from "@/components/landing/Hero";
import { Audience, Faq, Features, FinalCall, Footer, HowItWorks, Market, Pricing, TasteFlow } from "@/components/landing/Sections";
import { QlooStrip } from "@/components/landing/QlooStrip";
import { PlansDemo } from "@/components/landing/PlansDemo";
import { ForPros, Trust } from "@/components/landing/ForPros";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <QlooStrip />
        <HowItWorks />
        <PlansDemo />
        <TasteFlow />
        <Features />
        <Audience />
        <ForPros />
        <Trust />
        <Market />
        <Pricing />
        <Faq />
        <FinalCall />
      </main>
      <Footer />
    </div>
  );
}
