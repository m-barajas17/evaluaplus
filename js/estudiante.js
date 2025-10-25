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
    updateDoc,  
    arrayUnion  
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Constante para el Spinner
const loadingSpinner = '<div class="loader-container"><div class="loader"></div></div>';

// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const userNameElement = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const joinClassForm = document.getElementById('join-class-form');
const classesListContainer = document.getElementById('classes-list');
const joinRoomForm = document.getElementById('join-room-form');
const evaluationsContainer = document.getElementById('evaluations-container'); 
const historyListContainer = document.getElementById('history-list');

// --- REFERENCIAS PARA EL MODAL DE REVISIÓN ---
const reviewModal = document.getElementById('review-modal');
const reviewModalTitle = document.getElementById('review-modal-title');
const closeReviewModalBtn = document.getElementById('close-review-modal-btn');
const reviewContentContainer = document.getElementById('review-content-container');

// --- ESTADO DEL USUARIO ---
let studentData = {
    uid: null,
    nombre: null
};

// --- LÓGICA DEL MODAL DE REVISIÓN ---
// (Esta lógica se mantiene intacta)
const closeReviewModal = () => {
    reviewModal.style.opacity = '0';
    setTimeout(() => {
        reviewModal.style.display = 'none';
    }, 300);
};

const showReview = async (resultId) => {
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


// --- LÓGICA PARA MOSTRAR HISTORIAL (CORREGIDA) ---
const displayStudentHistory = async (studentId) => {
    historyListContainer.innerHTML = loadingSpinner;
    
    // 1. LA CONSULTA (SIN orderBy)
    // Volvemos a la consulta original que solo filtra por estudiante
    const q = query(collection(db, "resultados"), where("estudianteId", "==", studentId));
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            historyListContainer.innerHTML = '<p>Aún no has completado ninguna evaluación.</p>';
            return;
        }

        // 2. ORDENACIÓN EN EL CLIENTE
        // Convertimos los documentos a un array
        const results = [];
        querySnapshot.forEach(doc => {
            results.push({ id: doc.id, ...doc.data() });
        });

        // Ordenamos el array por fecha (más reciente primero)
        // Usamos .toDate() porque 'fecha' es un Timestamp de Firebase
        results.sort((a, b) => b.fecha.toDate() - a.fecha.toDate());

        // 3. RENDERIZADO (CON LOS DATOS ORDENADOS)
        // Mapeamos el array 'results' ya ordenado
        const historyItemsHTML = await Promise.all(results.map(async (resultData) => {
            const roomDocRef = doc(db, "salas", resultData.salaId);
            const roomDocSnap = await getDoc(roomDocRef);

            let roomTitle = "Evaluación (nombre no disponible)";
            if (roomDocSnap.exists()) {
                roomTitle = roomDocSnap.data().titulo;
            }

            return `
                <div class="history-item" data-result-id="${resultData.id}">
                    <span class="history-item-title">${roomTitle}</span>
                    <span class="history-item-score">${resultData.calificacion} / ${resultData.totalPreguntas}</span>
                </div>
            `;
        }));

        historyListContainer.innerHTML = historyItemsHTML.join('');

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
    // (Lógica sin cambios)
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


// --- LÓGICA PARA MOSTRAR EVALUACIONES ASIGNADAS ---
const displayAssignedEvaluations = async (studentId) => {
    // (Lógica sin cambios)
    evaluationsContainer.innerHTML = loadingSpinner; 
    
    try {
        const classesQuery = query(collection(db, "clases"), where("estudiantesIds", "array-contains", studentId));
        const classesSnapshot = await getDocs(classesQuery);

        if (classesSnapshot.empty) {
            evaluationsContainer.innerHTML = '<p>No estás inscrito en ninguna clase. Las evaluaciones asignadas por tus docentes aparecerán aquí una vez te inscribas.</p>';
            return; 
        }

        const classIds = classesSnapshot.docs.map(doc => doc.id);

        if (classIds.length === 0) { 
             evaluationsContainer.innerHTML = '<p>Estás inscrito en clases, pero parece haber un problema al obtener sus IDs.</p>';
             return;
        }
        
        // Limite 'array-contains-any' es 30 en Firestore v10+ (subió de 10)
        const evaluationsQuery = query(collection(db, "salas"), where("clasesAsignadas", "array-contains-any", classIds));
        const evaluationsSnapshot = await getDocs(evaluationsQuery);

        if (evaluationsSnapshot.empty) {
            evaluationsContainer.innerHTML = '<p>¡Estás inscrito en clases! 🎉 Pero tus docentes aún no han asignado ninguna evaluación a ellas. Revisa más tarde.</p>';
            return;
        }

        evaluationsContainer.innerHTML = ''; 
        evaluationsSnapshot.forEach((doc) => {
            const sala = doc.data();
            const salaId = doc.id;
            const evaluationCard = document.createElement('div');
            evaluationCard.className = 'evaluation-card'; 
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

// --- LÓGICA DE UNIRSE A CLASE ---
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
            await displayStudentClasses(studentData.uid);
            await displayAssignedEvaluations(studentData.uid);
        }
    } catch (error) {
        console.error("Error al unirse a la clase:", error);
        searchingToast.hideToast();
        Toastify({ text: "Ocurrió un error al intentar unirse a la clase.", duration: 3000, style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } }).showToast();
    }
};

// --- LÓGICA DE UNIRSE A SALA POR CÓDIGO ---
const handleJoinRoom = async (e) => {
    // (Lógica modificada en el paso anterior)
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
            const roomId = roomDoc.id; 

             Toastify({
                text: `¡Unido a "${roomDoc.data().titulo}"! Abriendo evaluación...`, duration: 2000,
                style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
            }).showToast();
            
            // Redirigir a la nueva página
            window.open(`evaluacion.html?roomId=${roomId}`, '_blank');
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

    // Listener para botones de evaluaciones asignadas
    evaluationsContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('start-eval-btn')) {
            const roomId = e.target.dataset.roomId;
            
             Toastify({
                text: "Abriendo evaluación...",
                duration: 1500,
                style: { background: "linear-gradient(135deg, #38BDF8, #3730A3)" }
            }).showToast();
            
            // Redirigir a la nueva página
            window.open(`evaluacion.html?roomId=${roomId}`, '_blank');
        }
    });
    
    // Listeners para el modal de revisión
    historyListContainer.addEventListener('click', (e) => {
        const historyItem = e.target.closest('.history-item');
        if (historyItem) {
            const resultId = historyItem.dataset.resultId;
            showReview(resultId);
        }
    });
    closeReviewModalBtn.addEventListener('click', closeReviewModal);
    reviewModal.addEventListener('click', (e) => {
        if (e.target === reviewModal) closeReviewModal();
    });

    // Carga inicial de datos al entrar al panel
    displayStudentClasses(userData.uid);
    displayAssignedEvaluations(userData.uid);
    displayStudentHistory(userData.uid); // <--- Llamada a la función corregida
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
                    // =============================================
                    // ¡NUEVO! (Fase 27) Aplicar tema dinámico
                    // =============================================
                    document.body.classList.add('theme-estudiante');
                    initializePanel(userData); 
                } else {
                    // (FASE 25) Cambiado alert() por console.log y redirección simple
                    console.log("Acceso no autorizado, redirigiendo."); 
                    window.location.href = 'index.html';
                }
            } else { window.location.href = 'login.html'; } 
        } catch (error) {
            console.error("Error al obtener datos:", error);
            window.location.href = 'login.html'; 
        }
    } else { window.location.href = 'login.html'; } 
});