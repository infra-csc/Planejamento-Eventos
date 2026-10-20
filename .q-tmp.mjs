import { PGlite } from "@electric-sql/pglite";
const db = new PGlite(process.argv[2]);
const q = async (s) => console.log(JSON.stringify((await db.query(s)).rows));
await q(`select g.nome, (select count(*) from projetos p where p.grupo_id=g.id and p.ativo and p.disponivel_solicitacao) proj, (select count(*) from pecas p where p.grupo_id=g.id and p.ativo and p.disponivel_solicitacao) pec from projeto_grupos g order by 1`);
await q(`select count(*) filter (where grupo_id is null) proj_padrao, count(*) total from projetos where ativo and disponivel_solicitacao`);
await q(`select count(*) filter (where grupo_id is null) pec_padrao, count(*) total from pecas where ativo and disponivel_solicitacao`);
await q(`select codigo, nome, status from eventos where status not in ('CANCELADO','ENCERRADO') order by data_inicio limit 60`);
