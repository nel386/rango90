# BLOQUE 45 — tanda de expansión 36428256771

Run de GitHub Actions en modo `expand`, sobre el checkpoint validado `36427659458`. El manifiesto final conserva las 85 combinaciones completas de cinco ligas y temporadas 2010–2026. Se verificaron localmente `coverageHash`, `factsHash` y `manifestHash`; los 4.680 registros de petición anteriores son prefijo exacto del manifiesto padre.

La preflight `/status` fue la primera petición de la tanda. Devolvió HTTP 200, `errors` vacío, `results: 0` y el objeto de cuota diaria con 7.154 restantes; el límite por minuto era 300 y marcaba 299 restantes. Con esos valores, la regla automática reservó el 10 % diario y fijó el presupuesto total en 6.439 intentos, contando la preflight.

La tanda acabó con 6.439 respuestas HTTP 200: una preflight y 6.438 consultas únicas de jugador-temporada. No hubo reintentos, 429 ni errores de proveedor. Los pares de expansión pasan de 1.600 a 8.038; quedan 179.540 de la estimación de 187.578. Los 11.034 jugadores siguen siendo el conjunto elegible de la cobertura actual.

La cuota diaria observada bajó de 7.154 a 956: 6.198 unidades. Bajo el supuesto de que las 6.438 consultas de estadísticas descuentan una unidad cada una, la diferencia no reconciliada es de 240. Los artefactos no permiten atribuirla a uso concurrente de la cuenta ni a la contabilidad del proveedor; la causa queda indeterminada. El contador por minuto es una ventana móvil y no mide consumo acumulado.

No se ejecutaron `load`, importaciones, PostgreSQL ni snapshots. Esta expansión cubre temporadas 2010–2026; no completa el histórico anterior a 2010 ni autoriza publicar un ranking de carrera completa. El detalle verificable sin payloads está en el [informe JSON](./BLOCK45_QUOTA_BATCH_36428256771.json); los hashes de ese artefacto se declaran con el algoritmo canónico de claves ordenadas y omisión de `reportHash`.
