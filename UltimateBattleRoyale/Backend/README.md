# Backend de perfil (autoritativo)

Servidor HTTP em Python (só biblioteca padrão; `cryptography` apenas para validar tokens do EOS)
que é a **única autoridade** sobre XP, nível, moedas, itens, passe, desafios e estatísticas.

```bash
python3 -m unittest discover -s tests -t .          # 23 testes (inclui verificação cruzada com o C++)
BR_AUTH_MODE=dev BR_SERVER_SECRET=troque-isto python3 -m brbackend.server --port 8080 --db profiles.db
```

| Rota | Quem | Função |
|---|---|---|
| `GET /v1/health` | — | saúde |
| `GET /v1/catalog/today` | — | loja do dia, recompensas do passe |
| `GET /v1/profile` | jogador | perfil completo + desafios ativos |
| `POST /v1/shop/purchase {itemId}` | jogador | compra com moedas (só itens da rotação do dia) |
| `POST /v1/pass/buy`, `POST /v1/pass/claim {tier,premium}` | jogador | passe de temporada |
| `PUT /v1/loadout` | jogador | equipa somente itens possuídos |
| `POST /v1/iap/verify` | jogador | **501**: compras reais exigem credenciais Google Play/App Store |
| `GET /v1/server/loadout?player=` | servidor dedicado (HMAC) | cosméticos verificados para exibir na partida |
| `POST /v1/server/match-result` | servidor dedicado (HMAC) | grava resultados; XP/moedas calculados aqui; idempotente |

Garantias testadas: cliente não consegue lançar resultado de partida (exige assinatura do servidor), requisições
assinadas expiram em 5 min, resultados duplicados não pagam duas vezes, valores implausíveis são rejeitados,
compras e resgates são transacionais, loadout só aceita itens possuídos, limite de requisições por jogador.

As regras (curva de XP, recompensas, desafios, rotação da loja) são espelhos das regras C++ e
`tests/test_crosscheck.py` compila `Tests/RulesTests/CrossCheck.cpp` e compara os resultados.
O catálogo (`brbackend/catalog.json`) é extraído do C++ (`extract_catalog.py`) e `tests/test_catalog_sync.py`
falha se ficar desatualizado.
