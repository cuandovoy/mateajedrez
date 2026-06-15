Correr type-check del proyecto y reportar todos los errores TypeScript.

```bash
yarn type-check
```

Si hay errores:
- Agruparlos por archivo
- Para cada error mostrar: archivo, línea, mensaje
- Proponer fix para los errores más comunes (tipos faltantes, `as any` necesarios por tipos generados desactualizados)

Si no hay errores, confirmar con el conteo de archivos chequeados.
