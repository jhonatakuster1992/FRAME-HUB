# 5 projetos no Claude — reels de 40 s

Vídeo vertical (1080×1920, 30 fps, 40 s) no estilo "pôster editorial" do vídeo de referência:
tipografia cinética palavra a palavra, fotos em P&B com círculos/blocos vermelhos, palavras gigantes
cortadas no fundo, cortes no tempo da batida, *punch-in* a cada corte e grão de filme.

- `5-projetos-claude.mp4`: vídeo final
- `src/video.html`: roteiro e animação (cada `<section>` é uma cena com início e fim em segundos)
- `src/render.js`: captura quadro a quadro com Playwright e exporta `sfx.json` com o momento de cada efeito
- `src/audio.py`: trilha deep house (120 BPM, Lá menor) e efeitos sonoros sintetizados e sincronizados com o `sfx.json`
- `assets/`: imagens geradas no Flow (Nano Banana Pro) a partir dos prompts em `PROMPTS-IMAGENS.md`
- `render.sh`: gera tudo de novo

## Trocar as imagens
As imagens em `assets/` foram geradas com os prompts de `PROMPTS-IMAGENS.md`.
Para trocar alguma, substitua o arquivo mantendo o mesmo nome e rode `./render.sh`.
O texto de cada cena foi posicionado no espaço livre da imagem, então uma imagem nova precisa
ter a mesma composição.

## Roteiro
| tempo | cena |
|---|---|
| 0–4 s | esquece o próximo curso |
| 4–8 s | 5 projetos que ensinam mais / aprende FAZENDO |
| 8–12,5 s | 01 painel do dia |
| 12,5–17 s | 02 segundo cérebro |
| 17–21,5 s | 03 um agente que revisa o seu dia |
| 21,5–26 s | 04 kit da sua marca |
| 26–30,5 s | 05 biblioteca da vida |
| 30,5–34,5 s | não faz os 5 de uma vez, começa pelo 01 hoje |
| 34,5–40 s | comenta PROJETOS e fechamento |
