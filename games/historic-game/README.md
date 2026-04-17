# Historic Game

Juego de cartas historicas para ordenar eventos en una linea de tiempo.

## Flujo

1. Elegir un mazo cargado desde JSON.
2. Elegir modalidad facil o dificil.
3. Seleccionar 2 o 3 jugadores. Cada jugador empieza con 6 cartas.
4. Iniciar una partida con orden de turno y cartas sorteadas una sola vez.
5. Arrastrar una carta del jugador actual a la linea de tiempo y validar su posicion.
6. En modo dificil, si falla, la carta se revela en su posicion correcta y el jugador roba una carta del mazo si quedan disponibles.
7. En modo facil, si falla, la carta se revela, va al descarte y el jugador roba una carta del mazo si quedan disponibles.
8. El primer jugador que se queda sin cartas gana y termina la partida.

## Datos

El mazo inicial vive en `data/historia-general.json` e incluye 10 eventos. Para agregar mazos, crea otro JSON con la misma estructura y registralo en `script.js`.
