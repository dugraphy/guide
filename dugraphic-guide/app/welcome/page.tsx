import type { Metadata } from "next";
import { Unbounded } from "next/font/google";
import LandingPage from "@/components/marketing/LandingPage";
import "./landing.css";

const display = Unbounded({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dugraphic Guide — DU Studio OS",
  description: "DU 스튜디오의 견적서, 클라이언트 인테이크, 체크리스트, 워크스페이스를 운영하는 내부 시스템.",
};

export default function WelcomePage() {
  return (
    <div className={display.variable}>
      <LandingPage />
    </div>
  );
}
