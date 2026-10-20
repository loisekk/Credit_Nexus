"use client";

import dynamic from "next/dynamic";
import { HexagonSpinner } from "@/components/layout/SplashScreen";

// The whole workstation is a client-side WebGL application — loaded without SSR.
const CreditNexusApp = dynamic(() => import("@/CreditNexusApp"), {
  ssr: false,
  loading: () => <HexagonSpinner />,
});

export default function Home() {
  return <CreditNexusApp />;
}
