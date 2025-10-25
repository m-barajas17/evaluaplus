// js/evaluacion.js

// --- IMPORTACIONES DE FIREBASE ---
import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- REFERENCIAS AL DOM ---
const userNameElement = document.getElementById('user-name');
const timerDisplay = document.getElementById('timer-display');
const timerCountdown = document.getElementById('timer-countdown');
const evaluationContent = document.getElementById('evaluation-content'); // Contenedor principal

// --- VARIABLES DE ESTADO ---
let currentEvaluation = null;     // Almacenará los datos de la sala (preguntas, etc.)
let currentQuestionIndex = 0;   // Rastreador de la pregunta actual
let studentAnswers = [];        // Array para guardar las respuestas del estudiante
let studentData = {             // Datos del estudiante autenticado
    uid: null,
    nombre: null,
    salaId: null // ID de la sala de la evaluación en curso
};
let timerInterval = null;         // Referencia al intervalo del temporizador

// --- LÓGICA DE INICIALIZACIÓN (GUARDIÁN DE RUTA Y CARGA) ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener el roomId de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');

    if (!roomId) {
        evaluationContent.innerHTML = '<h2>Error</h2><p>No se ha especificado un ID de evaluación. Por favor, cierra esta pestaña e inténtalo de nuevo.</p>';
        return;
    }
    
    studentData.salaId = roomId;

    // 2. Guardián de Ruta y Carga de Datos
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuario autenticado, verificar rol
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists() && userDocSnap.data().rol === 'estudiante') {
                // =============================================
                // ¡NUEVO! (Fase 27) Aplicar tema dinámico
                // =============================================
                document.body.classList.add('theme-estudiante');

                // Usuario es estudiante, guardar sus datos
                studentData.uid = user.uid;
                studentData.nombre = userDocSnap.data().nombre;
                userNameElement.textContent = `Estudiante: ${studentData.nombre}`;
                
                // Cargar la evaluación
                await loadEvaluationData(roomId);
            } else {
                // Rol incorrecto o usuario no encontrado
                evaluationContent.innerHTML = '<h2>Acceso Denegado</h2><p>No tienes permiso para ver esta evaluación. Por favor, inicia sesión como estudiante.</p>';
                setTimeout(() => window.location.href = 'login.html', 3000);
            }
        } else {
            // Usuario no autenticado
            evaluationContent.innerHTML = '<h2>Acceso Denegado</h2><p>Debes iniciar sesión para realizar una evaluación.</p>';
            setTimeout(() => window.location.href = 'login.html', 3000);
        }
    });
});

/**
 * Carga los datos de la sala (evaluación) desde Firestore
 * @param {string} roomId - El ID del documento de la sala
 */
async function loadEvaluationData(roomId) {
    try {
        const roomDocRef = doc(db, "salas", roomId);
        const roomDocSnap = await getDoc(roomDocRef);

        if (roomDocSnap.exists()) {
            const roomData = roomDocSnap.data();
            // Iniciar la evaluación con los datos cargados
            startEvaluation(roomData, roomId);
        } else {
            evaluationContent.innerHTML = '<h2>Error</h2><p>La evaluación que buscas no existe o ha sido eliminada.</p>';
        }
    } catch (error) {
        console.error("Error al cargar la evaluación:", error);
        evaluationContent.innerHTML = '<h2>Error</h2><p>Ocurrió un error al cargar la evaluación. Inténtalo de nuevo.</p>';
    }
}

// --- LÓGICA DE EVALUACIÓN (MIGRADA) ---

/**
 * Inicia el temporizador de la evaluación
 * (Función migrada de js/estudiante.js)
 */
function startTimer(endTime) {
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
            handleFinishEvaluation(); // Envío automático
            return;
        }

        const minutes = Math.floor((remaining / 1000 / 60) % 60);
        const seconds = Math.floor((remaining / 1000) % 60);
        timerCountdown.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (remaining < 300000) { // 5 minutos
            timerDisplay.classList.add('danger');
        } else {
             timerDisplay.classList.remove('danger');
        }
    }, 1000);
}

/**
 * Guarda la respuesta de la pregunta actual
 * (Función migrada de js/estudiante.js y ADAPTADA)
 */
const saveCurrentAnswer = () => {
    // ADAPTACIÓN: Buscar dentro de evaluationContent
    const selectedOption = evaluationContent.querySelector('input[name="question"]:checked'); 
    const shortAnswerInput = evaluationContent.querySelector('#short-answer-input'); 

    if (selectedOption) {
        studentAnswers[currentQuestionIndex] = selectedOption.value;
    } else if (shortAnswerInput) {
        studentAnswers[currentQuestionIndex] = shortAnswerInput.value.trim();
    } else {
         studentAnswers[currentQuestionIndex] = null;
    }
};

/**
 * Muestra la pregunta actual en la interfaz
 * (Función migrada de js/estudiante.js y ADAPTADA)
 */
const displayQuestion = () => {
    const questionData = currentEvaluation.questions[currentQuestionIndex];
    const savedAnswer = studentAnswers[currentQuestionIndex]; 
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
                ${currentQuestionIndex > 0 ? '<button id="prev-btn" class="cta-button secondary">Anterior</button>' : '<div></div>' /* Placeholder */}
                ${currentQuestionIndex < currentEvaluation.questions.length - 1 ? '<button id="next-btn" class="cta-button">Siguiente</button>' : ''}
                ${currentQuestionIndex === currentEvaluation.questions.length - 1 ? '<button id="finish-btn" class="cta-button">Finalizar Evaluación</button>' : ''}
            </div>
        </div>`;
    
    // ADAPTACIÓN: Renderizar dentro de evaluationContent
    evaluationContent.innerHTML = evaluationHTML; 
};

/**
 * Configura el estado inicial de la evaluación
 * (Función migrada de js/estudiante.js)
 */
const startEvaluation = (roomData, roomId) => {
    // Iniciar temporizador si existe
    if (roomData.limiteTiempo && roomData.limiteTiempo > 0) {
        const tiempoEnMilisegundos = roomData.limiteTiempo * 60 * 1000;
        const endTime = Date.now() + tiempoEnMilisegundos;
        startTimer(endTime);
    } else {
         if (timerInterval) clearInterval(timerInterval);
         timerInterval = null;
         timerDisplay.style.display = 'none';
         timerDisplay.classList.remove('danger');
    }
    
    if (!roomData.preguntas || roomData.preguntas.length === 0) {
        evaluationContent.innerHTML = `<h2>Evaluación no disponible</h2><p>Esta sala aún no tiene preguntas. Por favor, contacta a tu docente.</p>`;
        return;
    }
    
    // Configurar estado de la evaluación actual
    currentEvaluation = {
        title: roomData.titulo,
        questions: roomData.preguntas
    };
    // studentData.salaId ya se estableció al cargar la página
    studentAnswers = new Array(currentEvaluation.questions.length).fill(null); 
    currentQuestionIndex = 0; 
    
    displayQuestion(); // Mostrar la primera pregunta
};

/**
 * Finaliza la evaluación, calcula, guarda y cierra la ventana
 * (Función migrada de js/estudiante.js y ADAPTADA)
 */
const handleFinishEvaluation = async () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerDisplay.style.display = 'none';
    }

    saveCurrentAnswer(); // Guardar la última respuesta
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
        fecha: new Date() // Usar objeto Date de Firebase
    };

    try {
        await addDoc(collection(db, "resultados"), resultData);
        
        // ADAPTACIÓN: Mostrar resultado final antes de cerrar
        const resultsHTML = `
            <div class="results-container">
                <h2>¡Evaluación Completada!</h2>
                <p>Tu resultado para "${currentEvaluation.title}" ha sido guardado.</p>
                <div class="score-display">
                    <span class="score">${score}</span>
                    <span class="total">de ${currentEvaluation.questions.length}</span>
                </div>
                <p style="margin-top: 1.5rem;">Puedes cerrar esta pestaña y revisar los detalles en tu historial.</p>
            </div>`;
        evaluationContent.innerHTML = resultsHTML;

        Toastify({
            text: "¡Evaluación guardada con éxito!",
            duration: 3000,
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();
        
        // ADAPTACIÓN: Cerrar la pestaña después de un breve retraso
        setTimeout(() => {
            window.close();
        }, 3500); // 3.5 segundos para que el usuario vea el resultado

    } catch (error) {
        console.error("Error al guardar el resultado:", error);
        evaluationContent.innerHTML = `<h2>Error al guardar</h2><p>Ocurrió un error al guardar tu resultado. Por favor, no cierres esta pestaña y contacta a tu docente.</p>`;
        Toastify({
            text: "Ocurrió un error al guardar tu resultado.",
            duration: -1, // No cerrar el toast de error
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
        }).showToast();
    }
};


// --- EVENT LISTENERS (MIGRADOS) ---
evaluationContent.addEventListener('click', (e) => {
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
         saveCurrentAnswer();
         handleFinishEvaluation();
    }
});