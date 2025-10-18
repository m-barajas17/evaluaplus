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
    updateDoc,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const userNameElement = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const createRoomForm = document.getElementById('create-room-form');
const roomsListContainer = document.getElementById('rooms-list');

// --- ¡NUEVAS REFERENCIAS PARA LAS VISTAS! ---
// Estas nos permitirán cambiar fácilmente entre la vista principal y la de resultados.
const mainView = document.getElementById('main-view');
const resultsView = document.getElementById('results-view');
const resultsList = document.getElementById('results-list');
const resultsTitle = document.getElementById('results-title');
const backToMainViewBtn = document.getElementById('back-to-main-view-btn');


// --- FUNCIÓN AUXILIAR PARA GENERAR CÓDIGO ---
const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// --- LÓGICA PARA AÑADIR PREGUNTAS (Sin cambios) ---
const handleAddQuestion = async (roomId) => {
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

    let respuestaCorrecta = '';
    const respuestasValidas = ['A', 'B', 'C', 'D'];
    while (!respuestasValidas.includes(respuestaCorrecta)) {
        const input = prompt("¿Cuál es la respuesta correcta? (A, B, C, o D)");
        if (input === null) return;
        respuestaCorrecta = input.trim().toUpperCase();
        if (!respuestasValidas.includes(respuestaCorrecta)) {
            alert("Respuesta inválida. Por favor, introduce solo la letra A, B, C, o D.");
        }
    }

    const nuevaPregunta = {
        pregunta: preguntaTexto,
        opciones: { A: opcionA, B: opcionB, C: opcionC, D: opcionD },
        correcta: respuestaCorrecta
    };

    try {
        const roomDocRef = doc(db, "salas", roomId);
        await updateDoc(roomDocRef, {
            preguntas: arrayUnion(nuevaPregunta)
        });
        alert("¡Pregunta añadida con éxito!");
    } catch (error) {
        console.error("Error al añadir la pregunta:", error);
        alert("Ocurrió un error al guardar la pregunta. Inténtalo de nuevo.");
    }
};

// --- ¡NUEVA LÓGICA PARA MOSTRAR RESULTADOS! ---
/**
 * Consulta y muestra los resultados de una sala de evaluación específica.
 * @param {string} roomId - El ID del documento de la sala.
 * @param {string} roomTitle - El título de la sala para mostrarlo en la vista.
 */
const handleShowResults = async (roomId, roomTitle) => {
    // 1. Preparamos la interfaz
    resultsTitle.textContent = `Resultados de "${roomTitle}"`; // Ponemos el título correcto
    resultsList.innerHTML = '<p>Cargando resultados...</p>'; // Mensaje de carga

    // 2. Creamos la consulta a la colección 'resultados'
    // Buscamos todos los documentos donde el campo 'salaId' sea igual al ID de la sala seleccionada.
    const q = query(collection(db, "resultados"), where("salaId", "==", roomId));

    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            resultsList.innerHTML = '<p>Aún no hay resultados para esta evaluación.</p>';
        } else {
            // Si hay resultados, limpiamos el contenedor y los procesamos
            resultsList.innerHTML = '';
            querySnapshot.forEach(doc => {
                const result = doc.data();
                // Creamos un elemento HTML para cada resultado
                const resultItem = `
                    <div class="result-item">
                        <span class="result-item-name">${result.nombreEstudiante}</span>
                        <span class="result-item-score">${result.calificacion} / ${result.totalPreguntas}</span>
                    </div>
                `;
                // Lo añadimos a la lista
                resultsList.innerHTML += resultItem;
            });
        }
    } catch (error) {
        console.error("Error al obtener los resultados:", error);
        resultsList.innerHTML = '<p>Ocurrió un error al cargar los resultados.</p>';
    }

    // 3. Mostramos la vista de resultados y ocultamos la principal
    mainView.style.display = 'none';
    resultsView.style.display = 'block';
};


// --- LÓGICA DE VISUALIZACIÓN DE SALAS (ACTUALIZADA) ---
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
            const roomId = doc.id;

            // --- ¡HTML DE LA TARJETA ACTUALIZADO! ---
            // Añadimos el nuevo botón "Ver Resultados" y envolvemos los botones en un div.
            // Pasamos tanto el ID como el título a los botones para usarlos después.
            const roomCard = `
                <div class="room-card">
                    <div>
                        <h3>${room.titulo}</h3>
                        <p>Materia: ${room.materia}</p>
                        <div class="room-code">
                            Código: <span>${room.codigoAcceso}</span>
                        </div>
                    </div>
                    <div class="room-actions">
                        <button class="manage-button" data-room-id="${roomId}">Gestionar Evaluación</button>
                        <button class="view-results-button" data-room-id="${roomId}" data-room-title="${room.titulo}">Ver Resultados</button>
                    </div>
                </div>
            `;
            roomsListContainer.innerHTML += roomCard;
        });

    } catch (error) {
        console.error("Error al obtener las salas:", error);
        roomsListContainer.innerHTML = '<p>Ocurrió un error al cargar tus salas.</p>';
    }
};


// --- LÓGICA DE CREACIÓN DE SALAS (Sin cambios) ---
const handleCreateRoom = async (e, userId) => {
    e.preventDefault();
    const title = createRoomForm['title'].value;
    const subject = createRoomForm['subject'].value;
    const accessCode = generateAccessCode();

    try {
        await addDoc(collection(db, "salas"), {
            titulo: title,
            materia: subject,
            docenteId: userId,
            codigoAcceso: accessCode,
            preguntas: []
        });
        alert(`¡Sala "${title}" creada con éxito!\nCódigo de acceso: ${accessCode}`);
        createRoomForm.reset();
        await displayTeacherRooms(userId);
    } catch (error) {
        console.error("Error al crear la sala:", error);
        alert("Ocurrió un error al crear la sala.");
    }
};


// --- FUNCIÓN DE INICIALIZACIÓN DEL PANEL (ACTUALIZADA) ---
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

    // --- ¡EVENT LISTENER POR DELEGACIÓN ACTUALIZADO! ---
    // Ahora gestiona los clics para ambos botones.
    roomsListContainer.addEventListener('click', (e) => {
        const target = e.target;
        // Si se hace clic en el botón de gestionar
        if (target.classList.contains('manage-button')) {
            const roomId = target.dataset.roomId;
            handleAddQuestion(roomId);
        }
        // Si se hace clic en el botón de ver resultados
        if (target.classList.contains('view-results-button')) {
            const roomId = target.dataset.roomId;
            const roomTitle = target.dataset.roomTitle;
            handleShowResults(roomId, roomTitle);
        }
    });
    
    // --- ¡NUEVO EVENT LISTENER PARA EL BOTÓN DE VOLVER! ---
    backToMainViewBtn.addEventListener('click', () => {
        resultsView.style.display = 'none';
        mainView.style.display = 'block';
    });


    displayTeacherRooms(userData.uid);
};


// --- GUARDIÁN DE RUTA (Sin cambios) ---
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