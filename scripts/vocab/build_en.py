# /// script
# requires-python = ">=3.10"
# dependencies = ["wordfreq==3.1.1", "lemminflect==0.2.3"]
# ///
"""
Gera public/vocab/en_{a1,a2,b1,b2}.json a partir de fontes abertas.

Fontes (detalhes e licenças em scripts/vocab/README.md):
- CEFR-J Wordlist 1.5 (Tono Laboratory, TUFS): quais palavras pertencem a cada
  nível CEFR (A1 a B2). Baixado de um commit fixo do repositório
  openlanguageprofiles/olp-en-cefrj.
- lemminflect: formas flexionadas de cada palavra (went, children, better...).
  O validador do app compara a palavra exata do texto, então a lista precisa
  das formas, não só da forma de dicionário.
- wordfreq: frequência de uso, para decidir quais palavras entram primeiro.

Regra: a lista de um nível só contém palavras de CEFR-J daquele nível ou abaixo,
e as listas são cumulativas (B1 contém todo o A2, que contém todo o A1). Os
tamanhos batem com os limiares de calculateLevelFromVocab em App.tsx, para o
usuário começar no nível que escolheu.

Uso (na raiz do repositório; o uv instala as dependências declaradas acima):
    uv run scripts/vocab/build_en.py
"""

import csv
import io
import json
import re
import urllib.request
from pathlib import Path

from lemminflect import getAllInflections
from wordfreq import zipf_frequency

CEFRJ_COMMIT = "d4e45b75b38f27b30dfc5c44d8c571aec7e7092f"
CEFRJ_URL = (
    "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/"
    f"{CEFRJ_COMMIT}/cefrj-vocabulary-profile-1.5.csv"
)

# Tamanho de cada arquivo = limiar mínimo do nível em calculateLevelFromVocab (App.tsx)
LEVEL_SIZES = {"A1": 600, "A2": 1500, "B1": 3000, "B2": 6000}
LEVELS = list(LEVEL_SIZES)

# Classe gramatical do CEFR-J -> classe usada pelo lemminflect para gerar flexões
POS_TO_UPOS = {
    "noun": "NOUN",
    "verb": "VERB",
    "be-verb": "VERB",
    "do-verb": "VERB",
    "have-verb": "VERB",
    "modal auxiliary": "VERB",
    "adjective": "ADJ",
    "adverb": "ADV",
}

# Só letras minúsculas: é o que o tokenize() de geminiService.ts devolve.
# Expressões com espaço, hífen ou ponto ("ice cream", "t-shirt", "a.m.") ficam de fora.
SIMPLE_WORD = re.compile(r"[a-z]+")

OUT_DIR = Path(__file__).resolve().parents[2] / "public" / "vocab"


def load_cefrj() -> list[dict]:
    with urllib.request.urlopen(CEFRJ_URL, timeout=60) as resp:
        text = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def build_pool(rows: list[dict]) -> dict[str, str]:
    """Mapeia cada forma de palavra ao nível CEFR mais baixo em que ela aparece."""
    pool: dict[str, str] = {}

    def add(form: str, level: str) -> None:
        form = form.strip().lower()
        if not SIMPLE_WORD.fullmatch(form):
            return
        if form not in pool or LEVELS.index(level) < LEVELS.index(pool[form]):
            pool[form] = level

    for row in rows:
        level = row["CEFR"].strip()
        if level not in LEVEL_SIZES:
            continue
        upos = POS_TO_UPOS.get(row["pos"].strip())
        # "color/colour", "OK/okay": cada variante vira uma entrada
        for lemma in row["headword"].split("/"):
            lemma = lemma.strip().lower()
            if not SIMPLE_WORD.fullmatch(lemma):
                continue
            add(lemma, level)
            if upos:
                for forms in getAllInflections(lemma, upos=upos).values():
                    for form in forms:
                        add(form, level)
    return pool


def build_lists(pool: dict[str, str]) -> dict[str, list[str]]:
    freq = {w: zipf_frequency(w, "en") for w in pool}
    # Forma que nunca aparece no corpus do wordfreq é flexão improvável: fica de fora.
    # Empate de frequência: entra antes a palavra de nível CEFR mais baixo.
    ranked = sorted(
        (w for w in pool if freq[w] > 0),
        key=lambda w: (-freq[w], LEVELS.index(pool[w]), w),
    )

    lists: dict[str, list[str]] = {}
    chosen: list[str] = []
    chosen_set: set[str] = set()
    for level in LEVELS:
        allowed = set(LEVELS[: LEVELS.index(level) + 1])
        for word in ranked:
            if len(chosen) >= LEVEL_SIZES[level]:
                break
            if word not in chosen_set and pool[word] in allowed:
                chosen.append(word)
                chosen_set.add(word)
        if len(chosen) < LEVEL_SIZES[level]:
            raise SystemExit(f"{level}: só {len(chosen)} palavras disponíveis, precisa de {LEVEL_SIZES[level]}")
        lists[level] = list(chosen)
    return lists


def main() -> None:
    pool = build_pool(load_cefrj())
    lists = build_lists(pool)
    for level, words in lists.items():
        path = OUT_DIR / f"en_{level.lower()}.json"
        path.write_text(json.dumps(words, ensure_ascii=False) + "\n", encoding="utf-8")
        mix = {lv: sum(1 for w in words if pool[w] == lv) for lv in LEVELS}
        print(f"{path.name}: {len(words)} palavras | origem CEFR-J {mix}")


if __name__ == "__main__":
    main()
