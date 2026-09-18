import { redirect } from "next/navigation";

export default function Redirecionar() {
  redirect("/consolidacao?aba=pendencias");
}
