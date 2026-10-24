# Compatibilidade e versões

## Cliente histórico do Free Fire (2022)

| Atualização | Lançamento | Observação |
|---|---|---|
| OB32 "Illuminate" | 19/01/2022 | Charge Buster, Alpine no Contra Squad, CS Temporada 11 |
| OB33 | mar/2022 | |
| OB34 | mai/2022 | |
| OB35 | 20/07/2022 | aniversário de 5 anos |
| OB36 | 21/09/2022 | |
| OB37 | 16/11/2022 | Advance Server em 03/11/2022 |
| OB38 | 10–11/01/2023 | já é 2023 |

Fontes: Sportskeeda (patch notes do OB32, datas do OB35–OB38) e o histórico do Free Fire Mania.

- **Versão 1.70.x:** um guia descreve a 1.70.0 com Charge Buster, Alpine e CS Temporada 11, que são as novidades do OB32. Por isso a 1.70.x **provavelmente** é o OB32 (jan/2022). É uma inferência, sem confirmação oficial da Garena.
- **Protocolos diferentes:** cada OB muda o protocolo. O soneca7 só documenta a 1.70.0/1.70.1, então não presuma compatibilidade entre versões de 2022.

## Arquivo do usuário no Google Drive

| Item | Valor |
|---|---|
| Nome | `free.fire.2022.v.1.70.4.zip` |
| Tamanho | 61,8 MB |
| Inspecionado? | **Não** |

**Por que não foi inspecionado:**
- O conector do Drive só entrega o conteúdo como texto base64 dentro da conversa (cerca de 82 MB), então não dá para trazer o arquivo para o ambiente de trabalho por ele.
- Pelo tamanho, deve conter só o APK. Os guias da época citam um OBB de ~700 MB, que não está no Drive.
- A origem é desconhecida, já que a Garena não distribui mais essa versão.

**Para verificar você mesmo no celular:** abra o APK num leitor de APK (por exemplo o App Manager, que é open source) e anote:
- `versionName` / `versionCode`;
- `targetSdkVersion` / `minSdkVersion`;
- ABIs (`arm64-v8a`, `armeabi-v7a`);
- certificado de assinatura (se não for o da Garena, o APK foi modificado por terceiros).

**Expectativa técnica (hipóteses, não testadas):**
- O APK de 2022 provavelmente instala no Android atual.
- Sem os servidores da época, ele para na tela de atualização ou de login.
- A partir do Android 14, apps com `targetSdk` muito antigo podem ser bloqueados na instalação. Isso depende do valor real do APK.

## PHSWK Legacy (este projeto)

| Componente | Verificado em | Resultado |
|---|---|---|
| Servidor | Node.js 22.22 (Linux) | 15/15 testes automatizados passando |
| Cliente web | Chromium (Playwright), 800×380 com toque | fluxo completo sem erros de console (capturas em `docs/capturas/`) |
| Cliente web | celular Android real | **não testado** |
| Termux | — | **não testado**; as instruções seguem o uso padrão do Node |
