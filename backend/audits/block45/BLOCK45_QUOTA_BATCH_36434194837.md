# BLOQUE 45 — tanda de expansión 36434194837

Run de GitHub Actions en modo `expand`, reanudado desde `36428256771`. El manifiesto conserva las 85 combinaciones completas de cinco ligas y temporadas 2010–2026. Se validaron `manifestHash`, `coverageHash`, `factsHash` y el prefijo de las 11.119 peticiones del manifiesto padre.

La primera petición fue `/status`: HTTP 200, `errors` vacío, `results: 0`, 716 peticiones diarias restantes en cabecera y cuerpo, y límite por minuto 300 con 299 restantes. La regla automática fijó el presupuesto total en 645 intentos, incluida la preflight.

La tanda registró 645 respuestas HTTP 200: una preflight y 644 consultas únicas de jugador-temporada. Hubo cero reintentos, 429 y errores de proveedor. Los pares completados pasan de 8.038 a 8.682; quedan 178.896 de la estimación de 187.578. El conjunto de 11.034 jugadores corresponde a la cobertura actual.

Dentro de la tanda, la cuota diaria bajó de 716 a 312: 404 unidades frente a 644 consultas de expansión. En el intervalo desde el cierre anterior (956) hasta este cierre (312), la bajada fue de 644: igual a las consultas de expansión y una menos que los 645 intentos de workflow, incluida la preflight /status. La aritmética no determina el origen del desplazamiento de 240; no se atribuye ni se ajusta. El límite por minuto es una ventana móvil, no consumo acumulado.

No se ejecutaron `load`, importaciones, PostgreSQL ni snapshots. El alcance continúa limitado a 2010–2026, así que no representa una carrera completa anterior a 2010. El detalle sin payloads está en el [informe JSON](./BLOCK45_QUOTA_BATCH_36434194837.json), con hash canónico que excluye `reportHash`.
