import { notFound, redirect } from "next/navigation";
import { TELAS_INATIVAS } from "@/domain/telas";

export default function Redirecionar() {
  if (TELAS_INATIVAS.consolidacao) notFound();
  redirect("/consolidacao?aba=pendencias");
}
