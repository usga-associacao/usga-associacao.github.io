#!/usr/bin/env python3
"""
bump_versao.py

Corre este script sempre que editares js/main.js ou css/style.css, a partir
da pasta raiz do projeto (a pasta onde estao os ficheiros .html). Atualiza o
numero de versao (?v=...) de ambos os ficheiros em todas as paginas .html,
para o browser dos visitantes deixar de usar a copia antiga em cache.

Uso:
    python3 bump_versao.py

Nao mexe nos ficheiros main.js ou style.css em si -- so atualiza os numeros
?v=... que os referenciam dentro dos .html, em lote, para todas as paginas.
"""

import glob
import re
from datetime import date

PADRAO_JS = re.compile(rb'js/main\.js\?v=(\d+)')
PADRAO_CSS = re.compile(rb'css/style\.css\?v=(\d+)')


def obter_nova_versao(ficheiros):
    atual_maxima = 0
    for caminho in ficheiros:
        with open(caminho, 'rb') as f:
            conteudo = f.read()
        for match in list(PADRAO_JS.finditer(conteudo)) + list(PADRAO_CSS.finditer(conteudo)):
            atual_maxima = max(atual_maxima, int(match.group(1)))
    hoje = int(date.today().strftime('%Y%m%d'))
    return max(atual_maxima + 1, hoje)


def main():
    ficheiros = sorted(glob.glob('*.html'))
    if not ficheiros:
        print('Nenhum ficheiro .html encontrado nesta pasta.')
        print('Corre o script a partir da pasta raiz do projeto (onde estao os .html).')
        return

    nova_versao = obter_nova_versao(ficheiros)
    nova_versao_bytes = str(nova_versao).encode()
    total = 0

    for caminho in ficheiros:
        with open(caminho, 'rb') as f:
            conteudo = f.read()
        novo_conteudo, n1 = PADRAO_JS.subn(b'js/main.js?v=' + nova_versao_bytes, conteudo)
        novo_conteudo, n2 = PADRAO_CSS.subn(b'css/style.css?v=' + nova_versao_bytes, novo_conteudo)
        if n1 or n2:
            with open(caminho, 'wb') as f:
                f.write(novo_conteudo)
            total += n1 + n2
            print(f'{caminho}: js={n1} css={n2}')

    print()
    print(f'Nova versao: {nova_versao}')
    print(f'Total de substituicoes: {total}')


if __name__ == '__main__':
    main()