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

// --- REFERENCIAS PARA LA VISTA DE GESTIÓN DE PREGUNTAS ---
const manageQuestionsView = document.getElementById('manage-questions-view');
const questionsTitle = document.getElementById('questions-title');
const questionsListContainer = document.getElementById('questions-list-container');
const addNewQuestionBtn = document.getElementById('add-new-question-btn');
const addFromBankBtn = document.getElementById('add-from-bank-btn'); // <-- NUEVO

// --- REFERENCIAS PARA EL MODAL DE PREGUNTAS ---
const addQuestionModal = document.getElementById('add-question-modal');
const addQuestionForm = document.getElementById('add-question-form');
const modalTitle = document.getElementById('modal-title');
const saveQuestionBtn = document.getElementById('save-question-btn');
const cancelQuestionBtn = document.getElementById('cancel-question-btn');
const saveToBankCheckbox = document.getElementById('save-to-bank'); // <-- NUEVO

// --- ¡NUEVAS REFERENCIAS PARA EL MODAL DEL BANCO! ---
const bankModal = document.getElementById('bank-modal');
const subjectFilter = document.getElementById('subject-filter');
const bankQuestionsList = document.getElementById('bank-questions-list');
const cancelBankBtn = document.getElementById('cancel-bank-btn');
const addSelectedQuestionsBtn = document.getElementById('add-selected-questions-btn');


// --- VARIABLES DE ESTADO ---
let currentRoomId = null;
let currentUserId = null; // Guardaremos el UID del usuario aquí
let editingQuestionIndex = null; // null para añadir, un número para editar
let bankQuestionsCache = []; // <-- NUEVO: Caché para preguntas del banco

// --- FUNCIÓN AUXILIAR PARA GENERAR CÓDIGO ---
const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// --- GESTIÓN DEL MODAL AÑADIR/EDITAR PREGUNTA ---
const openAddQuestionModal = () => {
    editingQuestionIndex = null;
    modalTitle.textContent = 'Añadir Nueva Pregunta';
    saveQuestionBtn.textContent = 'Guardar Pregunta';
    saveToBankCheckbox.parentElement.style.display = 'flex'; // Mostrar opción
    addQuestionForm.reset();
    addQuestionModal.style.display = 'flex';
};

const openEditQuestionModal = (question, index) => {
    editingQuestionIndex = index;
    modalTitle.textContent = 'Editar Pregunta';
    saveQuestionBtn.textContent = 'Guardar Cambios';
    saveToBankCheckbox.parentElement.style.display = 'none'; // Ocultar en modo edición
    
    addQuestionForm.querySelector('#question-text').value = question.pregunta;
    addQuestionForm.querySelector('#option-a').value = question.opciones.A;
    addQuestionForm.querySelector('#option-b').value = question.opciones.B;
    addQuestionForm.querySelector('#option-c').value = question.opciones.C;
    addQuestionForm.querySelector('#option-d').value = question.opciones.D;
    addQuestionForm.querySelector(`input[name="correct-answer"][value="${question.correcta}"]`).checked = true;
    addQuestionForm.querySelector('#feedback-correct').value = question.feedbackCorrecto || '';
    addQuestionForm.querySelector('#feedback-incorrect').value = question.feedbackIncorrecto || '';

    addQuestionModal.style.display = 'flex';
};

const closeAddQuestionModal = () => {
    addQuestionModal.style.display = 'none';
    addQuestionForm.reset();
    editingQuestionIndex = null;
};

// --- ¡NUEVA GESTIÓN DEL MODAL DEL BANCO! ---
const openBankModal = async () => {
    bankQuestionsList.innerHTML = '<p>Cargando preguntas...</p>';
    bankModal.style.display = 'flex';
    
    const q = query(collection(db, "bancoPreguntas"), where("docenteId", "==", currentUserId));
    const querySnapshot = await getDocs(q);

    bankQuestionsCache = querySnapshot.docs.map(doc => doc.data());

    // Poblar filtro de materias
    const materias = [...new Set(bankQuestionsCache.map(q => q.materia))];
    subjectFilter.innerHTML = '<option value="all">Todas las materias</option>';
    materias.forEach(materia => {
        subjectFilter.innerHTML += `<option value="${materia}">${materia}</option>`;
    });
    
    renderBankQuestions('all');
};

const closeBankModal = () => {
    bankModal.style.display = 'none';
};

const renderBankQuestions = (filter) => {
    const questionsToRender = filter === 'all' 
        ? bankQuestionsCache 
        : bankQuestionsCache.filter(q => q.materia === filter);

    if (questionsToRender.length === 0) {
        bankQuestionsList.innerHTML = '<p>No tienes preguntas en tu banco para esta materia.</p>';
        return;
    }

    bankQuestionsList.innerHTML = questionsToRender.map((q, index) => `
        <div class="bank-question-item">
            <input type="checkbox" id="bank-q-${index}" data-question-index="${index}">
            <label for="bank-q-${index}">${q.pregunta}</label>
        </div>
    `).join('');
};

// --- LÓGICA CRUD PARA PREGUNTAS ---

const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!currentRoomId || !currentUserId) return;

    const roomDocRef = doc(db, "salas", currentRoomId);
    const roomDocSnap = await getDoc(roomDocRef);
    const roomData = roomDocSnap.data();

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
        // --- LÓGICA MODIFICADA ---
        // 1. Guardar en el banco si está marcado (solo en modo "añadir")
        if (saveToBankCheckbox.checked && editingQuestionIndex === null) {
            await addDoc(collection(db, "bancoPreguntas"), {
                ...nuevaPregunta,
                docenteId: currentUserId,
                materia: roomData.materia 
            });
        }

        // 2. Actualizar la sala (lógica existente)
        let preguntasActualizadas = [...roomData.preguntas];
        if (editingQuestionIndex !== null) { // Modo Editar
            preguntasActualizadas[editingQuestionIndex] = nuevaPregunta;
        } else { // Modo Añadir
            preguntasActualizadas.push(nuevaPregunta);
        }

        await updateDoc(roomDocRef, { preguntas: preguntasActualizadas });
        
        alert(editingQuestionIndex !== null ? "¡Pregunta actualizada!" : "¡Pregunta añadida!");
        closeAddQuestionModal();
        await displayQuestionsForRoom(currentRoomId);
    } catch (error) {
        console.error("Error al guardar la pregunta:", error);
        alert("Ocurrió un error al guardar la pregunta.");
    }
};

const handleDeleteQuestion = async (index) => {
    if (!confirm('¿Estás seguro?')) return;
    if (!currentRoomId) return;

    try {
        const roomDocRef = doc(db, "salas", currentRoomId);
        const roomDocSnap = await getDoc(roomDocRef);
        const roomData = roomDocSnap.data();
        
        const preguntasActualizadas = roomData.preguntas.filter((_, i) => i !== index);

        await updateDoc(roomDocRef, { preguntas: preguntasActualizadas });
        
        alert("¡Pregunta eliminada!");
        await displayQuestionsForRoom(currentRoomId);
    } catch (error) {
        console.error("Error al eliminar:", error);
        alert("Ocurrió un error.");
    }
};

// --- ¡NUEVA LÓGICA PARA AÑADIR DESDE EL BANCO! ---
const handleAddFromBank = async () => {
    const selectedCheckboxes = bankQuestionsList.querySelectorAll('input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) {
        alert("Por favor, selecciona al menos una pregunta.");
        return;
    }

    const questionsToAdd = Array.from(selectedCheckboxes).map(cb => {
        const index = parseInt(cb.dataset.questionIndex);
        return bankQuestionsCache[index];
    });

    try {
        const roomDocRef = doc(db, "salas", currentRoomId);
        await updateDoc(roomDocRef, {
            preguntas: arrayUnion(...questionsToAdd)
        });

        alert(`¡${questionsToAdd.length} pregunta(s) añadida(s) con éxito!`);
        closeBankModal();
        await displayQuestionsForRoom(currentRoomId); // Refrescar vista
    } catch (error) {
        console.error("Error al añadir preguntas desde el banco:", error);
        alert("Ocurrió un error al añadir las preguntas.");
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
        if (!roomDocSnap.exists()) return;
        
        const roomData = roomDocSnap.data();
        questionsTitle.textContent = `Gestionando: "${roomData.titulo}"`;
        questionsListContainer.innerHTML = '';

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
        console.error("Error al cargar las preguntas:", error);
    }
};

const handleShowResults = async (roomId, roomTitle) => {
    resultsTitle.textContent = `Resultados de "${roomTitle}"`;
    resultsList.innerHTML = '<p>Cargando resultados...</p>';
    const q = query(collection(db, "resultados"), where("salaId", "==", roomId));

    try {
        const querySnapshot = await getDocs(q);
        resultsList.innerHTML = querySnapshot.empty
            ? '<p>Aún no hay resultados.</p>'
            : querySnapshot.docs.map(doc => {
                const result = doc.data();
                return `<div class="result-item"><span>${result.nombreEstudiante}</span><span class="result-item-score">${result.calificacion} / ${result.totalPreguntas}</span></div>`;
            }).join('');
    } catch (error) {
        console.error("Error al obtener resultados:", error);
        resultsList.innerHTML = '<p>Ocurrió un error al cargar.</p>';
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
                    <div><h3>${room.titulo}</h3><p>Materia: ${room.materia}</p><div class="room-code">Código: <span>${room.codigoAcceso}</span></div></div>
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
        alert(`¡Sala creada!\nCódigo de acceso: ${accessCode}`);
        createRoomForm.reset();
        await displayTeacherRooms(userId);
    } catch (error) {
        console.error("Error al crear la sala:", error);
    }
};

// --- INICIALIZACIÓN DEL PANEL ---
const initializePanel = (userData) => {
    userNameElement.textContent = `Bienvenido, ${userData.nombre}`;
    currentUserId = userData.uid; // <-- IMPORTANTE: Guardar el UID

    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) { console.error("Error al cerrar sesión:", error); }
    });

    createRoomForm.addEventListener('submit', (e) => handleCreateRoom(e, userData.uid));

    roomsListContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('manage-button')) {
            displayQuestionsForRoom(target.dataset.roomId);
        }
        if (target.classList.contains('view-results-button')) {
            handleShowResults(target.dataset.roomId, target.dataset.roomTitle);
        }
    });

    document.querySelectorAll('.back-to-main').forEach(btn => {
        btn.addEventListener('click', () => switchToView(mainView));
    });

    addNewQuestionBtn.addEventListener('click', openAddQuestionModal);
    addQuestionForm.addEventListener('submit', handleQuestionSubmit);
    cancelQuestionBtn.addEventListener('click', closeAddQuestionModal);

    // --- ¡NUEVOS EVENT LISTENERS! ---
    addFromBankBtn.addEventListener('click', openBankModal);
    cancelBankBtn.addEventListener('click', closeBankModal);
    subjectFilter.addEventListener('change', (e) => renderBankQuestions(e.target.value));
    addSelectedQuestionsBtn.addEventListener('click', handleAddFromBank);

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
            } else { window.location.href = 'login.html'; }
        } catch (error) {
            console.error("Error al obtener datos:", error);
            window.location.href = 'login.html';
        }
    } else { window.location.href = 'login.html'; }
});