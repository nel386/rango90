# BLOQUE 45 — expansión por tandas, run 36436241212

Run de GitHub Actions en modo `expand`, reanudado desde el manifiesto del run `36434194837`. El checkpoint conserva sus hashes y prefijo de peticiones; el resultado conserva las 85 combinaciones base completas en cinco ligas para 2010–2026.

La preflight `/status` fue la primera petición. La cuota diaria observada era 72/7.500 y la ventana por minuto 299/300; el presupuesto automático fijó 65 intentos. Se completó la tanda con 65 respuestas HTTP 200: una preflight y 64 consultas únicas jugador-temporada. Hubo cero reintentos, respuestas 429 o errores del proveedor.

La expansión pasa de 8.682 a 8.746 pares completados; quedan 178.832 de 187.578. Los 11.034 jugadores elegibles y estos pares siguen limitados a temporadas 2010–2026; no constituyen un ranking de carrera completa. La cuota diaria terminó en 7. La tanda se detuvo en su presupuesto y no se hicieron más consultas.

La cabecera diaria pasó de 72 en la preflight a 7 al cierre: descenso observado 65 frente al descenso esperado de 64 entre la primera y la última respuesta, diferencia de una unidad. Entre el cierre anterior (312) y esta preflight (72) hubo además un descenso de 240. El intervalo conjunto 312→7 bajó 305 unidades. Estas cuentas describen las lecturas, pero no identifican la causa; permanece desconocida y no se ajusta ni atribuye. Los valores por minuto son de ventana y no expresan consumo acumulado.

No se ejecutaron `load`, importaciones, PostgreSQL ni snapshots. El informe JSON incluye hashes canónicos de manifiesto, cobertura, hechos y reporte; su hash excluye `reportHash`.
