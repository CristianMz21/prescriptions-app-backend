# API Reference (live)

La referencia interactiva de la API se renderiza directamente desde `openapi.json` mediante ReDoc.

> ⚠️ Esta página es la **única** vista canónica del contrato. Cualquier discrepancia con `contratos-api.md` se resuelve a favor del spec generado.

<redoc spec-url="openapi.json"></redoc>

<script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>

---

## Cómo se genera

El spec se exporta desde los decoradores Nest cada vez que algún DTO o controller cambia. El handshake completo está documentado en [Workflow del contrato](api-contract-workflow.md).

```bash
pnpm api:refresh   # export → validate → postman
pnpm test:openapi-contract   # asserts shape
```
