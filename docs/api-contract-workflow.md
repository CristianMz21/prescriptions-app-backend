# Workflow del contrato API

Este proyecto trata a **`openapi.json` como la única fuente de verdad** de la API HTTP. Todo cambio de contrato debe originarse en decoradores NestJS (`@Api*`) o `class-validator`/`class-transformer`. Nunca se edita `openapi.json` a mano.

## Cadena de generación

```
NestJS decorators (controllers + DTOs)
        │
        ▼  pnpm export:openapi
   openapi.json
        │
        ├──► pnpm validate:openapi      (swagger-cli, lint sintáctico)
        ├──► pnpm postman:generate      (colección + entornos para Newman)
        ├──► pnpm test:openapi-contract (asserts shape: operationIds, errors, etc.)
        └──► (frontend) pnpm api:gen    (Orval — hooks React Query tipados)
```

Para regenerar todo de una sola vez:

```bash
pnpm api:refresh
```

## Operación día a día

| Cuando…                                              | Hacer…                                                 |
| ---------------------------------------------------- | ------------------------------------------------------ |
| Agregás/cambiás un endpoint, DTO, o response shape    | `pnpm api:refresh && git add openapi.json postman/`    |
| Cambiás el schema y el frontend depende de eso       | Pedirle al frontend que corra `pnpm api:gen` (Orval)   |
| Querés ver la API en docs                            | Abrir [`/api-reference`](api-reference.md) (ReDoc live)|
| Vas a hacer push                                     | `pre-push` hook corre `api:refresh` y bloquea drift    |

## Garantías de no-drift

- **Pre-push hook (`.husky/pre-push`)** — corre `api:refresh` y falla si `openapi.json` o `postman/` están desactualizados.
- **CI postman-newman.yml** — refresca y exige `git diff --exit-code` clean.
- **CI smoke contract test** — valida que cada path tiene `operationId`, que cada error 4xx/5xx referencia `ErrorResponseDto`, que cada POST/PATCH/PUT con body lo declara.
- **CI breaking-change diff (`oasdiff`)** — falla en PRs sin label `breaking-change` si el spec rompe consumidores.
- **CI codegen.yml (frontend)** — refresca el client Orval y exige drift cero.

## Reglas duras

1. **No editar `openapi.json` a mano.** Si algo aparece mal en el spec, arreglar el decorator/DTO que lo genera.
2. **Errores estandarizados.** Usar siempre `@ApiStandardErrors({...})`; nunca repetir `@ApiUnauthorizedResponse({type: ErrorResponseDto, …})`.
3. **Listados paginados** sólo vía `apiPaginatedOkResponse(ItemDto, …)`.
4. **Return types explícitos** en todos los métodos de controller (lint guard).
5. **Sin `as unknown as` ni `as any`** en controllers (lint guard).
6. **operationIds estables**: namespacing automático `Modulo_metodo` (factory en `swagger.config.ts`). Para renombrarlos hay que coordinar con consumidores (frontend, Postman).

## Versionado

- La versión del spec se lee desde `package.json` (`pkg.version`).
- Bumps SemVer manuales en PR cuando se cierra un cambio de contrato.
- PRs con cambios breaking deben llevar el label `breaking-change` para que `oasdiff` no bloquee.
