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

// =============================================
// Constante para el Spinner (Fase 13)
// =============================================
const loadingSpinner = '<div class="loader-container"><div class="loader"></div></div>';

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

// =============================================
// ¡NUEVO! (Fase 14) Referencias a la Vista de Analíticas
// =============================================
const analyticsView = document.getElementById('analytics-view');
const analyticsTitle = document.getElementById('analytics-title');
const analyticsSummaryGrid = document.getElementById('analytics-summary-grid');
const difficultQuestionsList = document.getElementById('difficult-questions-list');
const easyQuestionsList = document.getElementById('easy-questions-list');


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

// =============================================
// ¡NUEVO! (Fase 13) Referencias al Modal de Confirmación de Borrado
// =============================================
const confirmDeleteModal = document.getElementById('confirm-delete-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalText = document.getElementById('confirm-modal-text');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');


// --- STATE VARIABLES ---
let currentRoomId = null;
let currentUserId = null;
let editingQuestionIndex = null;
let bankQuestionsCache = []; 

// =============================================
// ¡NUEVO! (Fase 13) Variable de estado para el borrado
// =============================================
let deleteContext = {
    index: null,
    roomId: null
};

// --- HELPER FUNCTION ---
const generateAccessCode = () => {
    // (Sin cambios)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// --- ADD/EDIT QUESTION MODAL MANAGEMENT ---
const openAddQuestionModal = () => {
    // (Lógica sin cambios)
    editingQuestionIndex = null;
    modalTitle.textContent = 'Añadir Nueva Pregunta';
    saveQuestionBtn.textContent = 'Guardar Pregunta';
    saveToBankCheckbox.parentElement.style.display = 'flex';
    addQuestionForm.reset();
    addQuestionModal.style.display = 'flex';
};

const openEditQuestionModal = (question, index) => {
    // (Lógica sin cambios)
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
    // (Lógica sin cambios)
    addQuestionModal.style.display = 'none';
    addQuestionForm.reset();
    editingQuestionIndex = null;
};

// --- QUESTION BANK MODAL MANAGEMENT ---
const openBankModal = async () => {
    // =============================================
    // ¡MODIFICADO! (Fase 13) Se reemplaza texto de carga por spinner.
    // =============================================
    bankQuestionsList.innerHTML = loadingSpinner;
    bankModal.style.display = 'flex';
    
    try {
        const q = query(collection(db, "bancoPreguntas"), where("docenteId", "==", currentUserId));
        const querySnapshot = await getDocs(q);

        bankQuestionsCache = querySnapshot.docs.map(doc => ({...doc.data(), id: doc.id}));

        const materias = [...new Set(bankQuestionsCache.map(q => q.materia))];
        subjectFilter.innerHTML = '<option value="all">Todas las materias</option>';
        materias.forEach(materia => {
            subjectFilter.innerHTML += `<option value="${materia}">${materia}</option>`;
        });
        
        renderBankQuestions('all');
    } catch (error) {
        console.error("Error loading bank questions:", error);
        bankQuestionsList.innerHTML = '<p>Error al cargar el banco de preguntas.</p>';
        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de error
        // =============================================
        Toastify({
            text: "Error al cargar tu banco de preguntas.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
    }
};

const closeBankModal = () => {
    // (Lógica sin cambios)
    bankModal.style.display = 'none';
};

const renderBankQuestions = (filter) => {
    // (Lógica sin cambios, la carga ya se manejó en openBankModal)
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

    // (Lógica de recolección de datos sin cambios)
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
            // =============================================
            // ¡MODIFICADO! (Fase 13) Toast de éxito (guardado en banco)
            // =============================================
             Toastify({
                text: "Pregunta guardada en tu banco.",
                duration: 2000,
                style: { background: "linear-gradient(135deg, #38BDF8, #3730A3)" } // Tema
            }).showToast();
        }

        let updatedQuestions = [...roomData.preguntas];
        if (editingQuestionIndex !== null) {
            updatedQuestions[editingQuestionIndex] = newQuestionData;
        } else {
            updatedQuestions.push(newQuestionData);
        }

        await updateDoc(roomDocRef, { preguntas: updatedQuestions });
        
        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de éxito (pregunta añadida/actualizada)
        // =============================================
        Toastify({
            text: editingQuestionIndex !== null ? "¡Pregunta actualizada!" : "¡Pregunta añadida!",
            duration: 3000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" } // Verde éxito
        }).showToast();

        closeAddQuestionModal();
        await displayQuestionsForRoom(currentRoomId);
    } catch (error) {
        console.error("Error saving question:", error);
        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de error
        // =============================================
        Toastify({
            text: "Ocurrió un error al guardar la pregunta.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
    }
};

// =============================================
// ¡MODIFICADO! (Fase 13) Lógica de borrado refactorizada
// =============================================

/**
 * Paso 1: Abrir el modal de confirmación.
 */
const openDeleteConfirmModal = (index, roomId) => {
    deleteContext.index = index;
    deleteContext.roomId = roomId;

    // Personaliza el texto del modal
    confirmModalTitle.textContent = 'Confirmar Eliminación';
    confirmModalText.textContent = `¿Estás seguro de que quieres eliminar esta pregunta? Esta acción no se puede deshacer.`;
    
    confirmDeleteModal.style.display = 'flex';
};

/**
 * Paso 2: Cerrar el modal de confirmación.
 */
const closeDeleteConfirmModal = () => {
    confirmDeleteModal.style.display = 'none';
    // Limpia el contexto
    deleteContext.index = null;
    deleteContext.roomId = null;
};

/**
 * Paso 3: Ejecutar la eliminación.
 */
const handleExecuteDelete = async () => {
    const { index, roomId } = deleteContext;
    
    // Verificamos que tenemos un contexto válido
    if (index === null || !roomId) {
         Toastify({
            text: "Error de contexto. No se puede eliminar.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
        return;
    }

    try {
        const roomDocRef = doc(db, "salas", roomId);
        const roomDocSnap = await getDoc(roomDocRef);
        const roomData = roomDocSnap.data();
        
        // Filtra la pregunta usando el índice guardado en el contexto
        const updatedQuestions = roomData.preguntas.filter((_, i) => i !== index);

        await updateDoc(roomDocRef, { preguntas: updatedQuestions });
        
        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de éxito
        // =============================================
        Toastify({
            text: "¡Pregunta eliminada con éxito!",
            duration: 3000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" } // Verde éxito
        }).showToast();

        closeDeleteConfirmModal(); // Cierra el modal
        await displayQuestionsForRoom(roomId); // Refresca la lista

    } catch (error) {
        console.error("Error deleting question:", error);
        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de error
        // =============================================
        Toastify({
            text: "Ocurrió un error al eliminar la pregunta.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
        closeDeleteConfirmModal(); // Cierra el modal incluso si hay error
    }
};

const handleAddFromBank = async () => {
    const selectedCheckboxes = bankQuestionsList.querySelectorAll('input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) {
        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de aviso (warning)
        // =============================================
        Toastify({
            text: "Por favor, selecciona al menos una pregunta.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #f59e0b, #d97706)" } // Naranja aviso
        }).showToast();
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

        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de éxito
        // =============================================
        Toastify({
            text: `¡${questionsToAdd.length} pregunta(s) añadida(s) con éxito!`,
            duration: 3000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" } // Verde éxito
        }).showToast();
        
        closeBankModal();
        await displayQuestionsForRoom(currentRoomId);
    } catch (error) {
        console.error("Error adding questions from bank:", error);
        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de error
        // =============================================
         Toastify({
            text: "Ocurrió un error al añadir las preguntas.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
    }
};

// --- VIEW MANAGEMENT & RENDERING ---
const switchToView = (viewToShow) => {
    // =============================================
    // ¡MODIFICADO! (Fase 14) Añadir analyticsView a la lista
    // =============================================
    [mainView, resultsView, manageQuestionsView, analyticsView].forEach(view => view.style.display = 'none');
    viewToShow.style.display = 'block';
};

const displayQuestionsForRoom = async (roomId) => {
    currentRoomId = roomId; // Asegura que el ID de la sala esté seteado
    // =============================================
    // ¡MODIFICADO! (Fase 13) Se reemplaza texto de carga por spinner.
    // =============================================
    questionsListContainer.innerHTML = loadingSpinner;
    
    const roomDocRef = doc(db, "salas", roomId);
    try {
        const roomDocSnap = await getDoc(roomDocRef);
        if (!roomDocSnap.exists()) {
             Toastify({
                text: "Error: No se encontró la sala.",
                duration: 3000,
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
            }).showToast();
            return;
        }
        
        const roomData = roomDocSnap.data();
        questionsTitle.textContent = `Gestionando: "${roomData.titulo}"`;
        questionsListContainer.innerHTML = ''; // Limpia el spinner

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
                // =============================================
                // ¡MODIFICADO! (Fase 13) El botón de borrado ahora abre el modal
                // =============================================
                questionItem.querySelector('.edit-btn').addEventListener('click', () => openEditQuestionModal(question, index));
                questionItem.querySelector('.delete-btn').addEventListener('click', () => openDeleteConfirmModal(index, roomId)); // Pasa el índice Y el roomId
                questionsListContainer.appendChild(questionItem);
            });
        } else {
            questionsListContainer.innerHTML = '<p>Esta evaluación aún no tiene preguntas. ¡Añade la primera!</p>';
        }

        switchToView(manageQuestionsView);
    } catch (error) {
        console.error("Error loading room questions:", error);
         Toastify({
            text: "Error al cargar las preguntas de la sala.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
        questionsListContainer.innerHTML = '<p>Ocurrió un error al cargar las preguntas.</p>';
    }
};

const handleShowResults = async (roomId, roomTitle) => {
    resultsTitle.textContent = `Resultados de "${roomTitle}"`;
    // =============================================
    // ¡MODIFICADO! (Fase 13) Se reemplaza texto de carga por spinner.
    // =============================================
    resultsList.innerHTML = loadingSpinner;
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
        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de error
        // =============================================
         Toastify({
            text: "Error al cargar los resultados.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
    }
    switchToView(resultsView);
};


// =============================================
// ¡NUEVO! (Fase 14) Función de Cálculo de Analíticas
// =============================================
const handleShowAnalytics = async (roomId, roomTitle) => {
    analyticsTitle.textContent = `Analíticas de "${roomTitle}"`;
    switchToView(analyticsView);

    // 1. Mostrar estado de carga
    analyticsSummaryGrid.innerHTML = loadingSpinner;
    difficultQuestionsList.innerHTML = loadingSpinner;
    easyQuestionsList.innerHTML = loadingSpinner;

    try {
        // 2. Obtener los datos necesarios en paralelo
        const [roomDocSnap, resultsQuerySnap] = await Promise.all([
            getDoc(doc(db, "salas", roomId)),
            getDocs(query(collection(db, "resultados"), where("salaId", "==", roomId)))
        ]);

        if (!roomDocSnap.exists()) {
            throw new Error("No se encontró la sala.");
        }

        const roomData = roomDocSnap.data();
        const originalQuestions = roomData.preguntas;
        const numQuestions = originalQuestions.length;

        if (resultsQuerySnap.empty) {
            analyticsSummaryGrid.innerHTML = '<p>Aún no hay resultados para esta evaluación.</p>';
            difficultQuestionsList.innerHTML = '<p>N/A</p>';
            easyQuestionsList.innerHTML = '<p>N/A</p>';
            return;
        }

        // 3. Inicializar acumuladores
        let totalScoreSum = 0;
        let approvedCount = 0;
        const approvalThreshold = 0.6; // 60% para aprobar
        const numSubmissions = resultsQuerySnap.size;

        // Estructura para rastrear cada pregunta: { pregunta, correct, incorrect }
        let questionStats = originalQuestions.map(q => ({
            pregunta: q.pregunta,
            correct: 0,
            incorrect: 0
        }));

        // 4. Procesar cada resultado
        resultsQuerySnap.forEach(resultDoc => {
            const resultData = resultDoc.data();

            // Sumar para el promedio
            totalScoreSum += resultData.calificacion;

            // Contar aprobados
            if ((resultData.calificacion / numQuestions) >= approvalThreshold) {
                approvedCount++;
            }

            // Analizar respuesta por respuesta
            resultData.respuestas.forEach((studentAnswer, index) => {
                if (index < numQuestions) { // Asegurarnos de que el índice es válido
                    if (studentAnswer === originalQuestions[index].correcta) {
                        questionStats[index].correct++;
                    } else {
                        questionStats[index].incorrect++;
                    }
                }
            });
        });

        // 5. Calcular métricas finales
        const averageScore = totalScoreSum / numSubmissions;
        const averagePercentage = (averageScore / numQuestions) * 100;
        const approvalRate = (approvedCount / numSubmissions) * 100;

        // 6. Ordenar preguntas
        const difficultQuestions = [...questionStats].sort((a, b) => b.incorrect - a.incorrect).slice(0, 3);
        const easyQuestions = [...questionStats].sort((a, b) => b.correct - a.correct).slice(0, 3);

        // 7. Renderizar HTML

        // Renderizar resumen
        analyticsSummaryGrid.innerHTML = `
            <div class="analytics-summary-item">
                <h4>Calificación Promedio</h4>
                <p>${averageScore.toFixed(1)} / ${numQuestions}</p>
                <span>(${averagePercentage.toFixed(0)}%)</span>
            </div>
            <div class="analytics-summary-item">
                <h4>Tasa de Aprobación</h4>
                <p>${approvalRate.toFixed(0)}%</p>
                <span>(${approvedCount} de ${numSubmissions} estudiantes)</span>
            </div>
            <div class="analytics-summary-item">
                <h4>Total de Entregas</h4>
                <p>${numSubmissions}</p>
                <span>estudiantes</span>
            </div>
        `;

        // Renderizar preguntas difíciles
        difficultQuestionsList.innerHTML = difficultQuestions.map(q => {
            const totalAnswers = q.correct + q.incorrect;
            const incorrectRate = totalAnswers > 0 ? (q.incorrect / totalAnswers) * 100 : 0;
            return `
            <div class="analytics-question-item">
                <p>${q.pregunta}</p>
                <span>${incorrectRate.toFixed(0)}% <small>(${q.incorrect} fallos)</small></span>
            </div>`;
        }).join('');

        // Renderizar preguntas fáciles
        easyQuestionsList.innerHTML = easyQuestions.map(q => {
            const totalAnswers = q.correct + q.incorrect;
            const correctRate = totalAnswers > 0 ? (q.correct / totalAnswers) * 100 : 0;
            return `
            <div class="analytics-question-item">
                <p>${q.pregunta}</p>
                <span>${correctRate.toFixed(0)}% <small>(${q.correct} aciertos)</small></span>
            </div>`;
        }).join('');

    } catch (error) {
        console.error("Error al calcular analíticas:", error);
        analyticsSummaryGrid.innerHTML = '<p>Ocurrió un error al cargar las analíticas.</p>';
        difficultQuestionsList.innerHTML = '<p>Error</p>';
        easyQuestionsList.innerHTML = '<p>Error</p>';
        Toastify({
            text: `Error al cargar analíticas: ${error.message}`,
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};


const displayTeacherRooms = async (userId) => {
    // =============================================
    // ¡MODIFICADO! (Fase 13) Se reemplaza texto de carga por spinner.
    // =============================================
    roomsListContainer.innerHTML = loadingSpinner;
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
            // =============================================
            // ¡MODIFICADO! (Fase 14) Añadido el botón de analíticas
            // =============================================
            roomCard.innerHTML = `
                <div><h3>${room.titulo}</h3><p>Materia: ${room.materia}</p><div class="room-code">Código: <span>${room.codigoAcceso}</span></div></div>
                <div class="room-actions">
                    <button class="manage-button" data-room-id="${roomId}">Gestionar Evaluación</button>
                    <button class="view-results-button" data-room-id="${roomId}" data-room-title="${room.titulo}">Ver Resultados</button>
                    <button class="view-analytics-button" data-room-id="${roomId}" data-room-title="${room.titulo}">Ver Analíticas</button>
                </div>`;
            roomsListContainer.appendChild(roomCard);
        });
    } catch (error) {
        console.error("Error fetching rooms:", error);
        roomsListContainer.innerHTML = '<p>Ocurrió un error al cargar tus salas.</p>';
        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de error
        // =============================================
         Toastify({
            text: "Error al cargar tus salas.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
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
        
        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de éxito
        // =============================================
        Toastify({
            text: `¡Sala "${title}" creada con éxito! Código: ${accessCode}`,
            duration: 5000, // Más tiempo para que puedan copiar el código
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" } // Verde éxito
        }).showToast();

        createRoomForm.reset();
        await displayTeacherRooms(userId);
    } catch (error) {
        console.error("Error creating room:", error);
        // =============================================
        // ¡MODIFICADO! (Fase 13) Toast de error
        // =============================================
         Toastify({
            text: "Ocurrió un error al crear la sala.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
    }
};

// --- PANEL INITIALIZATION ---
const initializePanel = (userData) => {
    userNameElement.textContent = `Bienvenido, ${userData.nombre}`;
    currentUserId = userData.uid;

    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            // No necesitamos toast, la redirección es inmediata.
            window.location.href = 'login.html';
        } catch (error) { 
            console.error("Error signing out:", error); 
             Toastify({
                text: "Error al cerrar sesión.",
                duration: 3000,
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
            }).showToast();
        }
    });

    createRoomForm.addEventListener('submit', (e) => handleCreateRoom(e, userData.uid));

    // Listener para los botones de las tarjetas de sala
    roomsListContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('manage-button')) {
            displayQuestionsForRoom(target.dataset.roomId);
        }
        if (target.classList.contains('view-results-button')) {
            handleShowResults(target.dataset.roomId, target.dataset.roomTitle);
        }
        // =============================================
        // ¡NUEVO! (Fase 14) Listener para el botón de analíticas
        // =============================================
        if (target.classList.contains('view-analytics-button')) {
            handleShowAnalytics(target.dataset.roomId, target.dataset.roomTitle);
        }
    });

    // Listener para los botones "Volver"
    document.querySelectorAll('.back-to-main').forEach(btn => {
        btn.addEventListener('click', () => switchToView(mainView));
    });

    // Listeners para el modal de añadir/editar pregunta
    addNewQuestionBtn.addEventListener('click', openAddQuestionModal);
    addQuestionForm.addEventListener('submit', handleQuestionSubmit);
    cancelQuestionBtn.addEventListener('click', closeAddQuestionModal);
    
    // Listeners para el modal del banco de preguntas
    addFromBankBtn.addEventListener('click', openBankModal);
    cancelBankBtn.addEventListener('click', closeBankModal);
    subjectFilter.addEventListener('change', (e) => renderBankQuestions(e.target.value));
    addSelectedQuestionsBtn.addEventListener('click', handleAddFromBank);

    // =============================================
    // ¡NUEVO! (Fase 13) Listeners para el modal de confirmación
    // =============================================
    cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
    confirmDeleteBtn.addEventListener('click', handleExecuteDelete);
    
    // Carga inicial de salas
    displayTeacherRooms(userData.uid);
};

// --- ROUTE GUARD ---
onAuthStateChanged(auth, async (user) => {
    // (Lógica sin cambios, los errores aquí redirigen, no usan toasts)
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = { ...userDocSnap.data(), uid: user.uid };
                if (userData.rol === 'docente') {
                    initializePanel(userData);
                } else {
                    // Este alert() es aceptable porque es parte del guardián de ruta.
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