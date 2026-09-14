import { redirect } from "next/navigation";

export default function Redirecionar() {
  redirect("/biblioteca?aba=pecas");
}
