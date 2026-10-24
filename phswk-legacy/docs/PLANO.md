# Plano de desenvolvimento

| Fase | Conteúdo | Estado |
|---|---|---|
| A — Inventário | repositórios e dependências (`INVENTARIO.md`) | ✅ feito |
| B — Licenças/versões | licença ausente no soneca7; cliente 1.70.x ≈ OB32 (`COMPATIBILIDADE.md`) | ✅ feito |
| C — Ambiente reproduzível | Node ≥ 20 + 1 dependência (`ws`, MIT, versão fixa) | ✅ feito |
| D — Testes locais | 15 testes `node --test` + teste de navegador (Playwright) | ✅ feito |
| E — Servidor independente | contas, loja, fila com bots, CS e BR, ranking | ✅ versão 0.1 |
| F — Testes em Android | celular real via Termux e navegador | ⏳ **pendente** (precisa do aparelho do usuário) |

## Próximos passos sugeridos

1. **Fase F:** rodar no Termux, jogar com 2 celulares na mesma rede Wi-Fi (`http://<ip-do-celular>:8080`) e anotar os problemas encontrados.
2. **Hospedagem:** pôr o servidor numa VPS ou serviço grátis para jogar pela internet. Exige HTTPS (WSS) e um domínio.
3. **Rede:** predição de movimento no cliente e compressão do snapshot.
4. **Conteúdo:** mapas maiores, mais armas e roupas, salas personalizadas com senha.
5. **Arte própria:** sprites, sons e animações originais ou com licença aberta (CC0/CC-BY, por exemplo do OpenGameArt). Itens do Free Fire não podem ser usados.
6. **Login social:** registrar um app próprio no Google e implementar OAuth no servidor.
7. **App Android:** empacotar o cliente como PWA instalável ou com Capacitor/TWA, assinado com a sua própria chave.
