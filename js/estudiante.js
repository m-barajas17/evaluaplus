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

// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const userNameElement = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const joinRoomForm = document.getElementById('join-room-form');
const joinRoomSection = document.getElementById('join-room-section');
const evaluationSection = document.getElementById('evaluation-section'); // Contenedor de evaluación/resultados
const evaluationsContainer = document.getElementById('evaluations-container'); // Div interno
// --- ¡NUEVA REFERENCIA PARA EL HISTORIAL! ---
const historyListContainer = document.getElementById('history-list');


// --- GESTIÓN DEL ESTADO DE LA EVALUACIÓN Y DEL USUARIO ---
let currentEvaluation = null;
let currentQuestionIndex = 0;
let studentAnswers = [];
let studentData = {
    uid: null,
    nombre: null,
    salaId: null
};

// --- ¡NUEVA LÓGICA PARA MOSTRAR HISTORIAL! ---
/**
 * Consulta el historial de evaluaciones completadas por un estudiante y las muestra en la interfaz.
 * @param {string} studentId - El UID del estudiante que ha iniciado sesión.
 */
const displayStudentHistory = async (studentId) => {
    // 1. Creamos la consulta a la colección 'resultados'.
    // Buscamos todos los documentos donde el 'estudianteId' coincida con el del usuario actual.
    const q = query(collection(db, "resultados"), where("estudianteId", "==", studentId));
    
    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyListContainer.innerHTML = '<p>Aún no has completado ninguna evaluación.</p>';
            return;
        }

        historyListContainer.innerHTML = ''; // Limpiamos el mensaje de "cargando"
        
        // 2. Iteramos sobre cada resultado encontrado.
        // Usamos un bucle for...of para poder usar 'await' dentro y esperar a que cada consulta anidada termine.
        for (const resultDoc of querySnapshot.docs) {
            const resultData = resultDoc.data();
            
            // 3. Por cada resultado, necesitamos obtener el nombre de la evaluación.
            // Para ello, usamos el 'salaId' guardado en el resultado para buscar el documento correspondiente en la colección 'salas'.
            const roomDocRef = doc(db, "salas", resultData.salaId);
            const roomDocSnap = await getDoc(roomDocRef);

            let roomTitle = "Evaluación eliminada"; // Texto por defecto si la sala ya no existe
            if (roomDocSnap.exists()) {
                roomTitle = roomDocSnap.data().titulo;
            }

            // 4. Creamos el elemento HTML para el historial y lo añadimos al contenedor.
            const historyItem = `
                <div class="history-item">
                    <span class="history-item-title">${roomTitle}</span>
                    <span class="history-item-score">${resultData.calificacion} / ${resultData.totalPreguntas}</span>
                </div>
            `;
            historyListContainer.innerHTML += historyItem;
        }

    } catch (error) {
        console.error("Error al obtener el historial:", error);
        historyListContainer.innerHTML = '<p>Ocurrió un error al cargar tu historial.</p>';
    }
};


// --- LÓGICA DE CALIFICACIÓN Y FINALIZACIÓN (Sin cambios) ---
const handleFinishEvaluation = async () => {
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
            </div>`;
        evaluationSection.innerHTML = resultsHTML; // Mostramos el resultado en el contenedor principal
        
        // ¡ACTUALIZACIÓN IMPORTANTE!
        // Después de finalizar, volvemos a cargar el historial para que se refleje la nueva evaluación completada.
        await displayStudentHistory(studentData.uid);

    } catch (error) {
        console.error("Error al guardar el resultado:", error);
        alert("Ocurrió un error al guardar tu resultado.");
    }
};

// --- LÓGICA PARA RENDERIZAR LA EVALUACIÓN (Sin cambios sustanciales) ---
const saveCurrentAnswer = () => {
    const selectedOption = document.querySelector('input[name="question"]:checked');
    if (selectedOption) {
        studentAnswers[currentQuestionIndex] = selectedOption.value;
    }
};

const displayQuestion = () => {
    const questionData = currentEvaluation.questions[currentQuestionIndex];
    const savedAnswer = studentAnswers[currentQuestionIndex];
    const optionsHTML = Object.entries(questionData.opciones).map(([key, value]) => `
        <label class="option">
            <input type="radio" name="question" value="${key}" ${savedAnswer === key ? 'checked' : ''}>
            <span><strong>${key})</strong> ${value}</span>
        </label>
    `).join('');
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
    const q = query(collection(db, "salas"), where("codigoAcceso", "==", roomCode));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            alert("Código incorrecto. No se encontró ninguna sala.");
        } else {
            const roomDoc = querySnapshot.docs[0];
            startEvaluation(roomDoc.data(), roomDoc.id);
        }
    } catch (error) {
        console.error("Error al buscar la sala:", error);
        alert("Ocurrió un error al intentar unirse a la sala.");
    }
};

// --- FUNCIÓN DE INICIALIZACIÓN DEL PANEL (ACTUALIZADA) ---
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
        }
    });

    joinRoomForm.addEventListener('submit', handleJoinRoom);

    // Se cambió el contenedor del listener para evitar conflictos
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
    
    // --- ¡LLAMADA A LA NUEVA FUNCIÓN! ---
    // En cuanto el panel se inicializa, llamamos a la función para cargar el historial.
    displayStudentHistory(userData.uid);
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
                if (userData.rol === 'estudiante') {
                    initializePanel(userData);
                } else {
                    alert("Acceso no autorizado. Esta página es solo para estudiantes.");
                    window.location.href = 'index.html';
                }
            } else {
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error("Error al obtener los datos del usuario:", error);
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});