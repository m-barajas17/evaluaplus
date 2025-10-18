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
    updateDoc
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

// --- ¡NUEVAS REFERENCIAS PARA LA VISTA DE GESTIÓN DE PREGUNTAS! ---
const manageQuestionsView = document.getElementById('manage-questions-view');
const questionsTitle = document.getElementById('questions-title');
const questionsListContainer = document.getElementById('questions-list-container');
const addNewQuestionBtn = document.getElementById('add-new-question-btn');

// --- REFERENCIAS PARA EL MODAL DE PREGUNTAS ---
const addQuestionModal = document.getElementById('add-question-modal');
const addQuestionForm = document.getElementById('add-question-form');
const modalTitle = document.getElementById('modal-title');
const saveQuestionBtn = document.getElementById('save-question-btn');
const cancelQuestionBtn = document.getElementById('cancel-question-btn');


// --- VARIABLES DE ESTADO ---
let currentRoomId = null;
let editingQuestionIndex = null; // null para añadir, un número para editar

// --- FUNCIÓN AUXILIAR PARA GENERAR CÓDIGO ---
const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// --- GESTIÓN DEL MODAL ---
const openAddQuestionModal = () => {
    editingQuestionIndex = null; // Modo "Añadir"
    modalTitle.textContent = 'Añadir Nueva Pregunta';
    saveQuestionBtn.textContent = 'Guardar Pregunta';
    addQuestionForm.reset();
    addQuestionModal.style.display = 'flex';
    setTimeout(() => addQuestionModal.classList.add('active'), 10);
};

const openEditQuestionModal = (question, index) => {
    editingQuestionIndex = index; // Modo "Editar"
    modalTitle.textContent = 'Editar Pregunta';
    saveQuestionBtn.textContent = 'Guardar Cambios';
    
    // Poblar el formulario con los datos de la pregunta
    addQuestionForm.querySelector('#question-text').value = question.pregunta;
    addQuestionForm.querySelector('#option-a').value = question.opciones.A;
    addQuestionForm.querySelector('#option-b').value = question.opciones.B;
    addQuestionForm.querySelector('#option-c').value = question.opciones.C;
    addQuestionForm.querySelector('#option-d').value = question.opciones.D;
    addQuestionForm.querySelector(`input[name="correct-answer"][value="${question.correcta}"]`).checked = true;
    addQuestionForm.querySelector('#feedback-correct').value = question.feedbackCorrecto || '';
    addQuestionForm.querySelector('#feedback-incorrect').value = question.feedbackIncorrecto || '';

    addQuestionModal.style.display = 'flex';
    setTimeout(() => addQuestionModal.classList.add('active'), 10);
};

const closeAddQuestionModal = () => {
    addQuestionModal.classList.remove('active');
    setTimeout(() => {
        addQuestionModal.style.display = 'none';
        addQuestionForm.reset();
        editingQuestionIndex = null; // Limpiamos el estado de edición
    }, 300);
};

// --- LÓGICA CRUD PARA PREGUNTAS ---

const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!currentRoomId) {
        console.error("ID de sala no especificado.");
        return;
    }

    const nuevaPregunta = {
        pregunta: addQuestionForm.querySelector('#question-text').value,
        opciones: {
            A: addQuestionForm.querySelector('#option-a').value,
            B: addQuestionForm.querySelector('#option-b').value,
            C: addQuestionForm.querySelector('#option-c').value,
            D: addQuestionForm.querySelector('#option-d').value,
        },
        correcta: addQuestionForm.querySelector('input[name="correct-answer"]:checked').value,
        feedbackCorrecto: addQuestionForm.querySelector('#feedback-correct').value || "¡Respuesta Correcta!",
        feedbackIncorrecto: addQuestionForm.querySelector('#feedback-incorrect').value || "La respuesta es incorrecta."
    };

    try {
        const roomDocRef = doc(db, "salas", currentRoomId);
        const roomDocSnap = await getDoc(roomDocRef);
        const roomData = roomDocSnap.data();
        let preguntasActualizadas = [...roomData.preguntas];

        if (editingQuestionIndex !== null) { // Modo Editar
            preguntasActualizadas[editingQuestionIndex] = nuevaPregunta;
        } else { // Modo Añadir
            preguntasActualizadas.push(nuevaPregunta);
        }

        await updateDoc(roomDocRef, { preguntas: preguntasActualizadas });
        
        alert(editingQuestionIndex !== null ? "¡Pregunta actualizada!" : "¡Pregunta añadida!");
        closeAddQuestionModal();
        await displayQuestionsForRoom(currentRoomId); // Refrescar la lista de preguntas
    } catch (error) {
        console.error("Error al guardar la pregunta:", error);
        alert("Ocurrió un error al guardar la pregunta.");
    }
};

const handleDeleteQuestion = async (index) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta pregunta?')) {
        return;
    }
    if (!currentRoomId) return;

    try {
        const roomDocRef = doc(db, "salas", currentRoomId);
        const roomDocSnap = await getDoc(roomDocRef);
        const roomData = roomDocSnap.data();
        
        // Creamos un nuevo array excluyendo la pregunta en el índice a eliminar
        const preguntasActualizadas = roomData.preguntas.filter((_, i) => i !== index);

        await updateDoc(roomDocRef, { preguntas: preguntasActualizadas });
        
        alert("¡Pregunta eliminada con éxito!");
        await displayQuestionsForRoom(currentRoomId); // Refrescar la lista
    } catch (error) {
        console.error("Error al eliminar la pregunta:", error);
        alert("Ocurrió un error al eliminar la pregunta.");
    }
};

// --- GESTIÓN DE VISTAS Y RENDERIZADO ---

const switchToView = (viewToShow) => {
    mainView.style.display = 'none';
    resultsView.style.display = 'none';
    manageQuestionsView.style.display = 'none';
    viewToShow.style.display = 'block';
};

const displayQuestionsForRoom = async (roomId) => {
    currentRoomId = roomId;
    const roomDocRef = doc(db, "salas", roomId);
    try {
        const roomDocSnap = await getDoc(roomDocRef);
        if (!roomDocSnap.exists()) {
            console.error("La sala no existe.");
            switchToView(mainView);
            return;
        }
        const roomData = roomDocSnap.data();
        questionsTitle.textContent = `Gestionando: "${roomData.titulo}"`;
        questionsListContainer.innerHTML = ''; // Limpiar lista

        if (roomData.preguntas && roomData.preguntas.length > 0) {
            roomData.preguntas.forEach((question, index) => {
                const questionItem = document.createElement('div');
                questionItem.className = 'question-item';
                questionItem.innerHTML = `
                    <span class="question-item-text">${index + 1}. ${question.pregunta}</span>
                    <div class="question-item-actions">
                        <button class="cta-button secondary edit-btn">Editar</button>
                        <button class="cta-button danger delete-btn">Eliminar</button>
                    </div>
                `;
                questionItem.querySelector('.edit-btn').addEventListener('click', () => openEditQuestionModal(question, index));
                questionItem.querySelector('.delete-btn').addEventListener('click', () => handleDeleteQuestion(index));
                questionsListContainer.appendChild(questionItem);
            });
        } else {
            questionsListContainer.innerHTML = '<p>Esta evaluación aún no tiene preguntas. ¡Añade la primera!</p>';
        }

        switchToView(manageQuestionsView);

    } catch (error) {
        console.error("Error al cargar las preguntas de la sala:", error);
    }
};


const handleShowResults = async (roomId, roomTitle) => {
    resultsTitle.textContent = `Resultados de "${roomTitle}"`;
    resultsList.innerHTML = '<p>Cargando resultados...</p>';
    const q = query(collection(db, "resultados"), where("salaId", "==", roomId));

    try {
        const querySnapshot = await getDocs(q);
        resultsList.innerHTML = querySnapshot.empty
            ? '<p>Aún no hay resultados para esta evaluación.</p>'
            : querySnapshot.docs.map(doc => {
                const result = doc.data();
                return `
                    <div class="result-item">
                        <span class="result-item-name">${result.nombreEstudiante}</span>
                        <span class="result-item-score">${result.calificacion} / ${result.totalPreguntas}</span>
                    </div>`;
            }).join('');
    } catch (error) {
        console.error("Error al obtener los resultados:", error);
        resultsList.innerHTML = '<p>Ocurrió un error al cargar los resultados.</p>';
    }
    switchToView(resultsView);
};

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
                        <div class="room-code">Código: <span>${room.codigoAcceso}</span></div>
                    </div>
                    <div class="room-actions">
                        <button class="manage-button" data-room-id="${roomId}">Gestionar Evaluación</button>
                        <button class="view-results-button" data-room-id="${roomId}" data-room-title="${room.titulo}">Ver Resultados</button>
                    </div>
                </div>`;
            roomsListContainer.innerHTML += roomCard;
        });
    } catch (error) {
        console.error("Error al obtener las salas:", error);
        roomsListContainer.innerHTML = '<p>Ocurrió un error al cargar tus salas.</p>';
    }
};

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

// --- INICIALIZACIÓN DEL PANEL ---
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

    roomsListContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('manage-button')) {
            const roomId = target.dataset.roomId;
            displayQuestionsForRoom(roomId); // Ahora muestra la vista de gestión
        }
        if (target.classList.contains('view-results-button')) {
            const roomId = target.dataset.roomId;
            const roomTitle = target.dataset.roomTitle;
            handleShowResults(roomId, roomTitle);
        }
    });

    document.querySelectorAll('.back-to-main').forEach(btn => {
        btn.addEventListener('click', () => switchToView(mainView));
    });

    addNewQuestionBtn.addEventListener('click', openAddQuestionModal);
    addQuestionForm.addEventListener('submit', handleQuestionSubmit);
    cancelQuestionBtn.addEventListener('click', closeAddQuestionModal);
    addQuestionModal.addEventListener('click', (e) => {
        if (e.target === addQuestionModal) {
            closeAddQuestionModal();
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
                const userData = { ...userDocSnap.data(), uid: userUid };
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