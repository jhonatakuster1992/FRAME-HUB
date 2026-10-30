# 5 projetos no Claude — reels de 40 s

Vídeo vertical (1080×1920, 30 fps, 40 s) em motion graphics feito em JavaScript (GSAP),
com narração em voz masculina, trilha e efeitos sonoros.

## Arquivos
- `5-projetos-claude.mp4`: vídeo final
- `src/motion.html`: a composição inteira (cenas, transições e animações em GSAP)
  - abra `src/motion.html?play` num servidor local e clique para assistir com áudio (usa `build/mix.wav`)
- `src/narration.py`: narração pt-BR (voz `pm_alex` do Kokoro-82M) e tempos de cada palavra em `src/narration.js`
- `src/audio.py`: trilha deep house (120 BPM), efeitos sonoros e mixagem (a música abaixa quando a voz fala)
- `src/render.js`: captura quadro a quadro com Playwright e exporta o `sfx.json`
- `assets/`: imagens geradas no Flow (Nano Banana Pro) com os prompts de `PROMPTS-IMAGENS.md`
- `render.sh`: gera tudo de novo (baixa o modelo de voz do npm na primeira vez)

## Efeitos e transições (copiados do vídeo de referência)
| efeito | onde |
|---|---|
| palavra surge cinza e borrada e "acende", sincronizada com a fala | todas as cenas |
| câmera em deriva constante e texto subindo devagar | todas as cenas |
| câmera sobe acelerando com parallax e a palavra gigante cresce | 01 → 02, 03 → 04 |
| mergulho na palavra (zoom exponencial até o corte) | "mais." e "marca." |
| camadas entram deslizando de lado em velocidades diferentes, com borrão | gancho, painel, começar |
| chicote lateral com borrão de movimento | painel → cérebro, começar → CTA |
| texto some dois quadros antes do corte seco para o preto | cérebro → revisão, CTA → final |
| palavras fantasmas gigantes em duas linhas | marca, CTA |
| ícone com glitch RGB sobre o título | assinatura final |

## Mudar o texto
Edite as falas em `src/narration.py` (LINES) e os textos na tela em `src/motion.html`.
Cada texto aparece quando a narração diz a palavra indicada em `data-w`. Depois rode `./render.sh`.
