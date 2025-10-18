// js/docente.js

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

// --- DOM ELEMENT REFERENCES ---
const userNameElement = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const createRoomForm = document.getElementById('create-room-form');
const roomsListContainer = document.getElementById('rooms-list');

// --- VIEW REFERENCES ---
const mainView = document.getElementById('main-view');
const resultsView = document.getElementById('results-view');
const resultsList = document.getElementById('results-list');
const resultsTitle = document.getElementById('results-title');
const manageQuestionsView = document.getElementById('manage-questions-view');
const questionsTitle = document.getElementById('questions-title');
const questionsListContainer = document.getElementById('questions-list-container');
const addNewQuestionBtn = document.getElementById('add-new-question-btn');
const addFromBankBtn = document.getElementById('add-from-bank-btn');

// --- QUESTION MODAL REFERENCES ---
const addQuestionModal = document.getElementById('add-question-modal');
const addQuestionForm = document.getElementById('add-question-form');
const modalTitle = document.getElementById('modal-title');
const saveQuestionBtn = document.getElementById('save-question-btn');
const cancelQuestionBtn = document.getElementById('cancel-question-btn');
const saveToBankCheckbox = document.getElementById('save-to-bank');

// --- QUESTION BANK MODAL REFERENCES ---
const bankModal = document.getElementById('bank-modal');
const subjectFilter = document.getElementById('subject-filter');
const bankQuestionsList = document.getElementById('bank-questions-list');
const cancelBankBtn = document.getElementById('cancel-bank-btn');
const addSelectedQuestionsBtn = document.getElementById('add-selected-questions-btn');


// --- STATE VARIABLES ---
let currentRoomId = null;
let currentUserId = null;
let editingQuestionIndex = null;
let bankQuestionsCache = []; 

// --- HELPER FUNCTION ---
const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// --- ADD/EDIT QUESTION MODAL MANAGEMENT ---
const openAddQuestionModal = () => {
    editingQuestionIndex = null;
    modalTitle.textContent = 'Añadir Nueva Pregunta';
    saveQuestionBtn.textContent = 'Guardar Pregunta';
    saveToBankCheckbox.parentElement.style.display = 'flex';
    addQuestionForm.reset();
    addQuestionModal.style.display = 'flex';
};

const openEditQuestionModal = (question, index) => {
    editingQuestionIndex = index;
    modalTitle.textContent = 'Editar Pregunta';
    saveQuestionBtn.textContent = 'Guardar Cambios';
    saveToBankCheckbox.parentElement.style.display = 'none';
    
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

// --- QUESTION BANK MODAL MANAGEMENT ---
const openBankModal = async () => {
    bankQuestionsList.innerHTML = '<p>Cargando preguntas...</p>';
    bankModal.style.display = 'flex';
    
    const q = query(collection(db, "bancoPreguntas"), where("docenteId", "==", currentUserId));
    const querySnapshot = await getDocs(q);

    bankQuestionsCache = querySnapshot.docs.map(doc => ({...doc.data(), id: doc.id}));

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
    const filteredQuestions = filter === 'all' 
        ? bankQuestionsCache 
        : bankQuestionsCache.filter(q => q.materia === filter);

    if (filteredQuestions.length === 0) {
        bankQuestionsList.innerHTML = '<p>No tienes preguntas en tu banco para esta materia.</p>';
        return;
    }

    bankQuestionsList.innerHTML = filteredQuestions.map((q, index) => `
        <div class="bank-question-item">
            <input type="checkbox" id="bank-q-${q.id}" data-question-id="${q.id}">
            <label for="bank-q-${q.id}">${q.pregunta}</label>
        </div>
    `).join('');
};

// --- QUESTION CRUD LOGIC ---
const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!currentRoomId || !currentUserId) return;

    const roomDocRef = doc(db, "salas", currentRoomId);
    const roomDocSnap = await getDoc(roomDocRef);
    const roomData = roomDocSnap.data();

    const newQuestionData = {
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
        if (saveToBankCheckbox.checked && editingQuestionIndex === null) {
            await addDoc(collection(db, "bancoPreguntas"), {
                ...newQuestionData,
                docenteId: currentUserId,
                materia: roomData.materia 
            });
        }

        let updatedQuestions = [...roomData.preguntas];
        if (editingQuestionIndex !== null) {
            updatedQuestions[editingQuestionIndex] = newQuestionData;
        } else {
            updatedQuestions.push(newQuestionData);
        }

        await updateDoc(roomDocRef, { preguntas: updatedQuestions });
        
        alert(editingQuestionIndex !== null ? "¡Pregunta actualizada!" : "¡Pregunta añadida!");
        closeAddQuestionModal();
        await displayQuestionsForRoom(currentRoomId);
    } catch (error) {
        console.error("Error saving question:", error);
        alert("Ocurrió un error al guardar la pregunta.");
    }
};

const handleDeleteQuestion = async (index) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta pregunta?')) return;
    if (!currentRoomId) return;

    try {
        const roomDocRef = doc(db, "salas", currentRoomId);
        const roomDocSnap = await getDoc(roomDocRef);
        const roomData = roomDocSnap.data();
        
        const updatedQuestions = roomData.preguntas.filter((_, i) => i !== index);

        await updateDoc(roomDocRef, { preguntas: updatedQuestions });
        
        alert("¡Pregunta eliminada con éxito!");
        await displayQuestionsForRoom(currentRoomId);
    } catch (error) {
        console.error("Error deleting question:", error);
        alert("Ocurrió un error al eliminar la pregunta.");
    }
};

const handleAddFromBank = async () => {
    const selectedCheckboxes = bankQuestionsList.querySelectorAll('input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) {
        alert("Por favor, selecciona al menos una pregunta.");
        return;
    }

    const questionsToAdd = Array.from(selectedCheckboxes).map(cb => {
        const questionId = cb.dataset.questionId;
        const { id, docenteId, ...questionData } = bankQuestionsCache.find(q => q.id === questionId);
        return questionData;
    });

    try {
        const roomDocRef = doc(db, "salas", currentRoomId);
        await updateDoc(roomDocRef, {
            preguntas: arrayUnion(...questionsToAdd)
        });

        alert(`¡${questionsToAdd.length} pregunta(s) añadida(s) con éxito!`);
        closeBankModal();
        await displayQuestionsForRoom(currentRoomId);
    } catch (error) {
        console.error("Error adding questions from bank:", error);
        alert("Ocurrió un error al añadir las preguntas.");
    }
};

// --- VIEW MANAGEMENT & RENDERING ---
const switchToView = (viewToShow) => {
    [mainView, resultsView, manageQuestionsView].forEach(view => view.style.display = 'none');
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
        console.error("Error loading room questions:", error);
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
                return `<div class="result-item"><span class="result-item-name">${result.nombreEstudiante}</span><span class="result-item-score">${result.calificacion} / ${result.totalPreguntas}</span></div>`;
            }).join('');
    } catch (error) {
        console.error("Error fetching results:", error);
        resultsList.innerHTML = '<p>Ocurrió un error al cargar los resultados.</p>';
    }
    switchToView(resultsView);
};

const displayTeacherRooms = async (userId) => {
    roomsListContainer.innerHTML = '<p>Cargando salas...</p>';
    const q = query(collection(db, "salas"), where("docenteId", "==", userId));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            roomsListContainer.innerHTML = '<p>Aún no has creado ninguna sala.</p>';
            return;
        }
        roomsListContainer.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const room = doc.data();
            const roomId = doc.id;
            const roomCard = document.createElement('div');
            roomCard.className = 'room-card';
            roomCard.innerHTML = `
                <div><h3>${room.titulo}</h3><p>Materia: ${room.materia}</p><div class="room-code">Código: <span>${room.codigoAcceso}</span></div></div>
                <div class="room-actions">
                    <button class="manage-button" data-room-id="${roomId}">Gestionar Evaluación</button>
                    <button class="view-results-button" data-room-id="${roomId}" data-room-title="${room.titulo}">Ver Resultados</button>
                </div>`;
            roomsListContainer.appendChild(roomCard);
        });
    } catch (error) {
        console.error("Error fetching rooms:", error);
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
        console.error("Error creating room:", error);
        alert("Ocurrió un error al crear la sala.");
    }
};

// --- PANEL INITIALIZATION ---
const initializePanel = (userData) => {
    userNameElement.textContent = `Bienvenido, ${userData.nombre}`;
    currentUserId = userData.uid;

    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) { console.error("Error signing out:", error); }
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

    addFromBankBtn.addEventListener('click', openBankModal);
    cancelBankBtn.addEventListener('click', closeBankModal);
    subjectFilter.addEventListener('change', (e) => renderBankQuestions(e.target.value));
    addSelectedQuestionsBtn.addEventListener('click', handleAddFromBank);

    displayTeacherRooms(userData.uid);
};

// --- ROUTE GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = { ...userDocSnap.data(), uid: user.uid };
                if (userData.rol === 'docente') {
                    initializePanel(userData);
                } else {
                    alert("Acceso no autorizado.");
                    window.location.href = 'index.html';
                }
            } else { window.location.href = 'login.html'; }
        } catch (error) {
            console.error("Error fetching user data:", error);
            window.location.href = 'login.html';
        }
    } else { window.location.href = 'login.html'; }
});
