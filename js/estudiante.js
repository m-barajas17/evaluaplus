// js/estudiante.js

import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =============================================
// ¡NUEVO! (Paso 4.B) Constante para el Spinner
// =============================================
const loadingSpinner = '<div class="loader-container"><div class="loader"></div></div>';


// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const userNameElement = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const joinRoomForm = document.getElementById('join-room-form');
const joinRoomSection = document.getElementById('join-room-section');
const evaluationSection = document.getElementById('evaluation-section');
const evaluationsContainer = document.getElementById('evaluations-container');
const historyListContainer = document.getElementById('history-list');

// ¡NUEVO! REFERENCIAS PARA EL TEMPORIZADOR
const timerDisplay = document.getElementById('timer-display');
const timerCountdown = document.getElementById('timer-countdown');

// --- ¡NUEVO! REFERENCIAS PARA EL MODAL DE REVISIÓN ---
const reviewModal = document.getElementById('review-modal');
const reviewModalTitle = document.getElementById('review-modal-title');
const closeReviewModalBtn = document.getElementById('close-review-modal-btn');
const reviewContentContainer = document.getElementById('review-content-container');


// --- GESTIÓN DEL ESTADO DE LA EVALUACIÓN Y DEL USUARIO ---
let currentEvaluation = null;
let currentQuestionIndex = 0;
let studentAnswers = [];
let studentData = {
    uid: null,
    nombre: null,
    salaId: null
};

// ¡NUEVO! VARIABLE DE ESTADO DEL TEMPORIZADOR
let timerInterval = null; // Para guardar el ID del setInterval

// --- ¡NUEVO! LÓGICA DEL MODAL DE REVISIÓN ---

/**
 * Cierra el modal de revisión de la evaluación.
 */
const closeReviewModal = () => {
    // (Lógica sin cambios)
    reviewModal.style.opacity = '0';
    setTimeout(() => {
        reviewModal.style.display = 'none';
    }, 300); // Coincide con la transición de CSS
};

/**
 * Abre el modal y muestra la revisión detallada de una evaluación completada.
 * @param {string} resultId - El ID del documento del resultado en Firestore.
 */
const showReview = async (resultId) => {
    // =============================================
    // ¡MODIFICADO! (Paso 4.B) Se reemplaza texto de carga por spinner.
    // =============================================
    reviewContentContainer.innerHTML = loadingSpinner;
    reviewModal.style.display = 'flex';
    setTimeout(() => reviewModal.style.opacity = '1', 10);

    try {
        // 1. Obtener los datos del resultado específico.
        const resultDocRef = doc(db, "resultados", resultId);
        const resultDocSnap = await getDoc(resultDocRef);

        if (!resultDocSnap.exists()) {
            reviewContentContainer.innerHTML = '<p>Error: No se encontró el resultado.</p>';
            return;
        }
        const resultData = resultDocSnap.data();

        // 2. Obtener los datos de la sala (preguntas, respuestas correctas, feedback).
        const roomDocRef = doc(db, "salas", resultData.salaId);
        const roomDocSnap = await getDoc(roomDocRef);

        if (!roomDocSnap.exists()) {
            reviewContentContainer.innerHTML = '<p>Error: La sala de esta evaluación ya no existe.</p>';
            return;
        }
        const roomData = roomDocSnap.data();
        reviewModalTitle.textContent = `Revisión de "${roomData.titulo}"`;

// 3. Construir el HTML de la revisión.
        let reviewHTML = '';
        const studentResponses = resultData.respuestas; // Array con las respuestas del estudiante
        const questions = roomData.preguntas; // Array con las preguntas originales

        questions.forEach((question, index) => {
            const studentAnswer = studentResponses[index];
            const correctAnswer = question.correcta;
            const isCorrect = studentAnswer === correctAnswer;

            // --- INICIA EL NUEVO BLOQUE LÓGICO ---
            const questionType = question.tipo || 'multipleChoice';
            let optionsHTML = '';

            if (questionType === 'multipleChoice' || questionType === 'trueFalse') {
                optionsHTML = Object.entries(question.opciones).map(([key, value]) => {
                    let optionClass = 'review-option';
                    if (key === studentAnswer) {
                        optionClass += ' student-answer'; // La que marcó el estudiante
                    }
                    if (key === correctAnswer) {
                        optionClass += ' correct-answer'; // La que era correcta
                    }
                    return `<div class="${optionClass}"><strong>${key})</strong> ${value}</div>`;
                }).join('');
            } else if (questionType === 'shortAnswer') {
                const isCorrect = studentAnswer === correctAnswer;
                const answerClass = isCorrect ? 'correct-answer' : 'student-answer';

                optionsHTML = `
                    <div class="review-option ${answerClass}">
                        <strong>Tu Respuesta:</strong> ${studentAnswer || "(Sin respuesta)"}
                    </div>
                    <div class="review-option correct-answer">
                        <strong>Respuesta Correcta:</strong> ${correctAnswer}
                    </div>
                `;
            }
            // --- TERMINA EL NUEVO BLOQUE LÓGICO -
            
            // Determinar qué feedback mostrar
            const feedbackText = isCorrect ? question.feedbackCorrecto : question.feedbackIncorrecto;
            const feedbackClass = isCorrect ? 'correct' : 'incorrect';

            reviewHTML += `
                <div class="review-question-item">
                    <p class="review-question-text">${index + 1}. ${question.pregunta}</p>
                    <div class="review-options-container">${optionsHTML}</div>
                    ${feedbackText ? `<div class="review-feedback ${feedbackClass}">${feedbackText}</div>` : ''}
                </div>
            `;
        });

        reviewContentContainer.innerHTML = reviewHTML;

    } catch (error) {
        console.error("Error al mostrar la revisión:", error);
        reviewContentContainer.innerHTML = '<p>Ocurrió un error al cargar la revisión.</p>';
        // =============================================
        // ¡MODIFICADO! (Paso 4.B) Toast de error
        // =============================================
        Toastify({
            text: "Error al cargar la revisión.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
    }
};


// --- LÓGICA PARA MOSTRAR HISTORIAL (ACTUALIZADA) ---
const displayStudentHistory = async (studentId) => {
    // =============================================
    // ¡MODIFICADO! (Paso 4.B) Se reemplaza texto de carga por spinner.
    // =============================================
    historyListContainer.innerHTML = loadingSpinner;
    
    const q = query(collection(db, "resultados"), where("estudianteId", "==", studentId));
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            historyListContainer.innerHTML = '<p>Aún no has completado ninguna evaluación.</p>';
            return;
        }
        historyListContainer.innerHTML = '';
        
        // (Lógica de renderizado sin cambios)
        for (const resultDoc of querySnapshot.docs) {
            const resultData = resultDoc.data();
            const roomDocRef = doc(db, "salas", resultData.salaId);
            const roomDocSnap = await getDoc(roomDocRef);

            let roomTitle = "Evaluación (nombre no disponible)";
            if (roomDocSnap.exists()) {
                roomTitle = roomDocSnap.data().titulo;
            }

            // ¡NUEVO! Se añade el atributo data-result-id con el ID del documento.
            const historyItem = `
                <div class="history-item" data-result-id="${resultDoc.id}">
                    <span class="history-item-title">${roomTitle}</span>
                    <span class="history-item-score">${resultData.calificacion} / ${resultData.totalPreguntas}</span>
                </div>
            `;
            historyListContainer.innerHTML += historyItem;
        }
    } catch (error) {
        console.error("Error al obtener el historial:", error);
        historyListContainer.innerHTML = '<p>Ocurrió un error al cargar tu historial.</p>';
        // =============================================
        // ¡MODIFICADO! (Paso 4.B) Toast de error
        // =============================================
        Toastify({
            text: "Error al cargar tu historial.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
    }
};

const handleFinishEvaluation = async () => {
    // ¡NUEVO! Detener el temporizador si existe
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerDisplay.style.display = 'none'; // Ocultarlo
    }

    // (Lógica de calificación sin cambios)
    saveCurrentAnswer();
    let score = 0;
    currentEvaluation.questions.forEach((question, index) => {
        if (question.correcta === studentAnswers[index]) {
            score++;
        }
    });

    const resultData = {
        salaId: studentData.salaId,
        estudianteId: studentData.uid,
        nombreEstudiante: studentData.nombre,
        calificacion: score,
        totalPreguntas: currentEvaluation.questions.length,
        respuestas: studentAnswers,
        fecha: new Date()
    };

    try {
        await addDoc(collection(db, "resultados"), resultData);
        const resultsHTML = `
            <div class="results-container">
                <h2>¡Evaluación Completada!</h2>
                <p>Este es tu resultado final para la evaluación "${currentEvaluation.title}".</p>
                <div class="score-display">
                    <span class="score">${score}</span>
                    <span class="total">de ${currentEvaluation.questions.length}</span>
                </div>
                <p style="margin-top: 1.5rem;">Ahora puedes ver la revisión detallada en tu historial.</p>
            </div>`;
        evaluationSection.innerHTML = resultsHTML;

        // =============================================
        // ¡MODIFICADO! (Paso 4.B) Toast de éxito
        // =============================================
        Toastify({
            text: "¡Evaluación guardada con éxito!",
            duration: 3000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" } // Verde éxito
        }).showToast();

        // Actualiza el historial para que aparezca la nueva evaluación
        await displayStudentHistory(studentData.uid);

    } catch (error) {
        console.error("Error al guardar el resultado:", error);
        // =============================================
        // ¡MODIFICADO! (Paso 4.B) Toast de error
        // =============================================
        Toastify({
            text: "Ocurrió un error al guardar tu resultado.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
    }
};

/**
 * Inicia el temporizador de cuenta regresiva.
 * @param {number} endTime - El timestamp de finalización.
 */
function startTimer(endTime) {
    timerDisplay.style.display = 'flex'; // Muestra el temporizador

    // Limpia cualquier temporizador anterior
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = endTime - now;

        if (remaining <= 0) {
            // ¡Tiempo agotado!
            clearInterval(timerInterval);
            timerCountdown.textContent = "00:00";
            timerDisplay.classList.add('danger');

            Toastify({
                text: "¡El tiempo se ha agotado! Tu evaluación se enviará automáticamente.",
                duration: 5000,
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo
            }).showToast();

            handleFinishEvaluation(); // Envío automático
            return;
        }

        // Actualiza la UI del temporizador
        const minutes = Math.floor((remaining / 1000 / 60) % 60);
        const seconds = Math.floor((remaining / 1000) % 60);

        timerCountdown.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Añade clase de peligro si quedan menos de 5 minutos
        if (remaining < 300000) { // 5 minutos en milisegundos
            timerDisplay.classList.add('danger');
        }

    }, 1000);
}

// --- LÓGICA PARA RENDERIZAR LA EVALUACIÓN ---
// (Toda esta sección no tiene cambios, ya que no contenía alerts ni cargas)
const saveCurrentAnswer = () => {
    const selectedOption = document.querySelector('input[name="question"]:checked');
    const shortAnswerInput = document.getElementById('short-answer-input');

    if (selectedOption) {
        studentAnswers[currentQuestionIndex] = selectedOption.value;
    } else if (shortAnswerInput) {
        studentAnswers[currentQuestionIndex] = shortAnswerInput.value.trim();
    }
};

const displayQuestion = () => {
    // =============================================
    // ¡MODIFICADO! (Fase 17) Renderizado dinámico de opciones
    // =============================================
    const questionData = currentEvaluation.questions[currentQuestionIndex];
    const savedAnswer = studentAnswers[currentQuestionIndex];

    // ¡NUEVA LÓGICA DE RENDERIZADO!
    const questionType = questionData.tipo || 'multipleChoice'; // Asume M/C por retrocompatibilidad
    let optionsHTML = '';

    if (questionType === 'multipleChoice') {
        optionsHTML = Object.entries(questionData.opciones).map(([key, value]) => `
            <label class="option">
                <input type="radio" name="question" value="${key}" ${savedAnswer === key ? 'checked' : ''}>
                <span><strong>${key})</strong> ${value}</span>
            </label>
        `).join('');

        } else if (questionType === 'trueFalse') {
        // (lógica existente sin cambios)
        optionsHTML = Object.entries(questionData.opciones).map(([key, value]) => `
            <label class="option">
                <input type="radio" name="question" value="${key}" ${savedAnswer === key ? 'checked' : ''}>
                <span><strong>${key})</strong> ${value}</span>
            </label>
        `).join('');

    // --- AÑADE ESTE BLOQUE ---
    } else if (questionType === 'shortAnswer') {
        optionsHTML = `
            <div class="input-group">
                <label for="short-answer-input">Escribe tu respuesta:</label>
                <input type="text" id="short-answer-input" class="student-short-answer" value="${savedAnswer || ''}" placeholder="Respuesta...">
            </div>
        `;
    }

    const evaluationHTML = `
        <h2>${currentEvaluation.title}</h2>
        <div class="question-container">
            <p class="question-text">${currentQuestionIndex + 1}. ${questionData.pregunta}</p>
            <form id="question-form">
                <div class="options">${optionsHTML}</div>
            </form>
            <div class="nav-buttons">
                ${currentQuestionIndex > 0 ? '<button id="prev-btn" class="cta-button secondary">Anterior</button>' : '<div></div>'}
                ${currentQuestionIndex < currentEvaluation.questions.length - 1 ? '<button id="next-btn" class="cta-button">Siguiente</button>' : ''}
                ${currentQuestionIndex === currentEvaluation.questions.length - 1 ? '<button id="finish-btn" class="cta-button">Finalizar Evaluación</button>' : ''}
            </div>
        </div>`;
    evaluationsContainer.innerHTML = evaluationHTML;
};

const startEvaluation = (roomData, roomId) => {
    joinRoomSection.style.display = 'none';

    // ¡NUEVO! Iniciar el temporizador si existe
    if (roomData.limiteTiempo && roomData.limiteTiempo > 0) {
        const tiempoEnMilisegundos = roomData.limiteTiempo * 60 * 1000;
        const endTime = Date.now() + tiempoEnMilisegundos;
    
        startTimer(endTime); // Llamamos a la nueva función auxiliar
    }
    
    if (!roomData.preguntas || roomData.preguntas.length === 0) {
        evaluationsContainer.innerHTML = `<h2>Evaluación no disponible</h2><p>Esta sala aún no tiene preguntas. Por favor, contacta a tu docente.</p>`;
        return;
    }
    currentEvaluation = {
        title: roomData.titulo,
        questions: roomData.preguntas
    };
    studentData.salaId = roomId;
    studentAnswers = new Array(currentEvaluation.questions.length).fill(null);
    currentQuestionIndex = 0;
    displayQuestion();
};

const handleJoinRoom = async (e) => {
    e.preventDefault();
    const roomCode = joinRoomForm['room-code'].value.trim().toUpperCase();
    if (!roomCode) return;

    // =============================================
    // ¡NUEVO! (Paso 4.B) Toast de "Buscando..."
    // =============================================
    const searchingToast = Toastify({
        text: "Buscando sala...",
        duration: -1, // Dura indefinidamente
        gravity: "bottom",
        position: "center",
        style: {
            background: "linear-gradient(135deg, #38BDF8, #3730A3)",
        }
    }).showToast();

    const q = query(collection(db, "salas"), where("codigoAcceso", "==", roomCode));
    try {
        const querySnapshot = await getDocs(q);
        
        searchingToast.hideToast(); // Oculta el toast de "Buscando..."

        if (querySnapshot.empty) {
            // =============================================
            // ¡MODIFICADO! (Paso 4.B) Toast de aviso
            // =============================================
            Toastify({
                text: "Código incorrecto. No se encontró ninguna sala.",
                duration: 3000,
                style: { background: "linear-gradient(to right, #f59e0b, #d97706)" } // Naranja aviso
            }).showToast();
        } else {
            const roomDoc = querySnapshot.docs[0];
            // =============================================
            // ¡MODIFICADO! (Paso 4.B) Toast de éxito
            // =============================================
             Toastify({
                text: `¡Unido a "${roomDoc.data().titulo}"!`,
                duration: 2000,
                style: { background: "linear-gradient(to right, #00b09b, #96c93d)" } // Verde éxito
            }).showToast();
            startEvaluation(roomDoc.data(), roomDoc.id);
        }
    } catch (error) {
        console.error("Error al buscar la sala:", error);
        searchingToast.hideToast(); // Oculta el toast de "Buscando..."
        // =============================================
        // ¡MODIFICADO! (Paso 4.B) Toast de error
        // =============================================
        Toastify({
            text: "Ocurrió un error al intentar unirse a la sala.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
        }).showToast();
    }
};

// --- FUNCIÓN DE INICIALIZACIÓN DEL PANEL ---
const initializePanel = (userData) => {
    userNameElement.textContent = `Bienvenido, ${userData.nombre}`;
    studentData.uid = userData.uid;
    studentData.nombre = userData.nombre;

    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            // =============================================
            // ¡MODIFICADO! (Paso 4.B) Toast de error
            // =============================================
            Toastify({
                text: "Error al cerrar sesión.",
                duration: 3000,
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } // Rojo error
            }).showToast();
        }
    });

    joinRoomForm.addEventListener('submit', handleJoinRoom);

    // (Listener sin cambios)
    evaluationSection.addEventListener('click', (e) => {
        if (e.target.id === 'next-btn') {
            saveCurrentAnswer();
            currentQuestionIndex++;
            displayQuestion();
        }
        if (e.target.id === 'prev-btn') {
            saveCurrentAnswer();
            currentQuestionIndex--;
            displayQuestion();
        }
        if (e.target.id === 'finish-btn') {
            handleFinishEvaluation();
        }
    });
    
    // --- ¡NUEVO! EVENT LISTENERS PARA EL MODAL ---
    // (Listeners sin cambios)
    historyListContainer.addEventListener('click', (e) => {
        const historyItem = e.target.closest('.history-item');
        if (historyItem) {
            const resultId = historyItem.dataset.resultId;
            showReview(resultId);
        }
    });

    closeReviewModalBtn.addEventListener('click', closeReviewModal);
    reviewModal.addEventListener('click', (e) => {
        if (e.target === reviewModal) { // Cierra si se hace clic en el fondo
            closeReviewModal();
        }
    });

    displayStudentHistory(userData.uid);
};

// --- GUARDIÁN DE RUTA ---
onAuthStateChanged(auth, async (user) => {
    // (Lógica sin cambios, los errores aquí redirigen, no usan toasts)
    if (user) {
        const userUid = user.uid;
        const userDocRef = doc(db, "users", userUid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = { ...userDocSnap.data(), uid: userUid };
                if (userData.rol === 'estudiante') {
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