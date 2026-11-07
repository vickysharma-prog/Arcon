import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Quiz } from "@/components/quiz/Quiz";

export const metadata: Metadata = {
  title: "What's your space style? · Arcon",
  description: "Three taps: a place, a brand and something you love. Arcon reads your space style from them.",
};

export default function QuizPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Quiz />
    </div>
  );
}
