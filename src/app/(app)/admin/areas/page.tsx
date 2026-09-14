import { redirect } from "next/navigation";

export default function Redirecionar() {
  redirect("/admin?aba=areas");
}
