# BLOQUE 45 — expansión por tandas, run 36574961077

Run de GitHub Actions en modo `expand`, reanudado desde `36436241212`. El manifiesto mantiene 85/85 combinaciones completas para las cinco ligas y temporadas 2010–2026. Se validaron `coverageHash`, `factsHash`, `manifestHash` y el prefijo de 11.829 peticiones del padre; las 6.607 consultas nuevas no repiten pares ya consultados.

La primera petición fue `/status`: HTTP 200, `errors` vacío, `results: 0`, cuota diaria 7.342/7.500 y límite por minuto 299/300. El presupuesto automático quedó en 6.608 intentos, incluida la preflight. La tanda terminó con 6.608 respuestas HTTP 200: una preflight y 6.607 pares jugador-temporada únicos. Hubo cero reintentos, 429 y errores del proveedor.

Los pares completados pasan de 8.746 a 15.353; quedan 172.225 de 187.578 (8,2 % completado). La cuota diaria final observada fue 975. El descenso de cabeceras durante la tanda fue 6.367, 240 menos que las 6.607 peticiones posteriores a la preflight. La diferencia queda sin explicación; no se atribuye ni se ajusta. Los valores por minuto pertenecen a una ventana y no expresan consumo acumulado.

No se ejecutaron `load`, importaciones, PostgreSQL ni snapshots. La expansión sigue limitada a 2010–2026 y no representa la carrera completa. El informe JSON incluye el hash canónico, excluyendo `reportHash`.
