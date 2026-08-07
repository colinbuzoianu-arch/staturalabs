"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

// Coordinates "only one simulator panel open at a time" across every
// PostureSample rendered on a page — the pages themselves stay Server
// Components (they do prisma/i18n data fetching per sample), so this state
// can't live there. Wrap the whole list of sample rows in
// <SimulatorCoordinator>; each row's <PostureSampleSimulatorToggle> reads
// and drives the shared openSampleId through this context rather than
// holding its own local open/closed state.
type SimulatorCoordinatorContextValue = {
  openSampleId: string | null;
  toggle: (sampleId: string) => void;
};

const SimulatorCoordinatorContext =
  createContext<SimulatorCoordinatorContextValue | null>(null);

export function SimulatorCoordinator({ children }: { children: ReactNode }) {
  const [openSampleId, setOpenSampleId] = useState<string | null>(null);

  const toggle = (sampleId: string) =>
    setOpenSampleId((current) => (current === sampleId ? null : sampleId));

  return (
    <SimulatorCoordinatorContext.Provider value={{ openSampleId, toggle }}>
      {children}
    </SimulatorCoordinatorContext.Provider>
  );
}

export function useSimulatorCoordinator(): SimulatorCoordinatorContextValue {
  const context = useContext(SimulatorCoordinatorContext);
  if (!context) {
    throw new Error(
      "useSimulatorCoordinator must be used within a SimulatorCoordinator",
    );
  }
  return context;
}
