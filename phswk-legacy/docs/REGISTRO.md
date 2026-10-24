# Registro de erros e limitações

## Erros encontrados e corrigidos

1. **O time da direita vencia todas as partidas.**
   - **Sintoma:** em CS só com bots, o placar ficava 0–60 em 60 partidas.
   - **Causa:** a parede central estava em `y: 320`, fora do centro do mapa (o correto é `y: 330`). Isso quebrava a simetria entre os lados.
   - **Correção:** parede reposicionada, depois de achar o ponto exato com um teste de simetria determinístico (rng fixo).
   - **Resultado:** 27–33 em 60 partidas, dentro do esperado pelo acaso.
2. **Viés de ordem na simulação.** Os bots que vinham depois na lista miravam em posições já atualizadas. Agora todos os bots decidem com o mesmo estado, e a ordem de disparo roda a cada tick.
3. **Viés no desvio lateral dos bots.** A direção do desvio dependia do ID do bot. Agora depende do slot, igual para os dois times.
4. **Script de teste.** `node --test test/` falhava no Node 22, então o script passou a usar `test/*.test.js`.

## Limitações conhecidas

- **Free Fire original:** não roda nem é modificado. Skins, personagens, mapas e diamantes do Free Fire **não** estão disponíveis, porque são propriedade da Garena.
- **APK do Drive:** não inspecionado (veja `COMPATIBILIDADE.md`).
- **Android real:** não foi testado em celular de verdade, só em Chromium simulando celular.
- **Rede:** sem predição no cliente. Em internet lenta, o personagem responde com atraso.
- **Battle Royale:** curto (~15 s entre bots) porque o mapa é pequeno.
- **Login social:** sem Google/Facebook.
- **Câmera:** o zoom mostra pouco do mapa em telas largas, e o primeiro inimigo nem sempre aparece logo de cara.
- **Escala:** um único processo Node, sem limite de partidas simultâneas. Serve para grupos pequenos.
