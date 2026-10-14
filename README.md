# Central InclusiVR

Site estático (HTML, CSS e JS puros) para consulta visual do workspace **InclusiVR** no Notion, com a identidade visual do [inclusivr.com.br](https://inclusivr.com.br/): fonte Nunito, roxo `#ac2fed`, azul `#15b0ff` e índigo `#280eaa`.

## Como abrir

Abra o `index.html` no navegador. Não precisa de servidor nem de instalar nada.

## O que tem

| Seção | Conteúdo |
| --- | --- |
| **Início** | Números gerais, próximos prazos, atrasados, prioridades, áreas, conquistas, equipe e atalhos (Trello, Meet, Drive) |
| **Projetos** | Cartões com status, prioridade, áreas e progresso dos itens ligados a cada projeto |
| **Tarefas** | Quadro kanban por status, com filtros por pessoa, área, tipo e prazo |
| **Atas** | Linha do tempo das reuniões |
| **Contatos** | Cartões de contatos e relacionamentos |
| **Documentos** | Documentos, eventos e cronogramas |
| **Equipe** | Itens em aberto, atrasados e concluídos por pessoa |

Clicar em qualquer item abre um painel com as propriedades e a página completa do Notion. Os links entre páginas funcionam dentro do site. A busca no topo (atalho `/`) procura em títulos, descrições e no conteúdo das páginas.

## Como atualizar os dados

1. No Notion, na página **InclusiVR**, clique em `•••` → **Export** → **Markdown & CSV**, com **Include subpages** ligado.
2. Rode o script com o `.zip` baixado:

   ```bash
   python3 tools/build_data.py ~/Downloads/Export-xxxx.zip
   ```

Ele regera `data/notion-data.js` e `data/media/`. Só usa Python 3, sem bibliotecas extras.

> O script troca automaticamente o valor de linhas `Senha:` / `Password:` por `••••••`, para não levar credenciais do Notion para o site.

## Privacidade

Os dados incluem informações internas, como atas e contatos com telefones. Mantenha o repositório **privado**. Lembre que o GitHub Pages publica o site de forma pública mesmo a partir de repositório privado (exceto no plano Enterprise).

## Estrutura

```
index.html            página única (rotas por #hash)
css/style.css         estilos e identidade visual
js/app.js             telas, filtros, busca e painel de detalhes
js/markdown.js        conversor de Markdown do Notion para HTML
data/notion-data.js   dados gerados do export (não editar à mão)
data/media/           imagens das páginas
tools/build_data.py   conversor do export do Notion
assets/logo.png       logo da InclusiVR
```
