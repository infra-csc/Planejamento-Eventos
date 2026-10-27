import { redirect } from "next/navigation";

/** O estoque da Ativação virou o módulo Ativação (27/10): links antigos continuam funcionando. */
export default function EstoquePage() {
  redirect("/ativacao");
}
