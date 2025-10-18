// js/script.js

// --- ¡NUEVAS IMPORTACIONES PARA LA REDIRECCIÓN INTELIGENTE! ---
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- LÓGICA ORIGINAL DE LA PÁGINA DE INICIO (DEMO INTERACTIVA) ---
document.addEventListener('DOMContentLoaded', () => {
    AOS.init({
        duration: 800,
        once: true,
        offset: 50,
    });

    feather.replace();

    const subjectTabs = document.querySelectorAll('.subject-tab');
    const questionCards = document.querySelectorAll('.question-card');

    subjectTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const currentActiveCard = document.querySelector('.question-card.active');
            if (currentActiveCard) {
                currentActiveCard.classList.remove('active');
            }
            
            subjectTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const subject = tab.dataset.subject;
            const activeQuestionCard = document.getElementById(`${subject}-q`);
            
            setTimeout(() => {
                if (activeQuestionCard) {
                    activeQuestionCard.classList.add('active');
                }
            }, 150);
        });
    });

    const questionForms = document.querySelectorAll('.question-form');
    const progressBar = document.querySelector('.progress-bar');
    let questionsAnswered = 0;
    const totalQuestions = questionForms.length;
    
    questionForms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const feedbackEl = form.querySelector('.feedback');
            const selectedOption = form.querySelector('input[type="radio"]:checked');

            if (!selectedOption) {
                feedbackEl.innerHTML = '⚠️ Por favor, selecciona una opción.';
                feedbackEl.className = 'feedback warning';
                feedbackEl.style.display = 'block';
                return;
            }

            if (!form.dataset.answered) {
                questionsAnswered++;
                const progressPercentage = (questionsAnswered / totalQuestions) * 100;
                progressBar.style.width = `${progressPercentage}%`;
                form.dataset.answered = "true";
            }

            const isCorrect = selectedOption.value === form.dataset.correct;
            let feedbackText = '';
            let feedbackIcon = isCorrect ? '✔️' : '❌';

            if (form.querySelector('input[name="q1"]')) {
                feedbackText = isCorrect ? 
                    '¡Correcto! La metáfora establece que, al igual que un faro, el amor es una guía firme y perpetua.' :
                    'Incorrecto. La respuesta correcta es la C. El faro simboliza constancia y guía frente a los desafíos.';
            } else if (form.querySelector('input[name="q2"]')) {
                feedbackText = isCorrect ?
                    '¡Excelente! El RER está cubierto de ribosomas, que son los sitios de síntesis de proteínas para exportación.' :
                    'Incorrecto. La respuesta es la B. El RER es el especialista en procesar proteínas para exportar.';
            } else if (form.querySelector('input[name="q3"]')) {
                feedbackText = isCorrect ?
                    '¡Muy bien! La división del mundo en dos bloques (OTAN y Pacto de Varsovia) fue una consecuencia directa de la Guerra Fría.' :
                    'Incorrecto. La respuesta es la D. La formación de alianzas militares fue una consecuencia directa.';
            }

            feedbackEl.className = isCorrect ? 'feedback correct' : 'feedback wrong';
            feedbackEl.innerHTML = `${feedbackIcon} ${feedbackText}`;

            feedbackEl.style.display = 'block';
            feedbackEl.style.opacity = '0';
            feedbackEl.style.transform = 'translateY(10px)';
            setTimeout(() => {
                feedbackEl.style.opacity = '1';
                feedbackEl.style.transform = 'translateY(0)';
            }, 10);
        });
    });
});

// --- ¡NUEVA LÓGICA PARA LA REDIRECCIÓN INTELIGENTE! ---
/**
 * Inicializa el sistema de redirección inteligente en la página de inicio.
 * Verifica el estado de autenticación y ajusta los enlaces de acción.
 */
// js/script.js (función actualizada)

export const initializeRedirection = () => {
    // --- Referencias a los botones ---
    // Botones genéricos
    const genericCtas = document.querySelectorAll('.cta-button'); 
    // Botones específicos de los paneles con sus nuevos IDs
    const teacherPanelBtn = document.getElementById('teacher-panel-button');
    const studentPanelBtn = document.getElementById('student-panel-button');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // --- USUARIO CON SESIÓN ACTIVA ---
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userRole = userDocSnap.data().rol;
                    
                    if (userRole === 'docente') {
                        // El usuario es DOCENTE
                        genericCtas.forEach(button => {
                            button.textContent = 'Ir a mi Panel';
                            button.href = 'docente.html';
                        });
                        teacherPanelBtn.textContent = 'Ir a mi Panel de Docente';
                        teacherPanelBtn.href = 'docente.html';
                        studentPanelBtn.textContent = 'Acceder como Estudiante';
                        studentPanelBtn.href = 'login.html'; // Lo manda al login para cambiar

                    } else if (userRole === 'estudiante') {
                        // El usuario es ESTUDIANTE
                        genericCtas.forEach(button => {
                            button.textContent = 'Ir a mi Panel';
                            button.href = 'estudiante.html';
                        });
                        studentPanelBtn.textContent = 'Ir a mi Panel de Estudiante';
                        studentPanelBtn.href = 'estudiante.html';
                        teacherPanelBtn.textContent = 'Acceder como Docente';
                        teacherPanelBtn.href = 'login.html'; // Lo manda al login para cambiar
                    }

                } else {
                    // Si no hay documento, todos al login por seguridad
                    window.location.href = 'login.html';
                }
            } catch (error) {
                console.error("Error al obtener el rol del usuario:", error);
                window.location.href = 'login.html';
            }

        } else {
            // --- USUARIO SIN SESIÓN ACTIVA ---
            // Todos los botones llevan al login
            genericCtas.forEach(button => button.href = 'login.html');
            teacherPanelBtn.href = 'login.html';
            studentPanelBtn.href = 'login.html';
        }
    });
};