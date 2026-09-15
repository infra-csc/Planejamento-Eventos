import { redirect } from "next/navigation";
import { ARENAS } from "@/domain/arena/eco-run-sp-2026";

/** Hoje há uma arena cadastrada; a lista vira índice quando houver outras. */
export default function ArenaIndice() {
  redirect(`/arena/${ARENAS[0].slug}`);
}
