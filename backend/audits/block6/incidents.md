# Incidencias BLOQUE 6

## P0

Ninguna incidencia P0 confirmada. La auditoría visual no se ejecutó, por lo que esto no constituye una certificación visual.

## P1

Se ha confirmado un bloqueo P1 en el despliegue público y permanece pendiente la auditoría visual, no como defectos resueltos:

- auditoría móvil visual pendiente;
- `/v1/config` devuelve 404 y no expone el modo;
- el reto público continúa marcado `testOnly=true`;
- el ranking público devuelve el contrato antiguo.

## P2

Ninguna incidencia P2 confirmada en las pruebas ejecutadas.

La puerta de publicación mantiene estos pendientes fuera de producción y devuelve `readyForRelease=false`.
