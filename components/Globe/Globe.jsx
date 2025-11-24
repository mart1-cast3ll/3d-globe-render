"use client";

import { useEffect, useRef } from "react";
import { buildGlobe } from "@/components/Globe/globeLogic";

export default function Globe() {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    const { cleanup } = buildGlobe(ref.current);

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return <div ref={ref} className="globe-container" />;
}
