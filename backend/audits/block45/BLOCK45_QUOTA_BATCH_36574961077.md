# BLOQUE 45 — expansión por tandas, run 36574961077

Run de GitHub Actions en modo `expand`, reanudado desde `36436241212`. El manifiesto mantiene 85/85 combinaciones completas para las cinco ligas y temporadas 2010–2026. Se validaron `coverageHash`, `factsHash`, `manifestHash` y el prefijo de 11.829 peticiones del padre; las 6.607 consultas nuevas no repiten pares ya consultados.

La primera petición fue `/status`: HTTP 200, `errors` vacío, `results: 0`, cuota diaria 7.342/7.500 y límite por minuto 299/300. El presupuesto automático quedó en 6.608 intentos, incluida la preflight. La tanda terminó con 6.608 respuestas HTTP 200: una preflight y 6.607 pares jugador-temporada únicos. Hubo cero reintentos, 429 y errores del proveedor.

Los pares completados pasan de 8.746 a 15.353; quedan 172.225 de 187.578 (8,2 % completado). La cuota diaria final observada fue 975. El descenso de cabeceras durante la tanda fue 6.367, 240 menos que las 6.607 peticiones posteriores a la preflight. La diferencia queda sin explicación; no se atribuye ni se ajusta. Los valores por minuto pertenecen a una ventana y no expresan consumo acumulado.

## Revisión de consumidores del secreto compartido

El workflow `.github/workflows/api-football-refresh.yml` también usa `API_FOOTBALL_KEY` y corre diariamente a las 03:15 UTC. Hay ejecuciones exitosas el 29/9 (03:30–04:47, run `36517404288`) y el 30/9 (03:31–05:19, run `36664781033`). Ninguna se solapó con esta tanda del 29/9 (13:25–13:54); el log no da un recuento de peticiones. Es un consumidor confirmado de la cuota compartida antes/después de las preflights, pero no explica por sí solo el desfase intratanda de 240.

Durante el intervalo de la tanda no aparece otro job GitHub con llamadas a API-Football. Dos runs de Block 26 disparados por pushes fallaron antes de crear jobs; la CI del repositorio no configura el secreto. No hay acceso al panel privado desde este entorno, y no se pueden descartar otros repositorios o clientes externos. La causa de la diferencia sigue desconocida.

No se ejecutaron `load`, importaciones, PostgreSQL ni snapshots. La expansión sigue limitada a 2010–2026 y no representa la carrera completa. El informe JSON incluye el hash canónico, excluyendo `reportHash`.
