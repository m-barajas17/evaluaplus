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

// --- REFERENCIAS PARA LAS VISTAS ---
const mainView = document.getElementById('main-view');
const resultsView = document.getElementById('results-view');
const resultsList = document.getElementById('results-list');
const resultsTitle = document.getElementById('results-title');
const backToMainViewBtn = document.getElementById('back-to-main-view-btn');

// --- ¡NUEVAS REFERENCIAS PARA EL MODAL DE PREGUNTAS! ---
const addQuestionModal = document.getElementById('add-question-modal');
const addQuestionForm = document.getElementById('add-question-form');
const cancelQuestionBtn = document.getElementById('cancel-question-btn');

// --- Variable para guardar el ID de la sala actual ---
let currentRoomId = null;

// --- FUNCIÓN AUXILIAR PARA GENERAR CÓDIGO ---
const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// --- ¡NUEVA LÓGICA PARA GESTIONAR EL MODAL! ---
/**
 * Abre el modal para añadir una pregunta y guarda el ID de la sala.
 * @param {string} roomId - El ID del documento de la sala.
 */
const openAddQuestionModal = (roomId) => {
    currentRoomId = roomId; // Guardamos el ID de la sala
    addQuestionModal.style.display = 'flex';
    setTimeout(() => {
        addQuestionModal.classList.add('active');
    }, 10); // Pequeño delay para que la transición CSS funcione
};

/**
 * Cierra el modal y limpia el formulario.
 */
const closeAddQuestionModal = () => {
    addQuestionModal.classList.remove('active');
    setTimeout(() => {
        addQuestionModal.style.display = 'none';
        addQuestionForm.reset();
        currentRoomId = null; // Limpiamos el ID
    }, 300); // Coincide con la duración de la transición en CSS
};


// --- ¡LÓGICA DE AÑADIR PREGUNTAS REFACTORIZADA! ---
/**
 * Gestiona el envío del formulario del modal para añadir una nueva pregunta.
 * @param {Event} e - El evento de envío del formulario.
 */
const handleAddQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!currentRoomId) {
        console.error("No se ha especificado un ID de sala.");
        return;
    }

    // Recopilamos todos los datos del formulario del modal
    const preguntaTexto = addQuestionForm.querySelector('#question-text').value;
    const opcionA = addQuestionForm.querySelector('#option-a').value;
    const opcionB = addQuestionForm.querySelector('#option-b').value;
    const opcionC = addQuestionForm.querySelector('#option-c').value;
    const opcionD = addQuestionForm.querySelector('#option-d').value;
    const respuestaCorrecta = addQuestionForm.querySelector('input[name="correct-answer"]:checked').value;
    const feedbackCorrecto = addQuestionForm.querySelector('#feedback-correct').value;
    const feedbackIncorrecto = addQuestionForm.querySelector('#feedback-incorrect').value;

    // Creamos el nuevo objeto de pregunta con la estructura actualizada
    const nuevaPregunta = {
        pregunta: preguntaTexto,
        opciones: { A: opcionA, B: opcionB, C: opcionC, D: opcionD },
        correcta: respuestaCorrecta,
        feedbackCorrecto: feedbackCorrecto || "¡Respuesta Correcta!", // Feedback por defecto
        feedbackIncorrecto: feedbackIncorrecto || `La respuesta correcta era ${respuestaCorrecta}.` // Feedback por defecto
    };

    try {
        const roomDocRef = doc(db, "salas", currentRoomId);
        await updateDoc(roomDocRef, {
            preguntas: arrayUnion(nuevaPregunta)
        });
        alert("¡Pregunta añadida con éxito!");
        closeAddQuestionModal(); // Cerramos el modal tras el éxito
    } catch (error) {
        console.error("Error al añadir la pregunta:", error);
        alert("Ocurrió un error al guardar la pregunta. Inténtalo de nuevo.");
    }
};


// --- LÓGICA PARA MOSTRAR RESULTADOS (Sin cambios) ---
const handleShowResults = async (roomId, roomTitle) => {
    resultsTitle.textContent = `Resultados de "${roomTitle}"`;
    resultsList.innerHTML = '<p>Cargando resultados...</p>';
    const q = query(collection(db, "resultados"), where("salaId", "==", roomId));

    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            resultsList.innerHTML = '<p>Aún no hay resultados para esta evaluación.</p>';
        } else {
            resultsList.innerHTML = '';
            querySnapshot.forEach(doc => {
                const result = doc.data();
                const resultItem = `
                    <div class="result-item">
                        <span class="result-item-name">${result.nombreEstudiante}</span>
                        <span class="result-item-score">${result.calificacion} / ${result.totalPreguntas}</span>
                    </div>
                `;
                resultsList.innerHTML += resultItem;
            });
        }
    } catch (error) {
        console.error("Error al obtener los resultados:", error);
        resultsList.innerHTML = '<p>Ocurrió un error al cargar los resultados.</p>';
    }

    mainView.style.display = 'none';
    resultsView.style.display = 'block';
};


// --- LÓGICA DE VISUALIZACIÓN DE SALAS (Sin cambios) ---
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

    // Event listener para los botones de las tarjetas de sala
    roomsListContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('manage-button')) {
            const roomId = target.dataset.roomId;
            openAddQuestionModal(roomId); // ¡Ahora abre el modal!
        }
        if (target.classList.contains('view-results-button')) {
            const roomId = target.dataset.roomId;
            const roomTitle = target.dataset.roomTitle;
            handleShowResults(roomId, roomTitle);
        }
    });
    
    // --- ¡NUEVOS EVENT LISTENERS PARA EL MODAL! ---
    addQuestionForm.addEventListener('submit', handleAddQuestionSubmit);
    cancelQuestionBtn.addEventListener('click', closeAddQuestionModal);
    addQuestionModal.addEventListener('click', (e) => {
        // Cierra el modal si se hace clic en el overlay de fondo
        if (e.target === addQuestionModal) {
            closeAddQuestionModal();
        }
    });

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