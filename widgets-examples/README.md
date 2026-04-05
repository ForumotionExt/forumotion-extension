# FME — Exemple de Widgets JS

Aceste fișiere conțin snippeturi JavaScript gata de copiat în tab-ul **Widgets JS** din panoul FME.

## Structura unui widget

| Câmp        | Valori posibile         | Descriere                              |
|-------------|-------------------------|----------------------------------------|
| `target`    | `acp` / `forum` / `both` | Pe ce pagini rulează                  |
| `enabled`   | `true` / `false`        | Activat sau nu                         |
| `code`      | JavaScript              | Codul care se execută (`new Function`) |

## Foldere

| Folder       | Descriere                            |
|--------------|--------------------------------------|
| `acp/`       | Widgets pentru paginile de admin ACP |
| `forum/`     | Widgets pentru paginile de forum     |

---

Copiază conținutul secțiunii **`// CODE`** din fiecare fișier în editorul de cod al widget-ului.
