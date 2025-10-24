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
    addDoc,
    updateDoc,  // <-- NUEVA IMPORTACIÓN (FASE 22)
    arrayUnion  // <-- NUEVA IMPORTACIÓN (FASE 22)
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =============================================
// ¡NUEVO! (Paso 4.B) Constante para el Spinner
// =============================================
const loadingSpinner = '<div class="loader-container"><div class="loader"></div></div>';


// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const userNameElement = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');

// ================== NUEVAS REFERENCIAS (FASE 22) ==================
const joinClassForm = document.getElementById('join-class-form');
const classesListContainer = document.getElementById('classes-list');
// ================== FIN NUEVAS REFERENCIAS (FASE 22) ==================

const joinRoomForm = document.getElementById('join-room-form');
const joinRoomSection = document.getElementById('join-room-section');
const evaluationSection = document.getElementById('evaluation-section'); // (FASE 23) Ahora es el contenedor de evaluaciones asignadas y en curso
const evaluationsContainer = document.getElementById('evaluations-container'); // (FASE 23) Contenedor específico para las tarjetas/preguntas
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
    salaId: null // ID de la sala de la evaluación en curso
};

// ¡NUEVO! VARIABLE DE ESTADO DEL TEMPORIZADOR
let timerInterval = null; // Para guardar el ID del setInterval

// --- ¡NUEVO! LÓGICA DEL MODAL DE REVISIÓN ---

const closeReviewModal = () => {
    // (Lógica sin cambios)
    reviewModal.style.opacity = '0';
    setTimeout(() => {
        reviewModal.style.display = 'none';
    }, 300);
};

const showReview = async (resultId) => {
    // (Lógica sin cambios desde Fase 18)
    reviewContentContainer.innerHTML = loadingSpinner;
    reviewModal.style.display = 'flex';
    setTimeout(() => reviewModal.style.opacity = '1', 10);

    try {
        const resultDocRef = doc(db, "resultados", resultId);
        const resultDocSnap = await getDoc(resultDocRef);

        if (!resultDocSnap.exists()) {
            reviewContentContainer.innerHTML = '<p>Error: No se encontró el resultado.</p>';
            return;
        }
        const resultData = resultDocSnap.data();

        const roomDocRef = doc(db, "salas", resultData.salaId);
        const roomDocSnap = await getDoc(roomDocRef);

        if (!roomDocSnap.exists()) {
            reviewContentContainer.innerHTML = '<p>Error: La sala de esta evaluación ya no existe.</p>';
            return;
        }
        const roomData = roomDocSnap.data();
        reviewModalTitle.textContent = `Revisión de "${roomData.titulo}"`;

        let reviewHTML = '';
        const studentResponses = resultData.respuestas;
        const questions = roomData.preguntas;

        questions.forEach((question, index) => {
            const studentAnswer = studentResponses[index];
            const correctAnswer = question.correcta;
            const isCorrect = studentAnswer === correctAnswer;
            const questionType = question.tipo || 'multipleChoice';
            let optionsHTML = '';

            if (questionType === 'multipleChoice' || questionType === 'trueFalse') {
                optionsHTML = Object.entries(question.opciones).map(([key, value]) => {
                    let optionClass = 'review-option';
                    if (key === studentAnswer) optionClass += ' student-answer';
                    if (key === correctAnswer) optionClass += ' correct-answer';
                    return `<div class="${optionClass}"><strong>${key})</strong> ${value}</div>`;
                }).join('');
            } else if (questionType === 'shortAnswer') {
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
        Toastify({
            text: "Error al cargar la revisión.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};


// --- LÓGICA PARA MOSTRAR HISTORIAL ---
const displayStudentHistory = async (studentId) => {
    // (Lógica sin cambios)
    historyListContainer.innerHTML = loadingSpinner;
    const q = query(collection(db, "resultados"), where("estudianteId", "==", studentId));
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            historyListContainer.innerHTML = '<p>Aún no has completado ninguna evaluación.</p>';
            return;
        }
        historyListContainer.innerHTML = '';
        
        for (const resultDoc of querySnapshot.docs) {
            const resultData = resultDoc.data();
            const roomDocRef = doc(db, "salas", resultData.salaId);
            const roomDocSnap = await getDoc(roomDocRef);

            let roomTitle = "Evaluación (nombre no disponible)";
            if (roomDocSnap.exists()) {
                roomTitle = roomDocSnap.data().titulo;
            }

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
        Toastify({
            text: "Error al cargar tu historial.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};

// --- LÓGICA PARA MOSTRAR CLASES ---
const displayStudentClasses = async (studentId) => {
    // (Lógica sin cambios desde Fase 22)
    classesListContainer.innerHTML = loadingSpinner;
    const q = query(collection(db, "clases"), where("estudiantesIds", "array-contains", studentId));

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            classesListContainer.innerHTML = '<p>Aún no te has inscrito en ninguna clase.</p>';
            return;
        }
        classesListContainer.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const clase = doc.data();
            const classCard = document.createElement('div');
            classCard.className = 'class-card';
            classCard.innerHTML = `
                <h3>${clase.nombreClase}</h3>
                <p>Materia: ${clase.materia}</p>
            `;
            classesListContainer.appendChild(classCard);
        });
    } catch (error) {
        console.error("Error al obtener las clases del estudiante:", error);
        classesListContainer.innerHTML = '<p>Ocurrió un error al cargar tus clases.</p>';
    }
};


// ================== NUEVA FUNCIÓN (FASE 23) ==================
/**
 * Muestra las evaluaciones (salas) asignadas a las clases del estudiante.
 */
const displayAssignedEvaluations = async (studentId) => {
    evaluationsContainer.innerHTML = loadingSpinner; // Mostrar spinner mientras carga
    
    try {
        // 1. Encontrar las clases en las que está inscrito el estudiante
        const classesQuery = query(collection(db, "clases"), where("estudiantesIds", "array-contains", studentId));
        const classesSnapshot = await getDocs(classesQuery);

        if (classesSnapshot.empty) {
            evaluationsContainer.innerHTML = '<p>No estás inscrito en ninguna clase. Las evaluaciones asignadas por tus docentes aparecerán aquí una vez te inscribas.</p>';
            return; // Si no está en clases, no puede tener evaluaciones asignadas
        }

        // 2. Obtener los IDs de esas clases
        const classIds = classesSnapshot.docs.map(doc => doc.id);

        // 3. Buscar salas que estén asignadas a CUALQUIERA de esas clases
        // Nota: Firestore limita "array-contains-any" a un máximo de 30 IDs en la consulta.
        // Para más clases, se necesitaría una estructura de datos diferente o múltiples consultas.
        if (classIds.length === 0) { // Doble chequeo por si acaso
             evaluationsContainer.innerHTML = '<p>Estás inscrito en clases, pero parece haber un problema al obtener sus IDs.</p>';
             return;
        }
        
        const evaluationsQuery = query(collection(db, "salas"), where("clasesAsignadas", "array-contains-any", classIds));
        const evaluationsSnapshot = await getDocs(evaluationsQuery);

        if (evaluationsSnapshot.empty) {
            evaluationsContainer.innerHTML = '<p>¡Estás inscrito en clases! 🎉 Pero tus docentes aún no han asignado ninguna evaluación a ellas. Revisa más tarde.</p>';
            return;
        }

        // 4. Renderizar las tarjetas de evaluación
        evaluationsContainer.innerHTML = ''; // Limpiar el spinner para mostrar las tarjetas
        evaluationsSnapshot.forEach((doc) => {
            const sala = doc.data();
            const salaId = doc.id;
            const evaluationCard = document.createElement('div');
            evaluationCard.className = 'evaluation-card'; // Usar el nuevo estilo CSS
            evaluationCard.innerHTML = `
                <div class="evaluation-card-info">
                    <h3>${sala.titulo}</h3>
                    <p>Materia: ${sala.materia}</p>
                </div>
                <button class="cta-button start-eval-btn" data-room-id="${salaId}">Comenzar Evaluación</button>
            `;
            evaluationsContainer.appendChild(evaluationCard);
        });

    } catch (error) {
        console.error("Error al obtener evaluaciones asignadas:", error);
        evaluationsContainer.innerHTML = '<p>Ocurrió un error al cargar tus evaluaciones asignadas. Intenta recargar la página.</p>';
        Toastify({
            text: "Error al cargar evaluaciones asignadas.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};
// ================== FIN NUEVA FUNCIÓN (FASE 23) ==================


const handleFinishEvaluation = async () => {
    // (Lógica sin cambios)
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerDisplay.style.display = 'none';
    }

    saveCurrentAnswer();
    let score = 0;
    currentEvaluation.questions.forEach((question, index) => {
        // Comparación simple funciona para M/C, T/F y ShortAnswer (exacto)
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
                <p style="margin-top: 1.5rem;">Ahora puedes ver la revisión detallada en tu historial o volver a tus evaluaciones asignadas.</p>
                <button id="back-to-assigned" class="cta-button secondary" style="margin-top: 1rem; width: auto;">Ver Evaluaciones Asignadas</button>
            </div>`;
        evaluationsContainer.innerHTML = resultsHTML; // Mostrar resultado en el contenedor principal

        // (FASE 23) Añadir listener al botón para volver
        document.getElementById('back-to-assigned').addEventListener('click', () => {
             // Resetear estado de evaluación y volver a mostrar asignadas
             currentEvaluation = null;
             studentData.salaId = null;
             joinRoomSection.style.display = 'block'; // Mostrar de nuevo sección de unirse por código
             displayAssignedEvaluations(studentData.uid);
        });


        Toastify({
            text: "¡Evaluación guardada con éxito!",
            duration: 3000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();

        await displayStudentHistory(studentData.uid); // Actualizar historial

    } catch (error) {
        console.error("Error al guardar el resultado:", error);
        Toastify({
            text: "Ocurrió un error al guardar tu resultado.",
            duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};

function startTimer(endTime) {
    // (Lógica sin cambios)
    timerDisplay.style.display = 'flex';
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = endTime - now;

        if (remaining <= 0) {
            clearInterval(timerInterval);
            timerCountdown.textContent = "00:00";
            timerDisplay.classList.add('danger');
            Toastify({
                text: "¡El tiempo se ha agotado! Tu evaluación se enviará automáticamente.",
                duration: 5000,
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
            }).showToast();
            handleFinishEvaluation();
            return;
        }

        const minutes = Math.floor((remaining / 1000 / 60) % 60);
        const seconds = Math.floor((remaining / 1000) % 60);
        timerCountdown.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (remaining < 300000) { // 5 minutos
            timerDisplay.classList.add('danger');
        } else {
             timerDisplay.classList.remove('danger'); // (FASE 23 Fix) Quitar clase si el tiempo vuelve a ser > 5min (poco probable pero buena práctica)
        }
    }, 1000);
}

const saveCurrentAnswer = () => {
    // (Lógica sin cambios)
    const selectedOption = evaluationsContainer.querySelector('input[name="question"]:checked'); // (FASE 23 Fix) Buscar dentro de evaluationsContainer
    const shortAnswerInput = evaluationsContainer.querySelector('#short-answer-input'); // (FASE 23 Fix) Buscar dentro de evaluationsContainer

    if (selectedOption) {
        studentAnswers[currentQuestionIndex] = selectedOption.value;
    } else if (shortAnswerInput) {
        studentAnswers[currentQuestionIndex] = shortAnswerInput.value.trim();
    } else {
         studentAnswers[currentQuestionIndex] = null; // Guardar null si no hay respuesta (importante para la revisión)
    }
};

const displayQuestion = () => {
    // (Lógica sin cambios desde Fase 18)
    const questionData = currentEvaluation.questions[currentQuestionIndex];
    const savedAnswer = studentAnswers[currentQuestionIndex]; // Obtener respuesta guardada (puede ser null)
    const questionType = questionData.tipo || 'multipleChoice';
    let optionsHTML = '';

    if (questionType === 'multipleChoice') {
        optionsHTML = Object.entries(questionData.opciones).map(([key, value]) => `
            <label class="option">
                <input type="radio" name="question" value="${key}" ${savedAnswer === key ? 'checked' : ''}>
                <span><strong>${key})</strong> ${value}</span>
            </label>
        `).join('');
    } else if (questionType === 'trueFalse') {
        optionsHTML = Object.entries(questionData.opciones).map(([key, value]) => `
            <label class="option">
                <input type="radio" name="question" value="${key}" ${savedAnswer === key ? 'checked' : ''}>
                <span><strong>${key})</strong> ${value}</span>
            </label>
        `).join('');
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
                ${currentQuestionIndex > 0 ? '<button id="prev-btn" class="cta-button secondary">Anterior</button>' : '<div></div>' /* Placeholder para mantener alineación */}
                ${currentQuestionIndex < currentEvaluation.questions.length - 1 ? '<button id="next-btn" class="cta-button">Siguiente</button>' : ''}
                ${currentQuestionIndex === currentEvaluation.questions.length - 1 ? '<button id="finish-btn" class="cta-button">Finalizar Evaluación</button>' : ''}
            </div>
        </div>`;
    evaluationsContainer.innerHTML = evaluationHTML; // Renderizar dentro del contenedor principal
};

const startEvaluation = (roomData, roomId) => {
    // (Lógica sin cambios, excepto ocultar joinRoomSection)
    joinRoomSection.style.display = 'none'; // Ocultar sección de unirse por código al empezar una evaluación

    // Iniciar temporizador si existe
    if (roomData.limiteTiempo && roomData.limiteTiempo > 0) {
        const tiempoEnMilisegundos = roomData.limiteTiempo * 60 * 1000;
        const endTime = Date.now() + tiempoEnMilisegundos;
        startTimer(endTime);
    } else {
        // (FASE 23) Asegurarse de que el timer esté oculto si no hay límite
         if (timerInterval) clearInterval(timerInterval);
         timerInterval = null;
         timerDisplay.style.display = 'none';
         timerDisplay.classList.remove('danger');
    }
    
    if (!roomData.preguntas || roomData.preguntas.length === 0) {
        evaluationsContainer.innerHTML = `<h2>Evaluación no disponible</h2><p>Esta sala aún no tiene preguntas. Por favor, contacta a tu docente.</p>`;
        return;
    }
    
    // Configurar estado de la evaluación actual
    currentEvaluation = {
        title: roomData.titulo,
        questions: roomData.preguntas
    };
    studentData.salaId = roomId; // Guardar ID de la sala actual
    studentAnswers = new Array(currentEvaluation.questions.length).fill(null); // Resetear respuestas
    currentQuestionIndex = 0; // Empezar desde la primera pregunta
    
    displayQuestion(); // Mostrar la primera pregunta
};


const handleJoinClass = async (e) => {
    // (Lógica sin cambios)
    e.preventDefault();
    const classCode = joinClassForm['class-code'].value.trim().toUpperCase();
    if (!classCode) return;

    const searchingToast = Toastify({
        text: "Buscando clase...", duration: -1,
        style: { background: "linear-gradient(135deg, #38BDF8, #3730A3)" }
    }).showToast();

    const q = query(collection(db, "clases"), where("codigoClase", "==", classCode));
    try {
        const querySnapshot = await getDocs(q);
        searchingToast.hideToast();

        if (querySnapshot.empty) {
            Toastify({ text: "Código incorrecto. No se encontró ninguna clase.", duration: 3000, style: { background: "linear-gradient(to right, #f59e0b, #d97706)" } }).showToast();
        } else {
            const classDoc = querySnapshot.docs[0];
            const classId = classDoc.id;
            const classData = classDoc.data();

            if (classData.estudiantesIds && classData.estudiantesIds.includes(studentData.uid)) {
                Toastify({ text: `Ya estás inscrito en "${classData.nombreClase}".`, duration: 3000, style: { background: "linear-gradient(to right, #f59e0b, #d97706)" } }).showToast();
                return;
            }

            const classDocRef = doc(db, "clases", classId);
            await updateDoc(classDocRef, {
                estudiantesIds: arrayUnion(studentData.uid)
            });

            Toastify({ text: `¡Inscrito en "${classData.nombreClase}" con éxito!`, duration: 2000, style: { background: "linear-gradient(to right, #00b09b, #96c93d)" } }).showToast();

            joinClassForm.reset();
            await displayStudentClasses(studentData.uid); // Refrescar lista de clases
            await displayAssignedEvaluations(studentData.uid); // (FASE 23) Refrescar evaluaciones asignadas también
        }
    } catch (error) {
        console.error("Error al unirse a la clase:", error);
        searchingToast.hideToast();
        Toastify({ text: "Ocurrió un error al intentar unirse a la clase.", duration: 3000, style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } }).showToast();
    }
};

const handleJoinRoom = async (e) => {
    // (Lógica sin cambios)
    e.preventDefault();
    const roomCode = joinRoomForm['room-code'].value.trim().toUpperCase();
    if (!roomCode) return;

    const searchingToast = Toastify({
        text: "Buscando sala...", duration: -1, gravity: "bottom", position: "center",
        style: { background: "linear-gradient(135deg, #38BDF8, #3730A3)" }
    }).showToast();

    const q = query(collection(db, "salas"), where("codigoAcceso", "==", roomCode));
    try {
        const querySnapshot = await getDocs(q);
        searchingToast.hideToast();

        if (querySnapshot.empty) {
            Toastify({
                text: "Código incorrecto. No se encontró ninguna sala.", duration: 3000,
                style: { background: "linear-gradient(to right, #f59e0b, #d97706)" }
            }).showToast();
        } else {
            const roomDoc = querySnapshot.docs[0];
             Toastify({
                text: `¡Unido a "${roomDoc.data().titulo}"!`, duration: 2000,
                style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
            }).showToast();
            startEvaluation(roomDoc.data(), roomDoc.id); // Iniciar la evaluación encontrada por código
        }
    } catch (error) {
        console.error("Error al buscar la sala:", error);
        searchingToast.hideToast();
        Toastify({
            text: "Ocurrió un error al intentar unirse a la sala.", duration: 3000,
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};

// --- FUNCIÓN DE INICIALIZACIÓN DEL PANEL ---
const initializePanel = (userData) => {
    userNameElement.textContent = `Bienvenido, ${userData.nombre}`;
    studentData.uid = userData.uid;
    studentData.nombre = userData.nombre;

    logoutButton.addEventListener('click', async () => {
        // (Lógica sin cambios)
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            Toastify({
                text: "Error al cerrar sesión.", duration: 3000,
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
            }).showToast();
        }
    });

    joinClassForm.addEventListener('submit', handleJoinClass);
    joinRoomForm.addEventListener('submit', handleJoinRoom);

    // ================== NUEVO LISTENER (FASE 23) ==================
    // Listener para los botones "Comenzar Evaluación" de las tarjetas asignadas
    evaluationsContainer.addEventListener('click', async (e) => {
        // Solo actuar si se hizo clic en un botón con la clase 'start-eval-btn'
        if (e.target.classList.contains('start-eval-btn')) {
            const roomId = e.target.dataset.roomId; // Obtener el ID de la sala desde el atributo data
            
            // Mostrar un Toast de carga mientras se obtienen los datos
            const startingToast = Toastify({
                text: "Cargando evaluación...",
                duration: -1, // Indefinido hasta que se cierre manualmente
                style: { background: "linear-gradient(135deg, #38BDF8, #3730A3)" }
            }).showToast();
            
            try {
                // Obtener los datos completos de la sala desde Firestore
                const roomDocRef = doc(db, "salas", roomId);
                const roomDocSnap = await getDoc(roomDocRef);
    
                startingToast.hideToast(); // Ocultar el Toast de carga
                if (roomDocSnap.exists()) {
                    // Si la sala existe, llamar a startEvaluation para iniciarla
                    startEvaluation(roomDocSnap.data(), roomDocSnap.id); 
                } else {
                    // Mostrar error si la sala no se encuentra (poco probable pero posible)
                    Toastify({
                        text: "Error: No se pudo encontrar la evaluación asignada.",
                        duration: 3000,
                        style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
                    }).showToast();
                }
            } catch (error) {
                // Manejar errores al obtener los datos de la sala
                console.error("Error al iniciar evaluación asignada:", error);
                startingToast.hideToast();
                Toastify({
                    text: "Ocurrió un error al cargar la evaluación.",
                    duration: 3000,
                    style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
                }).showToast();
            }
        }
    });
    // ================== FIN NUEVO LISTENER (FASE 23) ==================

    // Listener para los botones DENTRO de una evaluación (Siguiente, Anterior, Finalizar)
    // (FASE 23) Necesitamos delegar este listener también, ya que el contenido se renderiza dinámicamente
    evaluationSection.addEventListener('click', (e) => { // Escuchar en la sección padre
        if (e.target.id === 'next-btn') {
            saveCurrentAnswer(); // Guardar respuesta actual antes de avanzar
            currentQuestionIndex++;
            displayQuestion(); // Mostrar siguiente pregunta
        }
        if (e.target.id === 'prev-btn') {
            saveCurrentAnswer(); // Guardar respuesta actual antes de retroceder
            currentQuestionIndex--;
            displayQuestion(); // Mostrar pregunta anterior
        }
        if (e.target.id === 'finish-btn') {
             saveCurrentAnswer(); // Asegurarse de guardar la última respuesta
             handleFinishEvaluation(); // Finalizar y calificar
        }
        // (FASE 23) Si se hace clic en el botón "Ver Evaluaciones Asignadas" después de terminar
        if (e.target.id === 'back-to-assigned') {
             currentEvaluation = null;
             studentData.salaId = null;
             joinRoomSection.style.display = 'block'; // Volver a mostrar sección de código
             displayAssignedEvaluations(studentData.uid); // Recargar lista de asignadas
        }
    });
    
    // Listeners para el modal de revisión
    historyListContainer.addEventListener('click', (e) => {
        // (Lógica sin cambios)
        const historyItem = e.target.closest('.history-item');
        if (historyItem) {
            const resultId = historyItem.dataset.resultId;
            showReview(resultId);
        }
    });
    closeReviewModalBtn.addEventListener('click', closeReviewModal);
    reviewModal.addEventListener('click', (e) => {
        // (Lógica sin cambios)
        if (e.target === reviewModal) closeReviewModal();
    });

    // Carga inicial de datos al entrar al panel
    displayStudentClasses(userData.uid);        // Cargar clases inscritas
    displayAssignedEvaluations(userData.uid);   // (FASE 23) Cargar evaluaciones asignadas
    displayStudentHistory(userData.uid);        // Cargar historial
};

// --- GUARDIÁN DE RUTA ---
onAuthStateChanged(auth, async (user) => {
    // (Lógica sin cambios)
    if (user) {
        const userUid = user.uid;
        const userDocRef = doc(db, "users", userUid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = { ...userDocSnap.data(), uid: userUid };
                if (userData.rol === 'estudiante') {
                    initializePanel(userData); // Iniciar panel si es estudiante
                } else {
                    alert("Acceso no autorizado."); // Redirigir si no es estudiante
                    window.location.href = 'index.html';
                }
            } else { window.location.href = 'login.html'; } // Redirigir si no hay datos de usuario
        } catch (error) {
            console.error("Error al obtener datos:", error);
            window.location.href = 'login.html'; // Redirigir en caso de error
        }
    } else { window.location.href = 'login.html'; } // Redirigir si no hay sesión
});