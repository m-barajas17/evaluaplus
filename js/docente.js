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

// ================== NUEVAS REFERENCIAS (FASE 22) ==================
const createClassForm = document.getElementById('create-class-form');
const classesListContainer = document.getElementById('classes-list');
// ================== FIN NUEVAS REFERENCIAS (FASE 22) ==================

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
// ================== NUEVA REFERENCIA (FASE 23) ==================
const assignToClassesSelect = document.getElementById('assign-to-classes');
// ================== FIN NUEVA REFERENCIA (FASE 23) ==================

// =============================================
// ¡NUEVO! (Fase 21) Referencia al botón CSV
// =============================================
const exportCsvBtn = document.getElementById('export-csv-btn');


// =============================================
// ¡NUEVO! (Fase 14) Referencias a la Vista de Analíticas
// =============================================
const analyticsView = document.getElementById('analytics-view');
const analyticsTitle = document.getElementById('analytics-title');

// --- QUESTION MODAL REFERENCES ---
const addQuestionModal = document.getElementById('add-question-modal');
const addQuestionForm = document.getElementById('add-question-form');
const modalTitle = document.getElementById('modal-title');
const saveQuestionBtn = document.getElementById('save-question-btn');
const cancelQuestionBtn = document.getElementById('cancel-question-btn');
const saveToBankCheckbox = document.getElementById('save-to-bank');
const optionsShortAnswer = document.getElementById('options-short-answer');
const inputCorrectAnswerSA = document.getElementById('correct-answer-sa');
const correctAnswerRadios = document.getElementById('correct-answer-radios');

// =============================================
// ¡NUEVO! (Fase 17) Referencias para Tipos de Pregunta
// =============================================
const questionTypeSelect = document.getElementById('question-type');
const optionsMultipleChoice = document.getElementById('options-multiple-choice');
const optionsTrueFalse = document.getElementById('options-true-false');
const correctAnswerMC = document.getElementById('correct-answer-mc');
const correctAnswerTF = document.getElementById('correct-answer-tf');

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
// ¡NUEVO! (Fase 21) Caché para los resultados
// =============================================
let currentResultsData = [];


// =============================================
// ¡NUEVO! (Fase 15) Instancias de los gráficos
// =============================================
let summaryChartInstance = null;
let performanceChartInstance = null;

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

// =============================================
// ¡NUEVO! (Fase 17) Función Auxiliar de UI del Modal
// =============================================
/**
 * Muestra/oculta y habilita/deshabilita los campos del modal según el tipo de pregunta.
 * @param {string} type - 'multipleChoice', 'trueFalse' o 'shortAnswer'
 */
const setQuestionModalUI = (type) => {
    // Ocultar y deshabilitar todo primero
    optionsMultipleChoice.style.display = 'none';
    correctAnswerMC.style.display = 'none';
    optionsTrueFalse.style.display = 'none';
    correctAnswerTF.style.display = 'none';
    optionsShortAnswer.style.display = 'none';
    correctAnswerRadios.style.display = 'none'; // Oculta el contenedor de radios

    addQuestionForm.querySelector('#option-a').disabled = true;
    addQuestionForm.querySelector('#option-b').disabled = true;
    addQuestionForm.querySelector('#option-c').disabled = true;
    addQuestionForm.querySelector('#option-d').disabled = true;
    document.querySelectorAll('input[name="correct-answer"]').forEach(radio => radio.disabled = true);
    document.querySelectorAll('input[name="correct-answer-tf"]').forEach(radio => radio.disabled = true);
    inputCorrectAnswerSA.disabled = true;

    if (type === 'multipleChoice') {
        optionsMultipleChoice.style.display = 'block';
        correctAnswerRadios.style.display = 'block';
        correctAnswerMC.style.display = 'flex';

        addQuestionForm.querySelector('#option-a').disabled = false;
        addQuestionForm.querySelector('#option-b').disabled = false;
        addQuestionForm.querySelector('#option-c').disabled = false;
        addQuestionForm.querySelector('#option-d').disabled = false;
        document.querySelectorAll('input[name="correct-answer"]').forEach(radio => radio.disabled = false);

    } else if (type === 'trueFalse') {
        optionsTrueFalse.style.display = 'block';
        correctAnswerRadios.style.display = 'block';
        correctAnswerTF.style.display = 'flex';

        document.querySelectorAll('input[name="correct-answer-tf"]').forEach(radio => radio.disabled = false);

    } else if (type === 'shortAnswer') {
        optionsShortAnswer.style.display = 'block';
        inputCorrectAnswerSA.disabled = false;
        // No se muestra el correctAnswerRadios
    }
};
// --- ADD/EDIT QUESTION MODAL MANAGEMENT ---
const openAddQuestionModal = () => {
    // (Sin cambios desde Fase 17)
    editingQuestionIndex = null;
    modalTitle.textContent = 'Añadir Nueva Pregunta';
    saveQuestionBtn.textContent = 'Guardar Pregunta';
    saveToBankCheckbox.parentElement.style.display = 'flex';
    addQuestionForm.reset();

    questionTypeSelect.value = 'multipleChoice';
    setQuestionModalUI('multipleChoice');
    
    addQuestionForm.querySelector('input[name="correct-answer"][value="A"]').checked = true;
    addQuestionForm.querySelector('input[name="correct-answer-tf"][value="A"]').checked = true;

    addQuestionModal.style.display = 'flex';
};

const openEditQuestionModal = (question, index) => {
    // (Sin cambios desde Fase 18)
    editingQuestionIndex = index;
    modalTitle.textContent = 'Editar Pregunta';
    saveQuestionBtn.textContent = 'Guardar Cambios';
    saveToBankCheckbox.parentElement.style.display = 'none';
    addQuestionForm.reset();

    const questionType = question.tipo || 'multipleChoice';
    questionTypeSelect.value = questionType;

    addQuestionForm.querySelector('#question-text').value = question.pregunta;
    addQuestionForm.querySelector('#feedback-correct').value = question.feedbackCorrecto || '';
    addQuestionForm.querySelector('#feedback-incorrect').value = question.feedbackIncorrecto || '';

    setQuestionModalUI(questionType);

    if (questionType === 'multipleChoice') {
        addQuestionForm.querySelector('#option-a').value = question.opciones.A;
        addQuestionForm.querySelector('#option-b').value = question.opciones.B;
        addQuestionForm.querySelector('#option-c').value = question.opciones.C;
        addQuestionForm.querySelector('#option-d').value = question.opciones.D;
        addQuestionForm.querySelector(`input[name="correct-answer"][value="${question.correcta}"]`).checked = true;
    } else if (questionType === 'trueFalse') {
        addQuestionForm.querySelector(`input[name="correct-answer-tf"][value="${question.correcta}"]`).checked = true;
    } else if (questionType === 'shortAnswer') {
        inputCorrectAnswerSA.value = question.correcta;
    }

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
    // (Sin cambios)
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
        Toastify({
            text: "Error al cargar tu banco de preguntas.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};

const closeBankModal = () => {
    // (Lógica sin cambios)
    bankModal.style.display = 'none';
};

const renderBankQuestions = (filter) => {
    // (Lógica sin cambios)
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
    // (Sin cambios desde Fase 18)
    e.preventDefault();
    if (!currentRoomId || !currentUserId) return;

    const roomDocRef = doc(db, "salas", currentRoomId);
    const roomDocSnap = await getDoc(roomDocRef);
    const roomData = roomDocSnap.data();

    const questionType = questionTypeSelect.value;
    let newQuestionData = {
        pregunta: addQuestionForm.querySelector('#question-text').value,
        feedbackCorrecto: addQuestionForm.querySelector('#feedback-correct').value || "¡Respuesta Correcta!",
        feedbackIncorrecto: addQuestionForm.querySelector('#feedback-incorrect').value || "La respuesta es incorrecta.",
        tipo: questionType
    };

    if (questionType === 'multipleChoice') {
        newQuestionData.opciones = {
            A: addQuestionForm.querySelector('#option-a').value,
            B: addQuestionForm.querySelector('#option-b').value,
            C: addQuestionForm.querySelector('#option-c').value,
            D: addQuestionForm.querySelector('#option-d').value,
        };
        newQuestionData.correcta = addQuestionForm.querySelector('input[name="correct-answer"]:checked').value;
    } else if (questionType === 'trueFalse') {
        newQuestionData.opciones = {
            A: "Verdadero",
            B: "Falso"
        };
        newQuestionData.correcta = addQuestionForm.querySelector('input[name="correct-answer-tf"]:checked').value;
    } else if (questionType === 'shortAnswer') {
        newQuestionData.opciones = null;
        newQuestionData.correcta = inputCorrectAnswerSA.value.trim();
    }

    try {
        if (saveToBankCheckbox.checked && editingQuestionIndex === null) {
            await addDoc(collection(db, "bancoPreguntas"), {
                ...newQuestionData,
                docenteId: currentUserId,
                materia: roomData.materia
            });
            Toastify({
                text: "Pregunta guardada en tu banco.",
                duration: 2000,
                style: { background: "linear-gradient(135deg, #38BDF8, #3730A3)" }
            }).showToast();
        }

        let updatedQuestions = [...roomData.preguntas];
        if (editingQuestionIndex !== null) {
            updatedQuestions[editingQuestionIndex] = newQuestionData;
        } else {
            updatedQuestions.push(newQuestionData);
        }

        await updateDoc(roomDocRef, { preguntas: updatedQuestions });

        Toastify({
            text: editingQuestionIndex !== null ? "¡Pregunta actualizada!" : "¡Pregunta añadida!",
            duration: 3000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();

        closeAddQuestionModal();
        await displayQuestionsForRoom(currentRoomId);
    } catch (error) {
        console.error("Error saving question:", error);
        Toastify({
            text: "Ocurrió un error al guardar la pregunta.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};

// =============================================
// Lógica de borrado (Sin cambios)
// =============================================
const openDeleteConfirmModal = (index, roomId) => {
    deleteContext.index = index;
    deleteContext.roomId = roomId;
    confirmModalTitle.textContent = 'Confirmar Eliminación';
    confirmModalText.textContent = `¿Estás seguro de que quieres eliminar esta pregunta? Esta acción no se puede deshacer.`;
    confirmDeleteModal.style.display = 'flex';
};

const closeDeleteConfirmModal = () => {
    confirmDeleteModal.style.display = 'none';
    deleteContext.index = null;
    deleteContext.roomId = null;
};

const handleExecuteDelete = async () => {
    const { index, roomId } = deleteContext;
    
    if (index === null || !roomId) {
         Toastify({
            text: "Error de contexto. No se puede eliminar.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
        return;
    }

    try {
        const roomDocRef = doc(db, "salas", roomId);
        const roomDocSnap = await getDoc(roomDocRef);
        const roomData = roomDocSnap.data();
        
        const updatedQuestions = roomData.preguntas.filter((_, i) => i !== index);

        await updateDoc(roomDocRef, { preguntas: updatedQuestions });
        
        Toastify({
            text: "¡Pregunta eliminada con éxito!",
            duration: 3000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();

        closeDeleteConfirmModal();
        await displayQuestionsForRoom(roomId);

    } catch (error) {
        console.error("Error deleting question:", error);
        Toastify({
            text: "Ocurrió un error al eliminar la pregunta.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
        closeDeleteConfirmModal();
    }
};

const handleAddFromBank = async () => {
    // (Sin cambios)
    const selectedCheckboxes = bankQuestionsList.querySelectorAll('input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) {
        Toastify({
            text: "Por favor, selecciona al menos una pregunta.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #f59e0b, #d97706)" }
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

        Toastify({
            text: `¡${questionsToAdd.length} pregunta(s) añadida(s) con éxito!`,
            duration: 3000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();
        
        closeBankModal();
        await displayQuestionsForRoom(currentRoomId);
    } catch (error) {
        console.error("Error adding questions from bank:", error);
         Toastify({
            text: "Ocurrió un error al añadir las preguntas.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};


// =============================================
// ¡NUEVO! (Fase 21) Funciones de Exportación CSV
// =============================================
const generateCSV = (data) => {
    // (Sin cambios)
    const headers = ["Nombre Estudiante", "Calificacion", "Total Preguntas"];
    let csvRows = [headers.join(',')];

    data.forEach(result => {
        const values = [
            `"${result.nombreEstudiante}"`,
            result.calificacion,
            result.totalPreguntas
        ];
        csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
};

const downloadCSV = (csvContent, fileName) => {
    // (Sin cambios)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

const handleExportCSV = async () => {
    // (Sin cambios)
    if (currentResultsData.length === 0) {
        Toastify({
            text: "No hay resultados para exportar.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #f59e0b, #d97706)" }
        }).showToast();
        return;
    }

    let roomTitle = "resultados_evaluaplus";
    try {
        const roomDocRef = doc(db, "salas", currentRoomId);
        const roomDocSnap = await getDoc(roomDocRef);
        if (roomDocSnap.exists()) {
            roomTitle = roomDocSnap.data().titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        }
    } catch (e) {
        console.error("Error al obtener nombre de sala para CSV:", e);
    }

    try {
        const csvContent = generateCSV(currentResultsData);
        downloadCSV(csvContent, `${roomTitle}_resultados.csv`);

        Toastify({
            text: "¡Exportación completada!",
            duration: 3000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();
    } catch (error) {
        console.error("Error al generar/descargar CSV:", error);
        Toastify({
            text: "Ocurrió un error al generar el archivo.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};


// --- VIEW MANAGEMENT & RENDERING ---
const switchToView = (viewToShow) => {
    // (Sin cambios)
    [mainView, resultsView, manageQuestionsView, analyticsView].forEach(view => view.style.display = 'none');
    viewToShow.style.display = 'block';
};

const displayQuestionsForRoom = async (roomId) => {
    // (Sin cambios)
    currentRoomId = roomId;
    questionsListContainer.innerHTML = loadingSpinner;
    
    const roomDocRef = doc(db, "salas", roomId);
    try {
        const roomDocSnap = await getDoc(roomDocRef);
        if (!roomDocSnap.exists()) {
             Toastify({
                text: "Error: No se encontró la sala.",
                duration: 3000,
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
            }).showToast();
            return;
        }
        
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
                questionItem.querySelector('.delete-btn').addEventListener('click', () => openDeleteConfirmModal(index, roomId));
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
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
        questionsListContainer.innerHTML = '<p>Ocurrió un error al cargar las preguntas.</p>';
    }
};

const handleShowResults = async (roomId, roomTitle) => {
    // (Sin cambios desde Fase 21)
    currentRoomId = roomId;
    resultsTitle.textContent = `Resultados de "${roomTitle}"`;
    resultsList.innerHTML = loadingSpinner;
    currentResultsData = [];
    
    const q = query(collection(db, "resultados"), where("salaId", "==", roomId));

    try {
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            resultsList.innerHTML = '<p>Aún no hay resultados para esta evaluación.</p>';
        } else {
            querySnapshot.forEach(doc => {
                currentResultsData.push(doc.data());
            });

            resultsList.innerHTML = currentResultsData.map(result => {
                return `<div class="result-item">
                            <span class="result-item-name">${result.nombreEstudiante}</span>
                            <span class="result-item-score">${result.calificacion} / ${result.totalPreguntas}</span>
                        </div>`;
            }).join('');
        }
    } catch (error) {
        console.error("Error fetching results:", error);
        resultsList.innerHTML = '<p>Ocurrió un error al cargar los resultados.</p>';
         Toastify({
            text: "Error al cargar los resultados.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
    switchToView(resultsView);
};


const handleShowAnalytics = async (roomId, roomTitle) => {
    // (Sin cambios desde Fase 15)
    currentRoomId = roomId;
    analyticsTitle.textContent = `Analíticas de "${roomTitle}"`;
    switchToView(analyticsView);
    
    if (summaryChartInstance) {
        summaryChartInstance.destroy();
        summaryChartInstance = null;
    }
    if (performanceChartInstance) {
        performanceChartInstance.destroy();
        performanceChartInstance = null;
    }

    const summaryCtx = document.getElementById('summary-chart');
    const performanceCtx = document.getElementById('question-performance-chart');
    
    try {
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
             const summaryCtxCanvas = document.getElementById('summary-chart');
             const performanceCtxCanvas = document.getElementById('question-performance-chart');

             const summaryParent = summaryCtxCanvas.parentElement;
             const performanceParent = performanceCtxCanvas.parentElement;
             
             summaryParent.innerHTML = '<canvas id="summary-chart"></canvas><p style="text-align:center; padding: 2rem 0;">Aún no hay resultados para generar analíticas.</p>';
             performanceParent.innerHTML = '<canvas id="question-performance-chart"></canvas><p style="text-align:center; padding: 2rem 0;">N/A</p>';
            return;
        } else {
             const summaryParent = document.getElementById('summary-chart').parentElement;
             if (!summaryParent.querySelector('canvas')) {
                 summaryParent.innerHTML = '<canvas id="summary-chart"></canvas>';
             }
             const performanceParent = document.getElementById('question-performance-chart').parentElement;
             if (!performanceParent.querySelector('canvas')) {
                 performanceParent.innerHTML = '<canvas id="question-performance-chart"></canvas>';
             }
        }

        let totalScoreSum = 0;
        let approvedCount = 0;
        const approvalThreshold = 0.6;
        const numSubmissions = resultsQuerySnap.size;

        let questionStats = originalQuestions.map(q => ({
            pregunta: q.pregunta,
            correct: 0,
            incorrect: 0
        }));

        resultsQuerySnap.forEach(resultDoc => {
            const resultData = resultDoc.data();
            totalScoreSum += resultData.calificacion;
            if ((resultData.calificacion / numQuestions) >= approvalThreshold) {
                approvedCount++;
            }
            resultData.respuestas.forEach((studentAnswer, index) => {
                if (index < numQuestions && originalQuestions[index]) {
                    if (studentAnswer === originalQuestions[index].correcta) {
                        questionStats[index].correct++;
                    } else {
                        questionStats[index].incorrect++;
                    }
                }
            });
        });

        const summaryCtx2 = document.getElementById('summary-chart').getContext('2d');
        const reprobadosCount = numSubmissions - approvedCount;

        summaryChartInstance = new Chart(summaryCtx2, {
            type: 'doughnut',
            data: {
                labels: ['Aprobados', 'Reprobados'],
                datasets: [{
                    label: 'Estudiantes',
                    data: [approvedCount, reprobadosCount],
                    backgroundColor: ['rgba(52, 211, 153, 0.7)', 'rgba(239, 68, 68, 0.7)'],
                    borderColor: ['rgba(52, 211, 153, 1)', 'rgba(239, 68, 68, 1)'],
                    borderWidth: 1,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                let value = context.raw || 0;
                                let percentage = ((value / numSubmissions) * 100).toFixed(0);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        const labels = questionStats.map((stat, index) => `Pregunta ${index + 1}`);
        const aciertosData = questionStats.map(stat => stat.correct);
        const fallosData = questionStats.map(stat => stat.incorrect);
        
        const performanceCtx2 = document.getElementById('question-performance-chart').getContext('2d');
        
        performanceChartInstance = new Chart(performanceCtx2, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Aciertos',
                        data: aciertosData,
                        backgroundColor: 'rgba(74, 222, 128, 0.7)',
                        borderColor: 'rgba(74, 222, 128, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Fallos',
                        data: fallosData,
                        backgroundColor: 'rgba(248, 113, 113, 0.7)',
                        borderColor: 'rgba(248, 113, 113, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: { display: true, text: 'Número de Respuestas' }
                    },
                    y: { stacked: true }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                const preguntaTexto = questionStats[index].pregunta;
                                return preguntaTexto.length > 70 ? preguntaTexto.substring(0, 70) + '...' : preguntaTexto;
                            }
                        }
                    },
                    legend: { position: 'bottom' }
                }
            }
        });

    } catch (error) {
        console.error("Error al calcular analíticas:", error);
         Toastify({
            text: `Error al cargar analíticas: ${error.message}`,
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};


// ================== MODIFICADO (FASE 23) ==================
/**
 * Muestra las clases creadas por el docente y las añade al selector de asignación.
 */
const displayTeacherClasses = async (userId) => {
    classesListContainer.innerHTML = loadingSpinner;
    // (FASE 23) Limpiar también el dropdown de asignación al iniciar la carga
    assignToClassesSelect.innerHTML = '<option value="" disabled>Cargando clases...</option>';

    const q = query(collection(db, "clases"), where("docenteId", "==", userId));
    try {
        const querySnapshot = await getDocs(q);
        
        // (FASE 23) Limpiar el contenedor de tarjetas y el dropdown antes de llenarlos
        classesListContainer.innerHTML = ''; 
        assignToClassesSelect.innerHTML = ''; // Limpiamos el "Cargando..."

        if (querySnapshot.empty) {
            classesListContainer.innerHTML = '<p>Aún no has creado ninguna clase.</p>';
            // (FASE 23) Actualizar el dropdown si no hay clases
            assignToClassesSelect.innerHTML = '<option value="" disabled>No has creado clases para asignar</option>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const clase = doc.data();
            // Crear tarjeta de clase (sin cambios)
            const classCard = document.createElement('div');
            classCard.className = 'class-card';
            classCard.innerHTML = `
                <h3>${clase.nombreClase}</h3>
                <p>Materia: ${clase.materia}</p>
                <div class="class-code">Código de Inscripción: <span>${clase.codigoClase}</span></div>
            `;
            classesListContainer.appendChild(classCard);

            // ================== NUEVO BLOQUE (FASE 23) ==================
            // Añadir al dropdown de asignación en el formulario de creación de sala
            const classOption = document.createElement('option');
            classOption.value = doc.id; // Guardamos el ID del documento de la clase
            classOption.textContent = clase.nombreClase;
            assignToClassesSelect.appendChild(classOption);
            // ================== FIN NUEVO BLOQUE (FASE 23) ==================
        });
    } catch (error) {
        console.error("Error fetching classes:", error);
        classesListContainer.innerHTML = '<p>Ocurrió un error al cargar tus clases.</p>';
        // (FASE 23) Mostrar error también en el dropdown
        assignToClassesSelect.innerHTML = '<option value="" disabled>Error al cargar clases</option>';
         Toastify({ // (FASE 23) Añadir Toast de error
            text: "Error al cargar tus clases.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};
// ================== FIN MODIFICADO (FASE 23) ==================


const displayTeacherRooms = async (userId) => {
    // (Sin cambios)
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
         Toastify({
            text: "Error al cargar tus salas.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};

const handleCreateClass = async (e, userId) => {
    // (Sin cambios desde Fase 22)
    e.preventDefault();
    const title = createClassForm['class-title'].value;
    const subject = createClassForm['class-subject'].value;
    const classCode = generateAccessCode();

    try {
        await addDoc(collection(db, "clases"), {
            nombreClase: title,
            materia: subject,
            docenteId: userId,
            codigoClase: classCode,
            estudiantesIds: []
        });

        Toastify({
            text: `¡Clase "${title}" creada con éxito! Código: ${classCode}`,
            duration: 5000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();

        createClassForm.reset();
        await displayTeacherClasses(userId);
    } catch (error) {
        console.error("Error creating class:", error);
         Toastify({
            text: "Ocurrió un error al crear la clase.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};

// ================== MODIFICADO (FASE 23) ==================
/**
 * Maneja la creación de una nueva sala de evaluación, incluyendo la asignación a clases.
 */
const handleCreateRoom = async (e, userId) => {
    e.preventDefault();
    const title = createRoomForm['title'].value;
    const subject = createRoomForm['subject'].value;
    
    const timeLimitInput = createRoomForm['time-limit'].value;
    const timeLimit = parseInt(timeLimitInput) > 0 ? parseInt(timeLimitInput) : null;
    
    const accessCode = generateAccessCode();

    // ================== NUEVO BLOQUE (FASE 23) ==================
    // Obtener los IDs de las clases seleccionadas del <select multiple>
    const selectedClassIds = Array.from(assignToClassesSelect.selectedOptions).map(option => option.value);
    // ================== FIN NUEVO BLOQUE (FASE 23) ==================

    try {
        await addDoc(collection(db, "salas"), {
            titulo: title,
            materia: subject,
            docenteId: userId,
            codigoAcceso: accessCode,
            preguntas: [],
            limiteTiempo: timeLimit,
            clasesAsignadas: selectedClassIds // (FASE 23) Guardar el array de IDs de clases
        });
        
        Toastify({
            text: `¡Sala "${title}" creada con éxito! Código: ${accessCode}`,
            duration: 5000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();

        createRoomForm.reset();
        // (FASE 23) Deseleccionar todas las opciones en el <select multiple>
        assignToClassesSelect.selectedIndex = -1; 
        await displayTeacherRooms(userId); // Refrescar la lista de salas
    } catch (error) {
        console.error("Error creating room:", error);
         Toastify({
            text: "Ocurrió un error al crear la sala.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};
// ================== FIN MODIFICADO (FASE 23) ==================

// --- PANEL INITIALIZATION ---
const initializePanel = (userData) => {
    // (Sin cambios, solo las llamadas al final)
    userNameElement.textContent = `Bienvenido, ${userData.nombre}`;
    currentUserId = userData.uid;

    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Error signing out:", error);
             Toastify({
                text: "Error al cerrar sesión.",
                duration: 3000,
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
            }).showToast();
        }
    });

    createClassForm.addEventListener('submit', (e) => handleCreateClass(e, userData.uid));
    createRoomForm.addEventListener('submit', (e) => handleCreateRoom(e, userData.uid));

    roomsListContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('manage-button')) {
            displayQuestionsForRoom(target.dataset.roomId);
        }
        if (target.classList.contains('view-results-button')) {
            handleShowResults(target.dataset.roomId, target.dataset.roomTitle);
        }
        if (target.classList.contains('view-analytics-button')) {
            handleShowAnalytics(target.dataset.roomId, target.dataset.roomTitle);
        }
    });

    document.querySelectorAll('.back-to-main').forEach(btn => {
        btn.addEventListener('click', () => switchToView(mainView));
    });

    addNewQuestionBtn.addEventListener('click', openAddQuestionModal);
    addQuestionForm.addEventListener('submit', handleQuestionSubmit);
    cancelQuestionBtn.addEventListener('click', closeAddQuestionModal);
    
    questionTypeSelect.addEventListener('change', (e) => {
        setQuestionModalUI(e.target.value);
    });

    addFromBankBtn.addEventListener('click', openBankModal);
    cancelBankBtn.addEventListener('click', closeBankModal);
    subjectFilter.addEventListener('change', (e) => renderBankQuestions(e.target.value));
    addSelectedQuestionsBtn.addEventListener('click', handleAddFromBank);

    cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
    confirmDeleteBtn.addEventListener('click', handleExecuteDelete);
    
    exportCsvBtn.addEventListener('click', handleExportCSV);

    
    // Carga inicial
    displayTeacherClasses(userData.uid); // Ahora también poblará el dropdown
    displayTeacherRooms(userData.uid);
};

// --- ROUTE GUARD ---
onAuthStateChanged(auth, async (user) => {
    // (Sin cambios)
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = { ...userDocSnap.data(), uid: user.uid };
                if (userData.rol === 'docente') {
                    // =============================================
                    // ¡NUEVO! (Fase 27) Aplicar tema dinámico
                    // =============================================
                    document.body.classList.add('theme-docente');
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