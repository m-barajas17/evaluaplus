// js/docente.js

// Importamos las funciones necesarias de Firebase.
import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    // --- ¡NUEVAS IMPORTACIONES! ---
    // updateDoc nos permite modificar un documento existente.
    updateDoc,
    // arrayUnion nos permite añadir un elemento a un array en Firestore.
    // Es la forma correcta de hacerlo para evitar problemas de concurrencia.
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const userNameElement = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const createRoomForm = document.getElementById('create-room-form');
const roomsListContainer = document.getElementById('rooms-list');


// --- FUNCIÓN AUXILIAR PARA GENERAR CÓDIGO ---
const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// --- NUEVA LÓGICA PARA AÑADIR PREGUNTAS ---

/**
 * Gestiona la adición de una nueva pregunta a una sala específica.
 * @param {string} roomId - El ID del documento de la sala en Firestore.
 */
const handleAddQuestion = async (roomId) => {
    // 1. Pedimos los datos al docente usando prompts.
    // Si el docente presiona "Cancelar", el prompt devuelve null, y la función se detiene.
    const preguntaTexto = prompt("Introduce el texto de la pregunta:");
    if (!preguntaTexto) return;

    const opcionA = prompt("Introduce la Opción A:");
    if (!opcionA) return;
    const opcionB = prompt("Introduce la Opción B:");
    if (!opcionB) return;
    const opcionC = prompt("Introduce la Opción C:");
    if (!opcionC) return;
    const opcionD = prompt("Introduce la Opción D:");
    if (!opcionD) return;

    // 2. Pedimos la respuesta correcta y validamos la entrada.
    // Usamos un bucle para asegurar que la respuesta sea A, B, C, o D.
    let respuestaCorrecta = '';
    const respuestasValidas = ['A', 'B', 'C', 'D'];
    while (!respuestasValidas.includes(respuestaCorrecta)) {
        const input = prompt("¿Cuál es la respuesta correcta? (A, B, C, o D)");
        if (input === null) return; // Si cancela, salimos.
        respuestaCorrecta = input.trim().toUpperCase();
        if (!respuestasValidas.includes(respuestaCorrecta)) {
            alert("Respuesta inválida. Por favor, introduce solo la letra A, B, C, o D.");
        }
    }

    // 3. Creamos un objeto que representa la nueva pregunta.
    // La estructura de este objeto es como se guardará en Firestore.
    const nuevaPregunta = {
        pregunta: preguntaTexto,
        opciones: {
            A: opcionA,
            B: opcionB,
            C: opcionC,
            D: opcionD
        },
        correcta: respuestaCorrecta
    };

    try {
        // 4. Actualizamos el documento en Firestore.
        // Obtenemos la referencia al documento específico de la sala.
        const roomDocRef = doc(db, "salas", roomId);

        // Usamos updateDoc para añadir la nueva pregunta al array 'preguntas'.
        await updateDoc(roomDocRef, {
            preguntas: arrayUnion(nuevaPregunta)
        });

        alert("¡Pregunta añadida con éxito!");

    } catch (error) {
        console.error("Error al añadir la pregunta:", error);
        alert("Ocurrió un error al guardar la pregunta. Inténtalo de nuevo.");
    }
};


// --- LÓGICA DE VISUALIZACIÓN ---
const displayTeacherRooms = async (userId) => {
    roomsListContainer.innerHTML = '';
    const q = query(collection(db, "salas"), where("docenteId", "==", userId));

    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            roomsListContainer.innerHTML = '<p>Aún no has creado ninguna sala.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const room = doc.data();
            // --- ¡CAMBIO IMPORTANTE! ---
            // Obtenemos el ID del documento. Lo necesitaremos para saber
            // qué sala actualizar cuando se añada una pregunta.
            const roomId = doc.id;

            // --- ¡HTML ACTUALIZADO! ---
            // Añadimos el nuevo botón "Gestionar Evaluación".
            // Usamos un atributo 'data-room-id' para "guardar" el ID de la sala
            // directamente en el botón. Esto nos facilita recuperarlo después.
            const roomCard = `
                <div class="room-card">
                    <h3>${room.titulo}</h3>
                    <p>Materia: ${room.materia}</p>
                    <div class="room-code">
                        Código: <span>${room.codigoAcceso}</span>
                    </div>
                    <button class="manage-button" data-room-id="${roomId}">Gestionar Evaluación</button>
                </div>
            `;
            roomsListContainer.innerHTML += roomCard;
        });

    } catch (error) {
        console.error("Error al obtener las salas:", error);
        roomsListContainer.innerHTML = '<p>Ocurrió un error al cargar tus salas.</p>';
    }
};


// --- LÓGICA DE CREACIÓN ---
const handleCreateRoom = async (e, userId) => {
    e.preventDefault();
    const title = createRoomForm['title'].value;
    const subject = createRoomForm['subject'].value;
    const accessCode = generateAccessCode();

    try {
        const newRoom = {
            titulo: title,
            materia: subject,
            docenteId: userId,
            codigoAcceso: accessCode,
            preguntas: []
        };
        await addDoc(collection(db, "salas"), newRoom);
        alert(`¡Sala "${title}" creada con éxito!\nCódigo de acceso: ${accessCode}`);
        createRoomForm.reset();
        await displayTeacherRooms(userId);

    } catch (error) {
        console.error("Error al crear la sala:", error);
        alert("Ocurrió un error al crear la sala.");
    }
};


// --- FUNCIÓN DE INICIALIZACIÓN DEL PANEL ---
const initializePanel = (userData) => {
    userNameElement.textContent = `Bienvenido, ${userData.nombre}`;

    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
        }
    });

    createRoomForm.addEventListener('submit', (e) => handleCreateRoom(e, userData.uid));

    // --- ¡NUEVO EVENT LISTENER POR DELEGACIÓN! ---
    // Añadimos un único 'escuchador' al contenedor principal de las salas.
    // Este se encargará de cualquier clic que ocurra dentro de él.
    roomsListContainer.addEventListener('click', (e) => {
        // Verificamos si el elemento clickeado tiene la clase 'manage-button'.
        if (e.target.classList.contains('manage-button')) {
            // Si es así, obtenemos el ID de la sala desde el atributo 'data-room-id'.
            const roomId = e.target.dataset.roomId;
            // Llamamos a nuestra nueva función para iniciar el proceso.
            handleAddQuestion(roomId);
        }
    });

    displayTeacherRooms(userData.uid);
};


// --- GUARDIÁN DE RUTA ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userUid = user.uid;
        const userDocRef = doc(db, "users", userUid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                userData.uid = userUid;
                if (userData.rol === 'docente') {
                    initializePanel(userData);
                } else {
                    alert("Acceso no autorizado.");
                    window.location.href = 'index.html';
                }
            } else {
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error("Error al obtener datos:", error);
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});