# BLOQUE 45 — tanda de expansión 36434194837

Run de GitHub Actions en modo `expand`, reanudado desde `36428256771`. El manifiesto conserva las 85 combinaciones completas de cinco ligas y temporadas 2010–2026. Se validaron `manifestHash`, `coverageHash`, `factsHash` y el prefijo de las 11.119 peticiones del manifiesto padre.

La primera petición fue `/status`: HTTP 200, `errors` vacío, `results: 0`, 716 peticiones diarias restantes en cabecera y cuerpo, y límite por minuto 300 con 299 restantes. La regla automática fijó el presupuesto total en 645 intentos, incluida la preflight.

La tanda registró 645 respuestas HTTP 200: una preflight y 644 consultas únicas de jugador-temporada. Hubo cero reintentos, 429 y errores de proveedor. Los pares completados pasan de 8.038 a 8.682; quedan 178.896 de la estimación de 187.578. El conjunto de 11.034 jugadores corresponde a la cobertura actual.

La cuota diaria bajó de 716 a 312: 404 unidades, frente a las 644 consultas de expansión. La diferencia de 240 vuelve a aparecer. Entre la tanda anterior y esta, la cabecera pasó de 956 restantes al cierre a 716 en la preflight. Estos contadores no identifican la causa; no se atribuye ni se ajusta la discrepancia. El límite por minuto es una ventana móvil, no consumo acumulado.

No se ejecutaron `load`, importaciones, PostgreSQL ni snapshots. El alcance continúa limitado a 2010–2026, así que no representa una carrera completa anterior a 2010. El detalle sin payloads está en el [informe JSON](./BLOCK45_QUOTA_BATCH_36434194837.json), con hash canónico que excluye `reportHash`.
