"use client";

import { useState } from "react";
import { newMass } from "@/lib/store";
import { MassEditor } from "@/components/mass/MassEditor";
import { WeekSuggestions } from "@/components/mass/WeekSuggestions";

export default function NovaMissaPage() {
  const [mass] = useState(newMass);
  return (
    <>
      {/* A missa sugerida pela coordenação vem antes: começar por ela é o caminho mais curto. */}
      <div className="mb-6">
        <WeekSuggestions compact />
      </div>
      <MassEditor initial={mass} isNew />
    </>
  );
}
