# Vocabulário inicial por nível

Os arquivos em `public/vocab/` viram o `knownWords` do usuário quando ele escolhe
um nível no onboarding. Eles são gerados por script, nunca editados à mão.

## Inglês (`en_a1.json` a `en_b2.json`)

Gerar de novo, na raiz do repositório (precisa do [uv](https://docs.astral.sh/uv/)):

```bash
uv run scripts/vocab/build_en.py
npx vitest run utils/vocabData.test.ts
```

Como a lista é montada:

1. **Quais palavras:** só palavras da CEFR-J Wordlist classificadas até o nível do
   arquivo. A lista de A2 só tem palavras A1 e A2, e assim por diante.
2. **Quais formas:** cada palavra entra com as flexões (`go`, `goes`, `went`,
   `gone`, `going`), geradas pelo lemminflect. O validador de histórias compara a
   palavra exata do texto, então a forma de dicionário sozinha não basta.
3. **Ordem:** da mais frequente para a menos frequente, segundo o wordfreq.
   Formas que nunca aparecem no corpus ficam de fora.
4. **Tamanho:** 600, 1.500, 3.000 e 6.000 palavras, os limites mínimos de A1, A2,
   B1 e B2 em `calculateLevelFromVocab` (`App.tsx`). As listas são cumulativas.

Palavras compostas ou com hífen e ponto (`ice cream`, `t-shirt`, `a.m.`) ficam de
fora, porque o tokenizador do app as separa.

## Fontes e licenças

- **CEFR-J Wordlist Version 1.5.** Compiled by Yukio Tono, Tokyo University of
  Foreign Studies. Retrieved from http://www.cefr-j.org/download.html, via
  [openlanguageprofiles/olp-en-cefrj](https://github.com/openlanguageprofiles/olp-en-cefrj)
  (commit `d4e45b7`). Uso livre, inclusive comercial, com citação; copyright do
  Tono Laboratory, TUFS.
- **[wordfreq](https://github.com/rspeer/wordfreq) 3.1.1**, de Robyn Speer. Usado só
  para ordenar por frequência. Código MIT; dados CC BY-SA 4.0. Os dados incluem
  SUBTLEX (Brysbaert, New e colegas) e OpenSubtitles.
- **[lemminflect](https://github.com/bjascob/LemmInflect) 0.2.3.** Código MIT.
