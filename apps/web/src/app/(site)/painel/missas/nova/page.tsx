"use client";

import { useState } from "react";
import { newMass } from "@/lib/store";
import { MassEditor } from "@/components/mass/MassEditor";

export default function NovaMissaPage() {
  const [mass] = useState(newMass);
  return <MassEditor initial={mass} isNew />;
}
