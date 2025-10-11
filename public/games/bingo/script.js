const totalNumbers = 90;
let available = Array.from({ length: totalNumbers }, (_, i) => i + 1);
const drawn = [];

const currentNumberEl = document.getElementById("currentNumber");
const numbersEl = document.getElementById("numbers");

// Mostrar todos los números inicialmente
for (let i = 1; i <= totalNumbers; i++) {
    const div = document.createElement("div");
    div.textContent = i;
    div.classList.add("number");
    div.id = `num-${i}`;
    numbersEl.appendChild(div);
}

function drawNumber() {
    if (available.length === 0) {
    currentNumberEl.textContent = "🎉 Fin del juego 🎉";
    return;
    }

    const randomIndex = Math.floor(Math.random() * available.length);
    const number = available.splice(randomIndex, 1)[0];
    drawn.push(number);

    currentNumberEl.textContent = number;

    // Resaltar el número como ya sorteado
    document.getElementById(`num-${number}`).classList.add("drawn");
}