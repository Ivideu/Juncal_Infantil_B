# Zona entrenador: pasos en Firebase (una sola vez)

## 1. Crear los 10 usuarios (uno por equipo)
Firebase → **Authentication → Users → Add user**. El correo es el nombre del equipo + `@entrenador.juncal.app` (no hace falta que exista) y la contraseña la eliges tú y se la das al entrenador de ese equipo.

| Equipo | Correo | Contraseña |
|---|---|---|
| Aficionado A | aficionado-a@entrenador.juncal.app | (la que quieras) |
| Aficionado B | aficionado-b@entrenador.juncal.app | |
| Juvenil A | juvenil-a@entrenador.juncal.app | |
| Juvenil B | juvenil-b@entrenador.juncal.app | |
| Cadete A | cadete-a@entrenador.juncal.app | |
| Cadete B | cadete-b@entrenador.juncal.app | |
| Infantil A | infantil-a@entrenador.juncal.app | |
| Infantil B | infantil-b@entrenador.juncal.app | |
| Alevín A | alevin-a@entrenador.juncal.app | |
| Alevín B | alevin-b@entrenador.juncal.app | |

Crea los 10 antes de publicar la web. Cambiar una contraseña = editar el usuario en esa misma pantalla.

## 2. Añadir reglas (sin borrar las que ya tienes)
Firebase → **Realtime Database → Reglas**. Deja tus reglas de `juncal` como están y añade, dentro de `"rules": { ... }`, estos cuatro bloques (separados por comas):

```json
"equipos": {
  "$eq": {
    ".read":  "auth != null && (auth.token.email == $eq + '@entrenador.juncal.app' || auth.token.email == 'ivanblasco81@hotmail.com')",
    ".write": "auth != null && (auth.token.email == $eq + '@entrenador.juncal.app' || auth.token.email == 'ivanblasco81@hotmail.com')"
  }
},
"entrenos": {
  "$eq": {
    ".read":  "auth != null && (auth.token.email == $eq + '@entrenador.juncal.app' || auth.token.email == 'ivanblasco81@hotmail.com')",
    ".write": "auth != null && (auth.token.email == $eq + '@entrenador.juncal.app' || auth.token.email == 'ivanblasco81@hotmail.com')"
  }
},
"convocatoria": {
  ".read": true,
  "$eq": {
    ".write": "auth != null && (auth.token.email == $eq + '@entrenador.juncal.app' || auth.token.email == 'ivanblasco81@hotmail.com')"
  }
},
"estadisticas": {
  ".read": true,
  "$eq": {
    ".write": "auth != null && (auth.token.email == $eq + '@entrenador.juncal.app' || auth.token.email == 'ivanblasco81@hotmail.com')"
  }
}
```

Qué hace cada bloque:
- `equipos` (plantilla) y `entrenos` (asistencia): **privados**. Solo los lee y escribe el entrenador de ese equipo y tú. Nadie más, aunque abra la web.
- `convocatoria` y `estadisticas`: **públicos para leer** (solo nombres de pila de convocados, goles y tarjetas), y solo escribe el entrenador de su equipo.

## 3. Poner el botón en cada página de categoría
En cada archivo `Categorias/XxxxX.html`, justo antes de `</body>`:
```html
<script src="../entrenador.js" defer></script>
```
El equipo se saca del nombre del archivo (`InfantilA.html` → infantil-a). Sube `entrenador.js` a la raíz del repositorio.

Opcional, para enseñar datos públicos dentro de la página, donde quieras que salgan:
```html
<div id="convocadosPublico"></div>
<div id="goleadoresPublico"></div>
```
Y si quieres el botón en un sitio concreto en vez de flotante: `<div id="zonaEntrenador"></div>`.

## Infantil B
La app (`index.html`) ya tiene su convocatoria SÍ/NO en la pestaña Jugadores y ahora la pestaña **Entrenos** del panel de administrador. Por eso no hace falta poner `entrenador.js` en la página del Infantil B; si lo pusieras, su convocatoria sería otra distinta de la de la app.
