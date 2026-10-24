# Inventário dos repositórios analisados

Pesquisa feita em 24/10/2026. Os repositórios foram clonados numa pasta separada, só para leitura: nenhum código deles foi executado nem copiado para este projeto.

| Repositório | Existe? | Código real? | Licença | Reaproveitável? |
|---|---|---|---|---|
| github.com/itsKyze/FreeFireServer | **Não** (HTTP 404) | — | — | — |
| github.com/barbosaserver (repo `BS`) | Sim | **Não**: 1 commit, só um `README.md` com `# BS` | nenhuma | — |
| github.com/soneca7/FreeFireServer | Sim | **Sim**: ~380 arquivos, ~18 mil linhas JS/Go | **nenhuma** (o `package.json` diz ISC, mas não há arquivo de licença e o README se declara um vazamento) | **Não** |

## soneca7/FreeFireServer — detalhes

**Fatos verificados no código:**
- **Linguagens e arquitetura:**
  - Node.js 16+ com Express, protobufjs, PostgreSQL/SQLite e Redis;
  - um `match-server` em Go (UDP);
  - serviços `live`, `login`, `main`, gateway TCP, `matchmaker`, `settlement` e `auth`;
  - Docker Compose com Traefik.
- **Versão de cliente alvo:** **1.70.0 / 1.70.1** (`config/default.js`: `version: '1.70.1'`; `protocol/SPEC.md`: "Free Fire 1.70.0 — server protocol spec (reverse-engineered)").
- **Modo mais completo:** Contra Squad. O próprio README diz "quase tudo no modo CS tá funcionando".
- **Protocolo:** HTTP POST com corpo protobuf cifrado em AES-128-CBC usando chave e IV **estáticos extraídos do cliente oficial**. As definições `.proto` (1.828 mensagens) e o mapa de 418 endpoints foram tirados do `libil2cpp.so` descriptografado (IDA).
- **Dados da Garena incluídos:** tabelas de itens e armas (`ItemTable.csv`, `WeaponSkin.csv` etc.) e URLs do CDN oficial (`dl.cdn.freefiremobile.com`).
- **Login:** o `auth/connect-server` imita rotas OAuth/Graph do Facebook, e o `ver.php` responde no lugar do servidor de versão oficial.
- **Testes:** `npm test` só imprime `"No tests yet"`. Há scripts de *smoke* e alguns testes Go (`crypto`, `packet`, `token`).
- **Como o cliente chega ao servidor:** o repositório **não traz** o cliente modificado. O README fala em "url redirect", ou seja, o cliente oficial precisa ser alterado ou ter o tráfego desviado.

**Por que não foi reaproveitado:**
1. Sem licença, o código é "todos os direitos reservados", e o autor do README diz que é vazamento de outra pessoa.
2. Depende de segredos e de dados proprietários extraídos do binário da Garena.
3. Só funciona com um cliente oficial modificado ou redirecionado, o que exige contornar a integridade do app.

> A chave AES presente no repositório **não foi copiada** para este projeto nem para esta documentação.

## Buscas adicionais

As buscas foram: "Free Fire 2022 legacy server", "OB37/OB38/OB39 server", "protocol research", "game preservation" e "Offside 2022".
- Não encontrei nenhum projeto público com código-fonte e licença aberta.
- Sobre "Offside 2022", não achei repositório nem documentação técnica pública.
- Os resultados sobre "servidor privado" apontam para APKs modificados distribuídos por Discord e chave de acesso. Não baixei nada disso: são arquivos de origem desconhecida.
