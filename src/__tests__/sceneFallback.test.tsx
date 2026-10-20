import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SceneFallback } from "@/components/three/SceneFallback";
import { useCharacterStore } from "@/stores/useCharacterStore";

describe("SceneFallback (non-WebGL / reduced-motion view)", () => {
  it("renders the NEXUS status identity without any 3D context", () => {
    useCharacterStore.setState({ state: "idle" });
    render(<SceneFallback reason="webgl" />);
    expect(screen.getByText(/3D view is unavailable on this device/i)).toBeInTheDocument();
    expect(screen.getByText(/WebGL not detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Standby/i)).toBeInTheDocument();
    expect(screen.getByText(/all analysis features remain fully functional/i)).toBeInTheDocument();
  });

  it("reflects the current character state in the fallback badge", () => {
    useCharacterStore.setState({ state: "highRisk" });
    render(<SceneFallback reason="crash" />);
    expect(screen.getByText(/Alert/i)).toBeInTheDocument();
  });

  it("labels renderer crashes distinctly from missing WebGL", () => {
    useCharacterStore.setState({ state: "error" });
    render(<SceneFallback reason="crash" />);
    expect(screen.getByText(/3D renderer stopped/i)).toBeInTheDocument();
  });
});
