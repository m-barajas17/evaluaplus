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
    // --- ¡NUEVA IMPORTACIÓN! ---
    // addDoc nos permite crear un nuevo documento en una colección.
    // Lo usaremos para guardar el resultado de la evaluación.
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const userNameElement = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const joinRoomForm = document.getElementById('join-room-form');
const joinRoomSection = document.getElementById('join-room-section');
const evaluationsContainer = document.getElementById('joined-rooms-list');

// --- GESTIÓN DEL ESTADO DE LA EVALUACIÓN Y DEL USUARIO ---
let currentEvaluation = null;
let currentQuestionIndex = 0;
let studentAnswers = [];
// Guardaremos los datos del estudiante para usarlos al final.
let studentData = {
    uid: null,
    nombre: null,
    salaId: null // Guardaremos el ID de la sala aquí.
};


// --- LÓGICA DE CALIFICACIÓN Y FINALIZACIÓN ---

/**
 * Se ejecuta cuando el estudiante hace clic en "Finalizar Evaluación".
 * Calcula la calificación, la guarda en Firestore y muestra el resultado.
 */
const handleFinishEvaluation = async () => {
    // 1. Guardamos la respuesta de la última pregunta.
    saveCurrentAnswer();

    // 2. Calculamos la puntuación.
    let score = 0;
    currentEvaluation.questions.forEach((question, index) => {
        // Comparamos la respuesta correcta de la pregunta con la guardada.
        if (question.correcta === studentAnswers[index]) {
            score++;
        }
    });

    // 3. Preparamos el objeto de resultado para guardarlo.
    const resultData = {
        salaId: studentData.salaId,
        estudianteId: studentData.uid,
        nombreEstudiante: studentData.nombre,
        calificacion: score,
        totalPreguntas: currentEvaluation.questions.length,
        // Guardamos las respuestas para futura referencia o revisión.
        respuestas: studentAnswers,
        fecha: new Date() // Guardamos la fecha en que se completó.
    };

    try {
        // 4. Creamos un nuevo documento en la colección 'resultados'.
        await addDoc(collection(db, "resultados"), resultData);

        // 5. Mostramos la pantalla de resultados al estudiante.
        const resultsHTML = `
            <div class="results-container">
                <h2>¡Evaluación Completada!</h2>
                <p>Este es tu resultado final para la evaluación "${currentEvaluation.title}".</p>
                <div class="score-display">
                    <span class="score">${score}</span>
                    <span class="total">de ${currentEvaluation.questions.length}</span>
                </div>
            </div>
        `;
        evaluationsContainer.innerHTML = resultsHTML;

    } catch (error) {
        console.error("Error al guardar el resultado:", error);
        alert("Ocurrió un error al guardar tu resultado. Por favor, contacta al docente.");
    }
};

// --- LÓGICA PARA RENDERIZAR LA EVALUACIÓN ---
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
        </div>
    `;
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
    // Guardamos el ID de la sala para usarlo al final.
    studentData.salaId = roomId;
    studentAnswers = new Array(currentEvaluation.questions.length).fill(null);
    currentQuestionIndex = 0;
    displayQuestion();
};

const handleJoinRoom = async (e) => {
    e.preventDefault();
    const roomCode = joinRoomForm['room-code'].value.trim().toUpperCase();
    if (!roomCode) {
        alert("Por favor, ingresa un código de sala.");
        return;
    }

    const q = query(collection(db, "salas"), where("codigoAcceso", "==", roomCode));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            alert("Código incorrecto. No se encontró ninguna sala.");
        } else {
            const roomDoc = querySnapshot.docs[0];
            // Pasamos tanto los datos de la sala como su ID.
            startEvaluation(roomDoc.data(), roomDoc.id);
        }
    } catch (error) {
        console.error("Error al buscar la sala:", error);
        alert("Ocurrió un error al intentar unirse a la sala.");
    }
};

// --- FUNCIÓN DE INICIALIZACIÓN DEL PANEL ---
const initializePanel = (userData) => {
    userNameElement.textContent = `Bienvenido, ${userData.nombre}`;
    // Guardamos los datos del estudiante en nuestra variable de estado.
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

    evaluationsContainer.addEventListener('click', (e) => {
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
        // --- ¡LÓGICA FINAL AÑADIDA! ---
        if (e.target.id === 'finish-btn') {
            // Llamamos a la función que se encarga de todo el proceso final.
            handleFinishEvaluation();
        }
    });
};

// --- GUARDIÁN DE RUTA ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userUid = user.uid;
        const userDocRef = doc(db, "users", userUid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                // Adjuntamos el UID a los datos del usuario.
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